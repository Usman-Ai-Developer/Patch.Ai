# backend/builder/services/backend/django/writers/serializers.py
from pathlib import Path
from ....helpers import clean_app_models, get_api_defaults

def write_serializers(workspace, app_name, blueprint):
    app_dir = workspace / app_name
    app_dir.mkdir(parents=True, exist_ok=True)
    models = blueprint.data.get('models', [])
    app_models = clean_app_models(models, app_name)

    if not app_models:
        content = '''from rest_framework import serializers

# Serializers go here
'''
    else:
        lines = ['from rest_framework import serializers']
        lines.append('from .models import ' + ', '.join([m['name'] for m in app_models]))
        lines.append('')

        all_models_map = {m['name']: m for m in app_models}

        for model in app_models:
            name = model['name']
            api = model.get('api', get_api_defaults())
            serializer_type = api.get('serializer_type', 'simple')

            fields = model.get('fields', [])
            field_names = [f['name'] for f in fields if f['name'] and f['name'].isidentifier()]
            if not field_names:
                field_names = ['id']

            if serializer_type == 'simple':
                lines.append(f'class {name}Serializer(serializers.ModelSerializer):')
                lines.append(f'    class Meta:')
                lines.append(f'        model = {name}')
                lines.append(f'        fields = {field_names}')
                lines.append('')
            else:
                rel_fields = []
                for f in fields:
                    if f['type'] in ['ForeignKey', 'OneToOneField']:
                        rel_field = f['name']
                        to_model = f.get('options', {}).get('to')
                        if to_model and to_model in all_models_map:
                            rel_fields.append((rel_field, to_model))
                lines.append(f'class {name}Serializer(serializers.ModelSerializer):')
                for rel_field, to_model in rel_fields:
                    lines.append(f'    {rel_field} = {to_model}Serializer()')
                lines.append(f'    class Meta:')
                lines.append(f'        model = {name}')
                lines.append(f'        fields = {field_names}')
                lines.append('')

        content = '\n'.join(lines)

    (app_dir / "serializers.py").write_text(content, encoding='utf-8')