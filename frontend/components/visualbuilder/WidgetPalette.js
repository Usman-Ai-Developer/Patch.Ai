// frontend/components/visualbuilder/WidgetPalette.js
"use client";

import React, { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { widgetsByCategory, INSTANCE_TYPE } from "./WidgetRegistry";

function PaletteItem({ type, label, icon, componentId }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: componentId ? `palette-component-${componentId}` : `palette-${type}`,
    data: componentId
      ? { source: "palette", widgetType: INSTANCE_TYPE, componentId, label }
      : { source: "palette", widgetType: type },
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="palette-item flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-surface-container-low hover:border-secondary/50 hover:bg-surface-container cursor-grab active:cursor-grabbing text-xs transition-colors"
      style={{ opacity: isDragging ? 0.3 : 1 }}
      title={componentId ? `Drag to place "${label}"` : `Drag to add a ${label}`}
    >
      <span className="material-symbols-outlined text-sm text-secondary">{icon}</span>
      <span className="truncate">{label}</span>
    </div>
  );
}

export default function WidgetPalette({ components = [] }) {
  const grouped = widgetsByCategory();
  const [collapsed, setCollapsed] = useState({});

  return (
    <div className="w-64 shrink-0 border-r border-white/5 overflow-y-auto p-3 space-y-4 max-h-full">
      {components.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wide text-on-surface-variant/50 font-semibold px-1 mb-2">
            Components
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            {components.map((comp) => (
              <PaletteItem
                key={comp.id}
                type={INSTANCE_TYPE}
                label={comp.name}
                icon="widgets"
                componentId={comp.id}
              />
            ))}
          </div>
        </div>
      )}

      <div className="text-xs uppercase tracking-wide text-on-surface-variant/50 font-semibold px-1">Widgets</div>
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category}>
          <button
            type="button"
            onClick={() => setCollapsed((c) => ({ ...c, [category]: !c[category] }))}
            className="w-full flex items-center justify-between text-xs font-semibold text-on-surface-variant/70 mb-2 px-1"
          >
            {category}
            <span className="material-symbols-outlined text-sm">
              {collapsed[category] ? "expand_more" : "expand_less"}
            </span>
          </button>
          {!collapsed[category] && (
            <div className="grid grid-cols-1 gap-1.5">
              {items.map((item) => (
                <PaletteItem key={item.type} type={item.type} label={item.label} icon={item.icon} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
