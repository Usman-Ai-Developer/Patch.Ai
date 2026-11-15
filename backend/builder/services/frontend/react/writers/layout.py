def write_layout(src_dir, models):
    content = """
import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function Layout() {
  return (
    <div className="flex min-h-screen bg-background text-text">
      <Sidebar />
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
"""
    # Write to components directory
    components_dir = src_dir / "components"
    components_dir.mkdir(parents=True, exist_ok=True)
    (components_dir / "Layout.jsx").write_text(content, encoding='utf-8')