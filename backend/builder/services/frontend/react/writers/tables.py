def write_tables(components_dir, models):
    content = '''import React from 'react';

export default function Table({ columns, data }) {
  if (!data || data.length === 0) {
    return <div className="text-subtext">No records found.</div>;
  }

  return (
    <div className="overflow-x-auto border rounded-lg">
      <table className="min-w-full divide-y divide-line">
        <thead className="bg-surface-container">
          <tr>
            {columns.map((col, idx) => (
              <th key={idx} className="px-4 py-2 text-left text-sm font-medium text-subtext">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {data.map((item, rowIdx) => (
            <tr key={rowIdx} className="hover:bg-surface-container/50">
              {columns.map((col, colIdx) => (
                <td key={colIdx} className="px-4 py-2 text-sm">
                  {col.render ? col.render(item) : item[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
'''
    (components_dir / "Table.jsx").write_text(content, encoding='utf-8')