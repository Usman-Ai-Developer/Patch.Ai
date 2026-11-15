// frontend/components/visualbuilder/InstancePanel.js
"use client";

import React from "react";

/**
 * Properties of a component instance: which variant it shows and the exposed
 * text/image properties it overrides. Overrides are stored per instance
 * (`props.overrides`) and never mutate the shared master tree.
 */
export default function InstancePanel({
  component,
  components = [],
  node,
  onChange,
  onEnterComponent,
  onRemoveProperty,
}) {
  if (!component) {
    return (
      <div className="w-[280px] shrink-0 border-l border-white/5 bg-surface/20 p-4 text-xs text-amber-300">
        This instance points at a component that no longer exists.
      </div>
    );
  }

  const variants = component.variants || [];
  const properties = component.properties || [];
  const overrides = node?.props?.overrides || {};
  const activeVariantId = node?.props?.variantId || "";

  function setVariant(value) {
    onChange({ variantId: value || null });
  }

  function setOverride(propId, value) {
    const next = { ...overrides };
    if (value === "") delete next[propId];
    else next[propId] = value;
    onChange({ overrides: next });
  }

  return (
    <div className="w-[280px] shrink-0 border-l border-white/5 bg-surface/20 flex flex-col min-h-0">
      <div className="px-3 py-2 border-b border-white/5 shrink-0">
        <div className="text-xs font-semibold text-on-surface truncate" title={component.name}>
          {component.name}
        </div>
        <div className="text-[10px] text-on-surface-variant/50">Component instance</div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {components.length > 1 && (
          <label className="block space-y-1">
            <span className="text-[10px] uppercase tracking-wide text-on-surface-variant/60">
              Component
            </span>
            <select
              value={component.id}
              onChange={(e) => {
                const next = components.find((c) => c.id === e.target.value);
                if (!next) return;
                // Different component = different properties, so overrides and
                // the variant selection cannot carry over.
                onChange({
                  componentId: next.id,
                  name: next.name,
                  variantId: null,
                  overrides: {},
                });
              }}
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-2 py-1.5 text-xs text-on-surface outline-none focus:border-secondary"
            >
              {components.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {variants.length > 0 && (
          <label className="block space-y-1">
            <span className="text-[10px] uppercase tracking-wide text-on-surface-variant/60">
              Variant
            </span>
            <select
              value={activeVariantId}
              onChange={(e) => setVariant(e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-2 py-1.5 text-xs text-on-surface outline-none focus:border-secondary"
            >
              <option value="">Default</option>
              {variants.map((variant) => (
                <option key={variant.id} value={variant.id}>
                  {variant.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {properties.length > 0 ? (
          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-wide text-on-surface-variant/60">
              Properties
            </div>
            {properties.map((prop) => (
              <div key={prop.id} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-on-surface-variant/80 truncate" title={prop.name}>
                    {prop.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemoveProperty?.(prop.id)}
                    className="shrink-0 text-on-surface-variant/40 hover:text-error transition-colors"
                    title={`Remove "${prop.name}" from the component (affects every instance)`}
                  >
                    <span className="material-symbols-outlined text-[14px]">delete</span>
                  </button>
                </div>
                {prop.type === "boolean" ? (
                  <label className="flex items-center gap-2 text-[11px] text-on-surface-variant/80">
                    <input
                      type="checkbox"
                      checked={overrides[prop.id] !== false}
                      onChange={(e) => setOverride(prop.id, e.target.checked)}
                    />
                    Visible
                  </label>
                ) : prop.type === "color" ? (
                  <input
                    type="color"
                    value={overrides[prop.id] ?? prop.defaultValue ?? "#000000"}
                    onChange={(e) => setOverride(prop.id, e.target.value)}
                    className="h-8 w-full cursor-pointer rounded-lg border border-outline-variant bg-surface-container-low"
                  />
                ) : prop.type === "number" ? (
                  <input
                    type="number"
                    value={overrides[prop.id] ?? ""}
                    onChange={(e) =>
                      setOverride(prop.id, e.target.value === "" ? "" : Number(e.target.value))
                    }
                    placeholder="Use master value"
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-2 py-1.5 text-xs text-on-surface placeholder:text-on-surface-variant/40 outline-none focus:border-secondary"
                  />
                ) : (
                  <input
                    type="text"
                    value={overrides[prop.id] ?? ""}
                    onChange={(e) => setOverride(prop.id, e.target.value)}
                    placeholder="Use master value"
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-2 py-1.5 text-xs text-on-surface placeholder:text-on-surface-variant/40 outline-none focus:border-secondary"
                  />
                )}
              </div>
            ))}
            {Object.keys(overrides).length > 0 && (
              <button
                type="button"
                onClick={() => onChange({ overrides: {} })}
                className="text-[11px] text-on-surface-variant hover:text-error transition-colors"
              >
                Reset all overrides
              </button>
            )}
          </div>
        ) : (
          <p className="text-[11px] leading-relaxed text-on-surface-variant/50">
            No exposed properties yet. Double-click the instance to edit its master, select a text
            element and use <span className="text-secondary">Expose</span> in the toolbar.
          </p>
        )}
      </div>

      <div className="p-3 border-t border-white/5 shrink-0">
        <button
          type="button"
          onClick={onEnterComponent}
          className="w-full flex items-center justify-center gap-1 text-xs px-3 py-1.5 rounded-full bg-surface-container-high hover:bg-surface-container-highest transition-all font-medium"
          title="Edit the shared master (affects every instance)"
        >
          <span className="material-symbols-outlined text-sm">edit_square</span>
          Edit master
        </button>
      </div>
    </div>
  );
}
