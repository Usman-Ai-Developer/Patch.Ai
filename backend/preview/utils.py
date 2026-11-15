# backend/preview/utils.py
import os
import json
import socket
from pathlib import Path
from django.conf import settings

def project_dir(project):
    return Path(settings.PROJECTS_ROOT) / str(project.id)

def find_file(filename, base_dir, max_depth=3):
    """
    Find all files with the given name up to max_depth and return the one
    with the shortest path (shallowest depth). If none found, return None.
    """
    best = None
    best_depth = float('inf')
    for root, dirs, files in os.walk(base_dir):
        rel_path = Path(root).relative_to(base_dir)
        depth = len(rel_path.parts)
        if depth > max_depth:
            continue
        if filename in files:
            if depth < best_depth:
                best_depth = depth
                best = Path(root) / filename
                if depth == 0:
                    break
    return best

def detect_project_type(project):
    """
    Detect project type by scanning the workspace.
    Returns a dict with:
      - type: string
      - command: list of strings
      - port: int
      - env: dict (optional)
      - cwd: str (directory where the main command should run)
    """
    workspace = project_dir(project)
    if not workspace.exists():
        return {"type": "unknown", "command": None, "port": None, "env": {}, "cwd": None}

    def find_free_port(start=8080, max_tries=10):
        for port in range(start, start + max_tries):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if s.connect_ex(('localhost', port)) != 0:
                    return port
        return start

    # ─── Django detection ──────────────────────────────────────────────
    manage_path = find_file("manage.py", workspace)
    if manage_path:
        manage_dir = manage_path.parent
        return {
            "type": "django",
            "command": ["python", "manage.py", "runserver", "0.0.0.0:8000"],
            "port": 8000,
            "env": {},
            "cwd": str(manage_dir),
        }

    # ─── Flask ──────────────────────────────────────────────────────────
    flask_files = ["app.py", "wsgi.py"]
    for fname in flask_files:
        if (workspace / fname).exists():
            env = {"FLASK_APP": fname}
            return {
                "type": "flask",
                "command": ["python", "-m", "flask", "run", "--host=0.0.0.0", "--port=5000"],
                "port": 5000,
                "env": env,
                "cwd": str(workspace),
            }

    # ─── FastAPI ────────────────────────────────────────────────────────
    if (workspace / "main.py").exists():
        try:
            with open(workspace / "main.py") as f:
                if "FastAPI" in f.read():
                    return {
                        "type": "fastapi",
                        "command": ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"],
                        "port": 8000,
                        "env": {},
                        "cwd": str(workspace),
                    }
        except:
            pass

    # ─── Node.js / JavaScript frameworks ──────────────────────────────
    package_json = workspace / "package.json"
    if package_json.exists():
        try:
            with open(package_json) as f:
                data = json.load(f)
            scripts = data.get("scripts", {})
            deps = {**data.get("dependencies", {}), **data.get("devDependencies", {})}

            if "react-scripts" in deps:
                return {"type": "react", "command": ["npm", "start"], "port": 3000, "env": {}, "cwd": str(workspace)}
            if "@vue/cli" in deps:
                return {"type": "vue", "command": ["npm", "run", "serve"], "port": 8080, "env": {}, "cwd": str(workspace)}
            if "@angular/cli" in deps:
                return {"type": "angular", "command": ["ng", "serve"], "port": 4200, "env": {}, "cwd": str(workspace)}
            if "next" in deps:
                return {"type": "next", "command": ["npm", "run", "dev"], "port": 3000, "env": {}, "cwd": str(workspace)}
            if "nuxt" in deps:
                return {"type": "nuxt", "command": ["npm", "run", "dev"], "port": 3000, "env": {}, "cwd": str(workspace)}
            if "svelte" in deps:
                return {"type": "svelte", "command": ["npm", "run", "dev"], "port": 5000, "env": {}, "cwd": str(workspace)}

            # Generic node
            for candidate in ["server.js", "app.js", "index.js"]:
                if (workspace / candidate).exists():
                    return {"type": "node", "command": ["node", candidate], "port": 3000, "env": {}, "cwd": str(workspace)}
            if "start" in scripts:
                return {"type": "node", "command": ["npm", "start"], "port": 3000, "env": {}, "cwd": str(workspace)}
            if "dev" in scripts:
                return {"type": "node", "command": ["npm", "run", "dev"], "port": 3000, "env": {}, "cwd": str(workspace)}
        except:
            pass

    # ─── PHP ─────────────────────────────────────────────────────────────
    if (workspace / "artisan").exists():
        return {"type": "php", "command": ["php", "artisan", "serve", "--port=8000"], "port": 8000, "env": {}, "cwd": str(workspace)}
    if (workspace / "index.php").exists():
        port = find_free_port(8000)
        return {"type": "php", "command": ["php", "-S", f"0.0.0.0:{port}"], "port": port, "env": {}, "cwd": str(workspace)}

    # ─── Ruby on Rails ─────────────────────────────────────────────────
    if (workspace / "Gemfile").exists():
        try:
            with open(workspace / "Gemfile") as f:
                if "rails" in f.read().lower():
                    return {"type": "rails", "command": ["rails", "server", "-p", "3000"], "port": 3000, "env": {}, "cwd": str(workspace)}
        except:
            pass

    # ─── Go ─────────────────────────────────────────────────────────────
    if (workspace / "go.mod").exists():
        if (workspace / "main.go").exists():
            return {"type": "go", "command": ["go", "run", "main.go"], "port": 8080, "env": {}, "cwd": str(workspace)}
        return {"type": "go", "command": ["go", "run", "."], "port": 8080, "env": {}, "cwd": str(workspace)}

    # ─── Spring Boot ──────────────────────────────────────────────────
    if (workspace / "pom.xml").exists():
        try:
            with open(workspace / "pom.xml") as f:
                if "spring-boot-starter-web" in f.read():
                    mvnw = workspace / "mvnw"
                    return {"type": "spring", "command": [str(mvnw), "spring-boot:run"] if mvnw.exists() else ["mvn", "spring-boot:run"], "port": 8080, "env": {}, "cwd": str(workspace)}
        except:
            pass
    if (workspace / "build.gradle").exists():
        try:
            with open(workspace / "build.gradle") as f:
                if "spring-boot" in f.read():
                    gradlew = workspace / "gradlew"
                    return {"type": "spring", "command": [str(gradlew), "bootRun"] if gradlew.exists() else ["gradle", "bootRun"], "port": 8080, "env": {}, "cwd": str(workspace)}
        except:
            pass

    # ─── Static HTML ──────────────────────────────────────────────────
    if list(workspace.glob("*.html")):
        port = find_free_port(8080)
        return {"type": "static", "command": ["python", "-m", "http.server", str(port)], "port": port, "env": {}, "cwd": str(workspace)}

    # ─── Python fallback ──────────────────────────────────────────────
    py_files = list(workspace.glob("*.py"))
    if py_files:
        for candidate in ["app.py", "main.py", "run.py", "server.py", "wsgi.py", "manage.py"]:
            if (workspace / candidate).exists():
                return {"type": "python", "command": ["python", candidate], "port": 8080, "env": {}, "cwd": str(workspace)}
        return {"type": "python", "command": ["python", py_files[0].name], "port": 8080, "env": {}, "cwd": str(workspace)}

    # ─── Node fallback ────────────────────────────────────────────────
    js_files = list(workspace.glob("*.js"))
    if js_files:
        for candidate in ["server.js", "app.js", "index.js"]:
            if (workspace / candidate).exists():
                return {"type": "node", "command": ["node", candidate], "port": 3000, "env": {}, "cwd": str(workspace)}
        return {"type": "node", "command": ["node", js_files[0].name], "port": 3000, "env": {}, "cwd": str(workspace)}

    return {"type": "unknown", "command": None, "port": None, "env": {}, "cwd": None}

def detect_frontend_type(workspace):
    """
    Detect frontend type in a workspace. Looks for a `frontend/` directory
    or a `package.json` in the root, and returns a dict similar to detect_project_type.
    Returns None if no frontend is found.
    """
    # Check for a `frontend/` directory
    frontend_dir = workspace / "frontend"
    if frontend_dir.exists() and frontend_dir.is_dir():
        # Try to detect within the frontend/ directory
        package_json = frontend_dir / "package.json"
        if package_json.exists():
            return _detect_from_package_json(package_json, frontend_dir)
        # If no package.json, check for static HTML
        if list(frontend_dir.glob("*.html")):
            port = _find_free_port(3000, 3010)
            return {
                "type": "static",
                "command": ["python", "-m", "http.server", str(port)],
                "port": port,
                "env": {},
                "cwd": str(frontend_dir),
            }
    # Check for package.json in the workspace root
    package_json = workspace / "package.json"
    if package_json.exists():
        return _detect_from_package_json(package_json, workspace)
    return None

def _detect_from_package_json(package_json_path, cwd):
    try:
        with open(package_json_path) as f:
            data = json.load(f)
        scripts = data.get("scripts", {})
        deps = {**data.get("dependencies", {}), **data.get("devDependencies", {})}

        if "react-scripts" in deps:
            return {"type": "react", "command": ["npm", "start"], "port": 3000, "env": {}, "cwd": str(cwd)}
        if "@vue/cli" in deps:
            return {"type": "vue", "command": ["npm", "run", "serve"], "port": 8080, "env": {}, "cwd": str(cwd)}
        if "@angular/cli" in deps:
            return {"type": "angular", "command": ["ng", "serve"], "port": 4200, "env": {}, "cwd": str(cwd)}
        if "next" in deps:
            return {"type": "next", "command": ["npm", "run", "dev"], "port": 3000, "env": {}, "cwd": str(cwd)}
        if "nuxt" in deps:
            return {"type": "nuxt", "command": ["npm", "run", "dev"], "port": 3000, "env": {}, "cwd": str(cwd)}
        if "svelte" in deps:
            return {"type": "svelte", "command": ["npm", "run", "dev"], "port": 5000, "env": {}, "cwd": str(cwd)}
        if "vite" in deps:
            # Include --port flag so _apply_port can override it
            return {"type": "vite", "command": ["npm", "run", "dev", "--", "--port", "5173"], "port": 5173, "env": {}, "cwd": str(cwd)}
        # Generic node
        for candidate in ["server.js", "app.js", "index.js"]:
            if (cwd / candidate).exists():
                return {"type": "node", "command": ["node", candidate], "port": 3000, "env": {}, "cwd": str(cwd)}
        if "start" in scripts:
            return {"type": "node", "command": ["npm", "start"], "port": 3000, "env": {}, "cwd": str(cwd)}
        if "dev" in scripts:
            return {"type": "node", "command": ["npm", "run", "dev"], "port": 3000, "env": {}, "cwd": str(cwd)}
    except:
        pass
    return None

def _find_free_port(start=8000, max_tries=50):
    for port in range(start, start + max_tries):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(('localhost', port)) != 0:
                return port
    return start