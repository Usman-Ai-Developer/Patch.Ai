import re
import sys
import keyword
from pathlib import Path

def pluralize(word):
    # Mirrors frontend/components/visualbuilder/apiUtils.js's pluralize().
    # Keep both in sync by hand ONLY for the algorithm; the empty/falsy
    # guard below matches the JS `if (!word) return word;` behavior on
    # purpose (previously this returned "s" for "", diverging from JS).
    # Covered by the contract test in builder/tests.py
    # (test_pluralize_matches_js_contract), which runs both implementations
    # against tests_fixtures/pluralize_cases.json.
    if not word:
        return word
    if word.endswith('y') and len(word) > 1 and word[-2] not in 'aeiou':
        return word[:-1] + 'ies'
    if word.endswith(('s', 'x', 'z', 'ch', 'sh')):
        return word + 'es'
    return word + 's'

def get_python_executable():
    return sys.executable

def sanitize_app_name(name):
    if not name:
        return 'api'
    name = re.sub(r'[^a-zA-Z0-9_]', '_', name)
    if not re.match(r'^[a-zA-Z_]', name):
        name = 'app_' + name
    return name

def is_valid_identifier(name):
    return (
        bool(name)
        and re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', name) is not None
        and not keyword.iskeyword(name)
    )

def sanitize_identifier(name, fallback):
    if not name:
        return fallback
    candidate = re.sub(r'[^a-zA-Z0-9_]', '_', str(name))
    if not re.match(r'^[a-zA-Z_]', candidate):
        candidate = '_' + candidate
    if keyword.iskeyword(candidate):
        candidate = candidate + '_field'
    return candidate or fallback

VALID_FIELD_TYPES = {
    'CharField', 'TextField', 'IntegerField', 'FloatField', 'DecimalField',
    'BooleanField', 'DateField', 'DateTimeField', 'EmailField', 'URLField',
    'ForeignKey', 'ManyToManyField', 'OneToOneField', 'PasswordField',
}
RELATION_FIELD_TYPES = {'ForeignKey', 'ManyToManyField', 'OneToOneField'}
REQUIRES_MAX_LENGTH = {'CharField', 'EmailField', 'URLField', 'PasswordField'}
DEFAULT_MAX_LENGTH = 255

def get_api_defaults():
    return {
        "enabled": True,
        "permissions": "IsAuthenticated",
        "pagination": {
            "type": "PageNumberPagination",
            "page_size": 20,
        },
        "filter_fields": [],
        "search_fields": [],
        "ordering_fields": "__all__",
        "serializer_type": "simple",
    }

def get_admin_defaults():
    return {
        "enabled": True,
        "list_display": [],
        "list_filter": [],
        "search_fields": [],
        "ordering": [],
        "list_editable": [],
        "read_only_fields": [],
        "list_per_page": 100,
        "actions_on_top": True,
        "fieldsets": [],
        "inlines": [],
    }

def get_permissions_defaults():
    return {
        "enabled": False,
        "roles": [
            {"name": "Admin", "permissions": ["create", "read", "update", "delete"]},
            {"name": "Editor", "permissions": ["create", "read", "update"]},
            {"name": "Viewer", "permissions": ["read"]},
        ],
    }

def get_project_settings_defaults():
    return {
        "reset_database_on_conflict": True,
    }

def clean_app_models(models, app_name):
    app_models = [m for m in models if m.get('app_name') == app_name]
    cleaned = []
    for model in app_models:
        name = sanitize_identifier(model.get('name'), 'Model')
        fields = []
        seen_names = set()
        for f in model.get('fields', []):
            fname = sanitize_identifier(f.get('name'), 'field')
            base, n = fname, 1
            while fname in seen_names:
                fname = f'{base}_{n}'
                n += 1
            seen_names.add(fname)

            ftype = f.get('type') if f.get('type') in VALID_FIELD_TYPES else 'CharField'
            options = dict(f.get('options') or {})

            if ftype in RELATION_FIELD_TYPES and not options.get('to'):
                ftype = 'CharField'
                options = {'max_length': DEFAULT_MAX_LENGTH}

            if ftype in REQUIRES_MAX_LENGTH and not options.get('max_length'):
                if ftype == 'PasswordField':
                    options['max_length'] = 128
                else:
                    options['max_length'] = DEFAULT_MAX_LENGTH

            fields.append({'name': fname, 'type': ftype, 'options': options})

        # ─── Clean Meta options ─────────────────────────────────────────
        raw_meta = model.get('meta', {})
        meta = {
            'db_table': raw_meta.get('db_table', ''),
            'verbose_name': raw_meta.get('verbose_name', ''),
            'verbose_name_plural': raw_meta.get('verbose_name_plural', ''),
            'ordering': raw_meta.get('ordering', []),
            'unique_together': raw_meta.get('unique_together', []),
        }

        # ─── Clean Admin options ─────────────────────────────────────────
        default_admin = get_admin_defaults()
        raw_admin = model.get('admin', {})
        admin = {
            'enabled': raw_admin.get('enabled', default_admin['enabled']),
            'list_display': raw_admin.get('list_display', default_admin['list_display']),
            'list_filter': raw_admin.get('list_filter', default_admin['list_filter']),
            'search_fields': raw_admin.get('search_fields', default_admin['search_fields']),
            'ordering': raw_admin.get('ordering', default_admin['ordering']),
            'list_editable': raw_admin.get('list_editable', default_admin['list_editable']),
            'read_only_fields': raw_admin.get('read_only_fields', default_admin['read_only_fields']),
            'list_per_page': raw_admin.get('list_per_page', default_admin['list_per_page']),
            'actions_on_top': raw_admin.get('actions_on_top', default_admin['actions_on_top']),
            'fieldsets': raw_admin.get('fieldsets', default_admin['fieldsets']),
            'inlines': raw_admin.get('inlines', default_admin['inlines']),
        }

        # ─── Clean Permissions options ────────────────────────────────────
        default_permissions = get_permissions_defaults()
        raw_permissions = model.get('permissions')
        if not isinstance(raw_permissions, dict):
            raw_permissions = {}
        permissions = {
            'enabled': raw_permissions.get('enabled', default_permissions['enabled']),
            'roles': raw_permissions.get('roles', default_permissions['roles']),
        }

        cleaned_model = {
            'name': name,
            'app_name': app_name,
            'fields': fields,
            'relationships': model.get('relationships', []),
            'permissions': permissions,
            'filter_fields': model.get('filter_fields', []),
            'search_fields': model.get('search_fields', []),
            'ordering_fields': model.get('ordering_fields', '__all__'),
            'admin': admin,
            'api': model.get('api', get_api_defaults()),
            'meta': meta,
        }
        cleaned.append(cleaned_model)
    return cleaned

def get_existing_apps(workspace):
    workspace = Path(workspace)
    existing = set()
    for item in workspace.iterdir():
        if not item.is_dir():
            continue
        if item.name in ['config', 'venv', 'env', '__pycache__', 'project_workspaces']:
            continue
        if (item / 'models.py').exists() or (item / 'views.py').exists() or (item / 'apps.py').exists():
            existing.add(item.name)
    return existing