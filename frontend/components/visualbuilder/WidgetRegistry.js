// frontend/components/visualbuilder/WidgetRegistry.js
"use client";

import React, { useState } from "react";
import { useBuilderData } from "./builderContext";
import EndpointPreview from "./EndpointPreview";
import GenericPreview from "./GenericPreview";
import { CATEGORIES, WIDGET_METADATA, DESIGN_TOKENS } from "./WidgetMetadata.generated";

// WIDGET_METADATA / CATEGORIES / DESIGN_TOKENS are generated from the ONE
// canonical source — backend/builder/services/frontend/react/writers/
// widget_manifest.py — by `python manage.py export_widget_manifest`. Do
// not hand-add widget metadata or Tailwind classes here; edit the Python
// manifest and regenerate (see that file's docstring, and the parity
// tests in builder/tests.py which fail CI if this file is stale or a
// token no longer matches the generated app's real components).
export { CATEGORIES };

const t = DESIGN_TOKENS; // shorthand — t["table.wrap"] etc.

function useModelByName(name) {
  const { models } = useBuilderData();
  return models.find((m) => m.name === name) || null;
}

// ─── Preview components for the 13 "smart" widgets ─────────────────────
// These bind to models, auth, or tab state, so — like their Python
// counterparts in visual_pages.py's _SMART_RENDER_FUNCS — they need real
// hand-written logic on both sides. Their *styling* now comes from
// DESIGN_TOKENS (copied verbatim from the actual generated components),
// so what you see on the canvas matches what the generated app looks
// like, not an approximation of it. Only label/icon/category/propsSchema/
// defaultProps come from WIDGET_METADATA above; the Preview component
// itself still lives here because it needs live model data + React state.
const SMART_PREVIEWS = {
  Table: ({ node }) => {
    const model = useModelByName(node.props?.model);
    const fields = (node.props?.fields || []).length
      ? node.props.fields
      : (model?.fields || []).slice(0, 3).map((f) => f.name);
    return (
      <div className={t["table.wrap"]}>
        <table className={t["table.table"]}>
          <thead>
            <tr className={t["table.headRow"]}>
              {(fields.length ? fields : ["field"]).map((f) => (
                <th key={f} className={t["table.headCell"]}>{f}</th>
              ))}
              {node.props?.showActions !== false && (
                <th className={t["table.headCell"]}>Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {!model ? (
              <tr>
                <td colSpan={fields.length + 1} className={t["table.empty"]}>
                  Select a model to bind this table
                </td>
              </tr>
            ) : (
              <tr className={t["table.bodyRow"]}>
                {fields.map((f) => (
                  <td key={f} className={t["table.cell"]}>—</td>
                ))}
                {node.props?.showActions !== false && (
                  <td className={t["table.cell"]}>
                    <span className={t["table.editAction"]}>Edit</span>{" "}
                    <span className={t["table.deleteAction"]}>Delete</span>
                  </td>
                )}
              </tr>
            )}
          </tbody>
        </table>
        {model && <EndpointPreview model={model} />}
      </div>
    );
  },

  Form: ({ node }) => {
    const model = useModelByName(node.props?.model);
    const fields = (node.props?.fields || []).length
      ? node.props.fields
      : (model?.fields || []).slice(0, 3).map((f) => f.name);
    return (
      <div className={t["form.wrap"]}>
        {(fields.length ? fields : ["field"]).map((f) => (
          <div key={f} className={t["form.fieldWrap"]}>
            <label className={t["form.label"]}>{f}</label>
            <input disabled className={t["form.input"]} placeholder={f} />
          </div>
        ))}
        <button type="button" disabled className={t["form.submit"]}>
          {node.props?.mode === "edit" ? "Save" : "Create"}
        </button>
        {!model && <p className={t["form.error"]}>Select a model to bind this form</p>}
        {model && <EndpointPreview model={model} />}
      </div>
    );
  },

  DetailView: ({ node }) => {
    const model = useModelByName(node.props?.model);
    const fields = (node.props?.fields || []).length
      ? node.props.fields
      : (model?.fields || []).slice(0, 4).map((f) => f.name);
    return (
      <div className={t["detail.wrap"]}>
        {(fields.length ? fields : ["field"]).map((f) => (
          <div key={f} className={t["detail.row"]}>
            <span className={t["detail.key"]}>{f}</span>
            <span>—</span>
          </div>
        ))}
        {model && <EndpointPreview model={model} />}
      </div>
    );
  },

  StatCard: ({ node }) => {
    const model = useModelByName(node.props?.model);
    return (
      <div className={t["statCard.wrap"]}>
        <div className={t["statCard.value"]}>—</div>
        <div className={t["statCard.label"]}>{node.props?.label || node.props?.model || "Stat"}</div>
        {model && <EndpointPreview model={model} />}
      </div>
    );
  },

  DataList: ({ node }) => {
    const model = useModelByName(node.props?.model);
    return (
      <div>
        <ul className={t["dataList.wrap"]}>
          <li className={t["dataList.item"]}>
            <span className={t["dataList.link"]}>
              {model ? `Sample ${node.props?.titleField || model.name}` : "Select a model"}
            </span>
          </li>
        </ul>
        {model && <EndpointPreview model={model} />}
      </div>
    );
  },

  Tabs: ({ node, children }) => {
    const [active, setActive] = useState(0);
    const tabs = node.props?.tabs || [];
    return (
      <div>
        <div className={t["tabs.bar"]}>
          {tabs.map((label, idx) => (
            <button
              key={label}
              type="button"
              onClick={() => setActive(idx)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                active === idx ? t["tabs.tabActive"] : t["tabs.tabInactive"]
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 p-2">{children}</div>
      </div>
    );
  },

  Navbar: () => (
    <div className={t["navbar.wrap"]}>Navbar (from Navigation designer)</div>
  ),

  Sidebar: () => (
    <div className={`${t["sidebar.wrap"]} !h-auto !sticky-0`}>Sidebar (from Navigation designer)</div>
  ),

  LoginCta: () => <span className={t["auth.link"]}>Go to Login</span>,
  SignupCta: () => <span className={t["auth.link"]}>Go to Signup</span>,

  RoleGate: ({ node, children }) => (
    <div className="relative">
      <span className={t["roleGate.badge"]}>
        {(node.props?.roles || []).join(", ") || "Everyone"}
      </span>
      <div className="mt-2 flex flex-col gap-2">{children}</div>
    </div>
  ),

  AiActionButton: ({ node }) => (
    <button type="button" disabled className={t["automation.button"]}>
      ✨ {node.props?.label || "AI Action"}
    </button>
  ),

  WorkflowTriggerButton: ({ node }) => (
    <button type="button" disabled className={t["automation.button"]}>
      🔄 {node.props?.label || "Run Workflow"}
    </button>
  ),
};

// ─── Assemble WIDGETS from manifest metadata + the right Preview ───────
export const WIDGETS = Object.fromEntries(
  Object.entries(WIDGET_METADATA).map(([type, meta]) => {
    const Preview =
      meta.tier === "generic"
        ? (props) => <GenericPreview {...props} spec={meta.render} />
        : SMART_PREVIEWS[type] ||
          (() => <div className="text-xs text-red-400">No preview registered for &quot;{type}&quot;</div>);

    return [
      type,
      {
        category: meta.category,
        label: meta.label,
        icon: meta.icon,
        isContainer: meta.isContainer,
        defaultProps: meta.defaultProps,
        propsSchema: meta.propsSchema,
        // Only Frame sets this (see widget_manifest.py) — when true, THIS
        // widget's own children are free-positioned (x/y/width/height,
        // drag-to-move + resize) instead of flowing. Doesn't affect how
        // this widget itself is positioned by ITS OWN parent.
        freePositioning: meta.render?.freePositioning || false,
        Preview,
      },
    ];
  })
);

// ─── Reusable component instance (builder concept, not a manifest widget) ──
// Kept in WIDGETS so the canvas, layers and selection logic can treat an
// instance like any other node; it is deliberately not part of CATEGORIES, so
// it never shows up in the generic widget palette.
export const INSTANCE_TYPE = "Instance";
WIDGETS[INSTANCE_TYPE] = {
  category: "Components",
  label: "Component",
  icon: "widgets",
  isContainer: false,
  defaultProps: { componentId: null },
  propsSchema: [],
  freePositioning: false,
  Preview: ({ node }) => (
    <div className="text-xs text-on-surface-variant/70">
      {node?.props?.name || "Component instance"}
    </div>
  ),
};

export function widgetsByCategory() {
  const grouped = {};
  CATEGORIES.forEach((c) => (grouped[c] = []));
  Object.entries(WIDGETS).forEach(([type, def]) => {
    if (def.category) grouped[def.category]?.push({ type, ...def });
  });
  return grouped;
}

export function createDefaultNode(type) {
  const def = WIDGETS[type];
  if (!def) return null;
  return {
    id: `${type.toLowerCase()}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1000)}`,
    type,
    props: { ...def.defaultProps },
    children: def.isContainer ? [] : [],
  };
}