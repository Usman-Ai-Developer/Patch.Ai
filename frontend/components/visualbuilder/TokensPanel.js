// frontend/components/visualbuilder/TokensPanel.js
"use client";

import React, { useState } from "react";

function slugify(name, existingIds) {
  const base = (name || "token")
    .trim()
    .replace(/[^a-zA-Z0-9]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""))
    .replace(/^[A-Z]/, (c) => c.toLowerCase()) || "token";
  let id = base;
  let n = 2;
  while (existingIds.has(id)) {
    id = `${base}${n}`;
    n += 1;
  }
  return id;
}

function ColorRow({ token, onChange, onDelete }) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <input
        type="color"
        title="Light-mode value"
        value={token.value}
        onChange={(e) => onChange({ ...token, value: e.target.value })}
        className="w-8 h-8 rounded cursor-pointer shrink-0"
      />
      <input
        type="color"
        title="Dark-mode value"
        value={token.dark || token.value}
        onChange={(e) => onChange({ ...token, dark: e.target.value })}
        className="w-8 h-8 rounded cursor-pointer shrink-0"
      />
      <input
        className="flex-1 bg-surface-container-low border border-white/10 rounded px-2 py-1 text-xs"
        value={token.name}
        onChange={(e) => onChange({ ...token, name: e.target.value })}
      />
      <span className="text-[10px] text-on-surface-variant/40 font-mono w-20 truncate" title={token.id}>
        {token.id}
      </span>
      <button
        type="button"
        onClick={onDelete}
        className="material-symbols-outlined text-[14px] text-on-surface-variant/50 hover:text-error"
      >
        delete
      </button>
    </div>
  );
}

function TextStyleRow({ token, onChange, onDelete }) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span
        className="w-14 shrink-0 text-center text-[11px] px-1 py-1 rounded bg-surface-container-low border border-white/10 truncate"
        style={{ fontSize: token.fontSize, fontWeight: token.fontWeight }}
      >
        Ag
      </span>
      <input
        className="flex-1 bg-surface-container-low border border-white/10 rounded px-2 py-1 text-xs"
        value={token.name}
        onChange={(e) => onChange({ ...token, name: e.target.value })}
      />
      <input
        className="w-16 bg-surface-container-low border border-white/10 rounded px-1 py-1 text-xs"
        value={token.fontSize}
        placeholder="16px"
        onChange={(e) => onChange({ ...token, fontSize: e.target.value })}
      />
      <select
        className="w-20 bg-surface-container-low border border-white/10 rounded px-1 py-1 text-xs"
        value={token.fontWeight}
        onChange={(e) => onChange({ ...token, fontWeight: e.target.value })}
      >
        {["300", "400", "500", "600", "700", "800"].map((w) => (
          <option key={w} value={w}>{w}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={onDelete}
        className="material-symbols-outlined text-[14px] text-on-surface-variant/50 hover:text-error"
      >
        delete
      </button>
    </div>
  );
}

export default function TokensPanel({ tokens, onSave, onClose }) {
  const [colors, setColors] = useState(tokens?.colors || []);
  const [textStyles, setTextStyles] = useState(tokens?.textStyles || []);

  function addColor() {
    const existingIds = new Set(colors.map((c) => c.id));
    setColors((prev) => [
      ...prev,
      { id: slugify(`Color ${prev.length + 1}`, existingIds), name: `Color ${prev.length + 1}`, value: "#6366f1", dark: "#6366f1" },
    ]);
  }

  function addTextStyle() {
    const existingIds = new Set(textStyles.map((t) => t.id));
    setTextStyles((prev) => [
      ...prev,
      {
        id: slugify(`Style ${prev.length + 1}`, existingIds),
        name: `Style ${prev.length + 1}`,
        fontSize: "16px",
        fontWeight: "400",
      },
    ]);
  }

  function save() {
    onSave({ colors, textStyles });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-[480px] max-h-[80vh] overflow-y-auto bg-surface-container rounded-xl shadow-2xl border border-white/10 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Design tokens</h3>
          <button type="button" onClick={onClose} className="material-symbols-outlined text-[18px] hover:text-error">
            close
          </button>
        </div>
        <p className="text-[11px] text-on-surface-variant/60 mb-4">
          Named colors and text styles you can apply from any widget&apos;s Styling panel. Editing a
          token here updates every widget that references it, in both the canvas and the generated app.
        </p>

        <div className="mb-5">
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-xs font-semibold text-on-surface-variant">Colors</h4>
            <button type="button" onClick={addColor} className="text-[11px] text-secondary hover:underline">
              + Add color
            </button>
          </div>
          {colors.length === 0 && <p className="text-[11px] text-on-surface-variant/40 py-2">No color tokens yet.</p>}
          {colors.map((c, i) => (
            <ColorRow
              key={c.id}
              token={c}
              onChange={(next) => setColors((prev) => prev.map((p, idx) => (idx === i ? next : p)))}
              onDelete={() => setColors((prev) => prev.filter((_, idx) => idx !== i))}
            />
          ))}
        </div>

        <div className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-xs font-semibold text-on-surface-variant">Text styles</h4>
            <button type="button" onClick={addTextStyle} className="text-[11px] text-secondary hover:underline">
              + Add text style
            </button>
          </div>
          {textStyles.length === 0 && (
            <p className="text-[11px] text-on-surface-variant/40 py-2">No text styles yet.</p>
          )}
          {textStyles.map((t, i) => (
            <TextStyleRow
              key={t.id}
              token={t}
              onChange={(next) => setTextStyles((prev) => prev.map((p, idx) => (idx === i ? next : p)))}
              onDelete={() => setTextStyles((prev) => prev.filter((_, idx) => idx !== i))}
            />
          ))}
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button type="button" onClick={onClose} className="text-xs px-3 py-1.5 rounded hover:bg-white/5">
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            className="text-xs px-3 py-1.5 rounded bg-secondary text-on-secondary hover:opacity-90"
          >
            Save tokens
          </button>
        </div>
      </div>
    </div>
  );
}