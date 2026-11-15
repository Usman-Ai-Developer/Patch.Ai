def write_dashboard(pages_dir, models):
    model_names = [m['name'] for m in models]
    model_names_str = ', '.join([f"'{name}'" for name in model_names])

    content = f'''import React from 'react';
import {{ Link }} from 'react-router-dom';

const models = [
  {model_names_str}
];

export default function Dashboard() {{
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {{models.map(model => (
          <Link
            key={{model}}
            to={{`/${{model.toLowerCase()}}`}}
            className="p-4 bg-surface border rounded-lg hover:border-primary transition"
          >
            <h2 className="text-lg font-semibold capitalize">{{model}}</h2>
            <p className="text-subtext">Manage {{model}} records</p>
          </Link>
        ))}}
      </div>
    </div>
  );
}}
'''
    (pages_dir / "Dashboard.jsx").write_text(content, encoding='utf-8')