def write_components(components_dir, models, app_name):
    # Navbar
    nav_links = ''.join([f'<Link key="{m["name"]}" to="/{m["name"]}" className="text-text hover:text-brand-100 mr-4 capitalize">{m["name"]}</Link>' for m in models])
    navbar_content = f'''import React from 'react'
import {{ Link }} from 'react-router-dom'

export default function Navbar({{ title }}) {{
  return (
    <nav className="bg-panel border-b border-line p-4">
      <div className="container mx-auto flex justify-between items-center">
        <Link to="/" className="text-2xl font-bold text-brand-100">{{ title }}</Link>
        <div>
          <Link to="/" className="text-text hover:text-brand-100 mr-4">Dashboard</Link>
          {nav_links}
        </div>
      </div>
    </nav>
  )
}}
'''
    (components_dir / "Navbar.jsx").write_text(navbar_content, encoding='utf-8')

    # Table component
    table_content = '''import React from 'react'

export default function Table({ columns, data, onEdit, onDelete }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-panel border border-line rounded-lg">
        <thead>
          <tr className="border-b border-line">
            {columns.map(col => (
              <th key={col.key} className="px-4 py-2 text-left text-subtext">{col.label}</th>
            ))}
            <th className="px-4 py-2 text-left text-subtext">Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, idx) => (
            <tr key={idx} className="border-b border-line/50 hover:bg-surface-container/50">
              {columns.map(col => (
                <td key={col.key} className="px-4 py-2 text-text">{item[col.key]}</td>
              ))}
              <td className="px-4 py-2">
                <button onClick={() => onEdit(item)} className="text-brand-100 hover:underline mr-2">Edit</button>
                <button onClick={() => onDelete(item.id)} className="text-red-400 hover:underline">Delete</button>
              </td>
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td colSpan={columns.length + 1} className="px-4 py-2 text-subtext text-center">No records found</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
'''
    (components_dir / "Table.jsx").write_text(table_content, encoding='utf-8')

    # ModalForm component
    modal_content = '''import React from 'react'

export default function ModalForm({ isOpen, onClose, onSubmit, title, fields, formData, setFormData }) {
  if (!isOpen) return null

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData({ ...formData, [name]: type === 'checkbox' ? checked : value })
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-panel border border-line rounded-lg p-6 max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">{title}</h2>
        <form onSubmit={onSubmit}>
          {fields.map(field => {
            if (field.type === 'BooleanField') {
              return (
                <div key={field.name} className="mb-3 flex items-center">
                  <input
                    type="checkbox"
                    name={field.name}
                    checked={formData[field.name] || false}
                    onChange={handleChange}
                    className="mr-2"
                  />
                  <label className="text-sm text-subtext capitalize">{field.name}</label>
                </div>
              )
            }
            return (
              <div key={field.name} className="mb-3">
                <label className="block text-sm text-subtext mb-1 capitalize">{field.name}</label>
                <input
                  type={field.type === 'EmailField' ? 'email' : field.type === 'URLField' ? 'url' : field.type === 'PasswordField' ? 'password' : 'text'}
                  name={field.name}
                  value={formData[field.name] || ''}
                  onChange={handleChange}
                  className="w-full bg-ink border border-line rounded px-3 py-2 text-text"
                />
              </div>
            )
          })}
          <div className="flex justify-end gap-3 mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-line rounded text-subtext hover:text-text">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-brand-100 text-black rounded hover:bg-brand-200">Save</button>
          </div>
        </form>
      </div>
    </div>
  )
}
'''
    (components_dir / "ModalForm.jsx").write_text(modal_content, encoding='utf-8')