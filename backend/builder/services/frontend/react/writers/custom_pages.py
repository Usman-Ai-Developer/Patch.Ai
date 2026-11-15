def write_custom_pages(pages_dir, custom_pages):
    """Generate React components for custom pages."""
    for page in custom_pages:
        # Sanitise name to a valid JS identifier
        name = ''.join(c for c in page['name'] if c.isalnum() or c == '_')
        if not name:
            name = "Custom"
        name = name[0].upper() + name[1:]

        content = f"""
import React from 'react';

export default function {name}Page() {{
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">{page['name']}</h1>
      <p className="text-on-surface-variant">This is the {page['name']} page.</p>
    </div>
  );
}}
"""
        (pages_dir / f"{name}Page.jsx").write_text(content, encoding='utf-8')