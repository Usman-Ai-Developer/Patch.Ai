# backend/builder/services/backend/django/writers/admin.py
from pathlib import Path
from ....helpers import clean_app_models

def write_admin(workspace, app_name, blueprint):
    app_dir = workspace / app_name
    app_dir.mkdir(parents=True, exist_ok=True)
    models = blueprint.data.get('models', [])
    app_models = clean_app_models(models, app_name)

    if not app_models:
        content = '''from django.contrib import admin

# Register your models here.
'''
    else:
        lines = ['from django.contrib import admin']
        lines.append('from .models import ' + ', '.join([m['name'] for m in app_models]))
        lines.append('')

        all_models = blueprint.data.get('models', [])
        model_map = {}
        for m in all_models:
            full_key = f"{m['app_name']}.{m['name']}"
            model_map[full_key] = m
            model_map[m['name']] = m

        for model in app_models:
            name = model['name']
            admin_settings = model.get('admin', {})
            enabled = admin_settings.get('enabled', True)

            if not enabled:
                lines.append(f'# {name} is not registered (disabled in admin settings)')
                continue

            inlines = admin_settings.get('inlines', [])
            inline_classes = []
            if inlines:
                for inline_conf in inlines:
                    target = inline_conf.get('model', '')
                    if not target:
                        continue
                    target_model = model_map.get(target)
                    if not target_model:
                        for m in all_models:
                            if m['name'] == target:
                                target_model = m
                                break
                    if not target_model:
                        continue
                    # Self‑referential check
                    if target_model['name'] == name:
                        continue
                    has_fk = False
                    for f in target_model.get('fields', []):
                        ftype = f.get('type')
                        if ftype in ['ForeignKey', 'OneToOneField']:
                            to = f.get('options', {}).get('to')
                            if to and (to == f"{app_name}.{name}" or to == name):
                                has_fk = True
                                break
                    if not has_fk:
                        continue
                    inline_name = f"{target_model['name']}Inline"
                    inline_type = inline_conf.get('type', 'tabular')
                    inline_class = f"admin.{inline_type.capitalize()}Inline"
                    extra = inline_conf.get('extra', 1)
                    lines.append(f'class {inline_name}({inline_class}):')
                    lines.append(f'    model = {target_model["name"]}')
                    lines.append(f'    extra = {extra}')
                    lines.append('')
                    inline_classes.append(inline_name)

            lines.append(f'@admin.register({name})')
            lines.append(f'class {name}Admin(admin.ModelAdmin):')

            list_display = admin_settings.get('list_display', [])
            if list_display:
                lines.append(f'    list_display = {list_display}')
            else:
                lines.append("    list_display = ['id']")

            list_filter = admin_settings.get('list_filter', [])
            if list_filter:
                lines.append(f'    list_filter = {list_filter}')
            search_fields = admin_settings.get('search_fields', [])
            if search_fields:
                lines.append(f'    search_fields = {search_fields}')
            ordering = admin_settings.get('ordering', [])
            if ordering:
                lines.append(f'    ordering = {ordering}')
            list_editable = admin_settings.get('list_editable', [])
            if list_editable:
                lines.append(f'    list_editable = {list_editable}')
            read_only_fields = admin_settings.get('read_only_fields', [])
            if read_only_fields:
                lines.append(f'    read_only_fields = {read_only_fields}')
            list_per_page = admin_settings.get('list_per_page', 100)
            if list_per_page != 100:
                lines.append(f'    list_per_page = {list_per_page}')
            actions_on_top = admin_settings.get('actions_on_top', True)
            if not actions_on_top:
                lines.append('    actions_on_top = False')

            fieldsets = admin_settings.get('fieldsets', [])
            if fieldsets:
                lines.append('    fieldsets = (')
                for fs in fieldsets:
                    fs_name = fs.get('name', '')
                    fs_fields = fs.get('fields', [])
                    if not fs_fields:
                        continue
                    fields_str = ', '.join([f"'{f}'" for f in fs_fields])
                    lines.append(f"        ('{fs_name}', {{'fields': ({fields_str},)}}),")
                lines.append('    )')

            if inline_classes:
                lines.append(f'    inlines = [{", ".join(inline_classes)}]')
            lines.append('')

        content = '\n'.join(lines)

    (app_dir / "admin.py").write_text(content, encoding='utf-8')