import re
from ....helpers import pluralize

def write_pages(pages_dir, models, app_name, page_settings=None):
    if page_settings is None:
        page_settings = {}

    # ─── Home / Dashboard page ──────────────────────────────────────
    model_names = [m['name'] for m in models]
    model_names_str = ', '.join([f"'{name}'" for name in model_names])
    home_content = f'''import React from 'react';
import {{ Link }} from 'react-router-dom';

const models = [
  {model_names_str}
];

export default function Home() {{
  return (
    <div className="p-6">
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
    (pages_dir / "Home.jsx").write_text(home_content, encoding='utf-8')

    # ─── Generate pages for each model ─────────────────────────────
    for model in models:
        name = model['name']
        name_lower = name.lower()
        plural = pluralize(name_lower)
        fields = model.get('fields', [])
        form_fields = [f for f in fields if f['name'] != 'id' and f['type'] not in ['ForeignKey', 'ManyToManyField', 'OneToOneField']]

        settings = page_settings.get(name, {})
        # Default to True if not specified
        show_list = settings.get('list', True)
        show_create = settings.get('create', True)
        show_edit = settings.get('edit', True)
        show_detail = settings.get('list', True)  # Detail page is tied to list for now

        if show_list:
            write_list_page(pages_dir, name, plural, fields, app_name)
        if show_create:
            write_create_page(pages_dir, name, plural, form_fields, app_name)
        if show_edit:
            write_edit_page(pages_dir, name, plural, form_fields, app_name)
        if show_detail:
            write_detail_page(pages_dir, name, plural, fields, app_name)


def write_list_page(pages_dir, name, plural, fields, app_name):
    columns = []
    for f in fields:
        if f['name'] != 'id':
            columns.append(f"{{ key: '{f['name']}', label: '{f['name'].capitalize()}' }}")
    columns_str = ', '.join(columns)

    content = f'''import React, {{ useState, useEffect }} from 'react';
import {{ Link }} from 'react-router-dom';
import api from '../api/client';
import Table from '../components/Table';

export default function {name}List() {{
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {{
    try {{
      const res = await api.get('/{app_name}/{plural}/');
      setData(res.data);
    }} catch (err) {{
      setError(err.message);
    }} finally {{
      setLoading(false);
    }}
  }};

  useEffect(() => {{
    fetchData();
  }}, []);

  const handleDelete = async (id) => {{
    if (!confirm('Delete this record?')) return;
    try {{
      await api.delete('/{app_name}/{plural}/${{id}}/');
      fetchData();
    }} catch (err) {{
      alert('Failed to delete');
    }}
  }};

  const columns = [
    {columns_str},
    {{ key: 'actions', label: 'Actions', render: (item) => (
      <div className="flex gap-2">
        <Link to={{`/${{item.id}}`}} className="text-blue-400 hover:underline">View</Link>
        <Link to={{`/${{item.id}}/edit`}} className="text-yellow-400 hover:underline">Edit</Link>
        <button onClick={{() => handleDelete(item.id)}} className="text-red-400 hover:underline">Delete</button>
      </div>
    ) }}
  ];

  if (loading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4 text-red-500">Error: {{error}}</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold capitalize">{name}</h1>
        <Link to="create" className="bg-primary text-white px-4 py-2 rounded hover:bg-primary-dark">
          + Add {name}
        </Link>
      </div>
      <Table columns={{columns}} data={{data}} />
    </div>
  );
}}
'''
    (pages_dir / f"{name}List.jsx").write_text(content, encoding='utf-8')


def write_create_page(pages_dir, name, plural, form_fields, app_name):
    fields_json = str(form_fields).replace("'", '"')
    content = f'''import React, {{ useState }} from 'react';
import {{ useNavigate }} from 'react-router-dom';
import api from '../api/client';
import DynamicForm from '../components/DynamicForm';

export default function {name}Create() {{
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (data) => {{
    setSubmitting(true);
    try {{
      await api.post('/{app_name}/{plural}/', data);
      navigate('/{plural}');
    }} catch (err) {{
      alert('Failed to create: ' + err.message);
    }} finally {{
      setSubmitting(false);
    }}
  }};

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">Create {name}</h1>
      <DynamicForm
        fields={{fields_json}}
        onSubmit={{handleSubmit}}
        submitText={{submitting ? 'Creating...' : 'Create'}}
        disabled={{submitting}}
      />
    </div>
  );
}}
'''
    (pages_dir / f"{name}Create.jsx").write_text(content, encoding='utf-8')


def write_edit_page(pages_dir, name, plural, form_fields, app_name):
    fields_json = str(form_fields).replace("'", '"')
    content = f'''import React, {{ useState, useEffect }} from 'react';
import {{ useParams, useNavigate }} from 'react-router-dom';
import api from '../api/client';
import DynamicForm from '../components/DynamicForm';

export default function {name}Edit() {{
  const {{ id }} = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [initialData, setInitialData] = useState({{}});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {{
    api.get('/{app_name}/{plural}/${{id}}/').then(res => {{
      setInitialData(res.data);
      setLoading(false);
    }}).catch(() => {{
      alert('Failed to load record');
      navigate('/{plural}');
    }});
  }}, [id, navigate]);

  const handleSubmit = async (data) => {{
    setSubmitting(true);
    try {{
      await api.put('/{app_name}/{plural}/${{id}}/', data);
      navigate('/{plural}');
    }} catch (err) {{
      alert('Failed to update: ' + err.message);
    }} finally {{
      setSubmitting(false);
    }}
  }};

  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">Edit {name}</h1>
      <DynamicForm
        fields={{fields_json}}
        defaultValues={{initialData}}
        onSubmit={{handleSubmit}}
        submitText={{submitting ? 'Saving...' : 'Save'}}
        disabled={{submitting}}
      />
    </div>
  );
}}
'''
    (pages_dir / f"{name}Edit.jsx").write_text(content, encoding='utf-8')


def write_detail_page(pages_dir, name, plural, fields, app_name):
    field_lines = []
    for f in fields:
        if f['name'] != 'id':
            field_lines.append(f"          <div key='{f['name']}' className='flex'>")
            field_lines.append(f"            <span className='w-32 font-medium capitalize'>{f['name']}:</span>")
            field_lines.append(f"            <span>{{String(item['{f['name']}'] ?? '')}}</span>")
            field_lines.append("          </div>")
    fields_html = '\n'.join(field_lines)

    content = f'''import React, {{ useState, useEffect }} from 'react';
import {{ useParams, Link }} from 'react-router-dom';
import api from '../api/client';

export default function {name}Detail() {{
  const {{ id }} = useParams();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {{
    api.get('/{app_name}/{plural}/${{id}}/').then(res => {{
      setItem(res.data);
      setLoading(false);
    }}).catch(() => {{
      alert('Failed to load record');
    }});
  }}, [id]);

  if (loading) return <div className="p-4">Loading...</div>;
  if (!item) return <div className="p-4">Not found</div>;

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-4 capitalize">{name} Details</h1>
      <div className="bg-surface border rounded-lg p-4 space-y-2">
        {fields_html}
      </div>
      <div className="mt-4 flex gap-2">
        <Link to="{{`/edit`}}" className="bg-yellow-500 text-white px-4 py-2 rounded">Edit</Link>
        <Link to="{{`..`}}" className="bg-gray-600 text-white px-4 py-2 rounded">Back</Link>
      </div>
    </div>
  );
}}
'''
    (pages_dir / f"{name}Detail.jsx").write_text(content, encoding='utf-8')