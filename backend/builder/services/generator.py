import os
import re
import ast
import shutil
import subprocess
import sys
import time
import traceback
from pathlib import Path
from django.conf import settings
from django.db.utils import OperationalError
from assistant.file_ops import project_dir, sync_project_files_table
from .base import BaseGenerator
from .helpers import (
    get_python_executable,
    sanitize_app_name,
    get_existing_apps,
    get_api_defaults,
    get_project_settings_defaults,
)
from .backend.django.writers import (
    write_project_skeleton,
    write_models,
    write_serializers,
    write_views,
    write_urls,
    write_admin,
    write_permissions,
    write_tests,
    update_settings,
    sync_project_config,
    delete_app,
    ensure_app_urls,
)

# ─── Import frontend generator ──────────────────────────────────────
try:
    from .frontend.react import ReactGenerator
    print("[INFO] Successfully imported ReactGenerator from .frontend.react")
except ImportError as e:
    print(f"[ERROR] Failed to import ReactGenerator: {e}")
    import traceback as tb
    tb.print_exc()
    ReactGenerator = None
except Exception as e:
    print(f"[ERROR] Unexpected error importing ReactGenerator: {e}")
    import traceback as tb
    tb.print_exc()
    ReactGenerator = None


def _retry_db_operation(operation, max_retries=5, delay=0.1, operation_name="database operation"):
    for attempt in range(max_retries):
        try:
            return operation()
        except OperationalError as e:
            if "database is locked" in str(e) and attempt < max_retries - 1:
                wait = delay * (2 ** attempt)
                print(f"[WARNING] Database locked during {operation_name}, retrying in {wait:.2f}s... (attempt {attempt+1}/{max_retries})")
                time.sleep(wait)
                continue
            raise


class Generator(BaseGenerator):
    def __init__(self, project, blueprint):
        super().__init__(project, blueprint)
        self.app_name = blueprint.data.get('app_name', 'api')
        self.app_dir = self.workspace / self.app_name

    def generate(self, generate_backend=True, generate_frontend=True):
        try:
            if generate_backend:
                write_project_skeleton(self.workspace)

                all_models = self.blueprint.data.get('models', [])
                existing_apps = get_existing_apps(self.workspace)
                valid_models = [m for m in all_models if m.get('app_name') in existing_apps]
                if len(valid_models) != len(all_models):
                    self.blueprint.data['models'] = valid_models
                    _retry_db_operation(
                        lambda: self.blueprint.save(update_fields=['data']),
                        operation_name="blueprint save (clean models)"
                    )
                    print(f"[INFO] Removed {len(all_models) - len(valid_models)} model(s) for missing apps.")

                app_names = set(m.get('app_name') for m in valid_models if m.get('app_name'))
                # ─── FIX: Include apps already on disk, so 'users' is always processed ──
                all_apps_to_generate = set(app_names) | set(existing_apps)

                for app in all_apps_to_generate:
                    if app == 'users':
                        self._write_auth_app()
                        continue

                    app_dir = self.workspace / app
                    if not app_dir.exists():
                        app_dir.mkdir(parents=True, exist_ok=True)
                    (app_dir / "__init__.py").touch()
                    migrations_dir = app_dir / "migrations"
                    migrations_dir.mkdir(exist_ok=True)
                    (migrations_dir / "__init__.py").touch()

                    write_models(self.workspace, app, self.blueprint)
                    write_serializers(self.workspace, app, self.blueprint)
                    write_views(self.workspace, app, self.blueprint)
                    write_urls(self.workspace, app, self.blueprint)
                    write_admin(self.workspace, app, self.blueprint)
                    write_tests(self.workspace, app, self.blueprint)
                    write_permissions(self.workspace, app, self.blueprint)

                update_settings(self.workspace, self.app_name, self.blueprint)
                self.write_requirements()
                self.install_dependencies()
                self.run_migrations()
                self.sync_files()

            if generate_frontend:
                frontend_config = self.blueprint.data.get('frontend', {})
                if not frontend_config.get('enabled', False):
                    model_names = [m['name'] for m in self.blueprint.data.get('models', [])]
                    self.blueprint.data['frontend'] = {
                        'enabled': True,
                        'framework': 'react',
                        'pages': {
                            'enabled': model_names,
                        },
                        'navigation': [
                            {'label': 'Dashboard', 'path': '/'}
                        ] + [
                            {'label': m, 'path': f"/{m.lower()}"}
                            for m in model_names
                        ],
                        'theme': {
                            'primaryColor': '#3b82f6',
                            'secondaryColor': '#8b5cf6',
                            'darkMode': True,
                        },
                        'layout': 'sidebar',
                    }
                    _retry_db_operation(
                        lambda: self.blueprint.save(update_fields=['data']),
                        operation_name="blueprint save (enable frontend)"
                    )
                    print("[INFO] Frontend enabled in blueprint with default settings.")
                    frontend_config = self.blueprint.data['frontend']

                if ReactGenerator is None:
                    raise RuntimeError(
                        "ReactGenerator is not available. Please ensure:\n"
                        "1. The file builder/services/frontend/react/__init__.py exists\n"
                        "2. The file builder/services/frontend/react/generator.py exists\n"
                        "3. The directory builder/services/frontend/react/writers/ contains all required writer modules\n"
                        "4. All required writer functions are exported in writers/__init__.py\n"
                        "Check the server logs for the specific import error."
                    )

                framework = frontend_config.get('framework', 'react')
                if framework == 'react':
                    print("[INFO] Generating React frontend...")
                    try:
                        frontend_gen = ReactGenerator(self.project, self.blueprint, self.workspace)
                        frontend_gen.generate()
                        print("[INFO] React frontend generation completed.")
                        self.sync_files()
                    except Exception as e:
                        print(f"[ERROR] Frontend generation failed: {e}")
                        traceback.print_exc()
                        raise RuntimeError(f"Frontend generation failed: {str(e)}")
                else:
                    raise RuntimeError(f"Unsupported frontend framework: {framework}")

            return True
        except Exception as e:
            print(f"[ERROR] Generation failed for project {self.project.id}: {e}")
            traceback.print_exc()
            raise RuntimeError(f"Generation failed: {str(e)}")

    def _write_auth_app(self):
        """Dynamically generate the users app with custom fields from the blueprint."""
        app_name = 'users'
        app_dir = self.workspace / app_name

        if app_dir.exists():
            shutil.rmtree(app_dir)
            print("[INFO] Removed existing users app for fresh auth setup.")

        app_dir.mkdir(parents=True)
        (app_dir / "__init__.py").touch()
        migrations_dir = app_dir / "migrations"
        migrations_dir.mkdir(exist_ok=True)
        (migrations_dir / "__init__.py").touch()

        all_models = self.blueprint.data.get('models', [])
        user_model = None
        for m in all_models:
            if m.get('app_name') == app_name and m.get('name') == 'User':
                user_model = m
                break

        excluded_fields = {
            'id', 'password', 'confirm_password', 'confirm pssword',
            'username', 'email', 'first_name', 'last_name', 'is_active',
            'is_staff', 'is_superuser', 'last_login', 'date_joined', 'groups',
            'user_permissions'
        }

        custom_fields = []
        if user_model:
            for field in user_model.get('fields', []):
                fname = field['name']
                if fname not in excluded_fields:
                    custom_fields.append(field)

        # Helper to ensure max_length for CharField/EmailField/URLField/PasswordField
        def ensure_max_length(field_type, options):
            if field_type in ['CharField', 'EmailField', 'URLField', 'PasswordField']:
                if 'max_length' not in options or not options['max_length']:
                    options['max_length'] = 255
            return options

        model_code_lines = [
            'from django.db import models',
            'from django.contrib.auth.models import AbstractUser',
            '',
            'class User(AbstractUser):',
        ]

        if custom_fields:
            for field in custom_fields:
                ftype = field['type']
                fname = field['name']
                options = field.get('options', {})
                options = ensure_max_length(ftype, options)

                opts = []
                if options.get('choices'):
                    choices_str = ', '.join([f"('{k}', '{v}')" for k, v in options['choices']])
                    opts.append(f'choices=({choices_str},)')
                if options.get('max_length'):
                    opts.append(f'max_length={options["max_length"]}')
                if options.get('default') is not None:
                    default = options['default']
                    if isinstance(default, str):
                        opts.append(f'default="{default}"')
                    elif isinstance(default, bool):
                        opts.append(f'default={str(default)}')
                    else:
                        opts.append(f'default={default}')
                if options.get('null'):
                    opts.append('null=True')
                if options.get('blank'):
                    opts.append('blank=True')
                if options.get('unique'):
                    opts.append('unique=True')
                if options.get('help_text'):
                    opts.append(f'help_text="{options["help_text"]}"')

                opt_str = ', '.join(opts)
                if opt_str:
                    model_code_lines.append(f'    {fname} = models.{ftype}({opt_str})')
                else:
                    model_code_lines.append(f'    {fname} = models.{ftype}()')
        else:
            model_code_lines.append('    pass')

        model_code_lines.extend([
            '',
            '    def __str__(self):',
            '        return self.email or self.username',
        ])

        model_code = '\n'.join(model_code_lines)
        (app_dir / "models.py").write_text(model_code, encoding='utf-8')

        custom_field_names = [f['name'] for f in custom_fields]

        # UserSerializer
        user_serializer_fields = [
            'id', 'username', 'email', 'first_name', 'last_name', 'date_joined'
        ] + custom_field_names
        user_serializer_fields_str = ', '.join([f"'{f}'" for f in user_serializer_fields])

        # RegisterSerializer
        register_serializer_fields = [
            'username', 'password', 'password2', 'email', 'first_name', 'last_name'
        ] + custom_field_names
        register_serializer_fields_str = ', '.join([f"'{f}'" for f in register_serializer_fields])

        # RegisterResponseSerializer fields
        register_resp_lines = []
        for fname in custom_field_names:
            register_resp_lines.append(f'    {fname} = serializers.CharField(allow_blank=True, required=False)')
        register_resp_lines.append('    id = serializers.IntegerField()')
        register_resp_lines.append('    username = serializers.CharField()')
        register_resp_lines.append('    email = serializers.EmailField(allow_blank=True)')
        register_resp_lines.append('    first_name = serializers.CharField(allow_blank=True)')
        register_resp_lines.append('    last_name = serializers.CharField(allow_blank=True)')
        register_resp_lines.append('    date_joined = serializers.DateTimeField()')
        register_resp_fields_str = '\n'.join(register_resp_lines)

        serializers_code = f'''from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ({user_serializer_fields_str})

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = ({register_serializer_fields_str})

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({{"password": "Password fields didn't match."}})
        return attrs

    def create(self, validated_data):
        validated_data.pop("password2", None)
        user = User.objects.create_user(**validated_data)
        return user

class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField()

class LoginResponseSerializer(serializers.Serializer):
    access = serializers.CharField()
    refresh = serializers.CharField()
    user = UserSerializer()

class RegisterResponseSerializer(serializers.Serializer):
{register_resp_fields_str}
'''
        (app_dir / "serializers.py").write_text(serializers_code, encoding='utf-8')

        views_code = '''from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth import authenticate, get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
from drf_spectacular.utils import extend_schema, OpenApiResponse
from .serializers import (
    RegisterSerializer,
    UserSerializer,
    LoginSerializer,
    LoginResponseSerializer,
    RegisterResponseSerializer,
)

User = get_user_model()

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (permissions.AllowAny,)
    serializer_class = RegisterSerializer

    @extend_schema(
        request=RegisterSerializer,
        responses={
            201: RegisterResponseSerializer,
            400: OpenApiResponse(description="Validation error"),
        }
    )
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)


class LoginView(APIView):
    permission_classes = (permissions.AllowAny,)

    @extend_schema(
        request=LoginSerializer,
        responses={
            200: LoginResponseSerializer,
            401: OpenApiResponse(description="Invalid credentials"),
        }
    )
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        username = serializer.validated_data['username']
        password = serializer.validated_data['password']

        user = authenticate(request=request, username=username, password=password)

        if user is None:
            return Response(
                {"error": "Invalid credentials"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        refresh = RefreshToken.for_user(user)
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data,
        })


class LogoutView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    @extend_schema(
        request=None,
        responses={
            205: OpenApiResponse(description="Successfully logged out"),
            400: OpenApiResponse(description="Invalid or missing refresh token"),
        }
    )
    def post(self, request):
        try:
            refresh_token = request.data.get("refresh")
            if not refresh_token:
                return Response(
                    {"error": "Refresh token is required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response(
                {"detail": "Logged out successfully"},
                status=status.HTTP_205_RESET_CONTENT,
            )
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )


class MeView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    @extend_schema(
        responses={
            200: UserSerializer,
            401: OpenApiResponse(description="Not authenticated"),
        }
    )
    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)
'''
        (app_dir / "views.py").write_text(views_code, encoding='utf-8')

        admin_list_display = [
            'id', 'username', 'email', 'first_name', 'last_name'
        ] + custom_field_names
        admin_list_display_str = ', '.join([f"'{f}'" for f in admin_list_display])

        admin_search_fields = ['username', 'email', 'first_name', 'last_name'] + custom_field_names
        admin_search_fields_str = ', '.join([f"'{f}'" for f in admin_search_fields])

        admin_code = f'''from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User

class CustomUserAdmin(UserAdmin):
    list_display = ({admin_list_display_str})
    search_fields = ({admin_search_fields_str})
    # You can add more admin customisations here

admin.site.register(User, CustomUserAdmin)
'''
        (app_dir / "admin.py").write_text(admin_code, encoding='utf-8')

        urls_code = '''from django.urls import path
from . import views

urlpatterns = [
    path('register/', views.RegisterView.as_view(), name='register'),
    path('login/', views.LoginView.as_view(), name='login'),
    path('logout/', views.LogoutView.as_view(), name='logout'),
    path('me/', views.MeView.as_view(), name='me'),
]
'''
        (app_dir / "urls.py").write_text(urls_code, encoding='utf-8')

        settings_path = self.workspace / 'config' / 'settings.py'
        if settings_path.exists():
            with open(settings_path, 'r', encoding='utf-8') as f:
                content = f.read()

            pattern = r'(INSTALLED_APPS\s*=\s*\[)([^\]]*)(\])'
            def repl(match):
                apps = match.group(2)
                if "'users'" not in apps and '"users"' not in apps:
                    lines = apps.split(',')
                    insert_pos = len(lines)
                    for i, line in enumerate(reversed(lines)):
                        if line.strip():
                            insert_pos = len(lines) - i
                            break
                    lines.insert(insert_pos, "    'users',")
                    if "'rest_framework_simplejwt.token_blacklist'" not in apps and '"rest_framework_simplejwt.token_blacklist"' not in apps:
                        lines.insert(insert_pos + 1, "    'rest_framework_simplejwt.token_blacklist',")
                    return f"{match.group(1)}{','.join(lines)}{match.group(3)}"
                return match.group(0)
            content = re.sub(pattern, repl, content, flags=re.DOTALL)

            if "AUTH_USER_MODEL" not in content:
                content += "\n\n# Custom user model\nAUTH_USER_MODEL = 'users.User'\n"
            else:
                content = re.sub(r"AUTH_USER_MODEL\s*=\s*['\"][^'\"]+['\"]", "AUTH_USER_MODEL = 'users.User'", content)

            settings_path.write_text(content, encoding='utf-8')

        urls_path = self.workspace / 'config' / 'urls.py'
        if urls_path.exists():
            with open(urls_path, 'r', encoding='utf-8') as f:
                content = f.read()

            if "include('users.urls')" not in content:
                if "include" not in content:
                    content = content.replace("from django.urls import path", "from django.urls import path, include")
                lines = content.splitlines()
                new_lines = []
                inserted = False
                for line in lines:
                    new_lines.append(line)
                    if "path('admin/'" in line or "path(''" in line or "path('/'" in line:
                        if not inserted:
                            new_lines.append("    path('users/', include('users.urls')),")
                            inserted = True
                new_content = "\n".join(new_lines)
                urls_path.write_text(new_content, encoding='utf-8')

        print("[INFO] Authentication app (users) created/updated with custom fields.")

    # ─── Legacy enable_authentication ──────────────────────────────
    def enable_authentication(self):
        self._write_auth_app()
        self.sync_files()
        self.run_migrations()

    def write_requirements(self):
        req_path = self.workspace / "requirements.txt"
        content = '''Django>=4.2
djangorestframework>=3.14.0
djangorestframework-simplejwt>=5.3.0
django-cors-headers>=4.0.0
django-filter>=24.0
python-decouple>=3.8
drf-spectacular>=0.27.0
gunicorn>=23.0.0
dj-database-url>=2.0.0
'''
        req_path.write_text(content, encoding='utf-8')
        print(f"[INFO] Overwrote {req_path} with all dependencies.")

    def install_dependencies(self):
        python_exe = get_python_executable()
        req_path = self.workspace / "requirements.txt"
        print(f"[INFO] Installing requirements from {req_path}...")
        try:
            subprocess.run(
                [python_exe, "-m", "pip", "install", "-r", str(req_path)],
                cwd=str(self.workspace),
                check=True,
                capture_output=True,
                text=True,
                timeout=180,
            )
            print("[INFO] Requirements installed successfully.")
        except subprocess.CalledProcessError as e:
            print(f"[WARNING] pip install failed: {e.stderr}")
        except subprocess.TimeoutExpired:
            print("[WARNING] pip install timed out. Continuing anyway.")
        except Exception as e:
            print(f"[WARNING] pip install error: {e}")

    def run_migrations(self):
        python_exe = get_python_executable()
        cwd = str(self.workspace)
        print("[INFO] Running migrations...")

        reset_on_conflict = self.blueprint.data.get('project_settings', {}).get('reset_database_on_conflict', True)

        try:
            self._run_makemigrations(python_exe, cwd)
            self._run_migrate(python_exe, cwd)
            print("[INFO] Migrations completed.")
        except subprocess.CalledProcessError as e:
            stderr = e.stderr or ""
            if "InconsistentMigrationHistory" in stderr or "django.db.migrations" in stderr:
                if reset_on_conflict:
                    print("[INFO] Migration conflict detected. Resetting database and migrations...")
                    self._reset_database_and_migrations()
                    try:
                        self._run_makemigrations(python_exe, cwd)
                        self._run_migrate(python_exe, cwd)
                        print("[INFO] Migrations completed after reset.")
                    except subprocess.CalledProcessError as retry_err:
                        raise RuntimeError(f"Migrations still fail after reset:\n{retry_err.stderr}")
                else:
                    raise RuntimeError(f"Migrations failed:\n{e.stderr}")
            else:
                raise RuntimeError(f"Migrations failed:\n{e.stderr}")
        except subprocess.TimeoutExpired as e:
            raise RuntimeError(f"Migrations timed out after 60 seconds. Output: {e.stdout}\nError: {e.stderr}")

    def _run_makemigrations(self, python_exe, cwd):
        subprocess.run(
            [python_exe, 'manage.py', 'makemigrations', '--noinput'],
            cwd=cwd,
            check=True,
            capture_output=True,
            text=True,
            timeout=60
        )

    def _run_migrate(self, python_exe, cwd):
        subprocess.run(
            [python_exe, 'manage.py', 'migrate', '--noinput'],
            cwd=cwd,
            check=True,
            capture_output=True,
            text=True,
            timeout=60
        )

    def _reset_database_and_migrations(self):
        db_path = self.workspace / "db.sqlite3"
        if db_path.exists():
            db_path.unlink()
            print("[INFO] Deleted db.sqlite3")
        for item in self.workspace.iterdir():
            if not item.is_dir():
                continue
            migrations_dir = item / "migrations"
            if not migrations_dir.exists():
                continue
            for file in migrations_dir.iterdir():
                if file.name == "__init__.py":
                    continue
                if file.suffix == ".py" or file.suffix == ".pyc":
                    file.unlink()
                    print(f"[INFO] Deleted migration file: {file}")
        print("[INFO] All migration files (except __init__.py) deleted.")

    def sync_files(self):
        paths = []
        for root, dirs, files in os.walk(self.workspace):
            for file in files:
                rel_path = os.path.relpath(os.path.join(root, file), self.workspace)
                paths.append(rel_path)
        sync_project_files_table(self.project, paths)
        self._clean_orphaned_models()
        sync_project_config(self.workspace)

    def _clean_orphaned_models(self):
        if not hasattr(self.project, 'blueprint'):
            return
        blueprint = self.project.blueprint
        models = blueprint.data.get('models', [])
        existing_apps = get_existing_apps(self.workspace)
        new_models = [m for m in models if m.get('app_name') in existing_apps]
        if len(new_models) != len(models):
            blueprint.data['models'] = new_models
            _retry_db_operation(
                lambda: blueprint.save(update_fields=['data']),
                operation_name="blueprint save (clean orphaned models)"
            )
            print(f"[INFO] Cleaned {len(models) - len(new_models)} orphaned model(s).")

    def delete_app(self, app_name):
        delete_app(self.workspace, app_name, self.project)
        self.sync_files()

    def get_apps_structure(self):
        structure = []
        workspace = self.workspace
        for item in workspace.iterdir():
            if not item.is_dir():
                continue
            if item.name in ['config', 'venv', 'env', '__pycache__', 'project_workspaces']:
                continue
            if (item / 'models.py').exists() or (item / '__init__.py').exists():
                app_info = {
                    "name": item.name,
                    "models": self._extract_classes(item / 'models.py', ['models.Model', 'AbstractUser', 'AbstractBaseUser']),
                    "serializers": self._extract_classes(item / 'serializers.py', ['serializers.ModelSerializer']),
                    "views": self._extract_classes(item / 'views.py', ['APIView', 'ViewSet', 'ModelViewSet']),
                    "urls": self._extract_functions(item / 'urls.py'),
                    "admin": self._extract_classes(item / 'admin.py', ['admin.ModelAdmin']),
                    "tests": self._extract_classes(item / 'tests.py', ['TestCase']),
                }
                structure.append(app_info)
        return structure

    def _extract_classes(self, file_path, base_class_patterns):
        if not file_path.exists():
            return []
        if isinstance(base_class_patterns, str):
            base_class_patterns = [base_class_patterns]
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                source = f.read()
            tree = ast.parse(source)
            classes = []
            for node in ast.walk(tree):
                if isinstance(node, ast.ClassDef):
                    for base in node.bases:
                        base_name = None
                        if isinstance(base, ast.Attribute):
                            base_name = base.attr
                        elif isinstance(base, ast.Name):
                            base_name = base.id
                        if base_name and base_name in base_class_patterns:
                            classes.append(node.name)
                            break
            return classes
        except Exception:
            return []

    def _extract_functions(self, file_path):
        if not file_path.exists():
            return []
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                source = f.read()
            tree = ast.parse(source)
            functions = []
            for node in ast.walk(tree):
                if isinstance(node, ast.FunctionDef):
                    functions.append(node.name)
            return functions
        except Exception:
            return []

    def create_new_app(self, app_name):
        app_name = sanitize_app_name(app_name)
        app_dir = self.workspace / app_name
        if app_dir.exists():
            raise Exception(f"App '{app_name}' already exists.")
        app_dir.mkdir(parents=True)
        (app_dir / "__init__.py").touch()
        migrations_dir = app_dir / "migrations"
        migrations_dir.mkdir(exist_ok=True)
        (migrations_dir / "__init__.py").touch()

        (app_dir / 'apps.py').write_text(f'''from django.apps import AppConfig

class {app_name.capitalize()}Config(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = '{app_name}'
''', encoding='utf-8')
        (app_dir / 'models.py').write_text('from django.db import models\n\n# Create your models here.\n', encoding='utf-8')
        (app_dir / 'views.py').write_text('from django.shortcuts import render\n\n# Create your views here.\n', encoding='utf-8')
        (app_dir / 'serializers.py').write_text('from rest_framework import serializers\n\n', encoding='utf-8')
        (app_dir / 'urls.py').write_text('from django.urls import path\nfrom . import views\n\nurlpatterns = [\n    # path(\'example/\', views.example, name=\'example\'),\n]\n', encoding='utf-8')
        (app_dir / 'admin.py').write_text('from django.contrib import admin\n\n# Register your models here.\n', encoding='utf-8')
        (app_dir / 'tests.py').write_text('from django.test import TestCase\n\n# Create your tests here.\n', encoding='utf-8')
        self.sync_files()

    def reset_database(self):
        db_path = self.workspace / "db.sqlite3"
        if db_path.exists():
            db_path.unlink()
            print("[INFO] Deleted db.sqlite3")
        for item in self.workspace.iterdir():
            if not item.is_dir():
                continue
            migrations_dir = item / "migrations"
            if not migrations_dir.exists():
                continue
            for file in migrations_dir.iterdir():
                if file.name == "__init__.py":
                    continue
                if file.suffix == ".py" or file.suffix == ".pyc":
                    file.unlink()
                    print(f"[INFO] Deleted migration file: {file}")
        print("[INFO] All migration files (except __init__.py) deleted.")
        self.run_migrations()