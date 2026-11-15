# backend/builder/services/backend/django/writers/urls.py
from pathlib import Path
from ....helpers import pluralize, clean_app_models

def write_urls(workspace, app_name, blueprint):
    app_dir = workspace / app_name
    app_dir.mkdir(parents=True, exist_ok=True)
    models = blueprint.data.get('models', [])
    app_models = clean_app_models(models, app_name)

    if not app_models:
        content = '''from django.urls import path, include
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
# router.register(r'example', ExampleViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
'''
    else:
        lines = ['from django.urls import path, include']
        lines.append('from rest_framework.routers import DefaultRouter')
        lines.append('from .views import ' + ', '.join([m['name'] + 'ViewSet' for m in app_models]))
        lines.append('')
        lines.append('router = DefaultRouter()')
        for model in app_models:
            name = model['name']
            plural = pluralize(name.lower())
            lines.append(f"router.register(r'{plural}', {model['name']}ViewSet, basename='{name.lower()}')")
        lines.append('')
        lines.append('urlpatterns = [')
        lines.append("    path('', include(router.urls)),")
        lines.append(']')
        content = '\n'.join(lines)
    (app_dir / "urls.py").write_text(content, encoding='utf-8')