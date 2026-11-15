# backend/builder/services/backend/django/writers/tests.py
from pathlib import Path
from ....helpers import clean_app_models

def write_tests(workspace, app_name, blueprint):
    app_dir = workspace / app_name
    app_dir.mkdir(parents=True, exist_ok=True)
    models = blueprint.data.get('models', [])
    app_models = clean_app_models(models, app_name)

    if not app_models:
        content = '''from django.test import TestCase

# Create your tests here.
'''
    else:
        lines = ['from django.test import TestCase']
        lines.append('from django.utils import timezone')
        lines.append('from .models import ' + ', '.join([m['name'] for m in app_models]))
        lines.append('')
        for model in app_models:
            name = model['name']
            fields = model.get('fields', [])
            required_kwargs = {}
            for f in fields:
                fname = f['name']
                ftype = f.get('type', 'CharField')
                options = f.get('options', {})
                if options.get('null') or options.get('blank'):
                    continue
                if ftype in ['CharField', 'TextField', 'EmailField', 'URLField']:
                    required_kwargs[fname] = f'test_{fname}'
                elif ftype in ['IntegerField', 'FloatField', 'DecimalField']:
                    required_kwargs[fname] = 0
                elif ftype == 'BooleanField':
                    required_kwargs[fname] = False
                elif ftype == 'DateField':
                    required_kwargs[fname] = '2020-01-01'
                elif ftype == 'DateTimeField':
                    required_kwargs[fname] = 'timezone.now()'
            lines.append(f'class {name}ModelTests(TestCase):')
            if required_kwargs:
                args_str = ', '.join([f'{k}={v}' if 'timezone' in str(v) else f'{k}={repr(v)}' for k, v in required_kwargs.items()])
                lines.append(f'    def test_{name.lower()}_creation(self):')
                lines.append(f'        obj = {name}.objects.create({args_str})')
                lines.append('        self.assertIsNotNone(obj)')
            else:
                lines.append(f'    def test_{name.lower()}_creation(self):')
                lines.append(f'        obj = {name}.objects.create()')
                lines.append('        self.assertIsNotNone(obj)')
            lines.append('')
        content = '\n'.join(lines)
    (app_dir / "tests.py").write_text(content, encoding='utf-8')