"""
Filesystem helpers for a project's workspace directory.
"""
import os
import time
import zipfile
from pathlib import Path
import random

from django.conf import settings
from django.db.utils import OperationalError

from .models import ProjectFile


def project_dir(project) -> Path:
    return Path(settings.PROJECTS_ROOT) / str(project.id)


def _safe_join(base: Path, relative_path: str) -> Path:
    candidate = (base / relative_path).resolve()
    base_resolved = base.resolve()
    if base_resolved not in candidate.parents and candidate != base_resolved:
        raise ValueError(f"Unsafe path rejected: {relative_path}")
    return candidate


def _retry_update_or_create(project, rel, defaults, max_retries=8, delay=0.5):
    """
    Retry update_or_create with exponential backoff and jitter on database lock errors.
    """
    for attempt in range(max_retries):
        try:
            ProjectFile.objects.update_or_create(
                project=project,
                path=rel,
                defaults=defaults,
            )
            return
        except OperationalError as e:
            if "database is locked" in str(e) and attempt < max_retries - 1:
                wait = delay * (2 ** attempt) + random.uniform(0, 0.2)
                print(f"[WARNING] Database locked in file_ops, retrying in {wait:.2f}s... (attempt {attempt+1}/{max_retries})")
                time.sleep(wait)
                continue
            raise


def write_loose_files(project, uploaded_files) -> list[str]:
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
    base = project_dir(project)
    base.mkdir(parents=True, exist_ok=True)

    written = []
    with zipfile.ZipFile(zip_file) as zf:
        for raw_member in zf.namelist():
            # Normalise to POSIX separators and strip "./" so the paths we
            # record match what the API expects (?path=a/b.txt) even for
            # archives created on Windows with backslash separators.
            member = raw_member.replace("\\", "/")
            while member.startswith("./"):
                member = member[2:]
            if not member or member.endswith("/") or member.startswith("__MACOSX"):
                continue
            target = _safe_join(base, member)
            target.parent.mkdir(parents=True, exist_ok=True)
            with zf.open(raw_member) as src, open(target, "wb") as dst:
                dst.write(src.read())
            written.append(member)
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
        _retry_update_or_create(
            project,
            rel,
            {"size_bytes": size, "is_binary": is_binary},
        )


def full_sync_project_files(project, relative_paths: list[str]):
    """
    Sync the ProjectFile table with the actual files on disk.
    Adds new files, updates existing ones, and deletes records for files that no longer exist.
    """
    base = project_dir(project)
    # Get current set of files from database
    existing_paths = set(ProjectFile.objects.filter(project=project).values_list('path', flat=True))
    # Convert relative_paths to set (files found on disk)
    disk_paths = set(relative_paths)
    # Paths to delete: existing - disk
    to_delete = existing_paths - disk_paths
    if to_delete:
        ProjectFile.objects.filter(project=project, path__in=to_delete).delete()

    # Now add/update the rest
    for rel in relative_paths:
        full = base / rel
        if not full.exists():
            continue
        ext = full.suffix.lower()
        is_binary = ext not in settings.ALLOWED_TEXT_EXTENSIONS
        size = full.stat().st_size
        _retry_update_or_create(
            project,
            rel,
            {"size_bytes": size, "is_binary": is_binary},
        )


def read_text_files_for_context(project) -> dict[str, str]:
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
    qs = ProjectFile.objects.filter(project=project, is_binary=False).order_by("path")
    return [pf.path for pf in qs[: settings.MAX_FILES_PER_PROJECT]]


def read_single_file(project, rel_path: str) -> str | None:
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


def get_relevant_files(project, instruction: str, top_k: int = 5) -> list[str]:
    """
    Rank the project's text files by relevance to a natural-language instruction,
    using TF-IDF over each file's path + content, and return the top_k paths.
    Falls back to an empty list if there isn't enough content to rank, or if the
    instruction has no meaningful overlap with any file.
    """
    if not instruction or not instruction.strip():
        return []

    contents = read_text_files_for_context(project)
    if not contents:
        return []

    paths = list(contents.keys())
    if len(paths) <= top_k:
        return paths

    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.metrics.pairwise import cosine_similarity
    except ImportError:
        # scikit-learn isn't available; degrade gracefully instead of erroring
        # out the whole chat turn.
        return paths[:top_k]

    documents = [f"{path}\n{content}" for path, content in contents.items()]

    try:
        vectorizer = TfidfVectorizer(stop_words="english", max_features=20000)
        doc_vectors = vectorizer.fit_transform(documents + [instruction])
    except ValueError:
        # e.g. instruction/content is entirely stop words -> empty vocabulary
        return []

    instruction_vector = doc_vectors[-1]
    file_vectors = doc_vectors[:-1]
    scores = cosine_similarity(instruction_vector, file_vectors)[0]

    ranked = sorted(zip(paths, scores), key=lambda pair: pair[1], reverse=True)
    return [path for path, score in ranked[:top_k] if score > 0]


def apply_patch_operations(project, operations: list[dict]) -> tuple[list[dict], list[dict]]:
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
            if target.exists() and target.is_dir():
                failed.append({**op, "reason": f"target is a directory, cannot create file: {path}"})
                continue
            if target.parent.exists() and not target.parent.is_dir():
                failed.append({**op, "reason": f"parent is a file, cannot create file: {path}"})
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding="utf-8")
            _touch_project_file(project, path, content)
            applied.append({"op": "create", "path": path})

        elif action == "rewrite":
            content = op.get("content", "")
            if target.exists() and target.is_dir():
                failed.append({**op, "reason": f"target is a directory, cannot rewrite file: {path}"})
                continue
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
            if target.is_dir():
                failed.append({**op, "reason": "target is a directory, cannot replace"})
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
                if target.is_dir():
                    failed.append({**op, "reason": "cannot delete directories, only files"})
                    continue
                os.remove(target)
            ProjectFile.objects.filter(project=project, path=path).delete()
            applied.append({"op": "delete", "path": path})

        else:
            failed.append({**op, "reason": f"unknown op '{action}'"})

    return applied, failed


def _touch_project_file(project, path, content):
    _retry_update_or_create(
        project,
        path,
        {"size_bytes": len(content.encode("utf-8")), "is_binary": False},
    )


def apply_operations(project, operations: list[dict]) -> list[dict]:
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
            _retry_update_or_create(
                project,
                path,
                {"size_bytes": len(content.encode("utf-8")), "is_binary": False},
            )
            applied.append({"op": action, "path": path})

        elif action == "delete":
            if target.exists():
                os.remove(target)
            ProjectFile.objects.filter(project=project, path=path).delete()
            applied.append({"op": "delete", "path": path})

    return applied


def compute_operation_diff(project, operation: dict) -> dict:
    """
    Compute a diff for a single operation without applying it.
    Returns: dict with 'old', 'new', and optionally 'error'.
    """
    action = operation.get("op")
    path = operation.get("path")
    if not path:
        return {"old": "", "new": "", "error": "Missing path"}

    base = project_dir(project)
    try:
        target = _safe_join(base, path)
    except ValueError:
        return {"old": "", "new": "", "error": "Unsafe path"}

    old_content = ""
    new_content = ""
    error = None

    if action == "create":
        new_content = operation.get("content", "")
        old_content = ""
    elif action == "delete":
        if target.exists() and not target.is_dir():
            old_content = target.read_text(encoding="utf-8", errors="ignore")
        new_content = ""
    elif action == "rewrite":
        if target.exists() and not target.is_dir():
            old_content = target.read_text(encoding="utf-8", errors="ignore")
        new_content = operation.get("content", "")
    elif action == "replace":
        if target.exists() and not target.is_dir():
            old_content = target.read_text(encoding="utf-8", errors="ignore")
        else:
            old_content = ""
        old_text = operation.get("old", "")
        new_text = operation.get("new", "")
        if old_content and old_text:
            count = old_content.count(old_text)
            if count == 1:
                new_content = old_content.replace(old_text, new_text, 1)
            elif count == 0:
                new_content = old_content
                error = f"Old text not found in '{path}'"
            else:
                new_content = old_content
                error = f"Old text matched {count} times, not unique"
        else:
            new_content = old_content
            if not old_text:
                error = "Missing 'old' text for replace"
    else:
        return {"old": "", "new": "", "error": f"Unknown op {action}"}

    return {"old": old_content, "new": new_content, "error": error}


def snapshot_paths(project, operations: list[dict]) -> dict[str, dict]:
    """Capture the on-disk state of every path an operation touches.

    Used to make "apply" all-or-nothing: if one operation fails, the writes
    already performed must be undone instead of being left behind (the
    message would otherwise be marked failed and could never be re-applied).
    """
    base = project_dir(project)
    snapshots: dict[str, dict] = {}
    for op in operations:
        path = op.get("path")
        if not path:
            continue
        try:
            target = _safe_join(base, path)
        except ValueError:
            continue
        if target.exists() and target.is_file():
            snapshots[path] = {"exists": True, "content": target.read_bytes()}
        else:
            snapshots[path] = {"exists": False, "content": None}
    return snapshots


def restore_paths(project, snapshots: dict[str, dict]) -> None:
    """Undo a partially applied patch set using a `snapshot_paths` result."""
    base = project_dir(project)
    for path, snapshot in snapshots.items():
        try:
            target = _safe_join(base, path)
        except ValueError:
            continue
        content = snapshot.get("content") or b""
        if snapshot.get("exists"):
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(content)
            _retry_update_or_create(
                project,
                path,
                {"size_bytes": len(content), "is_binary": False},
            )
        else:
            if target.exists() and target.is_file():
                os.remove(target)
            ProjectFile.objects.filter(project=project, path=path).delete()