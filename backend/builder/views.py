from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.shortcuts import get_object_or_404
from assistant.models import Project
from assistant.file_ops import sync_project_files_table, project_dir
from .models import Blueprint
from .services import Generator
from .services.helpers import get_project_settings_defaults
from .services.frontend.react.writers.widget_manifest import WIDGET_MANIFEST, CATEGORIES
from .services.frontend.react.writers.visual_pages import (
    render_page_code,
    build_component_source,
    build_page_routes,
)
import json
import re
import os
import subprocess
import sys
import traceback
import time


def _retry_db_operation(operation, max_retries=5, delay=0.1, operation_name="database operation"):
    """Retry a database operation with exponential backoff on OperationalError."""
    for attempt in range(max_retries):
        try:
            return operation()
        except Exception as e:
            from django.db.utils import OperationalError
            if "database is locked" in str(e) and attempt < max_retries - 1:
                wait = delay * (2 ** attempt)
                print(f"[WARNING] Database locked during {operation_name}, retrying in {wait:.2f}s... (attempt {attempt+1}/{max_retries})")
                time.sleep(wait)
                continue
            raise


def sanitize_app_name(name):
    if not name:
        return 'api'
    name = re.sub(r'[^a-zA-Z0-9_]', '_', name)
    if not re.match(r'^[a-zA-Z_]', name):
        name = 'app_' + name
    return name


class WidgetManifestView(APIView):
    """
    Read-only view of the canonical Visual Builder widget manifest
    (builder/services/frontend/react/writers/widget_manifest.py).

    Not currently used by the running frontend (WidgetRegistry.js consumes
    the generated WidgetMetadata.generated.js so the canvas never needs a
    network round-trip). This exists so: (1) the CI parity test can fetch
    it over the real API instead of importing internals, and (2) other
    tooling (docs, external integrations) has one authoritative endpoint
    instead of reading the Python file directly.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        widgets = {
            wtype: {k: v for k, v in spec.items() if k != "render" or spec["tier"] == "generic"}
            for wtype, spec in WIDGET_MANIFEST.items()
        }
        return Response({"categories": CATEGORIES, "widgets": widgets})


class BlueprintDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, project_id):
        project = get_object_or_404(Project, id=project_id, owner=request.user)
        if hasattr(project, 'blueprint'):
            blueprint = project.blueprint
            return Response({
                "id": blueprint.id,
                "framework": blueprint.framework,
                "data": blueprint.data,
                "app_name": blueprint.data.get("app_name"),
            })
        return Response({"detail": "No blueprint found for this project."}, status=status.HTTP_404_NOT_FOUND)

    def put(self, request, project_id):
        project = get_object_or_404(Project, id=project_id, owner=request.user)
        blueprint = get_object_or_404(Blueprint, project=project)
        new_data = request.data.get('data')
        if new_data is None:
            return Response({"detail": "Missing 'data' field."}, status=status.HTTP_400_BAD_REQUEST)
        blueprint.data = new_data
        blueprint.save(update_fields=['data'])
        return Response({
            "id": blueprint.id,
            "framework": blueprint.framework,
            "data": blueprint.data,
            "app_name": blueprint.data.get("app_name"),
        })


class StartProjectView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, project_id):
        project = get_object_or_404(Project, id=project_id, owner=request.user)
        if hasattr(project, 'blueprint'):
            return Response(
                {"detail": "Blueprint already exists for this project."},
                status=status.HTTP_400_BAD_REQUEST
            )
        framework = request.data.get('framework', 'drf')
        app_name = request.data.get('app_name', '').strip()
        project_name = request.data.get('project_name', '').strip()

        if project_name and project_name != project.name:
            project.name = project_name
            project.save(update_fields=['name'])

        app_name = sanitize_app_name(app_name)

        blueprint = Blueprint.objects.create(
            project=project,
            framework=framework,
            data={
                "models": [],
                "settings": {
                    "packages": ["djangorestframework", "django-cors-headers"],
                    "cors": True,
                    "auth": "JWT",
                },
                "app_name": app_name,
                "project_settings": get_project_settings_defaults(),
            }
        )

        try:
            generator = Generator(project, blueprint)
            generator.generate()
            paths = []
            for root, dirs, files in os.walk(project_dir(project)):
                for file in files:
                    rel_path = os.path.relpath(os.path.join(root, file), project_dir(project))
                    paths.append(rel_path)
            sync_project_files_table(project, paths)
        except Exception as e:
            print(f"[ERROR] Generation failed for project {project.id}: {e}")
            traceback.print_exc()
            blueprint.delete()
            return Response(
                {"detail": f"Generation failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return Response({
            "id": blueprint.id,
            "framework": blueprint.framework,
            "data": blueprint.data,
            "project_name": project.name,
            "app_name": blueprint.data.get("app_name"),
        }, status=status.HTTP_201_CREATED)


class GenerateCodeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, project_id):
        project = get_object_or_404(Project, id=project_id, owner=request.user)
        blueprint = get_object_or_404(Blueprint, project=project)

        target = request.query_params.get('target') or request.data.get('target', 'both')
        generate_backend = target in ('backend', 'both')
        generate_frontend = target in ('frontend', 'both')

        try:
            generator = Generator(project, blueprint)
            generator.generate(generate_backend=generate_backend, generate_frontend=generate_frontend)
            paths = []
            for root, dirs, files in os.walk(project_dir(project)):
                for file in files:
                    rel_path = os.path.relpath(os.path.join(root, file), project_dir(project))
                    paths.append(rel_path)
            sync_project_files_table(project, paths)
            return Response({"detail": "Code generated successfully."}, status=status.HTTP_200_OK)
        except Exception as e:
            traceback.print_exc()
            return Response({"detail": f"Generation failed: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AppsStructureView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, project_id):
        project = get_object_or_404(Project, id=project_id, owner=request.user)
        if not hasattr(project, 'blueprint'):
            return Response({"detail": "Blueprint not found."}, status=status.HTTP_404_NOT_FOUND)

        generator = Generator(project, project.blueprint)
        structure = generator.get_apps_structure()
        return Response(structure)


class CreateAppView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, project_id):
        project = get_object_or_404(Project, id=project_id, owner=request.user)
        if not hasattr(project, 'blueprint'):
            return Response({"detail": "Blueprint not found."}, status=status.HTTP_404_NOT_FOUND)

        app_name = request.data.get('app_name', '').strip()
        sanitized = sanitize_app_name(app_name)

        generator = Generator(project, project.blueprint)
        try:
            generator.create_new_app(sanitized)
            paths = []
            for root, dirs, files in os.walk(project_dir(project)):
                for file in files:
                    rel_path = os.path.relpath(os.path.join(root, file), project_dir(project))
                    paths.append(rel_path)
            sync_project_files_table(project, paths)
            return Response({
                "detail": f"App '{sanitized}' created successfully.",
                "app_name": sanitized
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            traceback.print_exc()
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class DeleteAppView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, project_id):
        project = get_object_or_404(Project, id=project_id, owner=request.user)
        if not hasattr(project, 'blueprint'):
            return Response({"detail": "Blueprint not found."}, status=status.HTTP_404_NOT_FOUND)

        app_name = request.data.get('app_name', '').strip()
        if not app_name:
            return Response({"detail": "app_name is required."}, status=status.HTTP_400_BAD_REQUEST)

        # `delete_app` rmtree's workspace/app_name. Reject anything that would
        # resolve outside the project workspace ("..", absolute paths, ...).
        workspace = project_dir(project).resolve()
        target = (workspace / app_name).resolve()
        if workspace not in target.parents:
            return Response({"detail": "Invalid app name."}, status=status.HTTP_400_BAD_REQUEST)
        app_name = target.name

        generator = Generator(project, project.blueprint)
        try:
            generator.delete_app(app_name)
            blueprint = project.blueprint
            if blueprint.data.get('models'):
                updated_models = [m for m in blueprint.data['models'] if m.get('app_name') != app_name]
                blueprint.data['models'] = updated_models
                blueprint.save(update_fields=['data'])
            return Response({"detail": f"App '{app_name}' deleted successfully."}, status=status.HTTP_200_OK)
        except Exception as e:
            traceback.print_exc()
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CreateSuperuserView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, project_id):
        project = get_object_or_404(Project, id=project_id, owner=request.user)
        blueprint = get_object_or_404(Blueprint, project=project)

        username = request.data.get('username', '').strip()
        email = request.data.get('email', '').strip()
        password = request.data.get('password', '').strip()
        password2 = request.data.get('password2', '').strip()

        if not username:
            return Response({"detail": "Username is required."}, status=400)
        if len(password) < 8:
            return Response({"detail": "Password must be at least 8 characters."}, status=400)
        if password != password2:
            return Response({"detail": "Passwords do not match."}, status=400)

        cwd = project_dir(project)
        python_exe = sys.executable
        manage_py = cwd / "manage.py"
        if not manage_py.exists():
            return Response({"detail": "manage.py not found. Project may be incomplete."}, status=500)

        settings_module = None
        with open(manage_py, 'r') as f:
            content = f.read()
        match = re.search(r"DJANGO_SETTINGS_MODULE['\"]?\s*,\s*['\"]([^'\"]+)['\"]", content)
        if match:
            settings_module = match.group(1)
        else:
            for sub in cwd.iterdir():
                if sub.is_dir() and (sub / "settings.py").exists():
                    settings_module = f"{sub.name}.settings"
                    break
        if not settings_module:
            return Response({"detail": "Could not detect Django settings module."}, status=500)

        env = os.environ.copy()
        env["DJANGO_SETTINGS_MODULE"] = settings_module
        env["PYTHONUNBUFFERED"] = "1"

        # ─── Step 1: Run makemigrations and migrate (with retry) ──
        def run_migrations():
            # First, makemigrations to capture any model changes
            subprocess.run(
                [python_exe, "manage.py", "makemigrations", "--noinput"],
                cwd=str(cwd),
                env=env,
                capture_output=True,
                text=True,
                timeout=30,
                check=True,
            )
            # Then apply them
            subprocess.run(
                [python_exe, "manage.py", "migrate", "--noinput"],
                cwd=str(cwd),
                env=env,
                capture_output=True,
                text=True,
                timeout=30,
                check=True,
            )

        try:
            _retry_db_operation(
                run_migrations,
                max_retries=3,
                delay=0.5,
                operation_name="migrations before superuser"
            )
            print("[INFO] Migrations run successfully before superuser creation.")
        except subprocess.CalledProcessError as e:
            return Response(
                {"detail": f"Failed to run migrations: {e.stderr}"},
                status=500,
            )
        except Exception as e:
            return Response(
                {"detail": f"Failed to run migrations: {str(e)}"},
                status=500,
            )

        # ─── Step 2: Create superuser ──────────────────────────────
        env["DJANGO_SUPERUSER_USERNAME"] = username
        env["DJANGO_SUPERUSER_EMAIL"] = email
        env["DJANGO_SUPERUSER_PASSWORD"] = password

        try:
            result = subprocess.run(
                [python_exe, "manage.py", "createsuperuser", "--noinput"],
                cwd=str(cwd),
                env=env,
                capture_output=True,
                text=True,
                timeout=30,
                check=True,
            )
            return Response({"detail": f"Superuser '{username}' created successfully."}, status=201)
        except subprocess.CalledProcessError as e:
            if "already exists" in e.stderr:
                return Response({"detail": f"User '{username}' already exists."}, status=400)
            return Response({"detail": f"Failed to create superuser: {e.stderr}"}, status=500)
        except Exception as e:
            traceback.print_exc()
            return Response({"detail": str(e)}, status=500)


class EnableAuthView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, project_id):
        project = get_object_or_404(Project, id=project_id, owner=request.user)
        blueprint = get_object_or_404(Blueprint, project=project)

        generator = Generator(project, blueprint)
        try:
            generator.enable_authentication()
            paths = []
            for root, dirs, files in os.walk(project_dir(project)):
                for file in files:
                    rel_path = os.path.relpath(os.path.join(root, file), project_dir(project))
                    paths.append(rel_path)
            sync_project_files_table(project, paths)
            return Response({"detail": "Authentication enabled successfully."}, status=status.HTTP_200_OK)
        except Exception as e:
            traceback.print_exc()
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ResetDatabaseView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, project_id):
        project = get_object_or_404(Project, id=project_id, owner=request.user)
        blueprint = get_object_or_404(Blueprint, project=project)

        generator = Generator(project, blueprint)
        try:
            generator.reset_database()
            paths = []
            for root, dirs, files in os.walk(project_dir(project)):
                for file in files:
                    rel_path = os.path.relpath(os.path.join(root, file), project_dir(project))
                    paths.append(rel_path)
            sync_project_files_table(project, paths)
            return Response({"detail": "Database reset successfully. All data was deleted and migrations were regenerated from scratch."}, status=status.HTTP_200_OK)
        except Exception as e:
            traceback.print_exc()
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class RenderPageCodeView(APIView):
    """Render a visual page's widget tree to .jsx without writing to disk.

    This is what makes the studio a code generator rather than a mockup: the
    client sends the tree that is on the canvas right now and gets back exactly
    the file "Save & generate" would write, including the schema/hash header
    the builder uses for drift detection.
    """

    permission_classes = [IsAuthenticated]
    MAX_NODES = 5000
    MAX_DEPTH = 60
    MAX_TREE_BYTES = 1_000_000

    def post(self, request, project_id):
        project = get_object_or_404(Project, id=project_id, owner=request.user)
        blueprint = get_object_or_404(Blueprint, project=project)

        tree = request.data.get("tree")
        if not isinstance(tree, dict):
            return Response({"detail": "tree must be a widget-tree object."},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            node_count, depth = self._measure(tree)
        except ValueError:
            return Response({"detail": "tree is malformed."},
                            status=status.HTTP_400_BAD_REQUEST)
        if node_count > self.MAX_NODES:
            return Response({"detail": f"tree has {node_count} nodes; limit is {self.MAX_NODES}."},
                            status=status.HTTP_400_BAD_REQUEST)
        if depth > self.MAX_DEPTH:
            return Response({"detail": f"tree depth {depth} exceeds limit {self.MAX_DEPTH}."},
                            status=status.HTTP_400_BAD_REQUEST)
        if len(json.dumps(tree)) > self.MAX_TREE_BYTES:
            return Response({"detail": "tree is too large to render."},
                            status=status.HTTP_400_BAD_REQUEST)

        data = blueprint.data or {}
        frontend = data.get("frontend") or {}
        pages = frontend.get("pages") or {}
        ctx = {
            "models": data.get("models") or [],
            "app_name": data.get("app_name") or "api",
            "project_name": data.get("project_name") or project.name,
            "roles": data.get("roles") or [],
            "design_tokens": frontend.get("designTokens") or {},
            "components": frontend.get("components") or [],
            # Overlay actions resolve a route to the component generation writes.
            "page_routes": build_page_routes(
                data.get("models") or [],
                pages.get("settings") or {},
                pages.get("custom") or [],
            ),
        }

        component_name = (request.data.get("component_name") or "VisualPage").strip() or "VisualPage"
        as_component = bool(request.data.get("as_component"))
        if as_component:
            # Component mode: render the master's own file (nested instances
            # inlined), not a page that imports it.
            code = build_component_source({"name": component_name, "tree": tree}, ctx)
        else:
            code = render_page_code(tree, ctx, component_name)
        match = re.search(r"@visual-builder-hash ([0-9a-f]+)", code)
        fn_match = re.search(r"export default function ([A-Za-z0-9_$]+)", code)
        safe_name = fn_match.group(1) if fn_match else component_name
        folder = "src/components/visual" if as_component else "src/pages"
        return Response({
            "code": code,
            "hash": match.group(1) if match else "",
            "component_name": component_name,
            "file": f"{folder}/{safe_name}.jsx",
        })

    @classmethod
    def _measure(cls, tree):
        """Iterative node/depth count — a hostile or accidentally huge tree
        must never blow the Python stack."""
        count = 0
        max_depth = 0
        stack = [(tree, 1)]
        while stack:
            node, depth = stack.pop()
            if not isinstance(node, dict):
                raise ValueError("non-object node")
            count += 1
            max_depth = max(max_depth, depth)
            children = node.get("children") or []
            if not isinstance(children, list):
                raise ValueError("children must be a list")
            for child in children:
                stack.append((child, depth + 1))
        return count, max_depth