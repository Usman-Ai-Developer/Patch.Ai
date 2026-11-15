# backend/builder/services/backend/django/writers/project.py
import os
from pathlib import Path

def write_project_skeleton(workspace):
    manage_py = workspace / "manage.py"
    if manage_py.exists():
        return

    config_dir = workspace / "config"
    config_dir.mkdir(parents=True, exist_ok=True)

    settings_content = '''import os
from pathlib import Path
from decouple import config

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = config('SECRET_KEY', default='django-insecure-fake-key-for-dev')
DEBUG = config('DEBUG', default=True, cast=bool)
ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='localhost,127.0.0.1').split(',')

INSTALLED_APPS = [
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

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'
ASGI_APPLICATION = 'config.asgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}

CORS_ALLOW_ALL_ORIGINS = True

from datetime import timedelta
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=30),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
}

SPECTACULAR_SETTINGS = {
    'TITLE': 'API',
    'DESCRIPTION': 'Generated API',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
}
'''
    (config_dir / "settings.py").write_text(settings_content, encoding='utf-8')

    views_content = '''from django.shortcuts import render
from django.http import HttpResponse

def root(request):
    html = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Patch — Your Project</title>
    <link href="https://fonts.googleapis.com/css2?family=Geist:wght@100..900&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: radial-gradient(circle at center, #07141B 0%, #123C34 100%);
            font-family: 'Geist', -apple-system, BlinkMacSystemFont, sans-serif;
            color: #e4e4e7;
            padding: 1rem;
            overflow-x: hidden;
        }
        .glow {
            position: fixed;
            width: 600px;
            height: 600px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(78,223,145,0.08) 0%, transparent 70%);
            filter: blur(80px);
            pointer-events: none;
            z-index: 0;
        }
        .glow:nth-child(1) { top: -200px; left: -200px; }
        .glow:nth-child(2) { bottom: -200px; right: -200px; }
        .card {
            position: relative;
            z-index: 1;
            max-width: 720px;
            width: 100%;
            padding: 3rem 2rem;
            background: rgba(7, 15, 25, 0.92);
            backdrop-filter: blur(24px);
            border: 1px solid rgba(255, 255, 255, 0.06);
            border-radius: 28px;
            box-shadow: 0 40px 120px rgba(0,0,0,0.55);
            text-align: center;
        }
        .badge {
            display: inline-block;
            padding: 0.3rem 1rem;
            border-radius: 999px;
            background: rgba(78,223,145,0.15);
            color: #4edf91;
            font-size: 0.75rem;
            font-weight: 600;
            letter-spacing: 0.05em;
            text-transform: uppercase;
            margin-bottom: 1.5rem;
            border: 1px solid rgba(78,223,145,0.2);
        }
        h1 {
            font-size: 2.8rem;
            font-weight: 800;
            background: linear-gradient(135deg, #a78bfa, #60a5fa, #34d399);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 0.5rem;
            letter-spacing: -0.04em;
        }
        .subtitle {
            font-size: 1.2rem;
            color: #9ca3af;
            margin-bottom: 2rem;
            font-weight: 300;
        }
        .features {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: 1rem;
            margin: 2rem 0;
        }
        .feature {
            background: rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.06);
            border-radius: 16px;
            padding: 1rem 0.5rem;
            transition: all 0.2s ease;
        }
        .feature:hover {
            background: rgba(255,255,255,0.06);
            border-color: rgba(78,223,145,0.3);
            transform: translateY(-2px);
        }
        .feature .icon { font-size: 1.8rem; display: block; margin-bottom: 0.3rem; }
        .feature .label { font-size: 0.85rem; color: #d1d5db; }
        .footer {
            margin-top: 2.5rem;
            font-size: 0.85rem;
            color: #6b7280;
            border-top: 1px solid rgba(255,255,255,0.06);
            padding-top: 1.5rem;
        }
        .footer a {
            color: #4edf91;
            text-decoration: none;
            transition: color 0.2s;
        }
        .footer a:hover { color: #6efdab; text-decoration: underline; }
        .ai-pulse {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #4edf91;
            margin-left: 8px;
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0%, 100% { opacity: 0.4; transform: scale(0.8); }
            50% { opacity: 1; transform: scale(1.2); }
        }
        @media (max-width: 600px) {
            h1 { font-size: 2rem; }
            .card { padding: 2rem 1rem; }
        }
    </style>
</head>
<body>
    <div class="glow"></div>
    <div class="glow"></div>
    <div class="card">
        <div class="badge">✨ Ready to build</div>
        <h1>Patch</h1>
        <div class="subtitle">Your project is running <span class="ai-pulse"></span></div>
        <div class="features">
            <div class="feature"><span class="icon">⚡</span><span class="label">Fast &amp; modern</span></div>
            <div class="feature"><span class="icon">🔧</span><span class="label">Built with Django</span></div>
            <div class="feature"><span class="icon">🎨</span><span class="label">Customizable</span></div>
        </div>
        <div class="footer">
            Built with ❤️ using <a href="https://www.djangoproject.com/" target="_blank">Django</a> &bull;
            <a href="/admin/" target="_blank">Admin</a> &bull;
            <a href="/api/schema/swagger-ui/" target="_blank">API Docs</a>
        </div>
    </div>
</body>
</html>
    """
    return HttpResponse(html)
'''
    (config_dir / "views.py").write_text(views_content, encoding='utf-8')

    urls_content = '''from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView
from . import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', views.root, name='root'),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/schema/swagger-ui/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/schema/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
]
'''
    (config_dir / "urls.py").write_text(urls_content, encoding='utf-8')

    wsgi_content = '''import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

application = get_wsgi_application()
'''
    (config_dir / "wsgi.py").write_text(wsgi_content, encoding='utf-8')

    asgi_content = '''import os
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

application = get_asgi_application()
'''
    (config_dir / "asgi.py").write_text(asgi_content, encoding='utf-8')

    (config_dir / "__init__.py").touch()

    manage_content = '''#!/usr/bin/env python
import os
import sys

def main():
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed?"
        ) from exc
    execute_from_command_line(sys.argv)

if __name__ == '__main__':
    main()
'''
    manage_py.write_text(manage_content, encoding='utf-8')

    env_example = '''# Django
SECRET_KEY=django-insecure-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Database (optional, uses SQLite by default)
# DATABASE_URL=postgres://user:password@host:port/dbname

# CORS (for production)
# CORS_ALLOWED_ORIGINS=https://yourfrontend.com,https://www.yourfrontend.com

# Email (optional)
# EMAIL_HOST=smtp.gmail.com
# EMAIL_PORT=587
# EMAIL_HOST_USER=youremail@gmail.com
# EMAIL_HOST_PASSWORD=yourpassword
# EMAIL_USE_TLS=True
'''
    (workspace / ".env.example").write_text(env_example, encoding='utf-8')

    gunicorn_conf = '''import os

bind = "0.0.0.0:" + os.environ.get("PORT", "8000")
workers = int(os.environ.get("WEB_CONCURRENCY", 2))
threads = int(os.environ.get("PYTHON_MAX_THREADS", 4))
timeout = 120
keepalive = 5

# Logging
accesslog = "-"
errorlog = "-"
loglevel = "info"

# Set Django settings module
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
'''
    (workspace / "gunicorn.conf.py").write_text(gunicorn_conf, encoding='utf-8')

    dockerfile = '''FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \\
    gcc \\
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn

# Copy project
COPY . .

# Collect static files
RUN python manage.py collectstatic --noinput

# Expose port
EXPOSE 8000

# Run gunicorn
CMD ["gunicorn", "-c", "gunicorn.conf.py", "config.wsgi:application"]
'''
    (workspace / "Dockerfile").write_text(dockerfile, encoding='utf-8')

    docker_compose = '''version: '3.8'

services:
  web:
    build: .
    ports:
      - "8000:8000"
    environment:
      - DJANGO_SETTINGS_MODULE=config.settings
      - SECRET_KEY=${SECRET_KEY}
      - DEBUG=False
      - ALLOWED_HOSTS=${ALLOWED_HOSTS:-localhost}
      - DATABASE_URL=${DATABASE_URL:-sqlite:///db.sqlite3}
      - CORS_ALLOWED_ORIGINS=${CORS_ALLOWED_ORIGINS:-http://localhost:3000}
    env_file:
      - .env
    volumes:
      - ./media:/app/media
      - ./staticfiles:/app/staticfiles
    restart: unless-stopped
'''
    (workspace / "docker-compose.yml").write_text(docker_compose, encoding='utf-8')