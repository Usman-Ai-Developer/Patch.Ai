# backend/builder/services/backend/django/writers/sync.py
import os
import re
import shutil
from pathlib import Path
from ....helpers import sanitize_app_name, get_existing_apps, get_api_defaults

def update_settings(workspace, app_name, blueprint):
    settings_path = workspace / 'config' / 'settings.py'
    if not settings_path.exists():
        return

    with open(settings_path, 'r', encoding='utf-8') as f:
        content = f.read()

    existing_apps = get_existing_apps(workspace)
    app_names = set(existing_apps)

    models = blueprint.data.get('models', [])
    uses_filters = any(m.get('api', {}).get('filter_fields', []) for m in models)
    uses_search = any(m.get('api', {}).get('search_fields', []) for m in models)
    uses_pagination = any(m.get('api', {}).get('pagination', {}).get('type') != 'None' for m in models)

    pattern = r'(INSTALLED_APPS\s*=\s*\[)([^\]]*)(\])'
    def repl(match):
        apps = match.group(2)
        current_apps = []
        for m in re.finditer(r"['\"]([^'\"]+)['\"]", apps):
            current_apps.append(m.group(1))
        default_apps = [
            'django.contrib.admin',
            'django.contrib.auth',
            'django.contrib.contenttypes',
            'django.contrib.sessions',
            'django.contrib.messages',
            'django.contrib.staticfiles',
            'rest_framework',
            'rest_framework_simplejwt',
            'corsheaders',
            'drf_spectacular',
        ]
        if uses_filters and 'django_filters' not in current_apps:
            current_apps.append('django_filters')
        all_apps = default_apps + list(app_names)
        seen = set()
        unique_apps = []
        for app in default_apps + current_apps + list(app_names):
            if app not in seen:
                seen.add(app)
                unique_apps.append(app)
        new_apps_str = ",\n    ".join([f"'{app}'" for app in unique_apps])
        return f"{match.group(1)}\n    {new_apps_str}\n{match.group(3)}"

    new_content = re.sub(pattern, repl, content, flags=re.DOTALL)
    if new_content != content:
        content = new_content

    if 'REST_FRAMEWORK' not in content:
        rest_framework_config = '''
REST_FRAMEWORK = {
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}
'''
        content += '\n' + rest_framework_config
    else:
        if 'DEFAULT_SCHEMA_CLASS' not in content:
            pattern = r'(REST_FRAMEWORK\s*=\s*\{)([^\}]*)(\})'
            def add_schema(match):
                dict_body = match.group(2)
                if "'DEFAULT_SCHEMA_CLASS'" not in dict_body and '"DEFAULT_SCHEMA_CLASS"' not in dict_body:
                    dict_body = "\n    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema'," + dict_body
                return f"{match.group(1)}{dict_body}{match.group(3)}"
            content = re.sub(pattern, add_schema, content, flags=re.DOTALL)

    settings_path.write_text(content, encoding='utf-8')

def sync_project_config(workspace):
    workspace = Path(workspace)

    ensure_app_urls(workspace)

    # ─── Force remove any users/urls.py ──────────────────────────────
    users_urls = workspace / 'users' / 'urls.py'
    if users_urls.exists():
        users_urls.unlink()
        print("[INFO] Removed users/urls.py (managed by authentication)")

    app_names = get_existing_apps(workspace)

    for item in workspace.iterdir():
        if not item.is_dir():
            continue
        if item.name in ['config', 'venv', 'env', '__pycache__', 'project_workspaces']:
            continue
        original = item.name
        sanitized = sanitize_app_name(original)
        if original != sanitized:
            new_path = workspace / sanitized
            if not new_path.exists():
                shutil.move(str(item), str(new_path))
                if original in app_names:
                    app_names.remove(original)
                    app_names.add(sanitized)
            else:
                print(f"[WARNING] Cannot rename '{original}' to '{sanitized}' – target exists. Skipping.")
                continue

    settings_path = workspace / 'config' / 'settings.py'
    if settings_path.exists():
        with open(settings_path, 'r', encoding='utf-8') as f:
            content = f.read()
        pattern = r'(INSTALLED_APPS\s*=\s*\[)([^\]]*)(\])'
        match = re.search(pattern, content, re.DOTALL)
        if match:
            current_apps_str = match.group(2)
            apps = []
            for m in re.finditer(r"['\"]([^'\"]+)['\"]", current_apps_str):
                app = m.group(1)
                default_apps = [
                    'django.contrib.admin',
                    'django.contrib.auth',
                    'django.contrib.contenttypes',
                    'django.contrib.sessions',
                    'django.contrib.messages',
                    'django.contrib.staticfiles',
                    'rest_framework',
                    'rest_framework_simplejwt',
                    'corsheaders',
                    'drf_spectacular',
                ]
                if app in default_apps or app in app_names:
                    apps.append(app)
            for default_app in default_apps:
                if default_app not in apps:
                    apps.append(default_app)
            for app in app_names:
                if app not in apps:
                    apps.append(app)
            new_apps_str = ",\n    ".join([f"'{app}'" for app in apps])
            new_content = re.sub(pattern, f"INSTALLED_APPS = [\n    {new_apps_str}\n]", content, re.DOTALL)
            if new_content != content:
                settings_path.write_text(new_content, encoding='utf-8')

    urls_path = workspace / 'config' / 'urls.py'
    if not urls_path.exists():
        return

    views_py = workspace / 'config' / 'views.py'
    has_root_view = False
    if views_py.exists():
        with open(views_py, 'r', encoding='utf-8') as f:
            if 'def root(' in f.read():
                has_root_view = True

    imports = [
        "from django.contrib import admin",
        "from django.urls import path, include",
        "from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView",
    ]
    if has_root_view:
        imports.append("from . import views")

    urlpatterns = ["urlpatterns = ["]
    urlpatterns.append("    path('admin/', admin.site.urls),")
    if has_root_view:
        urlpatterns.append("    path('', views.root, name='root'),")
    urlpatterns.append("    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),")
    urlpatterns.append("    path('api/schema/swagger-ui/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),")
    urlpatterns.append("    path('api/schema/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),")
    for app in sorted(app_names):
        # ─── Skip users app ──────────────────────────────────────────
        if app == 'users':
            continue
        urlpatterns.append(f"    path('api/{app}/', include('{app}.urls'),),")
    urlpatterns.append("]")

    # ─── Final cleanup: remove any leftover 'users' path ────────────
    filtered_urlpatterns = [p for p in urlpatterns if "path('users/" not in p and "path('api/users/" not in p]
    if len(filtered_urlpatterns) != len(urlpatterns):
        print("[INFO] Removed leftover 'users' entry from urlpatterns")
    urlpatterns = filtered_urlpatterns

    new_content = "\n".join(imports + [""] + urlpatterns)
    urls_path.write_text(new_content, encoding='utf-8')

def ensure_app_urls(workspace):
    workspace = Path(workspace)
    for item in workspace.iterdir():
        if not item.is_dir():
            continue
        if item.name in ['config', 'venv', 'env', '__pycache__', 'project_workspaces']:
            continue
        # ─── Skip users app ──────────────────────────────────────────
        if item.name == 'users':
            continue
        if (item / 'models.py').exists() or (item / 'views.py').exists() or (item / 'apps.py').exists():
            urls_file = item / 'urls.py'
            if not urls_file.exists():
                content = '''from django.urls import path, include
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
# router.register(r'example', ExampleViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
'''
                urls_file.write_text(content, encoding='utf-8')
                print(f"[INFO] Created minimal urls.py for app: {item.name}")

def delete_app(workspace, app_name, project):
    app_dir = Path(workspace) / app_name
    if not app_dir.exists():
        raise Exception(f"App '{app_name}' does not exist.")
    try:
        from preview.views import stop_preview_if_running
        stop_preview_if_running(project.id)
    except (ImportError, AttributeError):
        pass
    try:
        shutil.rmtree(app_dir, ignore_errors=True)
    except Exception as e:
        if os.name == 'nt':
            import time
            time.sleep(0.5)
            shutil.rmtree(app_dir, ignore_errors=True)
        else:
            raise
    sync_project_config(workspace)
    try:
        from builder.models import Blueprint
        blueprint = Blueprint.objects.get(project=project)
        if blueprint.data.get('models'):
            updated_models = [m for m in blueprint.data['models'] if m.get('app_name') != app_name]
            blueprint.data['models'] = updated_models
            blueprint.save(update_fields=['data'])
    except:
        pass