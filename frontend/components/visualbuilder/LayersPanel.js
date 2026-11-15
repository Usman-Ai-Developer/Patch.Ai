// frontend/components/visualbuilder/LayersPanel.js
"use client";

import React, { useState } from "react";
import {
  DndContext,
  useSensor,
  useSensors,
  PointerSensor,
} from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { WIDGETS } from "./WidgetRegistry";
import { moveNode, moveNodeAfter, findNode } from "./treeUtils";

function LayerRow({
  node,
  depth,
  selectedIds,
  onSelect,
  collapsed,
  onToggleCollapse,
  onToggleVisibility,
  onToggleLock,
}) {
  const def = WIDGETS[node.type];
  const isRoot = node.id === "root";
  const isSelected = selectedIds?.includes(node.id);
  const hasChildren = (node.children || []).length > 0;
  const isCollapsed = collapsed.has(node.id);
  const isHidden = node.props?.hidden || false;
  const isLocked = node.props?.locked || false;

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } =
    useDraggable({
      id: `layer-${node.id}`,
      data: { nodeId: node.id },
      disabled: isRoot,
    });
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `layer-drop-${node.id}`,
    data: { nodeId: node.id, isContainer: def?.isContainer },
  });

  return (
    <div>
      <div
        ref={(el) => {
          setDragRef(el);
          setDropRef(el);
        }}
        {...attributes}
        {...listeners}
        onClick={(e) => {
          e.stopPropagation();
          if (!isRoot) onSelect(node.id, e);
        }}
        className={`flex items-center gap-0.5 px-1 py-1 rounded text-xs cursor-pointer ${
          isSelected ? "bg-secondary/20 text-secondary" : "hover:bg-white/5"
        } ${isOver ? "outline outline-1 outline-secondary" : ""} ${
          isDragging ? "opacity-40" : ""
        } ${isHidden ? "opacity-40" : ""}`}
        style={{ paddingLeft: `${depth * 14 + 6}px` }}
      >
        {/* Drag handle */}
        <div className="cursor-grab text-on-surface-variant/30 hover:text-on-surface">
          <span className="material-symbols-outlined text-[16px]">drag_handle</span>
        </div>

        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse(node.id);
            }}
            className="shrink-0"
          >
            <span className="material-symbols-outlined text-[14px]">
              {isCollapsed ? "chevron_right" : "expand_more"}
            </span>
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}

        <span className="material-symbols-outlined text-[14px] text-on-surface-variant/70 shrink-0">
          {def?.icon || "widgets"}
        </span>

        <span className="truncate flex-1">
          {isRoot ? "Page" : def?.label || node.type}
        </span>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleVisibility(node.id);
          }}
          className="text-on-surface-variant/40 hover:text-primary"
        >
          <span className="material-symbols-outlined text-[14px]">
            {isHidden ? "visibility_off" : "visibility"}
          </span>
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleLock(node.id);
          }}
          className="text-on-surface-variant/40 hover:text-primary"
        >
          <span className="material-symbols-outlined text-[14px]">
            {isLocked ? "lock" : "lock_open"}
          </span>
        </button>
      </div>

      {hasChildren && !isCollapsed && (
        <div>
          {node.children.map((child) => (
            <LayerRow
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedIds={selectedIds}
              onSelect={onSelect}
              collapsed={collapsed}
              onToggleCollapse={onToggleCollapse}
              onToggleVisibility={onToggleVisibility}
              onToggleLock={onToggleLock}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function LayersPanel({
  tree,
  selectedIds,
  onSelectionChange,
  setTree,
  onPropsChange,
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 }, // prevents clicks from being mistaken for drags
    })
  );
  const [collapsed, setCollapsed] = useState(new Set());

  function handleSelect(id, e) {
    const additive = e?.shiftKey || e?.metaKey || e?.ctrlKey;
    onSelectionChange((prevIds) => {
      if (!additive) return [id];
      const set = new Set(prevIds);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return Array.from(set);
    });
  }

  function toggleCollapse(id) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleVisibility(id) {
    if (onPropsChange) {
      const node = findNode(tree, id);
      if (node) {
        const newHidden = !node.props?.hidden;
        onPropsChange(id, { hidden: newHidden });
      }
    }
  }

  function toggleLock(id) {
    if (onPropsChange) {
      const node = findNode(tree, id);
      if (node) {
        const newLocked = !node.props?.locked;
        onPropsChange(id, { locked: newLocked });
      }
    }
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over) return;
    const draggedId = active.data.current?.nodeId;
    const targetId = over.data.current?.nodeId;
    const targetIsContainer = over.data.current?.isContainer;
    if (!draggedId || !targetId || draggedId === targetId) return;

    setTree((prev) => {
      if (targetIsContainer) {
        return moveNode(prev, draggedId, targetId, -1);
      }
      return moveNodeAfter(prev, draggedId, targetId);
    });
  }

  if (!tree) return null;

  return (
    <div className="w-56 shrink-0 border-r border-white/5 overflow-y-auto p-2 bg-surface/20">
      <div className="text-xs uppercase tracking-wide text-on-surface-variant/50 font-semibold px-1 mb-2">
        Layers
      </div>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <LayerRow
          node={tree}
          depth={0}
          selectedIds={selectedIds}
          onSelect={handleSelect}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapse}
          onToggleVisibility={toggleVisibility}
          onToggleLock={toggleLock}
        />
      </DndContext>
    </div>
  );
}