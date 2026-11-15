// frontend/components/visualbuilder/CanvasNode.js
"use client";

import React, { useMemo, useRef, useState } from "react";
import { WIDGETS, INSTANCE_TYPE } from "./WidgetRegistry";

function isRoot(node) {
  return node?.id === "root";
}

// Boolean-property conditions: hide nodes inside an instance when the
// instance's override does not match the node's condition.
function collectConditionPatches(node, overrides, patches) {
  if (!node || typeof node !== "object") return;
  const condition = node.props?.condition;
  if (condition?.propertyId) {
    const expected = String(condition.equals ?? "true") !== "false";
    const actual = overrides?.[condition.propertyId] !== false;
    if (actual !== expected) {
      patches[node.id] = { ...(patches[node.id] || {}), visible: false };
    }
  }
  (node.children || []).forEach((child) =>
    collectConditionPatches(child, overrides, patches)
  );
}

// Snap-to-guide tuning. SNAP_THRESHOLD is in *screen* px, so the drag/resize
// math (which works in layout px) divides it by the current zoom.
const SNAP_THRESHOLD = 6;
const GUIDE_EPSILON = 0.5;
const MIN_FREE_SIZE = 20;

// Parent + sibling alignment lines on each axis, in layout px. A moving node
// aligns its left/center/right (or top/middle/bottom) edges to any of these.
function collectSnapTargets(parentSize, siblings) {
  const xs = [0, parentSize.width / 2, parentSize.width];
  const ys = [0, parentSize.height / 2, parentSize.height];
  siblings.forEach((box) => {
    xs.push(box.x, box.x + box.width / 2, box.x + box.width);
    ys.push(box.y, box.y + box.height / 2, box.y + box.height);
  });
  return { xs, ys };
}

// Smallest shift that lands one of `edges` on a target, or null when every
// target is farther than `threshold` away (the unsnapped position is kept).
function snapAxis(edges, targets, threshold) {
  let shift = null;
  edges.forEach((edge) => {
    targets.forEach((target) => {
      const distance = target - edge;
      if (Math.abs(distance) <= threshold && (shift === null || Math.abs(distance) < Math.abs(shift))) {
        shift = distance;
      }
    });
  });
  return shift;
}

// After snapping, every target sitting exactly on one of `edges` gets a guide.
function alignedGuides(edges, targets) {
  const guides = new Set();
  targets.forEach((target) => {
    if (edges.some((edge) => Math.abs(edge - target) <= GUIDE_EPSILON)) guides.add(target);
  });
  return Array.from(guides);
}

function WidgetHandle({ node, selected, onPropsChange, zoom, children }) {
  const props = node.props || {};
  const [live, setLive] = useState(null);
  const wrapperRef = useRef(null);

  const x = live?.x ?? props.x ?? 0;
  const y = live?.y ?? props.y ?? 0;
  const width = live?.width ?? (props.width !== "auto" ? props.width : undefined);
  const height = live?.height ?? (props.height !== "auto" ? props.height : undefined);
  const isLocked = Boolean(props?.locked);
  const isHidden = Boolean(props?.hidden) || props?.visible === false;

  // Measure the offsetParent plus sibling handles once per gesture for snapping.
  function measureSnapContext() {
    const wrapper = wrapperRef.current;
    const parent = wrapper?.parentElement;
    if (!wrapper || !parent) return null;
    const parentSize = { width: parent.clientWidth, height: parent.clientHeight };
    const siblings = [];
    Array.from(parent.children).forEach((el) => {
      if (el === wrapper || !el.hasAttribute("data-widget-handle")) return;
      siblings.push({
        x: el.offsetLeft,
        y: el.offsetTop,
        width: el.offsetWidth,
        height: el.offsetHeight,
      });
    });
    return { parentSize, targets: collectSnapTargets(parentSize, siblings) };
  }

  function startDrag(e) {
    if (isLocked || isHidden) return;
    if (e.button !== 0 || e.target.closest("[data-resize-handle]")) return;
    e.stopPropagation();
    const startClient = { x: e.clientX, y: e.clientY };
    const startPos = { x: props.x || 0, y: props.y || 0 };
    const snapContext = measureSnapContext();
    const nodeSize = {
      width: wrapperRef.current?.offsetWidth || 0,
      height: wrapperRef.current?.offsetHeight || 0,
    };
    const threshold = SNAP_THRESHOLD / (zoom || 1);
    let latest = null;

    function onMove(ev) {
      const dx = (ev.clientX - startClient.x) / (zoom || 1);
      const dy = (ev.clientY - startClient.y) / (zoom || 1);
      let nextX = Math.round(startPos.x + dx);
      let nextY = Math.round(startPos.y + dy);
      let guides = null;
      if (snapContext) {
        const { parentSize, targets } = snapContext;
        const snapX = snapAxis([nextX, nextX + nodeSize.width / 2, nextX + nodeSize.width], targets.xs, threshold);
        const snapY = snapAxis([nextY, nextY + nodeSize.height / 2, nextY + nodeSize.height], targets.ys, threshold);
        if (snapX !== null) nextX += snapX;
        if (snapY !== null) nextY += snapY;
        guides = {
          xs: alignedGuides([nextX, nextX + nodeSize.width / 2, nextX + nodeSize.width], targets.xs),
          ys: alignedGuides([nextY, nextY + nodeSize.height / 2, nextY + nodeSize.height], targets.ys),
          width: parentSize.width,
          height: parentSize.height,
        };
      }
      latest = { x: nextX, y: nextY, guides };
      setLive(latest);
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (latest) onPropsChange(node.id, { x: latest.x, y: latest.y });
      setLive(null);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function startResize(e) {
    if (isLocked || isHidden) return;
    e.stopPropagation();
    e.preventDefault();
    const startClient = { x: e.clientX, y: e.clientY };
    const startSize = {
      width: typeof props.width === "number" ? props.width : 160,
      height: typeof props.height === "number" ? props.height : 80,
    };
    const baseX = props.x || 0;
    const baseY = props.y || 0;
    const snapContext = measureSnapContext();
    const threshold = SNAP_THRESHOLD / (zoom || 1);
    let latest = null;

    function onMove(ev) {
      const dw = (ev.clientX - startClient.x) / (zoom || 1);
      const dh = (ev.clientY - startClient.y) / (zoom || 1);
      let nextWidth = Math.max(MIN_FREE_SIZE, Math.round(startSize.width + dw));
      let nextHeight = Math.max(MIN_FREE_SIZE, Math.round(startSize.height + dh));
      let guides = null;
      if (snapContext) {
        const { parentSize, targets } = snapContext;
        const snapRight = snapAxis([baseX + nextWidth], targets.xs, threshold);
        const snapBottom = snapAxis([baseY + nextHeight], targets.ys, threshold);
        if (snapRight !== null) nextWidth = Math.max(MIN_FREE_SIZE, nextWidth + snapRight);
        if (snapBottom !== null) nextHeight = Math.max(MIN_FREE_SIZE, nextHeight + snapBottom);
        guides = {
          xs: alignedGuides([baseX + nextWidth], targets.xs),
          ys: alignedGuides([baseY + nextHeight], targets.ys),
          width: parentSize.width,
          height: parentSize.height,
        };
      }
      latest = { width: nextWidth, height: nextHeight, guides };
      setLive(latest);
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (latest) onPropsChange(node.id, { width: latest.width, height: latest.height });
      setLive(null);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  const showGuides = live?.guides && (live.guides.xs.length > 0 || live.guides.ys.length > 0);
  const guideThickness = 1 / (zoom || 1);

  const style = {
    position: "absolute",
    left: x,
    top: y,
  };
  if (width && width !== "auto") style.width = typeof width === "number" ? `${width}px` : width;
  if (height && height !== "auto") style.height = typeof height === "number" ? `${height}px` : height;
  if (isLocked) style.pointerEvents = "none";

  return (
    <>
      {selected && showGuides && (
        <div className="absolute inset-0 z-50 pointer-events-none" aria-hidden="true">
          {live.guides.xs.map((guideX) => (
            <div
              key={`guide-x-${guideX}`}
              className="absolute top-0 bottom-0 bg-secondary"
              style={{
                left: Math.max(0, Math.min(guideX, live.guides.width - guideThickness)),
                width: `${guideThickness}px`,
              }}
            />
          ))}
          {live.guides.ys.map((guideY) => (
            <div
              key={`guide-y-${guideY}`}
              className="absolute left-0 right-0 bg-secondary"
              style={{
                top: Math.max(0, Math.min(guideY, live.guides.height - guideThickness)),
                height: `${guideThickness}px`,
              }}
            />
          ))}
        </div>
      )}
      <div
        ref={wrapperRef}
        data-widget-handle={node.id}
        style={style}
        onMouseDown={startDrag}
        className="cursor-move"
      >
        {children}
        {selected && !isLocked && !isHidden && (
          <div
            data-resize-handle
            onMouseDown={startResize}
            className="absolute -bottom-1 -right-1 w-3 h-3 rounded-sm bg-secondary opacity-0 group-hover:opacity-100 hover:opacity-100 cursor-nwse-resize z-20"
            title="Drag to resize"
          />
        )}
      </div>
    </>
  );
}

export default function CanvasNode({
  node,
  selectedIds,
  onSelect,
  onDelete,
  onDuplicate,
  onUngroup,
  onPropsChange,
  zoom = 1,
  depth = 0,
  components = {},
  readOnly = false,
  visited = [],
  overridesByNode = {},
  onEnterComponent,
}) {
  // ─── Inline text editing (double-click a text-bearing widget) ──────
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const cancelEditRef = useRef(false);

  const def = WIDGETS[node.type];

  // Instance overrides are keyed by master node id; merge them before the
  // widget renders so a page's copy can differ from the master without
  // touching the shared tree.
  const effectiveNode = overridesByNode[node.id]
    ? { ...node, props: { ...node.props, ...overridesByNode[node.id] } }
    : node;

  // Layer visibility/lock are authored in the Layers panel; the canvas has to
  // honour them or the toggles are decorative.
  const isHidden =
    node.id !== "root" &&
    (Boolean(effectiveNode.props?.hidden) || effectiveNode.props?.visible === false);
  const isLocked = Boolean(effectiveNode.props?.locked);

  // Which prop holds this widget's visible text. Text/Heading/Button/Link use
  // "text"; cards and stat widgets use "label"/"title". Containers have no
  // single text prop, and instances are not editable in place.
  const textKey = useMemo(() => {
    if (!def || def.isContainer || readOnly || isLocked || node.type === INSTANCE_TYPE) return null;
    const props = effectiveNode.props || {};
    for (const key of ["text", "label", "title"]) {
      if (typeof props[key] === "string") return key;
    }
    return null;
  }, [def, node.type, effectiveNode.props, readOnly, isLocked]);

  if (!def) {
    return <div className="text-xs text-red-400">Unknown widget: {node.type}</div>;
  }

  if (isHidden) return null;

  const isSelected = selectedIds?.includes(node.id);
  const Preview = def.Preview;
  const childIsFreePositioned = def.freePositioning;

  function beginEdit(e) {
    if (readOnly || !textKey) return;
    e.stopPropagation();
    e.preventDefault();
    cancelEditRef.current = false;
    setDraft(String(effectiveNode.props?.[textKey] ?? ""));
    setEditing(true);
  }

  function commitEdit() {
    if (cancelEditRef.current) {
      cancelEditRef.current = false;
      setEditing(false);
      return;
    }
    const next = draft;
    if (next !== String(effectiveNode.props?.[textKey] ?? "")) {
      onPropsChange(node.id, { [textKey]: next });
    }
    setEditing(false);
  }

  function handleEditKeyDown(e) {
    // Keep canvas shortcuts (Delete, arrows, ⌘Z…) out of the text field.
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      commitEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEditRef.current = true;
      setDraft(String(effectiveNode.props?.[textKey] ?? ""));
      setEditing(false);
    }
  }

  const childElements = (node.children || []).map((child) => {
    const rendered = (
      <CanvasNode
        key={child.id}
        node={child}
        selectedIds={selectedIds}
        onSelect={onSelect}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        onUngroup={onUngroup}
        onPropsChange={onPropsChange}
        zoom={zoom}
        depth={depth + 1}
        components={components}
        readOnly={readOnly}
        visited={visited}
        overridesByNode={overridesByNode}
        onEnterComponent={onEnterComponent}
      />
    );
    // Inside a component instance the tree is a read-only preview: no drag
    // handles, no selection (WidgetHandle inside each CanvasNode is disabled
    // when readOnly). Render children directly.
    return rendered;
  });

  // ─── Component instance ─────────────────────────────────────────────
  if (node.type === INSTANCE_TYPE) {
    const compId = node.props?.componentId;
    const comp = components?.[compId];
    if (!comp) {
      return (
        <div className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-300">
          Missing component
        </div>
      );
    }
    if (visited.includes(compId)) {
      return (
        <div className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-[11px] text-red-300">
          Cyclic component reference
        </div>
      );
    }
    const variant = (comp.variants || []).find((v) => v && v.id === node.props?.variantId);
    const masterTree = variant?.tree || comp.tree;
    if (!masterTree) {
      return (
        <div className="rounded border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-on-surface-variant">
          Empty component
        </div>
      );
    }
    // Turn this instance's overrides into per-node prop patches applied only
    // to this read-only master render.
    const patchByNode = {};
    (comp.properties || []).forEach((prop) => {
      if (!prop?.nodeId) return;
      const value = node.props?.overrides?.[prop.id];
      if (value !== undefined && value !== null && value !== "") {
        patchByNode[prop.nodeId] = { [prop.prop || "text"]: value };
      }
    });
    // Condition-gated nodes disappear on this instance only.
    collectConditionPatches(masterTree, node.props?.overrides || {}, patchByNode);
    return (
      <div
        data-node-id={node.id}
        className={`relative ${
          readOnly
            ? ""
            : isSelected
            ? "ring-2 ring-secondary ring-offset-2 ring-offset-surface"
            : "hover:ring-1 hover:ring-white/20"
        }`}
        onClick={
          readOnly || isLocked
            ? undefined
            : (e) => {
                e.stopPropagation();
                onSelect(node.id, e);
              }
        }
        title={
          readOnly
            ? undefined
            : `Component: ${comp.name}${variant ? ` (${variant.name})` : ""} — double-click to edit the master`
        }
        onDoubleClick={
          readOnly || isLocked
            ? undefined
            : (e) => {
                e.stopPropagation();
                onEnterComponent?.(compId);
              }
        }
      >
        <CanvasNode
          node={masterTree}
          components={components}
          visited={[...visited, compId]}
          readOnly
          overridesByNode={patchByNode}
          selectedIds={[]}
          onSelect={() => {}}
          onDelete={() => {}}
          onDuplicate={() => {}}
          onUngroup={() => {}}
          onPropsChange={() => {}}
          zoom={zoom}
          depth={depth + 1}
        />
      </div>
    );
  }

  if (isRoot(node)) {
    return (
      <div className="flex flex-col gap-4 w-full min-h-full" data-node-id="root">
        {childElements}
      </div>
    );
  }

  // Every non-root widget is rendered inside WidgetHandle, which positions it
  // absolutely at x/y, sizes it by width/height, and makes it draggable +
  // resizable via cursor (with alignment guides). Shapes, frames and any other
  // widget can therefore be moved and adjusted directly on the canvas.
  return (
    <WidgetHandle
      node={effectiveNode}
      selected={isSelected}
      onPropsChange={onPropsChange}
      zoom={zoom}
    >
    <div
      className="relative w-full h-full"
      onClick={
        readOnly || isLocked
          ? undefined
          : (e) => {
              e.stopPropagation();
              onSelect(node.id, e);
            }
      }
    >
      {!readOnly && !isLocked && (
        <div
          className={`absolute -top-3 -left-1 z-10 items-center gap-1 bg-surface-container-highest rounded px-1 py-0.5 text-[10px] ${
            isSelected ? "flex" : "hidden group-hover:flex"
          }`}
          onMouseDown={(e) => e.stopPropagation()}
        >
            <span className="text-on-surface-variant/70">{def.label}</span>
            {def.isContainer && node.children?.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onUngroup(node.id);
                }}
                className="material-symbols-outlined text-[12px] hover:text-secondary"
                title="Ungroup — lift children up a level (⌘/Ctrl+Shift+G)"
              >
                deselect
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate(node.id);
              }}
              className="material-symbols-outlined text-[12px] hover:text-secondary"
              title="Duplicate (⌘/Ctrl+D)"
            >
              content_copy
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(node.id);
              }}
              className="material-symbols-outlined text-[12px] hover:text-error"
              title="Delete (Del)"
            >
              delete
            </button>
          </div>
        )}
        <div className={editing ? "invisible" : undefined}>
          <Preview node={effectiveNode}>{childElements}</Preview>
        </div>
        {editing && (
          <div
            className="absolute inset-0 z-40 flex items-center rounded bg-surface-container-lowest/95 px-1"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleEditKeyDown}
              onBlur={commitEdit}
              aria-label={`Edit ${def.label} text`}
              className="w-full rounded border border-secondary bg-surface-container-low px-1.5 py-1 text-sm text-on-surface outline-none focus:ring-1 focus:ring-secondary/40"
            />
          </div>
        )}
      </div>
    </WidgetHandle>
  );
}