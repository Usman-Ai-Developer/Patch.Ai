# backend/builder/services/backend/django/writers/models.py
from pathlib import Path
from ....helpers import clean_app_models, RELATION_FIELD_TYPES

def write_models(workspace, app_name, blueprint):
    app_dir = workspace / app_name
    app_dir.mkdir(parents=True, exist_ok=True)
    models = blueprint.data.get('models', [])
    app_models = clean_app_models(models, app_name)

    if not app_models:
        content = '''from django.db import models

# Create your models here.
'''
    else:
        lines = ['from django.db import models']
        needs_abstract_user = any(m['name'] == 'User' and app_name == 'users' for m in app_models)
        if needs_abstract_user:
            lines.append('from django.contrib.auth.models import AbstractUser')
        lines.append('')

        # Build a map of model name -> (app_name, model_dict) for all models
        all_models_map = {}
        for m in models:
            all_models_map[m['name']] = (m.get('app_name'), m)

        for model in app_models:
            name = model.get('name', 'Model')
            fields = model.get('fields', [])
            
            # Skip password and confirm password fields for User model (they come from AbstractUser)
            if app_name == 'users' and name == 'User':
                # Filter out password-related fields (they are already in AbstractUser)
                fields = [f for f in fields if f['name'] not in ('password', 'confirm_password', 'confirm pssword')]
                base_class = 'AbstractUser'
            else:
                base_class = 'models.Model'
            
            lines.append(f'\nclass {name}({base_class}):')
            if not fields:
                lines.append('    pass')
            else:
                for field in fields:
                    field_name = field.get('name', 'field')
                    field_type = field.get('type', 'CharField')
                    options = field.get('options', {})
                    opts = []
                    
                    # ─── Handle PasswordField ──────────────────────────────
                    if field_type == 'PasswordField':
                        # Django does not have models.PasswordField; use CharField
                        field_type = 'CharField'
                        # Ensure max_length is set, default 128
                        if 'max_length' not in options or not options['max_length']:
                            options['max_length'] = 128
                        # Add a help_text note if not present
                        if 'help_text' not in options or not options['help_text']:
                            options['help_text'] = "Password"
                    
                    # ─── Handle relations ───────────────────────────
                    if field_type in RELATION_FIELD_TYPES:
                        to_model = options.get('to')
                        if to_model:
                            # Check if target model is in a different app
                            target_app = None
                            if to_model in all_models_map:
                                target_app = all_models_map[to_model][0]
                            # If target app is different, prefix with app label
                            if target_app and target_app != app_name:
                                # Only prefix if not already prefixed
                                if '.' not in to_model:
                                    to_model = f"{target_app}.{to_model}"
                            opts.append(f"'{to_model}'")
                        else:
                            field_type = 'CharField'
                            opts = ['max_length=255']
                    else:
                        # ─── Non-relation fields ────────────────────
                        if field_name == 'id':
                            opts.append('primary_key=True')
                        if field_type in ['CharField', 'TextField', 'EmailField', 'URLField', 'PasswordField']:
                            max_length = options.get('max_length')
                            if max_length:
                                opts.append(f'max_length={max_length}')
                        if field_type == 'DecimalField':
                            max_digits = options.get('max_digits', 10)
                            decimal_places = options.get('decimal_places', 2)
                            opts.append(f'max_digits={max_digits}')
                            opts.append(f'decimal_places={decimal_places}')
                    
                    # ─── Common options ─────────────────────────────
                    if options.get('null') is not None:
                        opts.append(f'null={options["null"]}')
                    if options.get('blank') is not None:
                        opts.append(f'blank={options["blank"]}')
                    if options.get('unique'):
                        opts.append('unique=True')
                    if options.get('primary_key'):
                        opts.append('primary_key=True')
                    if options.get('db_index'):
                        opts.append('db_index=True')
                    if options.get('help_text'):
                        opts.append(f'help_text="{options["help_text"]}"')
                    
                    # ─── Auto_now & auto_now_add ────────────────────
                    if field_type in ['DateField', 'DateTimeField']:
                        if options.get('auto_now'):
                            opts.append('auto_now=True')
                        if options.get('auto_now_add'):
                            opts.append('auto_now_add=True')
                    
                    # ─── Default value for required fields ──────────
                    is_required = not options.get('null', False) and not options.get('blank', False)
                    default = options.get('default')
                    if is_required and default is None:
                        if field_type in ['CharField', 'TextField', 'EmailField', 'URLField', 'PasswordField']:
                            default = ""
                        elif field_type in ['IntegerField', 'FloatField', 'DecimalField']:
                            default = 0
                        elif field_type == 'BooleanField':
                            default = False
                    if default is not None:
                        if isinstance(default, str):
                            opts.append(f'default="{default}"')
                        elif isinstance(default, bool):
                            opts.append(f'default={str(default)}')
                        elif default is None:
                            opts.append('default=None')
                        else:
                            opts.append(f'default={default}')
                    
                    # ─── Relation-specific options ──────────────────
                    if field_type in RELATION_FIELD_TYPES:
                        if options.get('on_delete') and field_type != 'ManyToManyField':
                            opts.append(f'on_delete=models.{options["on_delete"]}')
                        if options.get('related_name'):
                            opts.append(f'related_name="{options["related_name"]}"')
                        if field_type == 'ManyToManyField' and options.get('symmetrical') is not None:
                            opts.append(f'symmetrical={str(options["symmetrical"])}')
                    
                    opt_str = ', '.join(opts)
                    if opt_str:
                        lines.append(f'    {field_name} = models.{field_type}({opt_str})')
                    else:
                        lines.append(f'    {field_name} = models.{field_type}()')
                
                # ─── Meta Class ──────────────────────────────────────
                meta = model.get('meta', {})
                has_meta = any([
                    meta.get('db_table'),
                    meta.get('verbose_name'),
                    meta.get('verbose_name_plural'),
                    meta.get('ordering'),
                    meta.get('unique_together'),
                ])
                if has_meta:
                    lines.append('')
                    lines.append('    class Meta:')
                    if meta.get('db_table'):
                        lines.append(f'        db_table = "{meta["db_table"]}"')
                    if meta.get('verbose_name'):
                        lines.append(f'        verbose_name = "{meta["verbose_name"]}"')
                    if meta.get('verbose_name_plural'):
                        lines.append(f'        verbose_name_plural = "{meta["verbose_name_plural"]}"')
                    if meta.get('ordering'):
                        lines.append(f'        ordering = {meta["ordering"]}')
                    if meta.get('unique_together'):
                        lines.append(f'        unique_together = {meta["unique_together"]}')

                # ─── __str__ ──────────────────────────────────────────
                first_field = fields[0]['name'] if fields else None
                display_field = None
                if first_field in ['name', 'title', 'slug', 'username', 'email']:
                    display_field = first_field
                else:
                    for f in fields:
                        if f.get('type') in ['CharField', 'TextField', 'EmailField']:
                            display_field = f['name']
                            break
                if display_field:
                    lines.append(f'\n    def __str__(self):')
                    lines.append(f'        return self.{display_field}')
                else:
                    lines.append(f'\n    def __str__(self):')
                    lines.append(f'        return f"{{self.id}}"')
        content = '\n'.join(lines)
    (app_dir / "models.py").write_text(content, encoding='utf-8')