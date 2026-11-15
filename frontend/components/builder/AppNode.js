"use client";

import { useState } from "react";
import { useConfirm } from "../../hooks/useConfirm";

const CATEGORIES = [
  { key: "models", label: "Models", icon: "data_object" },
  { key: "serializers", label: "Serializers", icon: "text_snippet" },
  { key: "views", label: "Views", icon: "visibility" },
  { key: "urls", label: "URLs", icon: "link" },
  { key: "admin", label: "Admin", icon: "settings" },
  { key: "tests", label: "Tests", icon: "checklist" },
];

export default function AppNode({
  app,
  expanded,
  toggleCategory,
  onItemClick,
  onAppClick,
  onDeleteApp,
}) {
  const { confirm } = useConfirm();
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleFolder = () => {
    setIsExpanded(!isExpanded);
  };

  const handleAppClick = () => {
    if (onAppClick) onAppClick();
  };

  const handleDeleteApp = async (e) => {
    e.stopPropagation();
    const confirmed = await confirm({
      title: `Delete "${app.name}"?`,
      message: "All files and data associated with this app will be permanently removed. This cannot be undone.",
      confirmText: "Delete App",
      variant: "danger",
    });
    if (!confirmed) return;
    onDeleteApp();
  };

  return (
    <div>
      {/* ─── App folder row ────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between py-1 px-2 hover:bg-surface-container/50 rounded-lg cursor-pointer group transition-colors"
        onClick={toggleFolder}
      >
        <div
          className="flex items-center gap-1.5"
          onClick={(e) => { e.stopPropagation(); handleAppClick(); }}
        >
          <span className="text-on-surface-variant text-sm">
            {isExpanded ? "▾" : "▸"}
          </span>
          <span className="material-symbols-outlined text-sm text-on-surface-variant">
            {isExpanded ? "folder_open" : "folder"}
          </span>
          <span className="font-medium text-on-surface text-sm">{app.name}</span>
          <span className="text-xs text-on-surface-variant/60 ml-1">
            ({app.models?.length || 0} models)
          </span>
        </div>
        <button
          onClick={handleDeleteApp}
          className="text-on-surface-variant hover:text-error transition-colors opacity-0 group-hover:opacity-100"
          title="Delete app"
        >
          <span className="material-symbols-outlined text-sm">delete</span>
        </button>
      </div>

      {/* ─── Sub-items (models, serializers, etc.) ────────────────── */}
      {isExpanded && (
        <div className="ml-6 pl-3 border-l border-white/5 space-y-0.5">
          {CATEGORIES.map((cat) => {
            const items = app[cat.key] || [];
            if (items.length === 0) return null;
            const isCatExpanded = expanded[cat.key] || false;
            return (
              <div key={cat.key}>
                <div
                  className="flex items-center gap-1.5 py-0.5 px-2 hover:bg-surface-container/50 rounded-lg cursor-pointer text-sm text-on-surface-variant transition-colors"
                  onClick={() => toggleCategory(cat.key)}
                >
                  <span>{isCatExpanded ? "▾" : "▸"}</span>
                  <span className="material-symbols-outlined text-sm">{cat.icon}</span>
                  <span className="font-medium">{cat.label}</span>
                  <span className="text-xs text-on-surface-variant/60 ml-1">({items.length})</span>
                </div>
                {isCatExpanded && (
                  <div className="ml-6 space-y-0.5">
                    {items.map((item) => (
                      <div
                        key={item}
                        className="flex items-center gap-1.5 py-0.5 px-2 hover:bg-surface-container/50 rounded-lg cursor-pointer text-sm text-on-surface transition-colors"
                        onClick={() => onItemClick(cat.key, item)}
                      >
                        <span className="material-symbols-outlined text-sm text-on-surface-variant/60">description</span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}