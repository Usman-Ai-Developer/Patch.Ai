// frontend/components/visualbuilder/PageManager.js
"use client";

import React, { useState } from "react";

export default function PageManager({
  models,
  pageSettings,
  customPages,
  activePageKey,
  onSelectPage,
  onCreateCustomPage,
  onDeleteCustomPage,
}) {
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPath, setNewPath] = useState("");

  const hasLayout = (modelName) => !!pageSettings?.[modelName]?.layout;

  const submitNew = () => {
    if (!newName.trim() || !newPath.trim()) return;
    onCreateCustomPage(newName.trim(), newPath.trim().startsWith("/") ? newPath.trim() : `/${newPath.trim()}`);
    setNewName("");
    setNewPath("");
    setShowNew(false);
  };

  return (
    <div className="w-56 shrink-0 border-r border-white/5 overflow-y-auto p-3 space-y-4">
      <div>
        <div className="text-xs uppercase tracking-wide text-on-surface-variant/50 font-semibold px-1 mb-2">
          Model Pages
        </div>
        <div className="space-y-1">
          {models.length === 0 && <p className="text-xs text-on-surface-variant/40 px-1">No models yet.</p>}
          {models.map((m) => (
            <button
              key={m.name}
              type="button"
              onClick={() => onSelectPage({ kind: "model", key: m.name })}
              className={`w-full flex items-center justify-between text-left text-xs px-2.5 py-2 rounded-lg transition-colors ${
                activePageKey?.kind === "model" && activePageKey?.key === m.name
                  ? "bg-secondary/15 text-secondary"
                  : "hover:bg-white/5"
              }`}
            >
              <span>{m.name} (List)</span>
              {hasLayout(m.name) && <span className="material-symbols-outlined text-[14px]">check_circle</span>}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between px-1 mb-2">
          <span className="text-xs uppercase tracking-wide text-on-surface-variant/50 font-semibold">
            Custom Pages
          </span>
          <button
            type="button"
            onClick={() => setShowNew((s) => !s)}
            className="material-symbols-outlined text-sm text-secondary hover:text-secondary/70"
            title="New custom page"
          >
            add_circle
          </button>
        </div>

        {showNew && (
          <div className="space-y-2 mb-2 bg-surface-container-low rounded-lg p-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Page name"
              className="w-full bg-surface border border-white/10 rounded px-2 py-1 text-xs outline-none focus:border-secondary"
            />
            <input
              value={newPath}
              onChange={(e) => setNewPath(e.target.value)}
              placeholder="/path"
              className="w-full bg-surface border border-white/10 rounded px-2 py-1 text-xs outline-none focus:border-secondary"
            />
            <button
              type="button"
              onClick={submitNew}
              className="w-full text-xs bg-secondary text-on-secondary rounded py-1 font-medium"
            >
              Create
            </button>
          </div>
        )}

        <div className="space-y-1">
          {(customPages || []).length === 0 && (
            <p className="text-xs text-on-surface-variant/40 px-1">No custom pages yet.</p>
          )}
          {(customPages || []).map((p, idx) => (
            <div
              key={`${p.name}-${idx}`}
              className={`group flex items-center justify-between text-xs px-2.5 py-2 rounded-lg transition-colors ${
                activePageKey?.kind === "custom" && activePageKey?.key === idx
                  ? "bg-secondary/15 text-secondary"
                  : "hover:bg-white/5"
              }`}
            >
              <button type="button" onClick={() => onSelectPage({ kind: "custom", key: idx })} className="flex-1 text-left flex items-center gap-1">
                <span>{p.name}</span>
                {p.layout && <span className="material-symbols-outlined text-[14px]">check_circle</span>}
              </button>
              <button
                type="button"
                onClick={() => onDeleteCustomPage(idx)}
                className="material-symbols-outlined text-[13px] opacity-0 group-hover:opacity-100 hover:text-error"
                title="Delete page"
              >
                delete
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
