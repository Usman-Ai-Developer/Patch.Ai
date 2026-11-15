# backend/builder/services/backend/django/writers/permissions.py
from pathlib import Path

def write_permissions(workspace, app_name, blueprint):
    app_dir = workspace / app_name
    app_dir.mkdir(parents=True, exist_ok=True)
    
    models = blueprint.data.get('models', [])
    app_models = [m for m in models if m.get('app_name') == app_name]
    
    def is_permissions_enabled(model):
        perms = model.get('permissions')
        if not isinstance(perms, dict):
            return False
        return perms.get('enabled', False)
    
    has_permissions = any(is_permissions_enabled(m) for m in app_models)

    def needs_owner_class(model):
        """API set to "Owner Only" needs Is{Model}Owner even when the
        per-role permission matrix is switched off."""
        api = model.get('api')
        return isinstance(api, dict) and api.get('permissions') == 'IsOwner'

    owner_models = [m for m in app_models if needs_owner_class(m)]
    
    lines = [
        'from rest_framework import permissions',
        '',
    ]
    
    if not has_permissions and not owner_models:
        lines.append('# ─── Always available permission classes ──────────────')
        lines.append('')
        lines.append('class IsAdminOrReadOnly(permissions.BasePermission):')
        lines.append('    """')
        lines.append('    Custom permission to only allow admins to edit.')
        lines.append('    """')
        lines.append('')
        lines.append('    def has_permission(self, request, view):')
        lines.append('        if request.method in permissions.SAFE_METHODS:')
        lines.append('            return True')
        lines.append('        return request.user and request.user.is_staff')
        lines.append('')
        content = '\n'.join(lines)
        (app_dir / "permissions.py").write_text(content, encoding='utf-8')
        return
    
    for model in app_models:
        perms = model.get('permissions') or {}
        if not isinstance(perms, dict):
            perms = {}
        if not perms.get('enabled', False) and not needs_owner_class(model):
            continue
            
        model_name = model['name']
        
        lines.append(f'class Is{model_name}Owner(permissions.BasePermission):')
        lines.append('    """')
        lines.append(f'    Custom permission to only allow owners of a {model_name} to edit it.')
        lines.append('    """')
        lines.append('')
        lines.append('    def has_object_permission(self, request, view, obj):')
        lines.append('        if request.method in permissions.SAFE_METHODS:')
        lines.append('            return True')
        lines.append('')
        lines.append('        # Write permissions are only allowed to the owner')
        owner_field = 'user'
        for f in model.get('fields', []):
            if f['name'] in ['user', 'owner', 'created_by']:
                owner_field = f['name']
                break
        lines.append(f'        return obj.{owner_field} == request.user')
        lines.append('')
    
    all_roles = {}
    for model in app_models:
        perms = model.get('permissions', {})
        if not isinstance(perms, dict):
            continue
        if perms.get('enabled', False):
            for role in perms.get('roles', []):
                role_name = role.get('name', '')
                if role_name:
                    if role_name not in all_roles:
                        all_roles[role_name] = set()
                    all_roles[role_name].update(role.get('permissions', []))
    
    if all_roles:
        lines.append('')
        lines.append('# ─── Role-based permission classes ───────────────────')
        lines.append('')
        for role_name, perms_set in all_roles.items():
            class_name = f'Is{role_name}'
            lines.append(f'class {class_name}(permissions.BasePermission):')
            lines.append('    """')
            lines.append(f'    Permission class for {role_name} role.')
            lines.append('    """')
            lines.append('')
            lines.append('    def has_permission(self, request, view):')
            lines.append('        if not request.user or not request.user.is_authenticated:')
            lines.append('            return False')
            lines.append(f'        return request.user.groups.filter(name="{role_name}").exists()')
            lines.append('')
            lines.append('    def has_object_permission(self, request, view, obj):')
            lines.append('        return self.has_permission(request, view)')
            lines.append('')
    
    lines.append('')
    lines.append('# ─── Combined permission for CRUD actions ──────────────')
    lines.append('')
    lines.append('class IsAdminOrReadOnly(permissions.BasePermission):')
    lines.append('    """')
    lines.append('    Custom permission to only allow admins to edit.')
    lines.append('    """')
    lines.append('')
    lines.append('    def has_permission(self, request, view):')
    lines.append('        if request.method in permissions.SAFE_METHODS:')
    lines.append('            return True')
    lines.append('        return request.user and request.user.is_staff')
    lines.append('')
    
    content = '\n'.join(lines)
    (app_dir / "permissions.py").write_text(content, encoding='utf-8')