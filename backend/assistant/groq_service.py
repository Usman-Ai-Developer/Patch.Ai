"""
Tool-calling chat loop with Groq. Instead of shipping every file in the
project on every turn, the model first sees only the file tree (paths, no
content) plus any remembered facts about the project. It can call read_file
to pull in specific files it actually needs, then finishes by calling
propose_edits with targeted old/new text replacements (or full content only
for brand-new files) rather than rewriting whole files.

This is the expensive part to get wrong, so every tool call and the final
edit proposal are validated before anything touches disk (validation lives
in file_ops.apply_patch_operations, not here).
"""
import json
import logging
import re
from django.conf import settings
from groq import Groq, BadRequestError

from . import file_ops

logger = logging.getLogger(__name__)

MAX_TOOL_ITERATIONS = 8

SYSTEM_PROMPT = """You are a senior software engineer acting as an autonomous coding assistant \
working inside an existing project. You do NOT receive the full codebase up front — only the \
file tree and a short list of remembered facts about the project.

IMPORTANT RULES – FOLLOW THEM EXACTLY:
1. **To read a file, you MUST call the `read_file` function.** Do NOT output something like `<function=read_file ...>` in your text. That will cause an error. Only call the function via the tool‑calling mechanism.
2. **To propose edits, you MUST call the `propose_edits` function.** Do NOT describe edits in plain text – call the function.
3. The file tree shows paths relative to the project root. Use these paths **exactly as shown** – do not prepend folders, do not add './' or '/'.
4. Before using 'rewrite', verify the file exists in the tree. Use 'create' for new files.
5. For 'replace' operations, the "old" text must match EXACTLY ONCE in the current file.
6. If you don't have enough context, use `read_file` to fetch specific files first.
7. If the instruction is ambiguous, doesn't require changes, or would be unsafe, respond conversationally and DO NOT call any tools.

When you have actual file modifications to propose, call `propose_edits` with the operations.
If you learn something durable about the project (its stack, conventions, prior decisions), include short one‑line entries in "facts". Don't repeat facts you've already been told.

You MUST use the provided functions to read files and propose edits. Never output function calls as plain text."""

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
                                "old": {"type": "string", "description": "Required for 'replace'. Exact unique substring to find."},
                                "new": {"type": "string", "description": "Required for 'replace'. Replacement text."},
                                "content": {"type": "string", "description": "Required for 'create'/'rewrite'. Full file content."},
                            },
                            "required": ["op", "path"],
                        },
                    },
                    "facts": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Optional short facts about the project worth remembering for future turns.",
                    },
                },
                "required": ["summary", "operations"],
            },
        },
    },
]


def _client():
    api_key = settings.GROQ_API_KEY
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not set in the environment. Please add it to your .env file.")
    try:
        return Groq(api_key=api_key)
    except TypeError as e:
        if "proxies" in str(e):
            raise RuntimeError(
                f"Groq client initialization failed due to a version mismatch: {e}. "
                "Please upgrade the groq library: pip install --upgrade groq"
            )
        raise


def _validate_operations(project, operations: list[dict]) -> tuple[bool, str]:
    """Validate operations before sending to Groq to avoid API errors."""
    if not operations:
        return True, ""

    existing_paths = set(file_ops.list_text_file_paths(project))

    for op in operations:
        op_type = op.get("op")
        path = op.get("path", "")

        if not path:
            return False, f"Missing 'path' in operation: {op}"

        if op_type in ("rewrite", "replace") and path not in existing_paths:
            return False, f"File '{path}' does not exist. Use 'create' instead of '{op_type}'."

        if op_type == "replace" and not op.get("old"):
            return False, f"Missing 'old' text for replace operation on '{path}'."

    return True, ""


def run_chat_turn(project, instruction: str, chat_history: list[dict], known_facts: list[str]) -> dict:
    """
    Runs the tool‑calling loop for one user instruction.
    Returns {"summary": str, "operations": [...], "facts": [...], "files_read": [...]}
    """
    client = _client()

    tree = file_ops.list_text_file_paths(project)
    logger.info(f"File tree for project {project.id}: {tree}")

    facts_block = "\n".join(f"- {f}" for f in known_facts) or "(none yet)"
    tree_block = "\n".join(tree) or "(empty project)"

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(chat_history)
    messages.append({
        "role": "user",
        "content": (
            f"PROJECT FILE TREE:\n{tree_block}\n\n"
            f"REMEMBERED FACTS ABOUT THIS PROJECT:\n{facts_block}\n\n"
            f"USER INSTRUCTION:\n{instruction}"
        ),
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
            # Catch tool‑validation errors and return a helpful message
            error_msg = str(e)
            if "tool call validation failed" in error_msg:
                # Try to extract the problematic path from the error (optional)
                logger.error(f"Tool validation error: {error_msg}")
                return {
                    "summary": (
                        "The AI tried to use a tool incorrectly. This may happen if the file tree is empty "
                        "or the instruction doesn't match any files. Please ensure your project has text files "
                        "and try rephrasing your request."
                    ),
                    "operations": [],
                    "facts": [],
                    "files_read": files_read,
                }
            raise  # re‑raise other API errors

        choice = response.choices[0]
        msg = choice.message

        if not msg.tool_calls:
            # Model didn't use any tool calls – treat as conversational response
            return {
                "summary": msg.content or "I didn't understand that. Could you rephrase?",
                "operations": [],
                "facts": [],
                "files_read": files_read,
            }

        messages.append({
            "role": "assistant",
            "content": msg.content or "",
            "tool_calls": [tc.model_dump() for tc in msg.tool_calls],
        })

        propose_call = next((tc for tc in msg.tool_calls if tc.function.name == "propose_edits"), None)
        if propose_call:
            try:
                args = json.loads(propose_call.function.arguments)
            except json.JSONDecodeError:
                logger.error("propose_edits args not valid JSON: %s", propose_call.function.arguments[:500])
                return {"summary": "Model returned malformed edit data.", "operations": [], "facts": [], "files_read": files_read}

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

        # Handle read_file calls
        for tc in msg.tool_calls:
            if tc.function.name != "read_file":
                continue
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

    return {
        "summary": "Reached the maximum number of file lookups without finishing. Try a more specific instruction.",
        "operations": [],
        "facts": [],
        "files_read": files_read,
    }