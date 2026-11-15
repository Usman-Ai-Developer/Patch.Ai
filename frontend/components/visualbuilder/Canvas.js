// frontend/components/visualbuilder/Canvas.js
"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import CanvasNode from "./CanvasNode";
import { createDefaultNode, WIDGETS } from "./WidgetRegistry";
import {
  removeNode,
  removeNodes,
  duplicateNode,
  duplicateNodes,
  copyNodes,
  pasteNodesAfter,
  reorderSibling,
  groupNodes,
  ungroupNode,
  updateNodeProps,
  findParent,
  findNode,
  makeEmptyRoot,
} from "./treeUtils";

function isEditingText() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

function rectsIntersect(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;
const FIT_PADDING = 48; // screen px of breathing room around Root when fitting

function clampZoom(value) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

export default function Canvas({
  tree,
  setTree,
  selectedIds,
  onSelectionChange,
  activeTool = "select",
  toolOptions = {},
  viewportWidth = null,
  components = {},
  onEnterComponent,
}) {
  const canvasRef = useRef(null);
  const { setNodeRef: setDroppableRef } = useDroppable({ id: "canvas-drop" });
  const setCanvasRef = useCallback(
    (el) => {
      canvasRef.current = el;
      setDroppableRef(el);
    },
    [setDroppableRef]
  );

  // ─── Pan & zoom ──────────────────────────────────────────────────
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [spacePressed, setSpacePressed] = useState(false);
  const panDragRef = useRef(null);
  const [isPanning, setIsPanning] = useState(false);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.code === "Space" && !isEditingText()) setSpacePressed(true);
    }
    function handleKeyUp(e) {
      if (e.code === "Space") setSpacePressed(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const handleWheel = useCallback(
    (e) => {
      const isZoomModifier = e.ctrlKey || e.metaKey || e.altKey;
      if (!isZoomModifier) return;
      e.preventDefault();
      const rect = canvasRef.current.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      const delta = -e.deltaY * 0.001;
      setZoom((z) => {
        const nextZoom = clampZoom(z + delta * z);
        setPan((p) => ({
          x: cursorX - ((cursorX - p.x) / z) * nextZoom,
          y: cursorY - ((cursorY - p.y) / z) * nextZoom,
        }));
        return nextZoom;
      });
    },
    []
  );

  const zoomByStep = useCallback((factor) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const cursorX = rect.width / 2;
    const cursorY = rect.height / 2;
    setZoom((z) => {
      const nextZoom = clampZoom(z * factor);
      setPan((p) => ({
        x: cursorX - ((cursorX - p.x) / z) * nextZoom,
        y: cursorY - ((cursorY - p.y) / z) * nextZoom,
      }));
      return nextZoom;
    });
  }, []);

  const resetZoom = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Fit the root node's bounds inside the viewport (centred, with padding).
  const fitToView = useCallback(() => {
    const canvas = canvasRef.current;
    const rootEl = canvas?.querySelector('[data-node-id="root"]');
    if (!canvas || !rootEl) return;
    const viewport = canvas.getBoundingClientRect();
    const rect = rootEl.getBoundingClientRect();
    // The root lives inside the translate(pan) scale(zoom) wrapper, so
    // screen = pan + layout * zoom. Invert that to recover layout px.
    const layoutX = (rect.left - viewport.left - pan.x) / zoom;
    const layoutY = (rect.top - viewport.top - pan.y) / zoom;
    const layoutWidth = rect.width / zoom;
    const layoutHeight = rect.height / zoom;
    if (!(layoutWidth > 0) || !(layoutHeight > 0)) return;

    const nextZoom = clampZoom(
      Math.min(
        (viewport.width - FIT_PADDING * 2) / layoutWidth,
        (viewport.height - FIT_PADDING * 2) / layoutHeight
      )
    );
    setZoom(nextZoom);
    setPan({
      x: (viewport.width - layoutWidth * nextZoom) / 2 - layoutX * nextZoom,
      y: (viewport.height - layoutHeight * nextZoom) / 2 - layoutY * nextZoom,
    });
  }, [pan, zoom]);

  // ─── Marquee ──────────────────────────────────────────────────────
  const [marquee, setMarquee] = useState(null);
  const marqueeStateRef = useRef(null);
  const suppressNextClickRef = useRef(false);

  const handleCanvasMouseDown = useCallback(
    (e) => {
      if (spacePressed || e.button === 1) {
        e.preventDefault();
        panDragRef.current = { startClient: { x: e.clientX, y: e.clientY }, startPan: pan };
        setIsPanning(true);
        return;
      }
      if (e.target.closest?.("[data-node-id]") && e.target.closest("[data-node-id]") !== canvasRef.current) {
        return;
      }
      if (e.button !== 0) return;
      const additive = e.shiftKey || e.metaKey || e.ctrlKey;
      marqueeStateRef.current = { start: { x: e.clientX, y: e.clientY }, moved: false, additive };
      setMarquee({ x1: e.clientX, y1: e.clientY, x2: e.clientX, y2: e.clientY });
    },
    [spacePressed, pan]
  );

  useEffect(() => {
    function handleMouseMove(e) {
      if (panDragRef.current) {
        const { startClient, startPan } = panDragRef.current;
        setPan({
          x: startPan.x + (e.clientX - startClient.x),
          y: startPan.y + (e.clientY - startClient.y),
        });
        return;
      }
      if (!marqueeStateRef.current) return;
      const { start } = marqueeStateRef.current;
      const dx = Math.abs(e.clientX - start.x);
      const dy = Math.abs(e.clientY - start.y);
      if (dx > 3 || dy > 3) marqueeStateRef.current.moved = true;
      setMarquee({ x1: start.x, y1: start.y, x2: e.clientX, y2: e.clientY });
    }

    function handleMouseUp() {
      if (panDragRef.current) {
        panDragRef.current = null;
        setIsPanning(false);
        return;
      }
      const state = marqueeStateRef.current;
      if (!state) return;
      marqueeStateRef.current = null;

      if (!state.moved) {
        setMarquee(null);
        if (!state.additive) onSelectionChange([]);
        return;
      }

      setMarquee((current) => {
        if (current && canvasRef.current) {
          const rect = {
            left: Math.min(current.x1, current.x2),
            right: Math.max(current.x1, current.x2),
            top: Math.min(current.y1, current.y2),
            bottom: Math.max(current.y1, current.y2),
          };
          const nodeEls = canvasRef.current.querySelectorAll("[data-node-id]");
          const hit = [];
          nodeEls.forEach((el) => {
            const id = el.getAttribute("data-node-id");
            if (id === "root") return;
            const r = el.getBoundingClientRect();
            if (rectsIntersect(rect, r)) hit.push(id);
          });
          suppressNextClickRef.current = true;
          onSelectionChange((prevIds) => {
            if (state.additive) {
              const set = new Set(prevIds);
              hit.forEach((id) => set.add(id));
              return Array.from(set);
            }
            return hit;
          });
        }
        return null;
      });
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [onSelectionChange]);

  // ─── Node selection ──────────────────────────────────────────────
  const handleNodeSelect = useCallback(
    (id, e) => {
      const additive = e?.shiftKey || e?.metaKey || e?.ctrlKey;
      onSelectionChange((prevIds) => {
        if (!additive) return [id];
        const set = new Set(prevIds);
        if (set.has(id)) set.delete(id);
        else set.add(id);
        return Array.from(set);
      });
    },
    [onSelectionChange]
  );

  // ─── Canvas click for tool modes ──────────────────────────────────
  const handleCanvasClick = useCallback(
    (e) => {
      if (suppressNextClickRef.current) {
        suppressNextClickRef.current = false;
        return;
      }
      // If tool is not SELECT and we clicked on the background, create a node.
      if (activeTool !== "select" && !e.target.closest("[data-node-id]")) {
        const rect = canvasRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left - pan.x) / zoom;
        const y = (e.clientY - rect.top - pan.y) / zoom;
        let node = null;
        if (activeTool === "frame") {
          node = createDefaultNode("Frame");
          node.props = { ...node.props, x, y, width: 400, height: 300 };
        } else if (activeTool === "text") {
          node = createDefaultNode("Text");
          node.props = { ...node.props, x, y, text: "Double-click to edit" };
        } else if (activeTool === "shapes") {
          const shapeType = toolOptions.shapeType || "rectangle";
          node = createDefaultNode("Card");
          node.props = { ...node.props, x, y, width: 160, height: 120 };
          if (shapeType === "circle") {
            node.props.className = "rounded-full border border-white/20 bg-surface-container";
          } else if (shapeType === "rounded-rectangle") {
            node.props.className = "rounded-lg border border-white/20 bg-surface-container";
          } else if (shapeType === "line") {
            node = createDefaultNode("Divider");
            node.props = { ...node.props, x, y, width: 200, height: 2 };
          } else {
            node.props.className = "border border-white/20 bg-surface-container";
          }
        } else {
          // Other tools: just clear selection
          onSelectionChange([]);
          return;
        }
        if (node) {
          // Insert into root children
          setTree((prev) => {
            const root = prev || makeEmptyRoot();
            return { ...root, children: [...(root.children || []), node] };
          });
          onSelectionChange([node.id]);
        }
        return;
      }
      // For select tool, clear selection on background click
      if (activeTool === "select") {
        onSelectionChange([]);
      }
    },
    [activeTool, toolOptions, zoom, pan, setTree, onSelectionChange]
  );

  // ─── Keyboard shortcuts ──────────────────────────────────────────
  const clipboardRef = useRef([]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (isEditingText()) return;
      const mod = e.metaKey || e.ctrlKey;

      if (e.key === "Escape") {
        onSelectionChange([]);
        return;
      }

      if (mod && (e.key === "0")) {
        e.preventDefault();
        resetZoom();
        return;
      }
      if (mod && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        zoomByStep(1.2);
        return;
      }
      if (mod && e.key === "-") {
        e.preventDefault();
        zoomByStep(1 / 1.2);
        return;
      }

      // Never delete the root. isEditingText() above already ignores
      // Delete/Backspace typed into a property input or contenteditable.
      if (e.key === "Delete" || e.key === "Backspace") {
        // Locked layers are protected from canvas edits (unlock in Layers).
        const deletableIds = selectedIds.filter(
          (id) => id !== "root" && !findNode(tree, id)?.props?.locked
        );
        if (!deletableIds.length) return;
        e.preventDefault();
        setTree((t) => removeNodes(t, deletableIds));
        onSelectionChange([]);
        return;
      }

      if (mod && e.key.toLowerCase() === "c" && selectedIds.length) {
        e.preventDefault();
        clipboardRef.current = copyNodes(tree, selectedIds);
        return;
      }

      if (mod && e.key.toLowerCase() === "v" && clipboardRef.current.length) {
        e.preventDefault();
        const afterId = selectedIds[selectedIds.length - 1] || null;
        setTree((t) => {
          const { tree: next, newIds } = pasteNodesAfter(t, afterId, clipboardRef.current);
          onSelectionChange(newIds);
          return next;
        });
        return;
      }

      if (mod && e.key.toLowerCase() === "d" && selectedIds.length) {
        e.preventDefault();
        setTree((t) => {
          const { tree: next, newIds } = duplicateNodes(t, selectedIds);
          onSelectionChange(newIds);
          return next;
        });
        return;
      }

      // Free-positioned nodes (numeric x/y directly inside a Frame) are nudged
      // by 1px, or 10px with Shift. Nodes in normal flow fall through to the
      // sibling-reorder behaviour below, so that stays intact.
      const nudgeIds = selectedIds.filter((id) => {
        if (id === "root") return false;
        const node = findNode(tree, id);
        if (!node || node.props?.locked) return false;
        if (!Number.isFinite(node.props?.x) || !Number.isFinite(node.props?.y)) return false;
        const parent = findParent(tree, id);
        return Boolean(parent && WIDGETS[parent.type]?.freePositioning);
      });
      if (
        nudgeIds.length &&
        (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight")
      ) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        setTree((t) => {
          let next = t;
          nudgeIds.forEach((id) => {
            const node = findNode(next, id);
            if (!node) return;
            next = updateNodeProps(next, id, {
              x: (Number(node.props?.x) || 0) + dx,
              y: (Number(node.props?.y) || 0) + dy,
            });
          });
          return next;
        });
        return;
      }

      if ((e.key === "ArrowUp" || e.key === "ArrowDown") && selectedIds.length) {
        const movableIds = selectedIds.filter((id) => !findNode(tree, id)?.props?.locked);
        if (!movableIds.length) return;
        e.preventDefault();
        const direction = e.key === "ArrowUp" ? -1 : 1;
        setTree((t) => {
          let next = t;
          movableIds.forEach((id) => {
            next = reorderSibling(next, id, direction);
          });
          return next;
        });
        return;
      }

      if (mod && e.key.toLowerCase() === "g" && selectedIds.length >= 2) {
        e.preventDefault();
        if (e.shiftKey) return;
        const group = createDefaultNode("Column");
        setTree((t) => {
          const next = groupNodes(t, selectedIds, group);
          return next;
        });
        onSelectionChange([group.id]);
        return;
      }

      if (mod && e.shiftKey && e.key.toLowerCase() === "g" && selectedIds.length === 1) {
        e.preventDefault();
        const target = selectedIds[0];
        setTree((t) => ungroupNode(t, target));
        onSelectionChange([]);
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tree, selectedIds, setTree, onSelectionChange, resetZoom, zoomByStep]);

  // ─── Render ──────────────────────────────────────────────────────
  if (!tree) {
    return (
      <div className="flex-1 flex items-center justify-center text-on-surface-variant/50 text-sm">
        Select a page from the left to start building.
      </div>
    );
  }

  const marqueeStyle = marquee
    ? {
        position: "fixed",
        left: Math.min(marquee.x1, marquee.x2),
        top: Math.min(marquee.y1, marquee.y2),
        width: Math.abs(marquee.x2 - marquee.x1),
        height: Math.abs(marquee.y2 - marquee.y1),
      }
    : null;

  // Cursor style based on tool
  let cursorStyle = "default";
  if (activeTool === "frame" || activeTool === "text" || activeTool === "shapes") {
    cursorStyle = "crosshair";
  } else if (activeTool === "select") {
    cursorStyle = "default";
  }

  return (
    <>
      <div
        ref={setCanvasRef}
        className={`flex-1 overflow-hidden relative select-none bg-surface/10 ${
          isPanning ? "cursor-grabbing" : spacePressed ? "cursor-grab" : cursorStyle
        }`}
        onMouseDown={handleCanvasMouseDown}
        onClick={handleCanvasClick}
        onWheel={handleWheel}
        style={{
          minHeight: "600px",
          backgroundImage: `
            radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0)
          `,
          backgroundSize: "24px 24px",
        }}
      >
        {/* ─── Zoom controls ────────────────────────────────────── */}
        <div
          className="absolute bottom-3 right-3 z-40 flex items-center gap-1 bg-surface-container-highest/95 backdrop-blur rounded-full px-1 py-1 shadow-lg border border-white/10"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => zoomByStep(1 / 1.2)}
            className="material-symbols-outlined text-[16px] w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10"
            title="Zoom out (⌘/Ctrl+- or Alt+Scroll)"
          >
            remove
          </button>
          <button
            type="button"
            onClick={resetZoom}
            className="text-[11px] w-10 text-center hover:text-secondary"
            title="Reset zoom to 100% (⌘/Ctrl+0)"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => zoomByStep(1.2)}
            className="material-symbols-outlined text-[16px] w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10"
            title="Zoom in (⌘/Ctrl+= or Alt+Scroll)"
          >
            add
          </button>
          <button
            type="button"
            onClick={fitToView}
            className="material-symbols-outlined text-[16px] w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10"
            title="Fit to view"
            aria-label="Fit to view"
          >
            fit_screen
          </button>
          <span className="w-px h-4 bg-white/10 mx-0.5" />
          <span
            className="material-symbols-outlined text-[14px] w-6 h-6 flex items-center justify-center text-on-surface-variant/50"
            title="Hold Space and drag (or middle-click drag) to pan"
          >
            pan_tool
          </span>
        </div>

        {/* ─── Canvas content with transform ────────────────────── */}
        <div
          className="absolute inset-0 p-6"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
          }}
        >
          <div
            className="w-full min-h-[600px] mx-auto transition-[max-width] duration-200"
            style={
              viewportWidth
                ? { maxWidth: `${viewportWidth}px`, outline: "1px dashed rgba(255,255,255,0.12)" }
                : undefined
            }
          >
            <CanvasNode
              node={tree}
              selectedIds={selectedIds}
              onSelect={handleNodeSelect}
              onDelete={(id) => {
                setTree((t) => removeNode(t, id));
                onSelectionChange((prev) => prev.filter((i) => i !== id));
              }}
              onDuplicate={(id) => {
                setTree((t) => duplicateNode(t, id));
              }}
              onUngroup={(id) => {
                setTree((t) => ungroupNode(t, id));
                onSelectionChange([]);
              }}
              onPropsChange={(id, partial) => setTree((t) => updateNodeProps(t, id, partial))}
              zoom={zoom}
              components={components}
              onEnterComponent={onEnterComponent}
            />
          </div>
        </div>
      </div>
      {marqueeStyle && (
        <div
          className="pointer-events-none border border-secondary bg-secondary/10 z-50"
          style={marqueeStyle}
        />
      )}
    </>
  );
}