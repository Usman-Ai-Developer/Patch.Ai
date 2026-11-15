"""
Tool-calling chat loop with Groq – with repository intelligence (TF‑IDF).
"""
import json
import logging
import re
import subprocess
from django.conf import settings
from groq import Groq, BadRequestError

from . import file_ops

logger = logging.getLogger(__name__)

MAX_TOOL_ITERATIONS = 8

SYSTEM_PROMPT = """You are a senior software engineer acting as an autonomous coding assistant.

You have access to THREE tools:

1. `read_file(path)` – read the content of a file.
2. `propose_edits(summary, operations, facts)` – propose file edits (create, rewrite, replace, delete).
3. `run_command(command)` – execute a shell command inside the project workspace.

## WHEN TO USE EACH TOOL

### Use `run_command` for:
- **Scaffolding** – creating a new project (e.g., `django-admin startproject`, `npx create-react-app`, `flutter create`, `dotnet new`).
- **Installing dependencies** – `pip install`, `npm install`, `bundle install`, etc.
- **Running migrations** – `python manage.py migrate`, `npx prisma migrate dev`.
- **Building, testing, or running** – `npm run build`, `pytest`, `flutter test`.
- **Any command that generates many files** – it's faster, more reliable, and avoids token limits.

### Use `propose_edits` for:
- **Modifying existing files** – adding a function, changing a variable, fixing a bug.
- **Creating a single file** – if you need to add a small file (e.g., a new config file) and the project already exists.
- **Making targeted changes** – where you know exactly which lines to change.
- **When you are unsure** – prefer `run_command` for scaffolding and `propose_edits` for precise edits.

### General rule:
- If the task is about *building a new project structure* → use `run_command`.
- If the task is about *changing code within an existing project* → use `propose_edits`.

## RELEVANT FILES
The user's instruction is preceded by a list of "RELEVANT FILES" that are likely to be needed.
- Start by reading those files using `read_file` if they exist and are relevant to the instruction.
- If the instruction is about adding something new (e.g., a new page, a new feature), you may still need to read related files (like `urls.py` or `views.py`) to understand the project structure.
- The list is a suggestion, not a restriction – you can read any file you need.

## OPERATION TYPES FOR propose_edits
- `"create"` – brand‑new file (requires `path` and `content`).
- `"rewrite"` – full rewrite of an existing file (requires `path` and `content`).
- `"replace"` – targeted replacement (requires `path`, `old`, and `new`).
- `"delete"` – remove a file (requires `path`).

## IMPORTANT
- NEVER output a function call as plain text like `<function=...>`. Use the provided tool‑calling mechanism.
- If the instruction is just a question or greeting, respond conversationally – do NOT call any tools.
- Only call `propose_edits` when you have actual file modifications to propose.

Remember: the three tools are `read_file`, `propose_edits`, and `run_command`. Choose wisely based on the task."""

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Fetch the current full content of one file in the project by its path.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Relative path exactly as shown in the file tree."}
                },
                "required": ["path"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "propose_edits",
            "description": "Finalize your changes. Call this ONLY when you have actual file changes to make.",
            "parameters": {
                "type": "object",
                "properties": {
                    "summary": {"type": "string", "description": "One or two sentences describing what changed and why."},
                    "operations": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "op": {"type": "string", "enum": ["replace", "create", "rewrite", "delete"]},
                                "path": {"type": "string"},
                                "old": {"type": "string", "description": "Required for 'replace'."},
                                "new": {"type": "string", "description": "Required for 'replace'."},
                                "content": {"type": "string", "description": "Required for 'create'/'rewrite'."},
                            },
                            "required": ["op", "path"],
                        },
                    },
                    "facts": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Optional short facts about the project.",
                    },
                },
                "required": ["summary", "operations"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "run_command",
            "description": "Run a shell command inside the project workspace. Use this for scaffolding, installing dependencies, migrations, etc.",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "The shell command to execute (e.g., 'npm install', 'django-admin startproject myproject')"
                    }
                },
                "required": ["command"],
            },
        },
    },
]

def _client():
    api_key = settings.GROQ_API_KEY
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not set.")
    try:
        return Groq(api_key=api_key)
    except TypeError as e:
        if "proxies" in str(e):
            raise RuntimeError("Upgrade groq: pip install --upgrade groq")
        raise

def _extract_function_call(content: str):
    """Extract function call from plain‑text in various formats."""
    # propose_edits
    match = re.search(r'<function=propose_edits>(.*?)</function>', content, re.DOTALL)
    if match:
        try:
            args = json.loads(match.group(1))
            return {"name": "propose_edits", "arguments": args}
        except json.JSONDecodeError:
            pass

    # read_file
    match = re.search(r'<function=read_file>(.*?)</function>', content, re.DOTALL)
    if match:
        body = match.group(1).strip()
        try:
            args = json.loads(body)
            if "path" in args:
                return {"name": "read_file", "arguments": args}
        except json.JSONDecodeError:
            pass
        if body.startswith("path="):
            path = body[5:].strip()
            return {"name": "read_file", "arguments": {"path": path}}
        return {"name": "read_file", "arguments": {"path": body}}

    # run_command
    match = re.search(r'<function=run_command>(.*?)</function>', content, re.DOTALL)
    if match:
        body = match.group(1).strip()
        try:
            args = json.loads(body)
            if "command" in args:
                return {"name": "run_command", "arguments": args}
        except json.JSONDecodeError:
            pass
        if body.startswith("command="):
            command = body[8:].strip()
            return {"name": "run_command", "arguments": {"command": command}}
        return {"name": "run_command", "arguments": {"command": body}}

    return None

def _validate_operations(project, operations: list[dict]) -> tuple[bool, str]:
    if not operations:
        return True, ""

    existing_paths = set(file_ops.list_text_file_paths(project))
    workspace = file_ops.project_dir(project)

    for op in operations:
        op_type = op.get("op")
        path = op.get("path", "")
        if not path:
            return False, f"Missing 'path' in operation: {op}"

        if op_type in ("create", "rewrite"):
            full_path = workspace / path
            if full_path.exists() and full_path.is_dir():
                return False, f"Path '{path}' is a directory, cannot create/rewrite a file over it"

        if op_type in ("rewrite", "replace") and path not in existing_paths:
            return False, f"File '{path}' does not exist. Use 'create' instead of '{op_type}'."

        if op_type == "replace" and not op.get("old"):
            return False, f"Missing 'old' text for replace operation on '{path}'."

    return True, ""

def run_chat_turn(project, instruction: str, chat_history: list[dict], known_facts: list[str]) -> dict:
    client = _client()

    tree = file_ops.list_text_file_paths(project)
    logger.info(f"File tree for project {project.id}: {tree}")

    facts_block = "\n".join(f"- {f}" for f in known_facts) or "(none yet)"
    tree_block = "\n".join(tree) or "(empty project)"

    # ─── Phase 10: Retrieve relevant files ────────────────────────────
    relevant = file_ops.get_relevant_files(project, instruction, top_k=5)
    relevant_block = "\n".join(f"- {p}" for p in relevant) if relevant else "(none detected)"

    user_content = (
        f"PROJECT FILE TREE:\n{tree_block}\n\n"
        f"REMEMBERED FACTS:\n{facts_block}\n\n"
        f"RELEVANT FILES (based on your instruction):\n{relevant_block}\n\n"
        f"INSTRUCTION:\n{instruction}"
    )

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(chat_history)
    messages.append({
        "role": "user",
        "content": user_content,
    })

    files_read = []

    for _ in range(MAX_TOOL_ITERATIONS):
        try:
            response = client.chat.completions.create(
                model=settings.GROQ_MODEL,
                messages=messages,
                tools=TOOLS,
                tool_choice="auto",
                temperature=0.1,
                max_tokens=4000,
            )
        except BadRequestError as e:
            error_msg = str(e)
            if "tool call validation failed" in error_msg or "Failed to call a function" in error_msg:
                logger.error(f"Tool validation error: {error_msg}")
                if "failed_generation" in error_msg:
                    extracted = _extract_function_call(error_msg)
                    if extracted:
                        if extracted["name"] == "read_file":
                            path = extracted["arguments"].get("path", "")
                            content = file_ops.read_single_file(project, path) if path else None
                            if content is None:
                                result = f"Error: Could not read '{path}'. Check the path against the file tree."
                            else:
                                files_read.append(path)
                                result = content
                            messages.append({
                                "role": "tool",
                                "tool_call_id": "fallback",
                                "content": result,
                            })
                            continue
                        elif extracted["name"] == "propose_edits":
                            args = extracted["arguments"]
                            args.setdefault("operations", [])
                            args.setdefault("facts", [])
                            args["files_read"] = files_read
                            is_valid, err_msg = _validate_operations(project, args.get("operations", []))
                            if is_valid:
                                return args
                        elif extracted["name"] == "run_command":
                            command = extracted["arguments"].get("command", "")
                            workspace = file_ops.project_dir(project)
                            try:
                                proc = subprocess.run(
                                    command,
                                    shell=True,
                                    cwd=str(workspace),
                                    capture_output=True,
                                    text=True,
                                    timeout=30,
                                )
                                output = proc.stdout + proc.stderr
                                if proc.returncode != 0:
                                    output = f"Error (code {proc.returncode}):\n{output}"
                            except Exception as exc:
                                output = f"Failed to run command: {str(exc)}"
                            messages.append({
                                "role": "tool",
                                "tool_call_id": "fallback",
                                "content": output,
                            })
                            continue
                return {
                    "summary": (
                        "The AI tried to use a tool incorrectly. Please ensure you are only using "
                        "the provided tools: read_file, propose_edits, and run_command."
                    ),
                    "operations": [],
                    "facts": [],
                    "files_read": files_read,
                }
            raise

        choice = response.choices[0]
        msg = choice.message

        if msg.tool_calls:
            messages.append({
                "role": "assistant",
                "content": msg.content or "",
                "tool_calls": [tc.model_dump() for tc in msg.tool_calls],
            })
        else:
            content = msg.content or ""
            logger.info(f"No tool calls, raw content: {content[:500]}")
            extracted = _extract_function_call(content)
            if extracted:
                if extracted["name"] == "read_file":
                    path = extracted["arguments"].get("path", "")
                    content = file_ops.read_single_file(project, path) if path else None
                    if content is None:
                        result = f"Error: Could not read '{path}'. Check the path against the file tree."
                    else:
                        files_read.append(path)
                        result = content
                    messages.append({
                        "role": "tool",
                        "tool_call_id": "fallback",
                        "content": result,
                    })
                    continue
                elif extracted["name"] == "propose_edits":
                    args = extracted["arguments"]
                    args.setdefault("operations", [])
                    args.setdefault("facts", [])
                    args["files_read"] = files_read
                    is_valid, err_msg = _validate_operations(project, args.get("operations", []))
                    if is_valid:
                        return args
                    else:
                        messages.append({
                            "role": "tool",
                            "tool_call_id": "fallback",
                            "content": f"Error: {err_msg}",
                        })
                        continue
                elif extracted["name"] == "run_command":
                    command = extracted["arguments"].get("command", "")
                    workspace = file_ops.project_dir(project)
                    try:
                        proc = subprocess.run(
                            command,
                            shell=True,
                            cwd=str(workspace),
                            capture_output=True,
                            text=True,
                            timeout=30,
                        )
                        output = proc.stdout + proc.stderr
                        if proc.returncode != 0:
                            output = f"Error (code {proc.returncode}):\n{output}"
                    except Exception as exc:
                        output = f"Failed to run command: {str(exc)}"
                    messages.append({
                        "role": "tool",
                        "tool_call_id": "fallback",
                        "content": output,
                    })
                    continue
            else:
                return {
                    "summary": content or "I don't understand. Could you rephrase?",
                    "operations": [],
                    "facts": [],
                    "files_read": files_read,
                }

        # Process tool calls normally
        propose_call = next((tc for tc in msg.tool_calls if tc.function.name == "propose_edits"), None)
        if propose_call:
            try:
                args = json.loads(propose_call.function.arguments)
            except json.JSONDecodeError:
                logger.error("propose_edits args not valid JSON: %s", propose_call.function.arguments[:500])
                return {"summary": "Malformed edit data.", "operations": [], "facts": [], "files_read": files_read}

            args.setdefault("operations", [])
            args.setdefault("facts", [])
            args["files_read"] = files_read

            is_valid, err_msg = _validate_operations(project, args.get("operations", []))
            if not is_valid:
                return {
                    "summary": f"Cannot apply edits: {err_msg}. Please adjust and try again.",
                    "operations": [],
                    "facts": [],
                    "files_read": files_read,
                }

            return args

        # Handle read_file
        for tc in msg.tool_calls:
            if tc.function.name == "read_file":
                try:
                    args = json.loads(tc.function.arguments)
                    path = args.get("path", "")
                except json.JSONDecodeError:
                    path = ""
                content = file_ops.read_single_file(project, path) if path else None
                if content is None:
                    result = f"Error: Could not read '{path}'. Check the path against the file tree."
                else:
                    files_read.append(path)
                    result = content
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": result,
                })
            elif tc.function.name == "run_command":
                try:
                    args = json.loads(tc.function.arguments)
                    command = args.get("command", "")
                except json.JSONDecodeError:
                    command = ""
                workspace = file_ops.project_dir(project)
                try:
                    proc = subprocess.run(
                        command,
                        shell=True,
                        cwd=str(workspace),
                        capture_output=True,
                        text=True,
                        timeout=30,
                    )
                    output = proc.stdout + proc.stderr
                    if proc.returncode != 0:
                        output = f"Error (code {proc.returncode}):\n{output}"
                except Exception as exc:
                    output = f"Failed to run command: {str(exc)}"
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": output,
                })

    return {
        "summary": "Reached the maximum number of tool calls without finishing. Try a more specific instruction.",
        "operations": [],
        "facts": [],
        "files_read": files_read,
    }