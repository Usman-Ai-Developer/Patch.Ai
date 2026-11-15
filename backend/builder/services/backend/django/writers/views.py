# backend/builder/services/backend/django/writers/views.py
from pathlib import Path
from ....helpers import pluralize, clean_app_models, get_api_defaults

def write_views(workspace, app_name, blueprint):
    app_dir = workspace / app_name
    app_dir.mkdir(parents=True, exist_ok=True)
    models = blueprint.data.get('models', [])
    app_models = clean_app_models(models, app_name)

    if not app_models:
        content = '''from rest_framework import viewsets

# Views go here
'''
    else:
        lines = [
            'from rest_framework import viewsets',
            'from rest_framework.permissions import AllowAny, IsAuthenticated, IsAdminUser',
            'from rest_framework.pagination import PageNumberPagination, LimitOffsetPagination, CursorPagination',
            'from django_filters.rest_framework import DjangoFilterBackend',
            'from rest_framework.filters import SearchFilter, OrderingFilter',
            'from drf_spectacular.utils import extend_schema',
            'from .models import ' + ', '.join([m['name'] for m in app_models]),
            'from .serializers import ' + ', '.join([m['name'] + 'Serializer' for m in app_models]),
        ]
        lines.append('')

        # ─── Collect all permission classes that will be used ──────
        used_perms = set()
        for model in app_models:
            perms = model.get('permissions', {})
            if perms.get('enabled', False):
                used_perms.add(f'Is{model["name"]}Owner')
                for role in perms.get('roles', []):
                    role_name = role.get('name', '')
                    if role_name:
                        used_perms.add(f'Is{role_name}')
            # Always add IsAdminOrReadOnly if API is not public
            api = model.get('api', get_api_defaults())
            if api.get('permissions', 'IsAuthenticated') != 'AllowAny':
                used_perms.add('IsAdminOrReadOnly')
            # "Owner Only" emits Is{Model}Owner in permission_classes; it has
            # to be imported even when the role matrix itself is disabled.
            if api.get('permissions') == 'IsOwner':
                used_perms.add(f'Is{model["name"]}Owner')

        # ─── Import custom permission classes ──────────────────────
        if used_perms:
            lines.append('from .permissions import (')
            for perm in sorted(used_perms):
                lines.append(f'    {perm},')
            lines.append(')')
            lines.append('')

        for model in app_models:
            name = model['name']
            api = model.get('api', get_api_defaults())
            
            perms = model.get('permissions', {})
            has_perms = perms.get('enabled', False)
            model_roles = perms.get('roles', []) if has_perms else []

            desc = f"ViewSet for the {name} model."
            
            lines.append(f'@extend_schema(tags=["{name.lower()}"], description="{desc}")')
            lines.append(f'class {name}ViewSet(viewsets.ModelViewSet):')
            lines.append(f'    """')
            lines.append(f'    {desc}')
            lines.append(f'    """')
            lines.append(f'    queryset = {name}.objects.all()')
            lines.append(f'    serializer_class = {name}Serializer')

            perm = api.get('permissions', 'IsAuthenticated')
            perm_classes = []
            
            if perm == 'AllowAny':
                perm_classes.append('AllowAny')
            elif perm == 'IsAdminUser':
                perm_classes.append('IsAdminUser')
            elif perm == 'IsOwner':
                perm_classes.append(f'Is{name}Owner')
            else:
                perm_classes.append('IsAuthenticated')
            
            if has_perms and model_roles:
                for role in model_roles:
                    role_name = role.get('name', '')
                    if role_name:
                        perm_classes.append(f'Is{role_name}')
            
            if perm != 'AllowAny':
                perm_classes.append('IsAdminOrReadOnly')
            
            # Remove duplicates while preserving order
            unique_perm_classes = []
            for p in perm_classes:
                if p not in unique_perm_classes:
                    unique_perm_classes.append(p)
            
            if unique_perm_classes:
                lines.append(f'    permission_classes = [{", ".join(unique_perm_classes)}]')

            pag_type = api.get('pagination', {}).get('type', 'PageNumberPagination')
            if pag_type != 'None':
                if pag_type == 'PageNumberPagination':
                    pag_class = 'PageNumberPagination'
                elif pag_type == 'LimitOffsetPagination':
                    pag_class = 'LimitOffsetPagination'
                elif pag_type == 'CursorPagination':
                    pag_class = 'CursorPagination'
                else:
                    pag_class = 'PageNumberPagination'
                page_size = api.get('pagination', {}).get('page_size', 20)
                lines.append(f'    pagination_class = type("CustomPagination", ({pag_class},), {{"page_size": {page_size}}})')

            filter_fields = api.get('filter_fields', [])
            search_fields = api.get('search_fields', [])
            ordering_fields = api.get('ordering_fields', '__all__')
            backends = []
            if filter_fields:
                backends.append('DjangoFilterBackend')
            if search_fields:
                backends.append('SearchFilter')
            if ordering_fields:
                backends.append('OrderingFilter')
            if backends:
                lines.append(f'    filter_backends = [{", ".join(backends)}]')

            if filter_fields:
                lines.append(f'    filterset_fields = {filter_fields}')
            if search_fields:
                lines.append(f'    search_fields = {search_fields}')
            if ordering_fields:
                if ordering_fields == '__all__':
                    lines.append('    ordering_fields = "__all__"')
                elif isinstance(ordering_fields, list) and ordering_fields:
                    lines.append(f'    ordering_fields = {ordering_fields}')

            lines.append('')
        content = '\n'.join(lines)

    (app_dir / "views.py").write_text(content, encoding='utf-8')