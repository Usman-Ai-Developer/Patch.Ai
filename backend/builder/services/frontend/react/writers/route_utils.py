from ....helpers import pluralize

def write_route_utils(utils_dir, models, frontend_config, custom_pages):
    imports = ["import Dashboard from '../pages/Dashboard';"]
    route_lines = []

    # Model pages
    for model in models:
        name = model['name']
        imports.append(f"import {name}List from '../pages/{name}List';")
        imports.append(f"import {name}Create from '../pages/{name}Create';")
        imports.append(f"import {name}Edit from '../pages/{name}Edit';")
        imports.append(f"import {name}Detail from '../pages/{name}Detail';")

    # Custom pages
    for page in custom_pages:
        name = ''.join(c for c in page['name'] if c.isalnum() or c == '_')
        if not name:
            name = "Custom"
        name = name[0].upper() + name[1:]
        imports.append(f"import {name}Page from '../pages/{name}Page';")

    imports_str = '\n'.join(imports)

    navigation = frontend_config.get('navigation', [])
    for item in navigation:
        if item['path'] == '/':
            route_lines.append("{ path: '/', element: <Dashboard /> },")
        else:
            path = item['path']
            if path.startswith('/'):
                path = path[1:]
            model = next((m for m in models if m['name'].lower() == path), None)
            if model:
                name = model['name']
                plural = pluralize(path)
                route_lines.append(f"{{ path: '/{plural}', element: <{name}List /> }},")
                route_lines.append(f"{{ path: '/{plural}/create', element: <{name}Create /> }},")
                route_lines.append(f"{{ path: '/{plural}/:id', element: <{name}Detail /> }},")
                route_lines.append(f"{{ path: '/{plural}/:id/edit', element: <{name}Edit /> }},")
            else:
                # Custom page
                custom = next((p for p in custom_pages if p['path'] == item['path']), None)
                if custom:
                    cname = ''.join(c for c in custom['name'] if c.isalnum() or c == '_')
                    if not cname:
                        cname = "Custom"
                    cname = cname[0].upper() + cname[1:]
                    route_lines.append(f"{{ path: '{custom['path']}', element: <{cname}Page /> }},")

    if not route_lines:
        route_lines.append("{ path: '/', element: <Dashboard /> },")
        for model in models:
            name = model['name']
            name_lower = name.lower()
            plural = pluralize(name_lower)
            route_lines.append(f"{{ path: '/{plural}', element: <{name}List /> }},")
            route_lines.append(f"{{ path: '/{plural}/create', element: <{name}Create /> }},")
            route_lines.append(f"{{ path: '/{plural}/:id', element: <{name}Detail /> }},")
            route_lines.append(f"{{ path: '/{plural}/:id/edit', element: <{name}Edit /> }},")

    route_str = '\n    '.join(route_lines)

    content = f"""
import React from 'react';
import {{ createBrowserRouter }} from 'react-router-dom';
import Layout from '../components/Layout';
{imports_str}

export const router = createBrowserRouter([
  {{
    path: '/',
    element: <Layout />,
    children: [
      {route_str}
    ]
  }}
]);
"""
    (utils_dir / "routes.js").write_text(content, encoding='utf-8')