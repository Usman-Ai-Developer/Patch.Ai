"""
Filesystem helpers for a project's workspace directory. Every path is
validated to stay inside the project's own folder — never trust a path
coming back from the LLM without checking it first.
"""
import os
import zipfile
from pathlib import Path

from django.conf import settings

from .models import ProjectFile


def project_dir(project) -> Path:
    return Path(settings.PROJECTS_ROOT) / str(project.id)


def _safe_join(base: Path, relative_path: str) -> Path:
    """Resolve relative_path under base and reject any attempt to escape it
    (e.g. '../../etc/passwd')."""
    candidate = (base / relative_path).resolve()
    base_resolved = base.resolve()
    if base_resolved not in candidate.parents and candidate != base_resolved:
        raise ValueError(f"Unsafe path rejected: {relative_path}")
    return candidate


def write_loose_files(project, uploaded_files) -> list[str]:
    """Writes individually-attached files (not inside a zip) straight into
    the project workspace. Browsers only send a bare filename for a normal
    multi-file picker/drop (no folder structure), so these land at the
    project root unless the filename itself contains path separators."""
    base = project_dir(project)
    base.mkdir(parents=True, exist_ok=True)
    written = []
    for f in uploaded_files:
        rel = getattr(f, "name", "") or ""
        if not rel:
            continue
        try:
            target = _safe_join(base, rel)
        except ValueError:
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        with open(target, "wb") as dst:
            for chunk in f.chunks():
                dst.write(chunk)
        written.append(rel)
    return written


def extract_zip_to_workspace(project, zip_file) -> list[str]:
    """Extracts an uploaded zip into the project's workspace dir.
    Returns list of relative paths written."""
    base = project_dir(project)
    base.mkdir(parents=True, exist_ok=True)

    written = []
    with zipfile.ZipFile(zip_file) as zf:
        for member in zf.namelist():
            if member.endswith("/") or member.startswith("__MACOSX"):
                continue
            target = _safe_join(base, member)
            target.parent.mkdir(parents=True, exist_ok=True)
            with zf.open(member) as src, open(target, "wb") as dst:
                dst.write(src.read())
            written.append(str(Path(member)))
    return written


def sync_project_files_table(project, relative_paths: list[str]):
    base = project_dir(project)
    for rel in relative_paths:
        full = base / rel
        if not full.exists():
            continue
        ext = full.suffix.lower()
        is_binary = ext not in settings.ALLOWED_TEXT_EXTENSIONS
        size = full.stat().st_size
        ProjectFile.objects.update_or_create(
            project=project,
            path=rel,
            defaults={"size_bytes": size, "is_binary": is_binary},
        )


def read_text_files_for_context(project) -> dict[str, str]:
    """Reads all reasonably-sized text files for sending to the LLM.
    Kept around for the initial full-rewrite flow / fallback, but the
    tool-calling flow below should be preferred since it only fetches
    files the model actually asks for."""
    base = project_dir(project)
    contents = {}
    qs = ProjectFile.objects.filter(project=project, is_binary=False).order_by("path")
    for pf in qs[: settings.MAX_FILES_PER_PROJECT]:
        full = base / pf.path
        if not full.exists() or full.stat().st_size > settings.MAX_FILE_BYTES:
            continue
        try:
            contents[pf.path] = full.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
    return contents


def list_text_file_paths(project) -> list[str]:
    """Paths only, no content — this is what gets sent to the model up front
    so it can decide what to ask for, instead of receiving every file."""
    qs = ProjectFile.objects.filter(project=project, is_binary=False).order_by("path")
    return [pf.path for pf in qs[: settings.MAX_FILES_PER_PROJECT]]


def read_single_file(project, rel_path: str) -> str | None:
    """Used by the read_file tool during the chat loop. Returns None if the
    path is unsafe, missing, or too large to be worth sending."""
    # Normalise the path: remove leading './', '/', backslashes, extra spaces
    rel_path = rel_path.strip().replace("\\", "/")
    if rel_path.startswith("./"):
        rel_path = rel_path[2:]
    if rel_path.startswith("/"):
        rel_path = rel_path[1:]

    base = project_dir(project)
    try:
        target = _safe_join(base, rel_path)
    except ValueError:
        return None
    if not target.exists() or not target.is_file():
        return None
    if target.stat().st_size > settings.MAX_FILE_BYTES:
        return f"<file too large to include: {target.stat().st_size} bytes>"
    try:
        return target.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return None


def apply_patch_operations(project, operations: list[dict]) -> tuple[list[dict], list[dict]]:
    """Applies operations using targeted old-text -> new-text replacement
    instead of full-file rewrites, which is what actually saves output tokens.

    Supported ops:
      - replace: {"op": "replace", "path": ..., "old": ..., "new": ...}
                 old must match EXACTLY ONCE in the current file content.
      - create:  {"op": "create", "path": ..., "content": ...}
      - rewrite: {"op": "rewrite", "path": ..., "content": ...}  (escape hatch
                 for cases where a targeted replace isn't practical)
      - delete:  {"op": "delete", "path": ...}

    Returns (applied, failed) — failed entries include a reason so the caller
    can retry with more context if it wants to.
    """
    base = project_dir(project)
    base.mkdir(parents=True, exist_ok=True)
    applied, failed = [], []

    for op in operations:
        action = op.get("op")
        path = op.get("path")
        if not action or not path:
            failed.append({**op, "reason": "missing op or path"})
            continue

        try:
            target = _safe_join(base, path)
        except ValueError:
            failed.append({**op, "reason": "unsafe path"})
            continue

        if action == "create":
            content = op.get("content", "")
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding="utf-8")
            _touch_project_file(project, path, content)
            applied.append({"op": "create", "path": path})

        elif action == "rewrite":
            content = op.get("content", "")
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding="utf-8")
            _touch_project_file(project, path, content)
            applied.append({"op": "rewrite", "path": path})

        elif action == "replace":
            old = op.get("old", "")
            new = op.get("new", "")
            if not target.exists():
                failed.append({**op, "reason": "file does not exist, use 'create' instead"})
                continue
            current = target.read_text(encoding="utf-8", errors="ignore")
            count = current.count(old)
            if count == 0:
                failed.append({**op, "reason": "old text not found in file (may be stale/whitespace mismatch)"})
                continue
            if count > 1:
                failed.append({**op, "reason": f"old text matched {count} times, not unique — include more surrounding context"})
                continue
            updated = current.replace(old, new, 1)
            target.write_text(updated, encoding="utf-8")
            _touch_project_file(project, path, updated)
            applied.append({"op": "replace", "path": path})

        elif action == "delete":
            if target.exists():
                os.remove(target)
            ProjectFile.objects.filter(project=project, path=path).delete()
            applied.append({"op": "delete", "path": path})

        else:
            failed.append({**op, "reason": f"unknown op '{action}'"})

    return applied, failed


def _touch_project_file(project, path, content):
    ProjectFile.objects.update_or_create(
        project=project,
        path=path,
        defaults={"size_bytes": len(content.encode("utf-8")), "is_binary": False},
    )


def apply_operations(project, operations: list[dict]) -> list[dict]:
    """Applies create/update/delete ops from the LLM to disk. Returns the
    same list of ops (for storing on the ChatMessage as a change log)."""
    base = project_dir(project)
    base.mkdir(parents=True, exist_ok=True)
    applied = []

    for op in operations:
        action = op.get("op")
        path = op.get("path")
        if not action or not path:
            continue

        try:
            target = _safe_join(base, path)
        except ValueError:
            continue

        if action in ("create", "update"):
            content = op.get("content", "")
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding="utf-8")
            ProjectFile.objects.update_or_create(
                project=project,
                path=path,
                defaults={"size_bytes": len(content.encode("utf-8")), "is_binary": False},
            )
            applied.append({"op": action, "path": path})

        elif action == "delete":
            if target.exists():
                os.remove(target)
            ProjectFile.objects.filter(project=project, path=path).delete()
            applied.append({"op": "delete", "path": path})

    return applied