"""
Syntax-checks JS/JSX/TS/TSX content before the builder writes it to a
project's workspace. Used by file_ops.apply_patch_operations so that a
malformed AI-generated edit (e.g. `future={ a: 1 }` instead of
`future={{ a: 1 }}`) gets rejected - and reported back to the model as a
failed operation - instead of being written straight to disk and only
surfacing later as a Vite/webpack crash at preview time.

This intentionally only checks syntax (via esbuild's parser), not types
and not lint rules - it's a "does this even parse" gate, not a linter.
"""
import json
import logging
import shutil
import subprocess
from pathlib import Path

logger = logging.getLogger(__name__)

VALIDATOR_SCRIPT = Path(__file__).parent / "js_validate" / "validate.js"

# Extension -> esbuild loader. Anything not in this map is skipped
# entirely (e.g. .py, .html, .css, .json, .md) - only these file types
# go through the JS/TS parser.
LOADER_BY_EXT = {
    ".js": "jsx",   # generated projects routinely put JSX in .js files
    ".jsx": "jsx",
    ".ts": "ts",
    ".tsx": "tsx",
    ".mjs": "jsx",
    ".cjs": "jsx",
}

VALIDATION_TIMEOUT_SECONDS = 10


def is_checkable(path: str) -> bool:
    return Path(path).suffix.lower() in LOADER_BY_EXT


def check_js_syntax(path: str, content: str) -> tuple[bool, str | None]:
    """
    Returns (is_valid, error_message).

    - Non-JS/TS files, or anything we can't actually run the check for
      (node missing, esbuild not installed, unexpected failure), return
      (True, None) - we fail OPEN so a missing/broken validator setup
      never blocks the builder from writing files. Real syntax errors
      in JS/JSX/TS/TSX content return (False, "<message>").
    """
    ext = Path(path).suffix.lower()
    loader = LOADER_BY_EXT.get(ext)
    if not loader:
        return True, None

    if not VALIDATOR_SCRIPT.exists():
        logger.warning("JS syntax validator script missing at %s; skipping check", VALIDATOR_SCRIPT)
        return True, None

    node_exe = shutil.which("node")
    if not node_exe:
        logger.warning("node not found on PATH; skipping JS/JSX syntax check for %s", path)
        return True, None

    try:
        result = subprocess.run(
            [node_exe, str(VALIDATOR_SCRIPT), loader],
            input=content,
            capture_output=True,
            text=True,
            timeout=VALIDATION_TIMEOUT_SECONDS,
        )
    except subprocess.TimeoutExpired:
        logger.warning("JS syntax check timed out for %s; skipping check", path)
        return True, None
    except Exception as e:
        logger.warning("JS syntax check failed to run for %s (%s); skipping check", path, e)
        return True, None

    if result.returncode == 0:
        return True, None

    if result.returncode == 2:
        # Validator couldn't run (esbuild not installed, etc) - fail open,
        # but log loudly since this means the check isn't protecting anyone.
        logger.warning(
            "JS syntax validator unavailable (%s); run `npm install` in %s to enable it. Skipping check for %s.",
            result.stdout.strip() or result.stderr.strip(),
            VALIDATOR_SCRIPT.parent,
            path,
        )
        return True, None

    # returncode == 1: a genuine syntax error.
    try:
        info = json.loads(result.stdout.strip() or "{}")
    except json.JSONDecodeError:
        info = {}

    message = info.get("message") or "Syntax error"
    loc_bits = []
    if info.get("line") is not None:
        loc_bits.append(f"line {info['line']}")
    if info.get("column") is not None:
        loc_bits.append(f"column {info['column']}")
    location = f" ({', '.join(loc_bits)})" if loc_bits else ""
    snippet = f"\n  {info['snippet'].strip()}" if info.get("snippet") else ""

    return False, f"{message}{location}{snippet}"