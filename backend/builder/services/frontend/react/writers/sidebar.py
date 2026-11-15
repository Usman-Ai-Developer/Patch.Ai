from pathlib import Path
from ....helpers import pluralize

def write_sidebar(src_dir, models, frontend_config, custom_pages):
    components_dir = src_dir / "components"
    components_dir.mkdir(parents=True, exist_ok=True)

    navigation = frontend_config.get('navigation', [])
    page_settings = frontend_config.get('pages', {}).get('settings', {})
    nav_items = []

    for item in navigation:
        if item['path'] == '/':
            nav_items.append(f"  {{ name: 'Dashboard', path: '/', icon: '🏠' }}")
        else:
            path = item['path']
            if path.startswith('/'):
                path = path[1:]
            model = next((m for m in models if m['name'].lower() == path), None)
            if model:
                settings = page_settings.get(model['name'], {})
                if settings.get('showInNav', True):
                    nav_items.append(f"  {{ name: '{model['name']}', path: '{item['path']}', icon: '📄' }}")
            else:
                # Check if it's a custom page
                custom = next((p for p in custom_pages if p['path'] == item['path']), None)
                if custom:
                    nav_items.append(f"  {{ name: '{custom['name']}', path: '{item['path']}', icon: 'link' }}")
                else:
                    nav_items.append(f"  {{ name: '{item['label']}', path: '{item['path']}', icon: 'link' }}")

    if not nav_items:
        nav_items.append(f"  {{ name: 'Dashboard', path: '/', icon: '🏠' }}")
        for model in models:
            name_lower = model['name'].lower()
            plural = pluralize(name_lower)
            nav_items.append(f"  {{ name: '{model['name']}', path: '/{plural}', icon: '📄' }}")

    nav_items_str = ",\n".join(nav_items)

    content = """
import React from 'react';
import { NavLink } from 'react-router-dom';

const navItems = [
__NAV_ITEMS__
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-surface border-r border-line h-screen sticky top-0 overflow-y-auto p-4">
      <div className="text-xl font-bold mb-6">Patch</div>

      <nav className="space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 rounded-lg transition ${
                isActive
                  ? 'bg-primary text-white'
                  : 'text-subtext hover:bg-surface-container hover:text-text'
              }`
            }
          >
            <span>{item.icon}</span>
            {item.name}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
"""
    content = content.replace("__NAV_ITEMS__", nav_items_str)
    (components_dir / "Sidebar.jsx").write_text(content, encoding='utf-8')