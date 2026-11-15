import subprocess
import threading
import time
import os
import socket
import logging
import re
import sys
import signal
from pathlib import Path
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from assistant.models import Project
from .utils import detect_project_type, detect_frontend_type, project_dir
from . import process_registry

logger = logging.getLogger(__name__)

# NOTE: process state used to live here as a module-level dict
# (`_running_servers = {}`), which only one worker process ever saw and
# which was wiped on every restart. It's now persisted via
# process_registry.py / the PreviewServer model — see that module's
# docstring for why. The dict is gone; anything that reads or writes
# preview state now goes through process_registry.{get_status,save,kill}.

PORT_SCAN_START = 9000
PORT_SCAN_END = 9999
PYTHON_EXE = sys.executable


class PreviewView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, project_id):
        project = get_object_or_404(Project, id=project_id, owner=request.user)
        workspace = project_dir(project)

        # Detect backend
        backend_info = detect_project_type(project)
        if backend_info["command"] is None:
            return Response(
                {"error": "Could not detect project type."},
                status=400,
            )

        # Detect frontend
        frontend_info = detect_frontend_type(workspace)
        logger.info(f"Frontend detection result: {frontend_info}")
        if frontend_info:
            logger.info(f"Detected frontend type: {frontend_info['type']}")

        # Check if servers already running (checked against real OS state
        # via process_registry, not an in-memory dict — see that module's
        # docstring for why that distinction matters).
        status = process_registry.get_status(project_id)
        if status["running"]:
            return Response({
                "url": status["url"],
                "urls": status["urls"],
                "type": backend_info["type"],
                "running": True,
                "frontend_running": status["frontend_running"],
                "backend_running": status["backend_running"],
            })

        # ─── Use the `cwd` from detection ─────────────────────────────
        backend_cwd = backend_info.get("cwd")
        if not backend_cwd:
            backend_cwd = str(workspace)
        else:
            backend_cwd = str(Path(backend_cwd))

        root = Path(backend_cwd)
        self._install_deps(root)

        # ─── Detect Django settings module ─────────────────────────────
        django_settings_module = None
        if backend_info["type"] == "django":
            manage_dir = Path(backend_cwd)
            project_name = None
            for sub in manage_dir.iterdir():
                if sub.is_dir() and (sub / "settings.py").exists():
                    project_name = sub.name
                    break
            if project_name:
                django_settings_module = f"{project_name}.settings"
                logger.info(f"Detected Django settings module: {django_settings_module}")
            else:
                logger.warning("Could not detect Django settings module; using 'settings'")

            if manage_dir and (manage_dir / "manage.py").exists():
                self._run_django_setup(manage_dir, django_settings_module)
                self._ensure_root_view(manage_dir)

        # ─── Pick free ports ───────────────────────────────────────────
        backend_requested_port = backend_info.get("port") or PORT_SCAN_START
        if self._is_port_free(backend_requested_port):
            backend_port = backend_requested_port
        else:
            backend_port = self._find_free_port()
            logger.info(f"Port {backend_requested_port} in use, using {backend_port} instead for backend")

        frontend_port = None
        if frontend_info:
            frontend_requested_port = frontend_info.get("port") or 3000
            if self._is_port_free(frontend_requested_port):
                frontend_port = frontend_requested_port
            else:
                frontend_port = self._find_free_port(start=3000)
                logger.info(f"Port {frontend_requested_port} in use, using {frontend_port} instead for frontend")

        # ─── Start backend server ──────────────────────────────────────
        env = os.environ.copy()
        env.update(backend_info.get("env", {}))
        env["PYTHONUNBUFFERED"] = "1"
        env["DEBUG"] = "True"
        env["PORT"] = str(backend_port)

        if django_settings_module:
            env["DJANGO_SETTINGS_MODULE"] = django_settings_module
        elif backend_info["type"] == "django":
            # Fallback: try to detect again
            project_name = None
            for sub in Path(backend_cwd).iterdir():
                if sub.is_dir() and (sub / "settings.py").exists():
                    project_name = sub.name
                    break
            if project_name:
                env["DJANGO_SETTINGS_MODULE"] = f"{project_name}.settings"
            else:
                env["DJANGO_SETTINGS_MODULE"] = "settings"

        backend_command = self._apply_port(backend_info["command"], backend_requested_port, backend_port, backend_info["type"])
        backend_command = [PYTHON_EXE if part == "python" else part for part in backend_command]

        if backend_info["type"] == "django" and django_settings_module:
            try:
                runserver_index = backend_command.index("runserver")
                backend_command.insert(runserver_index + 1, f"--settings={django_settings_module}")
            except ValueError:
                backend_command.append(f"--settings={django_settings_module}")

        try:
            proc_backend = subprocess.Popen(
                backend_command,
                cwd=backend_cwd,
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                bufsize=1,
                universal_newlines=True,
                preexec_fn=os.setsid if sys.platform != "win32" else None,
            )
            # Start thread to read backend output
            def read_backend_output():
                for line in iter(proc_backend.stdout.readline, ""):
                    if not line:
                        break
                    line = line.rstrip("\n")
                    logger.info(f"[Preview] {line}")
            threading.Thread(target=read_backend_output, daemon=True).start()
            logger.info(f"Started backend server for project {project_id} on port {backend_port}")
        except Exception as e:
            return Response(
                {"error": f"Failed to start backend server: {str(e)}"},
                status=500,
            )

        # ─── Start frontend server (if detected) ──────────────────────
        proc_frontend = None
        if frontend_info:
            frontend_cwd = frontend_info.get("cwd", str(workspace))
            frontend_command = self._apply_port(frontend_info["command"], frontend_info.get("port"), frontend_port, frontend_info["type"])
            use_shell = sys.platform == "win32"

            # ─── Frontend gets its own env ──────────────────────────────
            frontend_env = os.environ.copy()
            frontend_env.update(frontend_info.get("env", {}))
            frontend_env["PORT"] = str(frontend_port)
            frontend_env["BACKEND_PORT"] = str(backend_port)
            frontend_env.pop("DJANGO_SETTINGS_MODULE", None)

            logger.info(f"Setting BACKEND_PORT={backend_port} for frontend")
            logger.info(f"Starting frontend with command: {frontend_command}, cwd: {frontend_cwd}")
            try:
                proc_frontend = subprocess.Popen(
                    frontend_command if not use_shell else " ".join(frontend_command),
                    cwd=frontend_cwd,
                    env=frontend_env,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    bufsize=1,
                    universal_newlines=True,
                    shell=use_shell,
                    preexec_fn=os.setsid if sys.platform != "win32" else None,
                )
                # Start thread to read frontend output
                def read_frontend_output():
                    for line in iter(proc_frontend.stdout.readline, ""):
                        if not line:
                            break
                        line = line.rstrip("\n")
                        logger.info(f"[Frontend] {line}")
                threading.Thread(target=read_frontend_output, daemon=True).start()
                logger.info(f"Started frontend server for project {project_id} on port {frontend_port}")
            except Exception as e:
                logger.error(f"Failed to start frontend server: {e}")
                proc_frontend = None
                frontend_port = None

        # ─── Store process state (persisted, not just in-memory) ───────
        process_registry.save(
            project_id,
            backend_pid=proc_backend.pid,
            backend_port=backend_port,
            frontend_pid=proc_frontend.pid if proc_frontend else None,
            frontend_port=frontend_port if proc_frontend else None,
        )

        # ─── Wait for servers to start ────────────────────────────────
        backend_ready = self._wait_for_server(proc_backend, backend_port, timeout=15)
        frontend_ready = False
        if proc_frontend and frontend_port:
            # Give frontend more time (60 seconds)
            frontend_ready = self._wait_for_server(proc_frontend, frontend_port, timeout=60)
            # If process is still alive but the check timed out, consider it ready
            if not frontend_ready and proc_frontend.poll() is None:
                frontend_ready = True
                logger.info(f"Frontend process still running, assuming ready on port {frontend_port}")
            elif not frontend_ready:
                logger.warning(f"Frontend server for project {project_id} failed to start on port {frontend_port}")

        if not backend_ready:
            # Kill both if backend fails
            self._kill_processes(project_id)
            return Response(
                {"error": f"Backend server failed to start on port {backend_port}."},
                status=500,
            )

        urls = [f"http://localhost:{backend_port}/"]
        if frontend_ready:
            urls.append(f"http://localhost:{frontend_port}/")
        return Response({
            "url": urls[0],
            "urls": urls,
            "type": backend_info["type"],
            "frontend_type": frontend_info["type"] if frontend_info else None,
            "running": True,
            "backend_running": True,
            "frontend_running": frontend_ready,
            "backend_port": backend_port,
            "frontend_port": frontend_port if frontend_ready else None,
        })

    def _get_preview_url(self, info, port):
        return f"http://localhost:{port}/"

    def _is_port_free(self, port, host="127.0.0.1"):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind((host, port))
                return True
            except OSError:
                return False

    def _find_free_port(self, start=PORT_SCAN_START, end=PORT_SCAN_END):
        for candidate in range(start, end + 1):
            if self._is_port_free(candidate):
                return candidate
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(("127.0.0.1", 0))
            return s.getsockname()[1]

    def _wait_for_server(self, proc, port, timeout=15, host="127.0.0.1"):
        deadline = time.time() + timeout
        while time.time() < deadline:
            if proc.poll() is not None:
                return False
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(0.3)
                try:
                    s.connect((host, port))
                    return True
                except OSError:
                    time.sleep(0.3)
        return False

    def _apply_port(self, command, requested_port, port, project_type):
        command = list(command)
        if port == requested_port:
            return command

        new_command = []
        replace_next = False
        found_port_token = False
        for part in command:
            part_str = str(part)
            if replace_next:
                new_command.append(str(port))
                replace_next = False
                found_port_token = True
                continue
            if part_str in ("--port", "-p"):
                new_command.append(part_str)
                replace_next = True
                continue
            if part_str == str(requested_port):
                new_command.append(str(port))
                found_port_token = True
                continue
            if part_str.endswith(f":{requested_port}"):
                head = part_str.rsplit(":", 1)[0]
                new_command.append(f"{head}:{port}")
                found_port_token = True
                continue
            if part_str.endswith(f"={requested_port}"):
                head = part_str.rsplit("=", 1)[0]
                new_command.append(f"{head}={port}")
                found_port_token = True
                continue
            new_command.append(part_str)

        if not found_port_token:
            if project_type == "django":
                new_command.append(f"0.0.0.0:{port}")
            elif project_type == "angular":
                new_command += ["--port", str(port)]
            elif project_type == "svelte":
                new_command += ["--", "--port", str(port)]

        return new_command

    def _install_deps(self, root):
        """Install dependencies for backend and also frontend if package.json exists."""
        req_file = root / "requirements.txt"
        if req_file.exists():
            logger.info(f"Installing Python dependencies from {req_file} using {PYTHON_EXE}")
            try:
                subprocess.run(
                    [PYTHON_EXE, "-m", "pip", "install", "-r", "requirements.txt"],
                    cwd=str(root),
                    check=False,
                    capture_output=True,
                    text=True,
                    timeout=120,
                )
            except Exception as e:
                logger.error(f"pip install failed: {e}")

        if (root / "manage.py").exists():
            logger.info(f"Ensuring Django is installed in {root}")
            try:
                subprocess.run(
                    [PYTHON_EXE, "-m", "pip", "install", "django"],
                    cwd=str(root),
                    check=False,
                    capture_output=True,
                    text=True,
                    timeout=60,
                )
            except Exception as e:
                logger.error(f"Django install failed: {e}")

        # Install frontend dependencies if package.json exists in root or frontend/
        use_shell = sys.platform == "win32"
        for pkg in [root / "package.json", root / "frontend" / "package.json"]:
            if pkg.exists():
                logger.info(f"Installing Node dependencies in {pkg.parent}")
                try:
                    subprocess.run(
                        "npm install" if use_shell else ["npm", "install"],
                        cwd=str(pkg.parent),
                        check=False,
                        capture_output=True,
                        text=True,
                        timeout=120,
                        shell=use_shell,
                    )
                except Exception as e:
                    logger.error(f"npm install failed: {e}")

    def _run_django_setup(self, manage_dir, settings_module=None):
        django_env = os.environ.copy()
        django_env["PYTHONUNBUFFERED"] = "1"
        django_env["DEBUG"] = "True"

        if settings_module:
            django_env["DJANGO_SETTINGS_MODULE"] = settings_module
        else:
            project_name = None
            for sub in manage_dir.iterdir():
                if sub.is_dir() and (sub / "settings.py").exists():
                    project_name = sub.name
                    break
            if project_name:
                django_env["DJANGO_SETTINGS_MODULE"] = f"{project_name}.settings"
            else:
                django_env["DJANGO_SETTINGS_MODULE"] = "settings"

        logger.info(f"Running migrations in {manage_dir} using {PYTHON_EXE}")
        try:
            subprocess.run(
                [PYTHON_EXE, "manage.py", "migrate"],
                cwd=str(manage_dir),
                env=django_env,
                capture_output=True,
                text=True,
                timeout=30,
                check=False,
            )
        except Exception as e:
            logger.error(f"Migration error: {e}")

        logger.info(f"Collecting static files in {manage_dir} using {PYTHON_EXE}")
        try:
            subprocess.run(
                [PYTHON_EXE, "manage.py", "collectstatic", "--noinput"],
                cwd=str(manage_dir),
                env=django_env,
                capture_output=True,
                text=True,
                timeout=30,
                check=False,
            )
        except Exception as e:
            logger.error(f"collectstatic error: {e}")

    def _ensure_root_view(self, manage_dir):
        settings_dir = None
        for sub in manage_dir.iterdir():
            if sub.is_dir() and (sub / "settings.py").exists():
                settings_dir = sub
                break
        if not settings_dir:
            return

        urls_file = settings_dir / "urls.py"
        if not urls_file.exists():
            return

        content = urls_file.read_text(encoding='utf-8')
        if re.search(r"path\s*\(\s*['\"]\s*['\"]", content) or re.search(r"path\s*\(\s*['\"]/['\"]", content):
            return

        home_dir = manage_dir / "home"
        home_dir.mkdir(exist_ok=True)

        views_file = home_dir / "views.py"
        views_content = '''from django.http import HttpResponse

def home(request):
    html = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Your Project</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, sans-serif;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #0a0a12;
            color: #e4e4e7;
            padding: 1rem;
        }
        .container {
            max-width: 720px;
            width: 100%;
            padding: 3rem 2rem;
            background: linear-gradient(145deg, #13131f, #1a1a2e);
            border: 1px solid #2a2a4a;
            border-radius: 24px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.8), 0 0 40px rgba(100, 100, 255, 0.05);
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        .container::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle at 30% 20%, rgba(120, 80, 255, 0.08), transparent 60%);
            pointer-events: none;
        }
        .badge {
            display: inline-block;
            padding: 0.3rem 1rem;
            border-radius: 999px;
            background: rgba(120, 80, 255, 0.15);
            color: #a78bfa;
            font-size: 0.75rem;
            font-weight: 600;
            letter-spacing: 0.05em;
            text-transform: uppercase;
            margin-bottom: 1.5rem;
            border: 1px solid rgba(120, 80, 255, 0.2);
        }
        h1 {
            font-size: 2.8rem;
            font-weight: 800;
            background: linear-gradient(135deg, #a78bfa, #60a5fa, #34d399);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 0.5rem;
            position: relative;
        }
        .subtitle {
            font-size: 1.2rem;
            color: #9ca3af;
            margin-bottom: 2rem;
            font-weight: 300;
            position: relative;
        }
        .features {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: 1rem;
            margin: 2rem 0;
            position: relative;
        }
        .feature-item {
            background: rgba(255,255,255,0.03);
            border: 1px solid #2a2a4a;
            border-radius: 12px;
            padding: 1rem 0.5rem;
            transition: all 0.2s;
        }
        .feature-item:hover {
            background: rgba(255,255,255,0.06);
            border-color: #4a4a7a;
            transform: translateY(-2px);
        }
        .feature-item .icon {
            font-size: 1.8rem;
            display: block;
            margin-bottom: 0.3rem;
        }
        .feature-item .label {
            font-size: 0.85rem;
            color: #d1d5db;
        }
        .footer {
            margin-top: 2.5rem;
            font-size: 0.85rem;
            color: #6b7280;
            border-top: 1px solid #2a2a4a;
            padding-top: 1.5rem;
            position: relative;
        }
        .footer a {
            color: #a78bfa;
            text-decoration: none;
            transition: color 0.2s;
        }
        .footer a:hover {
            color: #c4b5fd;
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="badge">✨ Ready to build</div>
        <h1>Your project is running</h1>
        <p class="subtitle">Django is up and serving your app.</p>
        <div class="features">
            <div class="feature-item">
                <span class="icon">⚡</span>
                <span class="label">Fast &amp; modern</span>
            </div>
            <div class="feature-item">
                <span class="icon">🔧</span>
                <span class="label">Built with Django</span>
            </div>
            <div class="feature-item">
                <span class="icon">🎨</span>
                <span class="label">Customizable</span>
            </div>
        </div>
        <div class="footer">
            Built with ❤️ using <a href="https://www.djangoproject.com/" target="_blank">Django</a> &bull;
            <a href="/admin/" target="_blank">Admin</a>
        </div>
    </div>
</body>
</html>
    """
    return HttpResponse(html)
'''
        views_file.write_text(views_content, encoding='utf-8')

        urls_home = home_dir / "urls.py"
        urls_home_content = '''from django.urls import path
from . import views

urlpatterns = [
    path('', views.home, name='home'),
]
'''
        urls_home.write_text(urls_home_content, encoding='utf-8')

        (home_dir / "__init__.py").touch()

        if not re.search(r"from django\.urls import[^\n]*\binclude\b", content):
            if re.search(r"^from django\.urls import .+$", content, flags=re.MULTILINE):
                content = re.sub(
                    r"^from django\.urls import (.+)$",
                    lambda m: f"from django.urls import {m.group(1)}, include"
                    if "include" not in m.group(1) else m.group(0),
                    content,
                    count=1,
                    flags=re.MULTILINE,
                )
            else:
                content = "from django.urls import path, include\n" + content

        new_content, count = re.subn(
            r"(urlpatterns\s*=\s*\[)",
            r'\1\n    path("", include("home.urls")),',
            content,
            count=1,
        )

        if count:
            urls_file.write_text(new_content, encoding='utf-8')
            logger.info(f"Added root view to {urls_file}")
        else:
            logger.warning(f"Could not locate urlpatterns in {urls_file}; root view not added")

    def _kill_processes(self, project_id):
        """Kill both backend and frontend processes for a project."""
        process_registry.kill(project_id)


# ─── Preview Status View ──────────────────────────────────────────────
class PreviewStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, project_id):
        project = get_object_or_404(Project, id=project_id, owner=request.user)
        status = process_registry.get_status(project_id)
        if not status["running"]:
            return Response({"running": False})
        return Response({
            "running": True,
            "url": status["url"],
            "urls": status["urls"],
            "backend_running": status["backend_running"],
            "frontend_running": status["frontend_running"],
            "backend_port": status["backend_port"],
            "frontend_port": status["frontend_port"],
        })


# ─── Preview Stop View ─────────────────────────────────────────────────
class PreviewStopView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, project_id):
        project = get_object_or_404(Project, id=project_id, owner=request.user)
        ports = process_registry.kill(project_id)
        if ports is None:
            return Response({"stopped": False, "message": "No running preview server found."}, status=404)
        logger.info(f"Stopped preview servers for project {project_id}")
        return Response({"stopped": True, "ports": ports})


# ─── Helper used by other apps ─────────────────────────────────────────
def stop_preview_if_running(project_id):
    """Stop any preview server tracked for `project_id`.

    `assistant.views.SyncProjectFilesView` and the builder sync writer import
    this function by name; it used to be missing entirely, so the import
    silently failed and the preview process was never stopped before a file
    sync (which is exactly the file-lock situation the retry loop was added
    for). Returns True if a server was actually stopped.
    """
    ports = process_registry.kill(project_id)
    if ports is not None:
        logger.info(f"Stopped preview servers for project {project_id}: {ports}")
    return ports is not None