# backend/preview/process_registry.py
"""
Replaces the old module-level `_running_servers = {}` dict in
preview/views.py.

That dict lived in exactly one Python process's memory. Anything that
breaks the assumption "there's only ever one worker process, and it never
restarts" broke it silently:
  - A second gunicorn/uwsgi worker has its own empty dict, so it doesn't
    know a preview is running and can start a duplicate on the same port
    (or fail confusingly when the port's already taken).
  - A worker reload (code push, `--reload`, OOM restart) wipes the dict.
    The subprocess is still running and holding its port, but the app now
    reports `running: False` and orphans it — it's never cleaned up until
    someone kills it by hand.

None of that requires actually recovering the subprocess.Popen object
(which genuinely can't survive a process boundary). It only requires
knowing the pid and port well enough to ask the OS two questions: "is this
pid still alive" and "is this port still listening" — both of which any
process on the same host can answer for any pid, not just its own
children. So the fix is: persist {pid, port} in the database (PreviewServer
model) instead of a Python dict, and use OS-level checks instead of
proc.poll()/proc.wait() wherever we don't hold the original Popen object.
"""
import logging
import os
import signal
import socket
import subprocess
import sys
import time

from .models import PreviewServer

logger = logging.getLogger(__name__)


def pid_alive(pid):
    """True if `pid` refers to a live process on this host, regardless of
    whether the calling process is its parent."""
    if not pid:
        return False
    if sys.platform == "win32":
        try:
            result = subprocess.run(
                ["tasklist", "/FI", f"PID eq {pid}"],
                capture_output=True, text=True, timeout=5,
            )
            return str(pid) in result.stdout
        except Exception:
            return False
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        # Process exists but is owned by someone else — still "alive" for
        # our purposes (shouldn't happen for our own preview subprocesses,
        # but treat conservatively rather than reporting it as dead).
        return True
    except OSError:
        return False


def port_listening(port, host="127.0.0.1", timeout=0.3):
    if not port:
        return False
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(timeout)
        try:
            s.connect((host, port))
            return True
        except OSError:
            return False


def _kill_pid(pid, timeout=5):
    """Kill a process (and its process group, since preview subprocesses
    are started with preexec_fn=os.setsid) purely from its pid — no
    Popen handle required, so this works after a worker restart too."""
    if not pid_alive(pid):
        return
    try:
        if sys.platform == "win32":
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(pid)],
                capture_output=True, check=False,
            )
        else:
            pgid = os.getpgid(pid)
            os.killpg(pgid, signal.SIGTERM)
            deadline = time.time() + timeout
            while pid_alive(pid) and time.time() < deadline:
                time.sleep(0.2)
            if pid_alive(pid):
                os.killpg(pgid, signal.SIGKILL)
            _reap_if_own_child(pid)
    except ProcessLookupError:
        pass
    except Exception as e:
        logger.error(f"Error killing pid {pid}: {e}")


def _reap_if_own_child(pid):
    """If `pid` happens to be a direct child of *this* process (true for
    the worker that originally spawned it — false for any other worker
    checking the same pid after a restart), reap it so it doesn't sit
    around as a zombie. Harmless no-op otherwise: os.waitpid raises
    ECHILD for a pid that isn't our child, which we swallow."""
    if sys.platform == "win32":
        return
    try:
        os.waitpid(pid, os.WNOHANG)
    except ChildProcessError:
        pass
    except OSError:
        pass


def get_status(project_id):
    """
    Returns a dict describing the current state, checking real OS state
    rather than trusting the DB row blindly (a row can outlive the process
    it describes, e.g. after a crash). Deletes the row if nothing is
    actually alive, so callers never see a stale "running: True".
    """
    try:
        entry = PreviewServer.objects.get(project_id=project_id)
    except PreviewServer.DoesNotExist:
        return {"running": False, "urls": [], "backend_running": False, "frontend_running": False}

    backend_alive = pid_alive(entry.backend_pid) and port_listening(entry.backend_port)
    frontend_alive = pid_alive(entry.frontend_pid) and port_listening(entry.frontend_port)

    if not backend_alive and not frontend_alive:
        entry.delete()
        return {"running": False, "urls": [], "backend_running": False, "frontend_running": False}

    urls = []
    if backend_alive:
        urls.append(f"http://localhost:{entry.backend_port}/")
    if frontend_alive:
        urls.append(f"http://localhost:{entry.frontend_port}/")

    return {
        "running": True,
        "urls": urls,
        "url": urls[0] if urls else None,
        "backend_running": backend_alive,
        "frontend_running": frontend_alive,
        "backend_port": entry.backend_port if backend_alive else None,
        "frontend_port": entry.frontend_port if frontend_alive else None,
    }


def save(project_id, backend_pid, backend_port, frontend_pid, frontend_port):
    PreviewServer.objects.update_or_create(
        project_id=project_id,
        defaults={
            "backend_pid": backend_pid,
            "backend_port": backend_port,
            "frontend_pid": frontend_pid,
            "frontend_port": frontend_port,
        },
    )


def kill(project_id):
    """Kills whatever's running for this project (by pid, not by held
    Popen handle) and clears its DB row. Returns the ports that were
    freed, or None if nothing was tracked."""
    try:
        entry = PreviewServer.objects.get(project_id=project_id)
    except PreviewServer.DoesNotExist:
        return None

    ports = {"backend": entry.backend_port, "frontend": entry.frontend_port}
    _kill_pid(entry.backend_pid)
    _kill_pid(entry.frontend_pid)
    entry.delete()
    return ports
