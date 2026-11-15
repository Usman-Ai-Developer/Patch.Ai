// frontend/components/visualbuilder/PropertiesPanel.js
"use client";

import React from "react";
import { WIDGETS } from "./WidgetRegistry";
import { findNode, findParent } from "./treeUtils";
import { getModelEndpoint, isModelApiEnabled } from "./apiUtils";

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-on-surface-variant">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  "bg-surface-container-low border border-white/10 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-secondary transition-colors w-full";

const selectCls =
  "bg-surface-container-low border border-white/10 rounded-lg px-2 py-1 text-xs outline-none focus:border-secondary transition-colors w-full mb-1";

function tokenIdFromRef(value) {
  return typeof value === "string" && value.startsWith("@token:") ? value.slice("@token:".length) : "";
}

function ColorField({ label, value, fallback, colorTokens, onChange }) {
  const tokenId = tokenIdFromRef(value);
  const activeToken = tokenId ? colorTokens.find((t) => t.id === tokenId) : null;

  return (
    <Field label={label}>
      <select
        className={selectCls}
        value={tokenId}
        onChange={(e) => {
          const id = e.target.value;
          if (!id) onChange(fallback);
          else onChange(`@token:${id}`);
        }}
      >
        <option value="">Custom color</option>
        {colorTokens.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
      {activeToken ? (
        <div className="flex items-center gap-2 h-8 px-2 rounded-lg border border-white/10 bg-surface-container-low">
          <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: activeToken.value }} />
          <span className="text-xs text-on-surface-variant/70 truncate">{activeToken.value}</span>
        </div>
      ) : (
        <input
          type="color"
          className="w-full h-8 cursor-pointer"
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  );
}

export default function PropertiesPanel({
  tree,
  selectedId,
  selectedCount = 0,
  onChange,
  models,
  roles,
  designTokens,
  variants = [],
  componentProperties = [],
}) {
  const node = selectedId ? findNode(tree, selectedId) : null;
  const parent = node ? findParent(tree, selectedId) : null;
  const parentIsFreePositioning = parent ? WIDGETS[parent.type]?.freePositioning : false;

  if (!node) {
    return (
      <div className="w-72 shrink-0 border-l border-white/5 p-4 text-xs text-on-surface-variant/50">
        Select a widget on the canvas to edit its properties.
      </div>
    );
  }

  const def = WIDGETS[node.type];
  if (!def) {
    return (
      <div className="w-72 shrink-0 border-l border-white/5 p-4 text-xs text-red-400">
        Unknown widget type "{node.type}".
      </div>
    );
  }

  const modelObj = models.find((m) => m.name === node.props?.model);
  const fieldNames = (modelObj?.fields || []).map((f) => f.name);

  const update = (key, value) => onChange(node.id, { [key]: value });

  // Check if this node is itself a Frame (free-positioning container)
  const isFrame = def.freePositioning;

  return (
    <div className="w-72 shrink-0 border-l border-white/5 overflow-y-auto p-4 space-y-4">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-secondary">{def.icon}</span>
        <div>
          <div className="text-sm font-semibold">{def.label}</div>
          <div className="text-[10px] text-on-surface-variant/50">{node.id}</div>
        </div>
      </div>

      {selectedCount > 1 && (
        <p className="text-[11px] text-amber-400/80 bg-amber-400/10 rounded px-2 py-1.5">
          {selectedCount} widgets selected — changes apply to every selected{" "}
          <span className="font-semibold">{def.label}</span> widget, not just &quot;{node.id}&quot;.
        </p>
      )}

      {/* ─── Widget-specific props ────────────────────────────────── */}
      {(def.propsSchema || []).length > 0 && (
        <div className="border-b border-white/10 pb-4">
          <h4 className="text-xs font-semibold text-on-surface-variant mb-2">Widget Properties</h4>
          {def.propsSchema.map((schema) => {
            const value = node.props?.[schema.key];
            switch (schema.type) {
              case "text":
                return (
                  <Field key={schema.key} label={schema.label}>
                    <input className={inputCls} value={value ?? ""} onChange={(e) => update(schema.key, e.target.value)} />
                  </Field>
                );
              case "textarea":
                return (
                  <Field key={schema.key} label={schema.label}>
                    <textarea className={inputCls} rows={3} value={value ?? ""} onChange={(e) => update(schema.key, e.target.value)} />
                  </Field>
                );
              case "number":
                return (
                  <Field key={schema.key} label={schema.label}>
                    <input type="number" className={inputCls} value={value ?? 0} onChange={(e) => update(schema.key, Number(e.target.value))} />
                  </Field>
                );
              case "boolean":
                return (
                  <Field key={schema.key} label={schema.label}>
                    <input type="checkbox" checked={!!value} onChange={(e) => update(schema.key, e.target.checked)} className="h-4 w-4" />
                  </Field>
                );
              case "select":
                return (
                  <Field key={schema.key} label={schema.label}>
                    <select className={inputCls} value={value ?? ""} onChange={(e) => update(schema.key, e.target.value)}>
                      {schema.options.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </Field>
                );
              case "list":
                return (
                  <Field key={schema.key} label={schema.label}>
                    <input
                      className={inputCls}
                      value={(value || []).join(", ")}
                      onChange={(e) =>
                        update(
                          schema.key,
                          e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                        )
                      }
                      placeholder="Tab 1, Tab 2"
                    />
                  </Field>
                );
              case "model": {
                const boundEndpoint = modelObj ? getModelEndpoint(modelObj) : null;
                const apiEnabled = modelObj ? isModelApiEnabled(modelObj) : true;
                return (
                  <Field key={schema.key} label={schema.label}>
                    <select className={inputCls} value={value ?? ""} onChange={(e) => update(schema.key, e.target.value)}>
                      <option value="">— Select a model —</option>
                      {models.map((m) => (
                        <option key={m.name} value={m.name}>
                          {m.name}
                          {isModelApiEnabled(m) ? "" : " (API disabled)"}
                        </option>
                      ))}
                    </select>
                    {boundEndpoint && (
                      <p className={`text-[10px] ${apiEnabled ? "text-secondary" : "text-amber-400/80"}`}>
                        {apiEnabled
                          ? `Bound to GET ${boundEndpoint}`
                          : `API disabled — enable it in the API Designer to bind ${boundEndpoint}`}
                      </p>
                    )}
                  </Field>
                );
              }
              case "field":
                return (
                  <Field key={schema.key} label={schema.label}>
                    <select className={inputCls} value={value ?? ""} onChange={(e) => update(schema.key, e.target.value)} disabled={!modelObj}>
                      <option value="">— Select a field —</option>
                      {fieldNames.map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </Field>
                );
              case "fieldList":
                return (
                  <Field key={schema.key} label={schema.label}>
                    {!modelObj && <p className="text-[11px] text-on-surface-variant/40">Select a model first</p>}
                    {modelObj && (
                      <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
                        {fieldNames.map((f) => {
                          const checked = (value || []).includes(f);
                          return (
                            <label key={f} className="flex items-center gap-2 text-xs">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  const current = value || [];
                                  update(
                                    schema.key,
                                    e.target.checked ? [...current, f] : current.filter((x) => x !== f)
                                  );
                                }}
                              />
                              {f}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </Field>
                );
              case "roleList":
                return (
                  <Field key={schema.key} label={schema.label}>
                    {roles.length === 0 && <p className="text-[11px] text-on-surface-variant/40">No roles defined.</p>}
                    <div className="flex flex-col gap-1">
                      {roles.map((r) => {
                        const checked = (value || []).includes(r.name);
                        return (
                          <label key={r.name} className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const current = value || [];
                                update(
                                  schema.key,
                                  e.target.checked ? [...current, r.name] : current.filter((x) => x !== r.name)
                                );
                              }}
                            />
                            {r.name}
                          </label>
                        );
                      })}
                    </div>
                  </Field>
                );
              default:
                return null;
            }
          })}
        </div>
      )}

      {/* ─── Size & Transform ────────────────────────────────────── */}
      {/* Only show X/Y if parent is free-positioning OR this node itself is a free-positioning container? 
          For Frame, it is a container but it's positioned by its parent. If its parent is a Frame, then it has x,y. 
          The parentIsFreePositioning flag detects that. We'll also show X/Y if the node itself is a Frame and its parent is free-positioning. */}
      {(parentIsFreePositioning || isFrame) && (
        <div className="border-b border-white/10 pb-4">
          <h4 className="text-xs font-semibold text-on-surface-variant mb-2">Position</h4>
          {parentIsFreePositioning && (
            <div className="grid grid-cols-2 gap-2">
              <Field label="X">
                <input type="number" className={inputCls} value={node.props?.x ?? 0} onChange={(e) => update("x", Number(e.target.value))} />
              </Field>
              <Field label="Y">
                <input type="number" className={inputCls} value={node.props?.y ?? 0} onChange={(e) => update("y", Number(e.target.value))} />
              </Field>
            </div>
          )}
        </div>
      )}

      {/* ─── Prototype action ───────────────────────────────────────── */}
      <div className="border-b border-white/10 pb-4">
        <h4 className="text-xs font-semibold text-on-surface-variant mb-2">Prototype action</h4>
        <div className="space-y-2">
          <Field label="On click">
            <select
              className={inputCls}
              value={node.props?.action?.type ?? ""}
              onChange={(e) =>
                update(
                  "action",
                  e.target.value ? { ...(node.props?.action || {}), type: e.target.value } : undefined
                )
              }
            >
              <option value="">None</option>
              <option value="navigate">Navigate to route</option>
              <option value="url">Open URL</option>
              <option value="overlay">Open overlay</option>
              {variants.length > 0 && (
                <option value="variant">Switch component variant</option>
              )}
            </select>
          </Field>
          {node.props?.action?.type === "variant" ? (
            <Field label="Variant">
              <select
                className={inputCls}
                value={node.props?.action?.target ?? ""}
                onChange={(e) =>
                  update("action", { ...node.props.action, target: e.target.value })
                }
              >
                <option value="">Choose…</option>
                {variants.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : node.props?.action?.type ? (
            <Field label={node.props.action.type === "url" ? "URL" : "Route"}>
              <input
                className={inputCls}
                value={node.props?.action?.target ?? ""}
                placeholder={node.props.action.type === "url" ? "https://example.com" : "/tasks"}
                onChange={(e) =>
                  update("action", { ...(node.props?.action || {}), target: e.target.value })
                }
              />
            </Field>
          ) : null}
          {node.props?.action?.type === "overlay" && (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Transition">
                <select
                  className={inputCls}
                  value={node.props?.action?.transition ?? "dissolve"}
                  onChange={(e) =>
                    update("action", { ...node.props.action, transition: e.target.value })
                  }
                >
                  <option value="instant">Instant</option>
                  <option value="dissolve">Dissolve</option>
                  <option value="slide">Slide</option>
                  <option value="push">Push</option>
                </select>
              </Field>
              <Field label="Duration (ms)">
                <input
                  type="number"
                  className={inputCls}
                  value={node.props?.action?.duration ?? 240}
                  onChange={(e) =>
                    update("action", { ...node.props.action, duration: Number(e.target.value) })
                  }
                />
              </Field>
            </div>
          )}
        </div>
      </div>

      {componentProperties.some((p) => p.type === "boolean") && (
        <div className="border-b border-white/10 pb-4">
          <h4 className="text-xs font-semibold text-on-surface-variant mb-2">Condition</h4>
          <div className="space-y-2">
            <Field label="Show when">
              <select
                className={inputCls}
                value={node.props?.condition?.propertyId ?? ""}
                onChange={(e) =>
                  update(
                    "condition",
                    e.target.value
                      ? { ...(node.props?.condition || {}), propertyId: e.target.value }
                      : undefined
                  )
                }
              >
                <option value="">Always</option>
                {componentProperties
                  .filter((p) => p.type === "boolean")
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </Field>
            {node.props?.condition?.propertyId && (
              <Field label="Is">
                <select
                  className={inputCls}
                  value={node.props?.condition?.equals ?? "true"}
                  onChange={(e) =>
                    update("condition", { ...node.props.condition, equals: e.target.value })
                  }
                >
                  <option value="true">On</option>
                  <option value="false">Off</option>
                </select>
              </Field>
            )}
          </div>
        </div>
      )}

      {/* ─── Size ───────────────────────────────────────────────────── */}
      <div className="border-b border-white/10 pb-4">
        <h4 className="text-xs font-semibold text-on-surface-variant mb-2">Size</h4>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Width">
            <input
              className={inputCls}
              value={node.props?.width ?? "auto"}
              placeholder="auto"
              onChange={(e) => {
                const raw = e.target.value.trim();
                const num = Number(raw);
                update("width", raw === "" ? "auto" : Number.isNaN(num) ? raw : num);
              }}
            />
          </Field>
          <Field label="Height">
            <input
              className={inputCls}
              value={node.props?.height ?? "auto"}
              placeholder="auto"
              onChange={(e) => {
                const raw = e.target.value.trim();
                const num = Number(raw);
                update("height", raw === "" ? "auto" : Number.isNaN(num) ? raw : num);
              }}
            />
          </Field>
          <Field label="Width mode">
            <select
              className={inputCls}
              value={node.props?.widthMode ?? ""}
              onChange={(e) => update("widthMode", e.target.value || undefined)}
              title="Hug = size to contents, Fill = stretch to parent, Fixed = use Width"
            >
              <option value="">Default</option>
              <option value="hug">Hug contents</option>
              <option value="fill">Fill container</option>
              <option value="fixed">Fixed</option>
            </select>
          </Field>
          <Field label="Height mode">
            <select
              className={inputCls}
              value={node.props?.heightMode ?? ""}
              onChange={(e) => update("heightMode", e.target.value || undefined)}
              title="Hug = size to contents, Fill = stretch to parent, Fixed = use Height"
            >
              <option value="">Default</option>
              <option value="hug">Hug contents</option>
              <option value="fill">Fill container</option>
              <option value="fixed">Fixed</option>
            </select>
          </Field>
          <Field label="Rotation">
            <input type="number" className={inputCls} value={node.props?.rotation ?? 0} onChange={(e) => update("rotation", Number(e.target.value))} />
          </Field>
          <Field label="Opacity">
            <input type="number" step="0.05" min="0" max="1" className={inputCls} value={node.props?.opacity ?? 1} onChange={(e) => update("opacity", Number(e.target.value))} />
          </Field>
        </div>
      </div>

      {def.isContainer && (
        <div className="border-b border-white/10 pb-4">
          <h4 className="text-xs font-semibold text-on-surface-variant mb-2">Auto layout</h4>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Direction">
              <select
                className={inputCls}
                value={node.props?.flexDirection ?? ""}
                onChange={(e) => update("flexDirection", e.target.value || undefined)}
                title="Override the container's flex direction"
              >
                <option value="">Default</option>
                <option value="row">Horizontal</option>
                <option value="column">Vertical</option>
              </select>
            </Field>
            <Field label="Wrap">
              <select
                className={inputCls}
                value={node.props?.flexWrap ?? ""}
                onChange={(e) => update("flexWrap", e.target.value || undefined)}
                title="Wrap children onto new lines"
              >
                <option value="">Default</option>
                <option value="wrap">Wrap</option>
                <option value="nowrap">No wrap</option>
              </select>
            </Field>
            <Field label="Gap (px)">
              <input
                type="number"
                className={inputCls}
                value={node.props?.gapPx ?? ""}
                placeholder="auto"
                onChange={(e) =>
                  update("gapPx", e.target.value === "" ? undefined : Number(e.target.value))
                }
              />
            </Field>
          </div>
          <p className="text-[10px] text-on-surface-variant/40 mt-1">
            Hug/Fill come from Size; gap in px overrides the Tailwind gap.
          </p>
        </div>
      )}

      {/* ─── Styling ──────────────────────────────────────────────────── */}
      <div>
        <h4 className="text-xs font-semibold text-on-surface-variant mb-2">Styling</h4>
        <div className="space-y-2">
          <ColorField
            label="Background"
            value={node.props?.backgroundColor}
            fallback="#000000"
            colorTokens={designTokens?.colors || []}
            onChange={(v) => update("backgroundColor", v)}
          />
          <ColorField
            label="Text Color"
            value={node.props?.color}
            fallback="#ffffff"
            colorTokens={designTokens?.colors || []}
            onChange={(v) => update("color", v)}
          />
          <Field label="Text Style">
            <select
              className={inputCls}
              value={tokenIdFromRef(node.props?.textStyle)}
              onChange={(e) => update("textStyle", e.target.value ? `@token:${e.target.value}` : "")}
            >
              <option value="">Custom (Font Size / Weight below)</option>
              {(designTokens?.textStyles || []).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </Field>
          {tokenIdFromRef(node.props?.textStyle) ? (
            <p className="text-[10px] text-on-surface-variant/50 -mt-1">
              Font Size/Weight come from the text style above — edit the token itself (Tokens panel) to change them everywhere.
            </p>
          ) : (
            <>
              <Field label="Font Size">
                <input className={inputCls} value={node.props?.fontSize || "inherit"} onChange={(e) => update("fontSize", e.target.value)} />
              </Field>
              <Field label="Font Weight">
                <select className={inputCls} value={node.props?.fontWeight || "normal"} onChange={(e) => update("fontWeight", e.target.value)}>
                  <option value="normal">Normal</option>
                  <option value="bold">Bold</option>
                  <option value="100">100</option>
                  <option value="200">200</option>
                  <option value="300">300</option>
                  <option value="400">400</option>
                  <option value="500">500</option>
                  <option value="600">600</option>
                  <option value="700">700</option>
                  <option value="800">800</option>
                  <option value="900">900</option>
                </select>
              </Field>
            </>
          )}
          <Field label="Border">
            <input className={inputCls} value={node.props?.border || "none"} placeholder="1px solid #fff" onChange={(e) => update("border", e.target.value)} />
          </Field>
          <Field label="Border Radius">
            <input className={inputCls} value={node.props?.borderRadius || "0"} onChange={(e) => update("borderRadius", e.target.value)} />
          </Field>
          <Field label="Box Shadow">
            <input className={inputCls} value={node.props?.boxShadow || "none"} placeholder="0 4px 8px rgba(0,0,0,0.2)" onChange={(e) => update("boxShadow", e.target.value)} />
          </Field>
          <Field label="Padding">
            <input className={inputCls} value={node.props?.padding || "0"} onChange={(e) => update("padding", e.target.value)} />
          </Field>
          <Field label="Margin">
            <input className={inputCls} value={node.props?.margin || "0"} onChange={(e) => update("margin", e.target.value)} />
          </Field>
        </div>
      </div>
    </div>
  );
}