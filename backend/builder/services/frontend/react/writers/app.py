from ....helpers import pluralize

def write_app_jsx(src_dir, project_name, models, frontend_config, custom_pages):
    imports = [
        "import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';",
        "import AuthLayout from './AuthLayout';",
        "import Layout from './components/Layout';",
        "import Landing from './pages/Landing';",
        "import Login from './pages/Login';",
        "import Signup from './pages/Signup';",
        "import Dashboard from './pages/Dashboard';",
    ]
    model_imports = []
    model_routes = []
    for model in models:
        name = model['name']
        name_lower = name.lower()
        plural = pluralize(name_lower)
        model_imports.append(f"import {name}List from './pages/{name}List';")
        model_imports.append(f"import {name}Create from './pages/{name}Create';")
        model_imports.append(f"import {name}Edit from './pages/{name}Edit';")
        model_imports.append(f"import {name}Detail from './pages/{name}Detail';")
        model_routes.append(f"<Route path='{plural}' element={{<{name}List />}} />")
        model_routes.append(f"<Route path='{plural}/create' element={{<{name}Create />}} />")
        model_routes.append(f"<Route path='{plural}/:id' element={{<{name}Detail />}} />")
        model_routes.append(f"<Route path='{plural}/:id/edit' element={{<{name}Edit />}} />")

    # Custom pages imports and routes
    custom_imports = []
    custom_routes = []
    for page in custom_pages:
        name = ''.join(c for c in page['name'] if c.isalnum() or c == '_')
        if not name:
            name = "Custom"
        name = name[0].upper() + name[1:]
        custom_imports.append(f"import {name}Page from './pages/{name}Page';")
        custom_routes.append(f"<Route path='{page['path']}' element={{<{name}Page />}} />")

    all_imports = "\n".join(imports + model_imports + custom_imports)
    all_routes = "\n          ".join([
        "<Route path='dashboard' element={<Dashboard />} />",
    ] + model_routes + custom_routes)

    content = f"""
import React from 'react';
{all_imports}

function RequireAuth({{ children }}) {{
  const token = localStorage.getItem('access_token');
  if (!token) return <Navigate to="/login" replace />;
  return children;
}}

function App() {{
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={{<Landing />}} />
        <Route element={{<AuthLayout />}}>
          <Route path="/login" element={{<Login />}} />
          <Route path="/signup" element={{<Signup />}} />
        </Route>
        <Route path="/" element={{<RequireAuth><Layout /></RequireAuth>}}>
          {all_routes}
        </Route>
      </Routes>
    </BrowserRouter>
  );
}}

export default App;
"""
    (src_dir / "App.jsx").write_text(content, encoding='utf-8')