// frontend/components/visualbuilder/VisualBuilderApp.js
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { getBlueprint, updateBlueprint, generateProject, getFileContent, getFileTree } from "../../lib/api";
import { useConfirm } from "../../hooks/useConfirm";
import PageManager from "./PageManager";
import WidgetPalette from "./WidgetPalette";
import LayersPanel from "./LayersPanel";
import Canvas from "./Canvas";
import PropertiesPanel from "./PropertiesPanel";
import TokensPanel from "./TokensPanel";
import CodePanel from "./CodePanel";
import InstancePanel from "./InstancePanel";
import Toolbar from "./Toolbar";
import ToolsToolbar from "./ToolsToolbar";
import { WIDGETS, createDefaultNode, INSTANCE_TYPE } from "./WidgetRegistry";
import { useVisualBuilderChannel } from "./useVisualBuilderSync";
import {
  makeEmptyRoot,
  updateNodeProps,
  findNode,
  insertNode,
  groupNodes,
  ungroupNode,
  alignNodes,
  distributeNodes,
  reorderNode,
  cloneTree,
  reassignIds,
  replaceNode,
  newId,
} from "./treeUtils";
import { BuilderDataProvider } from "./builderContext";

function sanitizeComponentName(name) {
  const cleaned = (name || "Custom").replace(/[^a-zA-Z0-9_]/g, "");
  const base = cleaned || "Custom";
  return base[0].toUpperCase() + base.slice(1);
}

function filePathForPage(activePage, customPages) {
  if (!activePage) return null;
  if (activePage.kind === "model") return `frontend/src/pages/${activePage.key}List.jsx`;
  const page = customPages[activePage.key];
  if (!page) return null;
  return `frontend/src/pages/${sanitizeComponentName(page.name)}Page.jsx`;
}

// Applies an instance's overrides to a cloned master tree, so Detach keeps the
// per-instance text/image values instead of reverting to the master defaults.
function applyInstanceOverrides(masterTree, component, overrides) {
  const patches = {};
  (component?.properties || []).forEach((property) => {
    if (!property?.nodeId) return;
    const value = overrides?.[property.id];
    if (value !== undefined && value !== null && value !== "") {
      patches[property.nodeId] = { [property.prop || "text"]: value };
    }
  });

  function walk(node) {
    if (!node || typeof node !== "object") return node;
    const patch = patches[node.id];
    const next = {
      ...node,
      props: patch ? { ...node.props, ...patch } : node.props,
    };
    if (Array.isArray(node.children)) next.children = node.children.map(walk);
    return next;
  }

  return walk(JSON.parse(JSON.stringify(masterTree)));
}

function walkTree(node, visit) {
  if (!node || typeof node !== "object") return;
  visit(node);
  (node.children || []).forEach((child) => walkTree(child, visit));
}

// How many instances reference this component (or one specific variant) across
// every page and every other component. Used to block unsafe deletions.
function countInstances(frontend, componentId, variantId = null) {
  let count = 0;
  const visitTree = (tree) =>
    walkTree(tree, (node) => {
      if (node.type !== "Instance") return;
      if (node.props?.componentId !== componentId) return;
      if (variantId && node.props?.variantId !== variantId) return;
      count += 1;
    });

  const pages = frontend?.pages || {};
  Object.values(pages.settings || {}).forEach((settings) => visitTree(settings?.layout));
  (pages.custom || []).forEach((page) => visitTree(page?.layout));
  (frontend?.components || []).forEach((component) => {
    visitTree(component?.tree);
    (component?.variants || []).forEach((variant) => visitTree(variant?.tree));
  });
  return count;
}

// ─── Palette sensor ──────────────────────────────────────────────────
class PaletteSensor extends PointerSensor {
  static activators = [
    {
      eventName: "onPointerDown",
      handler: ({ nativeEvent: event }) => {
        const target = event.target.closest?.(".palette-item");
        return !!target;
      },
    },
  ];
}

export default function VisualBuilderApp({ projectId }) {
  const { confirm, ConfirmDialog } = useConfirm();
  const [blueprint, setBlueprint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState(null);
  const [tree, setTree] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const selectedId = selectedIds[selectedIds.length - 1] || null;

  // ─── Tools state ──────────────────────────────────────────────────
  const [activeTool, setActiveTool] = useState("select");
  const [toolOptions, setToolOptions] = useState({});

  const handleToolChange = useCallback((tool, options = {}) => {
    setActiveTool(tool);
    setToolOptions(options);
  }, []);

  // ─── Left Panel state ──────────────────────────────────────────────
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(260);
  const [leftPanelTab, setLeftPanelTab] = useState("pages");
  const [isResizing, setIsResizing] = useState(false);
  const leftPanelRef = useRef(null);

  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = leftPanelWidth;
    const onMouseMove = (ev) => {
      const newWidth = startWidth + (ev.clientX - startX);
      if (newWidth > 120 && newWidth < 500) {
        setLeftPanelWidth(newWidth);
      }
    };
    const onMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [leftPanelWidth]);

  // ─── History (undo/redo) ─────────────────────────────────────────
  const historyRef = useRef({
    past: [],
    future: [],
  });
  const [undoStackSize, setUndoStackSize] = useState(0);
  const [redoStackSize, setRedoStackSize] = useState(0);
  const isUndoRedoRef = useRef(false);
  const prevTreeRef = useRef(null);
  const prevSelectedRef = useRef([]);

  const pushHistory = useCallback((newTree, newSelectedIds) => {
    if (isUndoRedoRef.current || !newTree) return;
    const snapshot = {
      tree: newTree ? JSON.parse(JSON.stringify(newTree)) : null,
      selectedIds: newSelectedIds ? [...newSelectedIds] : [],
    };
    historyRef.current.past.push(snapshot);
    if (historyRef.current.past.length > 50) {
      historyRef.current.past.shift();
    }
    historyRef.current.future = [];
    setUndoStackSize(historyRef.current.past.length);
    setRedoStackSize(0);
  }, []);

  const undo = useCallback(() => {
    if (historyRef.current.past.length === 0) return;
    const currentSnapshot = {
      tree: tree ? JSON.parse(JSON.stringify(tree)) : null,
      selectedIds: [...selectedIds],
    };
    historyRef.current.future.push(currentSnapshot);
    const previous = historyRef.current.past.pop();
    isUndoRedoRef.current = true;
    setTree(previous.tree);
    setSelectedIds(previous.selectedIds);
    prevTreeRef.current = previous.tree;
    prevSelectedRef.current = previous.selectedIds;
    isUndoRedoRef.current = false;
    setUndoStackSize(historyRef.current.past.length);
    setRedoStackSize(historyRef.current.future.length);
  }, [tree, selectedIds]);

  const redo = useCallback(() => {
    if (historyRef.current.future.length === 0) return;
    const currentSnapshot = {
      tree: tree ? JSON.parse(JSON.stringify(tree)) : null,
      selectedIds: [...selectedIds],
    };
    historyRef.current.past.push(currentSnapshot);
    const next = historyRef.current.future.pop();
    isUndoRedoRef.current = true;
    setTree(next.tree);
    setSelectedIds(next.selectedIds);
    prevTreeRef.current = next.tree;
    prevSelectedRef.current = next.selectedIds;
    isUndoRedoRef.current = false;
    setUndoStackSize(historyRef.current.past.length);
    setRedoStackSize(historyRef.current.future.length);
  }, [tree, selectedIds]);

  const clearHistory = useCallback(() => {
    historyRef.current = { past: [], future: [] };
    setUndoStackSize(0);
    setRedoStackSize(0);
    prevTreeRef.current = null;
    prevSelectedRef.current = [];
  }, []);

  useEffect(() => {
    function handleKeyDown(e) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const target = e.target;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.key === "z" && e.shiftKey) || (e.key === "y" && !e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  useEffect(() => {
    if (!tree) return;
    const treeChanged = JSON.stringify(prevTreeRef.current) !== JSON.stringify(tree);
    const selectedChanged = JSON.stringify(prevSelectedRef.current) !== JSON.stringify(selectedIds);
    if (!treeChanged && !selectedChanged) return;
    // Record the state we are LEAVING, not the one we just entered. Pushing
    // the new tree made the first undo a no-op (it restored the current
    // state), and counting selection changes consumed undo steps for clicks.
    if (treeChanged && prevTreeRef.current !== null && !isUndoRedoRef.current) {
      pushHistory(prevTreeRef.current, prevSelectedRef.current);
    }
    prevTreeRef.current = tree;
    prevSelectedRef.current = selectedIds;
  }, [tree, selectedIds, pushHistory]);

  // ─── DnD ──────────────────────────────────────────────────────────
  const dndSensors = useSensors(useSensor(PaletteSensor));
  const [activeDrag, setActiveDrag] = useState(null);

  function handleDragStart(event) {
    setActiveDrag(event.active.data.current || null);
  }

  function findFrameAtPoint(clientX, clientY, tree) {
    const stack = document.elementsFromPoint(clientX, clientY);
    for (const el of stack) {
      const id = el.getAttribute && el.getAttribute("data-node-id");
      if (!id || id === "root") continue;
      const node = findNode(tree, id);
      if (node && WIDGETS[node.type]?.freePositioning) return { node, el };
    }
    return null;
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    setActiveDrag(null);
    if (!over) return;
    const data = active.data.current;
    if (!data || data.source !== "palette") return;

    const node = createDefaultNode(data.widgetType);
    if (!node) return;
    if (data.componentId) {
      // A palette "component" item drops an Instance, not a new widget tree.
      node.props = { ...node.props, componentId: data.componentId, name: data.label || "Component" };
    }

    const dropRect = event.active.rect.current?.translated;
    const cx = dropRect ? dropRect.left + dropRect.width / 2 : null;
    const cy = dropRect ? dropRect.top + dropRect.height / 2 : null;

    handleTreeChange((prev) => {
      const root = prev || makeEmptyRoot();
      const frameHit = cx != null ? findFrameAtPoint(cx, cy, root) : null;
      if (frameHit) {
        const frameRect = frameHit.el.getBoundingClientRect();
        node.props = {
          ...node.props,
          x: Math.round(cx - frameRect.left),
          y: Math.round(cy - frameRect.top),
        };
        return insertNode(root, frameHit.node.id, node, -1);
      }
      return { ...root, children: [...(root.children || []), node] };
    });
    setSelectedIds([node.id]);
  }

  // ─── State ────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [dirty, setDirty] = useState(false);

  const models = blueprint?.data?.models || [];
  const roles = blueprint?.data?.permissions?.roles || [];
  const pageSettings = blueprint?.data?.frontend?.pages?.settings || {};
  const customPages = blueprint?.data?.frontend?.pages?.custom || [];
  const designTokens = blueprint?.data?.frontend?.designTokens || { colors: [], textStyles: [] };
  const components = blueprint?.data?.frontend?.components || [];
  // Canvas looks instances up by id; the palette shows the ordered list.
  const componentsById = useMemo(
    () => Object.fromEntries(components.filter((c) => c && c.id).map((c) => [c.id, c])),
    [components]
  );
  // ─── Component master editing mode ────────────────────────────────
  // When set, `tree` is the master's tree instead of the page layout, so the
  // canvas, autosave and code panel all operate on the shared component.
  const [editingComponentId, setEditingComponentId] = useState(null);
  // null = editing the component's default tree; otherwise a variant id.
  const [editingVariantId, setEditingVariantId] = useState(null);
  const pageTreeBeforeComponent = useRef(null);
  const editingComponent = useMemo(
    () => components.find((c) => c.id === editingComponentId) || null,
    [components, editingComponentId]
  );
  const [showTokensPanel, setShowTokensPanel] = useState(false);
  const [showCodePanel, setShowCodePanel] = useState(false);
  // null = full-width desktop artboard; 768 / 390 preview the tablet and
  // mobile breakpoints without changing the generated code.
  const [viewportWidth, setViewportWidth] = useState(null);
  // Canvas-only preview of the light/dark token modes; generated apps use the
  // CSS variables in theme.css.
  const [themeMode, setThemeMode] = useState("light");

  // Same name generation uses, so the previewed file is byte-identical to
  // the one "Save & Generate" writes.
  const codeComponentName = useMemo(() => {
    const path = filePathForPage(activePage, customPages);
    return path ? path.split("/").pop().replace(/\.jsx$/i, "") : "VisualPage";
  }, [activePage, customPages]);

  const { notify } = useVisualBuilderChannel(projectId, (msg) => {
    if (msg.type === "blueprint-updated") {
      loadBlueprint({ preserveTree: true });
    }
  });

  // ─── Load blueprint ──────────────────────────────────────────────
  const loadBlueprint = useCallback(
    async ({ preserveTree = false } = {}) => {
      try {
        const bp = await getBlueprint(projectId);
        setBlueprint(bp);
        if (!preserveTree) setLoading(false);
        return bp;
      } catch (err) {
        toast.error(err.message || "Failed to load blueprint. Has this project's builder been started?");
        setLoading(false);
        return null;
      }
    },
    [projectId]
  );

  useEffect(() => {
    loadBlueprint();
  }, [projectId]);

  // ─── Load layout when active page changes ──────────────────────
  useEffect(() => {
    // In component mode `tree` is the master's tree: a blueprint refresh must
    // not replace it with the page layout mid-edit.
    if (editingComponentId) return;
    if (!activePage || !blueprint) return;
    let layout = null;
    if (activePage.kind === "model") {
      layout = pageSettings[activePage.key]?.layout || null;
    } else {
      layout = customPages[activePage.key]?.layout || null;
    }
    const newTree = layout ? layout : makeEmptyRoot();
    setTree(newTree);
    setSelectedIds([]);
    setDirty(false);
    clearHistory();
    prevTreeRef.current = newTree;
    prevSelectedRef.current = [];
  }, [activePage, blueprint, clearHistory, editingComponentId]);

  // Default page
  useEffect(() => {
    if (!activePage && models.length > 0) {
      setActivePage({ kind: "model", key: models[0].name });
    }
  }, [models, activePage]);

  // ─── Sync status ──────────────────────────────────────────────────
  const checkSyncStatus = useCallback(async () => {
    // In component mode there is no page file to compare against.
    if (editingComponentId) {
      setSyncStatus(null);
      return;
    }
    if (!activePage || !tree) return;
    const path = filePathForPage(activePage, customPages);
    if (!path) return;
    try {
      const filesRes = await getFileTree(projectId);
      const exists = filesRes.some((f) => f.path === path || f.path.replace(/\\/g, "/") === path);
      if (!exists) {
        setSyncStatus("never-generated");
        return;
      }
      const content = await getFileContent(projectId, path);
      const match = /@visual-builder-schema\n([\s\S]*?)\n@visual-builder-hash/.exec(content.content || "");
      if (!match) {
        setSyncStatus("never-generated");
        return;
      }
      const embedded = JSON.parse(match[1]);
      const current = JSON.stringify(embedded) === JSON.stringify(tree);
      setSyncStatus(current ? "in-sync" : "unsaved");
    } catch (err) {
      setSyncStatus("no-frontend");
    }
  }, [activePage, tree, customPages, projectId, editingComponentId]);

  useEffect(() => {
    checkSyncStatus();
  }, [checkSyncStatus]);

  // ─── Tree change ──────────────────────────────────────────────────
  function handleTreeChange(updater) {
    setTree((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      return next;
    });
    setDirty(true);
  }

  function handlePropsChange(nodeId, newProps) {
    setTree((prev) => updateNodeProps(prev, nodeId, newProps));
    setDirty(true);
  }

  // Multi-select edit: the properties panel is type-specific, so the same
  // patch is applied to every selected widget sharing the last-selected
  // widget's type. Mixed selections leave other types untouched.
  function handlePropsChangeMany(nodeId, newProps) {
    setTree((prev) => {
      const base = findNode(prev, nodeId);
      if (!base) return prev;
      let next = prev;
      selectedIds.forEach((id) => {
        const candidate = findNode(next, id);
        if (candidate && candidate.type === base.type) {
          next = updateNodeProps(next, id, newProps);
        }
      });
      return next;
    });
    setDirty(true);
  }

  // ─── Persist ──────────────────────────────────────────────────────
  async function persistLayoutToBlueprint(nextTree, mutate) {
    if (!blueprint) return null;
    const nextData = JSON.parse(JSON.stringify(blueprint.data));
    nextData.frontend = nextData.frontend || {};
    if (editingComponentId) {
      // Component mode: the canvas is editing a master or one of its variants.
      const list = nextData.frontend.components || [];
      const index = list.findIndex((c) => c.id === editingComponentId);
      if (index === -1) return null;
      const comp = list[index];
      if (editingVariantId) {
        list[index] = {
          ...comp,
          variants: (comp.variants || []).map((variant) =>
            variant.id === editingVariantId ? { ...variant, tree: nextTree } : variant
          ),
        };
      } else {
        list[index] = { ...comp, tree: nextTree };
      }
      nextData.frontend.components = list;
      if (typeof mutate === "function") mutate(nextData);
      const updated = await updateBlueprint(projectId, nextData);
      setBlueprint(updated);
      return updated;
    }
    if (!activePage) return null;
    nextData.frontend.pages = nextData.frontend.pages || {};
    if (activePage.kind === "model") {
      nextData.frontend.pages.settings = nextData.frontend.pages.settings || {};
      nextData.frontend.pages.settings[activePage.key] = {
        ...(nextData.frontend.pages.settings[activePage.key] || {}),
        layout: nextTree,
      };
    } else {
      nextData.frontend.pages.custom = nextData.frontend.pages.custom || [];
      nextData.frontend.pages.custom[activePage.key] = {
        ...(nextData.frontend.pages.custom[activePage.key] || {}),
        layout: nextTree,
      };
    }
    // Callers that change more than the layout (e.g. adding a component
    // master) mutate the same payload so it is one atomic PUT.
    if (typeof mutate === "function") mutate(nextData);
    const updated = await updateBlueprint(projectId, nextData);
    setBlueprint(updated);
    return updated;
  }

  async function handleSave({ silent = false } = {}) {
    if (!tree || (!activePage && !editingComponentId)) return;
    setSaving(true);
    try {
      await persistLayoutToBlueprint(tree);
      setDirty(false);
      notify({ type: "blueprint-updated" });
      if (!silent) {
        toast.success(editingComponentId ? "Component saved" : "Layout saved");
      }
      checkSyncStatus();
    } catch (err) {
      if (!silent) toast.error(err.message || "Failed to save layout");
    } finally {
      setSaving(false);
    }
  }

  // ─── Autosave ────────────────────────────────────────────────────
  // Persist the layout once the canvas has been idle for a moment, so closing
  // the tab no longer loses work. Kept in a ref so the effect doesn't restart
  // on every render from handleSave's new identity.
  const saveRef = useRef(null);
  useEffect(() => {
    saveRef.current = handleSave;
  });
  useEffect(() => {
    if (!dirty || !tree || (!activePage && !editingComponentId) || saving || generating) {
      return undefined;
    }
    const timer = setTimeout(() => {
      saveRef.current?.({ silent: true });
    }, 2500);
    return () => clearTimeout(timer);
  }, [dirty, tree, activePage, saving, generating, editingComponentId, editingVariantId]);

  async function handleSaveAndGenerate() {
    setGenerating(true);
    try {
      await persistLayoutToBlueprint(tree);
      await generateProject(projectId, "frontend");
      setDirty(false);
      notify({ type: "blueprint-updated" });
      notify({ type: "files-updated" });
      toast.success("Layout saved and code generated");
      checkSyncStatus();
    } catch (err) {
      toast.error(err.message || "Failed to generate code");
    } finally {
      setGenerating(false);
    }
  }

  // ─── Create a reusable component from the selection ───────────────
  async function handleCreateComponent() {
    if (!blueprint || !tree) return;
    if (selectedIds.length !== 1) {
      toast.error("Select exactly one element to turn into a component.");
      return;
    }
    const sourceId = selectedIds[0];
    if (sourceId === "root") {
      toast.error("The page root cannot become a component.");
      return;
    }
    const sourceNode = findNode(tree, sourceId);
    if (!sourceNode) return;

    const rawName =
      typeof window !== "undefined" ? window.prompt("Component name", "MyComponent") : null;
    if (rawName === null) return;
    const name = rawName.trim();
    if (!name) {
      toast.error("A component name is required.");
      return;
    }
    const existing = (blueprint.data?.frontend?.components || []).map((c) =>
      (c.name || "").toLowerCase()
    );
    if (existing.includes(name.toLowerCase())) {
      toast.error(`A component named "${name}" already exists.`);
      return;
    }

    const compId = `cmp_${Date.now().toString(36)}`;
    const master = {
      id: compId,
      name,
      tree: reassignIds(cloneTree(sourceNode)),
    };
    const instance = {
      id: newId("instance"),
      type: "Instance",
      props: { componentId: compId, name },
      children: [],
    };
    const nextTree = replaceNode(tree, sourceId, instance);

    setSaving(true);
    try {
      // One atomic PUT: the master and the page that now instances it.
      await persistLayoutToBlueprint(nextTree, (nextData) => {
        nextData.frontend.components = [...(nextData.frontend.components || []), master];
      });
      setTree(nextTree);
      setSelectedIds([instance.id]);
      setDirty(false);
      notify({ type: "blueprint-updated" });
      toast.success(`Component "${name}" created`);
    } catch (err) {
      toast.error(err.message || "Failed to create component");
    } finally {
      setSaving(false);
    }
  }

  // Detach: replace the instance with an editable copy of the master tree.
  function handleDetachInstance() {
    if (!tree || selectedIds.length !== 1) return;
    const node = findNode(tree, selectedIds[0]);
    if (!node || node.type !== INSTANCE_TYPE) return;
    const comp = componentsById[node.props?.componentId];
    const variant = (comp?.variants || []).find((v) => v.id === node.props?.variantId);
    const masterTree = variant?.tree || comp?.tree;
    if (!masterTree) {
      toast.error("This instance has no component to detach.");
      return;
    }
    // Keep the variant and the instance's overrides on the detached copy.
    const detached = reassignIds(
      applyInstanceOverrides(masterTree, comp, node.props?.overrides)
    );
    handleTreeChange((prev) => replaceNode(prev, node.id, detached));
    setSelectedIds([detached.id]);
    toast.success("Instance detached — the copy is now editable");
  }

  // ─── Component master editing mode ────────────────────────────────
  async function handleEnterComponent(compId) {
    const comp = componentsById[compId];
    if (!comp) {
      toast.error("Component not found.");
      return;
    }
    if (editingComponentId === compId) return;
    // Persist any unsaved page edits first: component mode swaps `tree`, and
    // the page tree must not silently lose changes when we come back.
    if (dirty && activePage) {
      try {
        await persistLayoutToBlueprint(tree);
        setDirty(false);
      } catch (err) {
        toast.error(err.message || "Could not save the page before editing the component");
        return;
      }
    }
    // Keep the page tree so "Back to page" restores it untouched.
    pageTreeBeforeComponent.current = tree;
    setEditingComponentId(compId);
    setEditingVariantId(null);
    setTree(comp.tree || makeEmptyRoot());
    setSelectedIds([]);
    setDirty(false);
    // Page history is meaningless inside the master (different root tree).
    clearHistory();
    prevTreeRef.current = comp.tree || makeEmptyRoot();
    prevSelectedRef.current = [];
    toast(`Editing component "${comp.name}" — changes apply to every instance`, {
      icon: "🧩",
    });
  }

  function restorePageTree() {
    setEditingComponentId(null);
    setEditingVariantId(null);
    const restored = pageTreeBeforeComponent.current || makeEmptyRoot();
    setTree(restored);
    pageTreeBeforeComponent.current = null;
    setSelectedIds([]);
    setDirty(false);
    clearHistory();
    prevTreeRef.current = restored;
    prevSelectedRef.current = [];
  }

  async function handleExitComponent() {
    if (!editingComponentId) return;
    if (dirty) {
      try {
        await persistLayoutToBlueprint(tree);
        setDirty(false);
      } catch (err) {
        toast.error(err.message || "Could not save the component before leaving");
        return;
      }
    }
    restorePageTree();
  }

  function handleSelectPage(page) {
    if (editingComponentId) {
      toast.error("Finish editing the component first — use “Back to page”.");
      return;
    }
    setActivePage(page);
  }

  // ─── Variants ─────────────────────────────────────────────────────
  function handleSwitchVariant(variantId) {
    if (!editingComponent) return;
    const variant = (editingComponent.variants || []).find((v) => v.id === variantId);
    const nextTree = variant?.tree || editingComponent.tree || makeEmptyRoot();
    setEditingVariantId(variantId || null);
    setTree(nextTree);
    setSelectedIds([]);
    setDirty(false);
    clearHistory();
    prevTreeRef.current = nextTree;
    prevSelectedRef.current = [];
  }

  async function handleAddVariant() {
    if (!editingComponent) return;
    const raw = typeof window !== "undefined" ? window.prompt("Variant name", "Compact") : null;
    if (raw === null) return;
    const name = raw.trim();
    if (!name) {
      toast.error("A variant name is required.");
      return;
    }
    const existing = (editingComponent.variants || []).map((v) => (v.name || "").toLowerCase());
    if (existing.includes(name.toLowerCase())) {
      toast.error(`A variant named "${name}" already exists.`);
      return;
    }
    const variantId = `var_${Date.now().toString(36)}`;
    const variant = { id: variantId, name, tree: JSON.parse(JSON.stringify(tree)) };
    setSaving(true);
    try {
      await persistLayoutToBlueprint(tree, (nextData) => {
        const list = nextData.frontend.components || [];
        const index = list.findIndex((c) => c.id === editingComponentId);
        if (index !== -1) {
          list[index] = {
            ...list[index],
            variants: [...(list[index].variants || []), variant],
          };
        }
      });
      setEditingVariantId(variantId);
      setTree(variant.tree);
      setDirty(false);
      clearHistory();
      prevTreeRef.current = variant.tree;
      prevSelectedRef.current = [];
      toast.success(`Variant "${name}" created from the current layout`);
    } catch (err) {
      toast.error(err.message || "Failed to add variant");
    } finally {
      setSaving(false);
    }
  }

  // ─── Expose a node as an instance property ────────────────────────
  async function exposeProperty(propKey, type = "text") {
    if (!editingComponent || !selectedNode) return;
    const props = selectedNode.props || {};
    const key = propKey || "text";
    const already = (editingComponent.properties || []).some(
      (p) => p.nodeId === selectedNode.id && (p.prop || "text") === key
    );
    if (already) {
      toast.error("This element already exposes that property.");
      return;
    }
    const name =
      type === "boolean"
        ? `Show ${selectedNode.type}`
        : type === "color"
        ? key === "backgroundColor"
          ? "Background color"
          : "Text color"
        : type === "number"
        ? "Font size"
        : String(props[key] || "Text").slice(0, 24);
    const property = {
      id: `prop_${Date.now().toString(36)}`,
      name,
      nodeId: selectedNode.id,
      prop: key,
      type,
    };
    if (type === "color") property.defaultValue = String(props[key] || "#000000");
    setSaving(true);
    try {
      await persistLayoutToBlueprint(tree, (nextData) => {
        const list = nextData.frontend.components || [];
        const index = list.findIndex((c) => c.id === editingComponentId);
        if (index !== -1) {
          list[index] = {
            ...list[index],
            properties: [...(list[index].properties || []), property],
          };
        }
      });
      toast.success(`Exposed "${property.name}" — instances can now override it`);
    } catch (err) {
      toast.error(err.message || "Failed to expose property");
    } finally {
      setSaving(false);
    }
  }

  // Typed wrappers around exposeProperty().
  function handleExposeProperty() {
    const key = ["text", "label", "title"].find(
      (k) => typeof selectedNode?.props?.[k] === "string"
    );
    if (!key) {
      toast.error("Select a text element to expose.");
      return;
    }
    exposeProperty(key, "text");
  }

  function handleExposeColor() {
    const props = selectedNode?.props || {};
    const key =
      typeof props.backgroundColor === "string"
        ? "backgroundColor"
        : typeof props.color === "string"
        ? "color"
        : null;
    if (!key) {
      toast.error("Select an element that has a colour set.");
      return;
    }
    exposeProperty(key, "color");
  }

  function handleExposeNumber() {
    if (typeof selectedNode?.props?.fontSize !== "string") {
      toast.error("Select a text element with a font size.");
      return;
    }
    exposeProperty("fontSize", "number");
  }

  function handleExposeToggle() {
    exposeProperty("visible", "boolean");
  }

  // ─── Component / variant / property management ────────────────────
  async function handleRenameComponent() {
    if (!editingComponent) return;
    const raw = typeof window !== "undefined" ? window.prompt("Component name", editingComponent.name) : null;
    if (raw === null) return;
    const name = raw.trim();
    if (!name || name === editingComponent.name) return;
    const clash = components.some(
      (c) => c.id !== editingComponent.id && (c.name || "").toLowerCase() === name.toLowerCase()
    );
    if (clash) {
      toast.error(`A component named "${name}" already exists.`);
      return;
    }
    setSaving(true);
    try {
      await persistLayoutToBlueprint(tree, (nextData) => {
        const list = nextData.frontend.components || [];
        const index = list.findIndex((c) => c.id === editingComponentId);
        if (index !== -1) list[index] = { ...list[index], name };
      });
      toast.success(`Renamed to "${name}" — regenerate to rename its file`);
    } catch (err) {
      toast.error(err.message || "Failed to rename component");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteComponent() {
    if (!editingComponent) return;
    const used = countInstances(blueprint?.data?.frontend, editingComponent.id);
    if (used > 0) {
      toast.error(
        `"${editingComponent.name}" is used by ${used} instance${used === 1 ? "" : "s"} — detach them first.`
      );
      return;
    }
    const ok = await confirm({
      title: `Delete component "${editingComponent.name}"?`,
      message:
        "Its layout is removed from the blueprint. Generated files disappear on the next generate.",
      confirmText: "Delete Component",
      variant: "danger",
    });
    if (!ok) return;
    setSaving(true);
    try {
      await persistLayoutToBlueprint(tree, (nextData) => {
        nextData.frontend.components = (nextData.frontend.components || []).filter(
          (c) => c.id !== editingComponentId
        );
      });
      restorePageTree();
      toast.success("Component deleted");
    } catch (err) {
      toast.error(err.message || "Failed to delete component");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteVariant() {
    if (!editingComponent || !editingVariantId) return;
    const variant = (editingComponent.variants || []).find((v) => v.id === editingVariantId);
    if (!variant) return;
    const used = countInstances(blueprint?.data?.frontend, editingComponent.id, editingVariantId);
    if (used > 0) {
      toast.error(
        `Variant "${variant.name}" is used by ${used} instance${used === 1 ? "" : "s"} — switch them to Default first.`
      );
      return;
    }
    const ok = await confirm({
      title: `Delete variant "${variant.name}"?`,
      message: "The variant layout is removed. The default layout is untouched.",
      confirmText: "Delete Variant",
      variant: "danger",
    });
    if (!ok) return;
    setSaving(true);
    try {
      await persistLayoutToBlueprint(tree, (nextData) => {
        const list = nextData.frontend.components || [];
        const index = list.findIndex((c) => c.id === editingComponentId);
        if (index !== -1) {
          list[index] = {
            ...list[index],
            variants: (list[index].variants || []).filter((v) => v.id !== editingVariantId),
          };
        }
      });
      const defaultTree = editingComponent.tree || makeEmptyRoot();
      setEditingVariantId(null);
      setTree(defaultTree);
      setSelectedIds([]);
      setDirty(false);
      clearHistory();
      prevTreeRef.current = defaultTree;
      prevSelectedRef.current = [];
      toast.success("Variant deleted");
    } catch (err) {
      toast.error(err.message || "Failed to delete variant");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveProperty(propId) {
    const comp =
      selectedNode?.type === INSTANCE_TYPE
        ? componentsById[selectedNode.props?.componentId]
        : null;
    const property = (comp?.properties || []).find((p) => p.id === propId);
    if (!comp || !property) return;
    const ok = await confirm({
      title: `Remove property "${property.name}"?`,
      message:
        "Every instance of this component stops exposing it. Existing override values are ignored.",
      confirmText: "Remove Property",
      variant: "danger",
    });
    if (!ok) return;
    setSaving(true);
    try {
      await persistLayoutToBlueprint(tree, (nextData) => {
        const list = nextData.frontend.components || [];
        const index = list.findIndex((c) => c.id === comp.id);
        if (index !== -1) {
          list[index] = {
            ...list[index],
            properties: (list[index].properties || []).filter((p) => p.id !== propId),
          };
        }
      });
      toast.success("Property removed");
    } catch (err) {
      toast.error(err.message || "Failed to remove property");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveTokens(nextTokens) {
    if (!blueprint) return;
    const nextData = JSON.parse(JSON.stringify(blueprint.data));
    nextData.frontend = nextData.frontend || {};
    nextData.frontend.designTokens = nextTokens;
    try {
      const updated = await updateBlueprint(projectId, nextData);
      setBlueprint(updated);
      notify({ type: "blueprint-updated" });
      toast.success("Design tokens saved");
    } catch (err) {
      toast.error(err.message || "Failed to save design tokens");
    }
  }

  async function handleCreateCustomPage(name, path) {
    if (!blueprint) return;
    const nextData = JSON.parse(JSON.stringify(blueprint.data));
    nextData.frontend = nextData.frontend || {};
    nextData.frontend.pages = nextData.frontend.pages || {};
    nextData.frontend.pages.custom = nextData.frontend.pages.custom || [];
    if (nextData.frontend.pages.custom.some((p) => p.path === path)) {
      toast.error("A page with that path already exists.");
      return;
    }
    nextData.frontend.pages.custom.push({ name, path, layout: makeEmptyRoot() });
    try {
      const updated = await updateBlueprint(projectId, nextData);
      setBlueprint(updated);
      setActivePage({ kind: "custom", key: updated.data.frontend.pages.custom.length - 1 });
      notify({ type: "blueprint-updated" });
      toast.success(`Page "${name}" created`);
    } catch (err) {
      toast.error(err.message || "Failed to create page");
    }
  }

  async function handleDeleteCustomPage(idx) {
    if (!blueprint) return;
    const confirmed = await confirm({
      title: "Delete this page?",
      message: `Remove "${customPages[idx]?.name}" from the project?`,
      confirmText: "Delete",
      variant: "danger",
    });
    if (!confirmed) return;
    const nextData = JSON.parse(JSON.stringify(blueprint.data));
    nextData.frontend.pages.custom.splice(idx, 1);
    try {
      const updated = await updateBlueprint(projectId, nextData);
      setBlueprint(updated);
      if (activePage?.kind === "custom") setActivePage(null);
      notify({ type: "blueprint-updated" });
      toast.success("Page deleted");
    } catch (err) {
      toast.error(err.message || "Failed to delete page");
    }
  }

  // ─── Toolbar handlers ──────────────────────────────────────────────
  const handleAlign = useCallback(
    (direction) => {
      if (selectedIds.length < 2) return;
      setTree((t) => alignNodes(t, selectedIds, direction));
    },
    [selectedIds, setTree]
  );

  const handleDistribute = useCallback(
    (axis) => {
      if (selectedIds.length < 3) return;
      setTree((t) => distributeNodes(t, selectedIds, axis));
    },
    [selectedIds, setTree]
  );

  const handleGroup = useCallback(() => {
    if (selectedIds.length < 2) return;
    const group = createDefaultNode("Column");
    setTree((t) => groupNodes(t, selectedIds, group));
    setSelectedIds([group.id]);
  }, [selectedIds, setTree, setSelectedIds]);

  const handleUngroup = useCallback(() => {
    if (selectedIds.length !== 1) return;
    const target = selectedIds[0];
    const node = findNode(tree, target);
    if (node && WIDGETS[node.type]?.isContainer) {
      setTree((t) => ungroupNode(t, target));
      setSelectedIds([]);
    }
  }, [selectedIds, tree, setTree, setSelectedIds]);

  const handleReorder = useCallback(
    (action) => {
      if (selectedIds.length === 0) return;
      setTree((t) => {
        let next = t;
        selectedIds.forEach((id) => {
          next = reorderNode(next, id, action);
        });
        return next;
      });
    },
    [selectedIds, setTree]
  );

  const canGroup = selectedIds.length >= 2;
  const canUngroup =
    selectedIds.length === 1 && WIDGETS[findNode(tree, selectedIds[0])?.type]?.isContainer;
  const canReorder = selectedIds.length > 0;

  // ─── Page title ──────────────────────────────────────────────────
  const pageTitle = useMemo(() => {
    if (!activePage) return "Select a page";
    if (activePage.kind === "model") return `${activePage.key} — List Page`;
    return customPages[activePage.key]?.name || "Custom Page";
  }, [activePage, customPages]);

  // ─── Loading ──────────────────────────────────────────────────────
  if (loading) {
    return <div className="h-screen flex items-center justify-center text-on-surface-variant">Loading visual builder…</div>;
  }

  if (!blueprint) {
    return (
      <div className="h-screen flex flex-col items-center justify-center text-on-surface-variant gap-3 p-6 text-center">
        <span className="material-symbols-outlined text-4xl">error</span>
        <p>Couldn&apos;t load this project&apos;s blueprint. Start the builder for this project first, then reopen the Visual Builder.</p>
      </div>
    );
  }

  const selectedNode = tree && selectedIds.length === 1 ? findNode(tree, selectedIds[0]) : null;
  const canDetach = selectedNode?.type === INSTANCE_TYPE;
  const canExposeText = Boolean(
    editingComponentId &&
      selectedNode &&
      ["text", "label", "title"].some((key) => typeof selectedNode.props?.[key] === "string")
  );
  const canExposeColor = Boolean(
    editingComponentId &&
      selectedNode &&
      (typeof selectedNode.props?.backgroundColor === "string" ||
        typeof selectedNode.props?.color === "string")
  );
  const canExposeNumber = Boolean(
    editingComponentId && selectedNode && typeof selectedNode.props?.fontSize === "string"
  );
  const canExposeToggle = Boolean(
    editingComponentId && selectedNode && selectedNode.id !== "root"
  );

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-surface text-on-surface">
      {ConfirmDialog}
      {/* ─── Top toolbar ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-secondary">dashboard_customize</span>
          <div>
            <div className="text-sm font-semibold">
              {editingComponent ? `Component: ${editingComponent.name}` : "Visual Builder"}
            </div>
            <div className="text-[11px] text-on-surface-variant/60">
              {editingComponent
                ? "Editing the master — changes apply to every instance"
                : pageTitle}
            </div>
          </div>
        </div>

        {/* ─── Compact sync badge ────────────────────────────────── */}
        <div className="flex items-center gap-1">
          {dirty && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              ⚡ Layout changed
            </span>
          )}
          {!dirty && syncStatus === "in-sync" && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary/10 text-secondary border border-secondary/20">
              ✓ Synced
            </span>
          )}
          {!dirty && syncStatus === "never-generated" && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-on-surface-variant border border-white/10">
              Not generated
            </span>
          )}
          {!dirty && syncStatus === "no-frontend" && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-on-surface-variant border border-white/10">
              No frontend
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {editingComponentId && (
            <button
              type="button"
              onClick={handleExitComponent}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-secondary text-on-secondary font-medium hover:shadow-[0_0_20px_rgba(78,223,145,0.3)] transition-all"
              title="Save the component and return to the page"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              Back to page
            </button>
          )}
          {editingComponentId && (
            <>
              <button
                type="button"
                onClick={handleExposeProperty}
                disabled={!canExposeText || saving}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-surface-container-high hover:bg-surface-container-highest transition-all font-medium disabled:opacity-40"
                title="Expose the selected element's text as an instance property"
              >
                <span className="material-symbols-outlined text-sm">label</span>
                Text
              </button>
              <button
                type="button"
                onClick={handleExposeColor}
                disabled={!canExposeColor || saving}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-surface-container-high hover:bg-surface-container-highest transition-all font-medium disabled:opacity-40"
                title="Expose the selected element's colour as an instance property"
              >
                <span className="material-symbols-outlined text-sm">palette</span>
                Color
              </button>
              <button
                type="button"
                onClick={handleExposeNumber}
                disabled={!canExposeNumber || saving}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-surface-container-high hover:bg-surface-container-highest transition-all font-medium disabled:opacity-40"
                title="Expose the selected element's font size as a numeric property"
              >
                <span className="material-symbols-outlined text-sm">format_size</span>
                Size
              </button>
              <button
                type="button"
                onClick={handleExposeToggle}
                disabled={!canExposeToggle || saving}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-surface-container-high hover:bg-surface-container-highest transition-all font-medium disabled:opacity-40"
                title="Expose a visibility toggle for the selected element"
              >
                <span className="material-symbols-outlined text-sm">visibility</span>
                Toggle
              </button>
              <button
                type="button"
                onClick={handleAddVariant}
                disabled={saving}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-surface-container-high hover:bg-surface-container-highest transition-all font-medium disabled:opacity-40"
                title="Create a variant from the current layout"
              >
                <span className="material-symbols-outlined text-sm">content_copy</span>
                Variant
              </button>
              {(editingComponent?.variants || []).length > 0 && (
                <select
                  value={editingVariantId || ""}
                  onChange={(e) => handleSwitchVariant(e.target.value)}
                  className="text-xs bg-surface-container-high border border-white/10 rounded-full px-2 py-1.5 text-on-surface outline-none focus:border-secondary"
                  title="Variant being edited"
                >
                  <option value="">Default</option>
                  {(editingComponent?.variants || []).map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variant.name}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                onClick={handleRenameComponent}
                disabled={saving}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-surface-container-high hover:bg-surface-container-highest transition-all font-medium disabled:opacity-40"
                title="Rename this component"
              >
                <span className="material-symbols-outlined text-sm">edit</span>
                Rename
              </button>
              <button
                type="button"
                onClick={handleDeleteComponent}
                disabled={saving}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-error-container/10 text-error border border-error/20 hover:bg-error-container/20 transition-all font-medium disabled:opacity-40"
                title="Delete this component (only when no instance uses it)"
              >
                <span className="material-symbols-outlined text-sm">delete</span>
                Delete
              </button>
              {editingVariantId && (
                <button
                  type="button"
                  onClick={handleDeleteVariant}
                  disabled={saving}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-error-container/10 text-error border border-error/20 hover:bg-error-container/20 transition-all font-medium disabled:opacity-40"
                  title="Delete the variant currently being edited"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                  Delete variant
                </button>
              )}
            </>
          )}
          <button
            type="button"
            onClick={undo}
            disabled={undoStackSize === 0}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Undo (⌘/Ctrl+Z)"
          >
            <span className="material-symbols-outlined text-[18px]">undo</span>
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={redoStackSize === 0}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Redo (⌘/Ctrl+Shift+Z)"
          >
            <span className="material-symbols-outlined text-[18px]">redo</span>
          </button>

          <button
            type="button"
            onClick={() => setThemeMode((m) => (m === "dark" ? "light" : "dark"))}
            className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-full transition-all font-medium ${
              themeMode === "dark"
                ? "bg-secondary/20 text-secondary"
                : "bg-surface-container-high hover:bg-surface-container-highest"
            }`}
            title="Preview the dark-mode token values on the canvas"
          >
            <span className="material-symbols-outlined text-sm">
              {themeMode === "dark" ? "light_mode" : "dark_mode"}
            </span>
            {themeMode === "dark" ? "Light" : "Dark"}
          </button>
          <div
            className="flex items-center gap-0.5 rounded-full bg-surface-container-high px-1 py-0.5"
            title="Preview width (design-time only — generated code is responsive)"
          >
            {[
              { label: "Desktop", value: null, icon: "desktop_windows" },
              { label: "Tablet", value: 768, icon: "tablet_mac" },
              { label: "Mobile", value: 390, icon: "smartphone" },
            ].map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => setViewportWidth(opt.value)}
                className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors ${
                  viewportWidth === opt.value
                    ? "bg-secondary/20 text-secondary"
                    : "text-on-surface-variant hover:bg-white/10"
                }`}
                title={`Preview at ${opt.label}`}
                aria-label={`Preview at ${opt.label}`}
                aria-pressed={viewportWidth === opt.value}
              >
                <span className="material-symbols-outlined text-[16px]">{opt.icon}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowTokensPanel(true)}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-surface-container-high hover:bg-surface-container-highest transition-all font-medium"
          >
            <span className="material-symbols-outlined text-sm">palette</span>
            Tokens
          </button>
          <button
            type="button"
            onClick={() => setShowCodePanel((v) => !v)}
            className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-full transition-all font-medium ${
              showCodePanel
                ? "bg-secondary/20 text-secondary"
                : "bg-surface-container-high hover:bg-surface-container-highest"
            }`}
            title="Show the generated JSX for this page"
          >
            <span className="material-symbols-outlined text-sm">code</span>
            Code
          </button>
          <button
            type="button"
            onClick={handleCreateComponent}
            disabled={selectedIds.length !== 1 || saving}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-surface-container-high hover:bg-surface-container-highest transition-all font-medium disabled:opacity-40"
            title="Turn the selected element into a reusable component"
          >
            <span className="material-symbols-outlined text-sm">widgets</span>
            Component
          </button>
          <button
            type="button"
            onClick={handleDetachInstance}
            disabled={!canDetach}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-surface-container-high hover:bg-surface-container-highest transition-all font-medium disabled:opacity-40"
            title="Replace this instance with an editable copy"
          >
            <span className="material-symbols-outlined text-sm">link_off</span>
            Detach
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !activePage}
            className="text-xs px-3 py-1.5 rounded-full bg-surface-container-high hover:bg-surface-container-highest transition-all font-medium disabled:opacity-40"
            title="Save the layout to the blueprint without generating code"
          >
            {saving ? "Saving…" : "Save Layout"}
          </button>
          <button
            type="button"
            onClick={handleSaveAndGenerate}
            disabled={generating || !activePage}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-secondary text-on-secondary hover:shadow-[0_0_20px_rgba(78,223,145,0.3)] transition-all font-medium disabled:opacity-40"
            title="Save layout and generate the actual React component"
          >
            <span className="material-symbols-outlined text-sm">rocket_launch</span>
            {generating ? "Generating…" : "Save & Generate Code"}
          </button>
        </div>
      </div>

      {/* ─── Tools Toolbar ──────────────────────────────────────────── */}
      <ToolsToolbar activeTool={activeTool} onToolChange={handleToolChange} />

      {/* ─── Alignment Toolbar ────────────────────────────────────── */}
      <Toolbar
        selectedIds={selectedIds}
        onAlign={handleAlign}
        onDistribute={handleDistribute}
        onGroup={handleGroup}
        onUngroup={handleUngroup}
        onReorder={handleReorder}
        canGroup={canGroup}
        canUngroup={canUngroup}
        canReorder={canReorder}
      />

      {/* ─── Main workspace ──────────────────────────────────────── */}
      <div className="flex-1 flex min-h-0 relative">
        {/* ─── Left Panel ────────────────────────────────────────── */}
        {leftPanelCollapsed ? (
          <div className="w-8 border-r border-white/5 flex items-center justify-center shrink-0">
            <button
              type="button"
              onClick={() => setLeftPanelCollapsed(false)}
              className="text-on-surface-variant hover:text-secondary transition-colors"
              title="Expand left panel"
            >
              <span className="material-symbols-outlined text-sm">chevron_right</span>
            </button>
          </div>
        ) : (
          <>
            <div
              ref={leftPanelRef}
              className="border-r border-white/5 flex flex-col shrink-0 bg-surface/10"
              style={{ width: leftPanelWidth }}
            >
              <div className="flex items-center justify-between p-2 border-b border-white/5 shrink-0">
                <div className="flex gap-2 text-xs font-medium">
                  <button
                    type="button"
                    className={`${leftPanelTab === "pages" ? "text-secondary" : "text-on-surface-variant hover:text-on-surface"} transition-colors`}
                    onClick={() => setLeftPanelTab("pages")}
                  >
                    Pages
                  </button>
                  <button
                    type="button"
                    className={`${leftPanelTab === "widgets" ? "text-secondary" : "text-on-surface-variant hover:text-on-surface"} transition-colors`}
                    onClick={() => setLeftPanelTab("widgets")}
                  >
                    Widgets
                  </button>
                  <button
                    type="button"
                    className={`${leftPanelTab === "layers" ? "text-secondary" : "text-on-surface-variant hover:text-on-surface"} transition-colors`}
                    onClick={() => setLeftPanelTab("layers")}
                  >
                    Layers
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setLeftPanelCollapsed(true)}
                  className="text-on-surface-variant hover:text-secondary transition-colors"
                  title="Collapse left panel"
                >
                  <span className="material-symbols-outlined text-sm">chevron_left</span>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {leftPanelTab === "pages" && (
                  <PageManager
                    models={models}
                    pageSettings={pageSettings}
                    customPages={customPages}
                    activePageKey={activePage}
                    onSelectPage={handleSelectPage}
                    onCreateCustomPage={handleCreateCustomPage}
                    onDeleteCustomPage={handleDeleteCustomPage}
                  />
                )}
                {leftPanelTab === "widgets" && <WidgetPalette components={components} />}
                {leftPanelTab === "layers" && (
                  <LayersPanel
                    tree={tree}
                    selectedIds={selectedIds}
                    onSelectionChange={setSelectedIds}
                    setTree={handleTreeChange}
                    onPropsChange={handlePropsChange}
                  />
                )}
              </div>
            </div>

            {/* ─── Resize Handle ──────────────────────────────────── */}
            <div
              className="w-1 cursor-col-resize hover:bg-secondary/50 active:bg-secondary transition-colors shrink-0"
              onMouseDown={handleResizeStart}
              style={{ cursor: isResizing ? "col-resize" : "col-resize" }}
              title="Drag to resize"
            />
          </>
        )}

        {/* ─── Canvas + Properties ───────────────────────────────── */}
        <div className="flex-1 flex min-h-0">
          <DndContext sensors={dndSensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            {tree ? (
              <BuilderDataProvider
                projectId={projectId}
                models={models}
                designTokens={designTokens}
                activeMode={themeMode}
              >
                <Canvas
                  tree={tree}
                  setTree={handleTreeChange}
                  selectedIds={selectedIds}
                  onSelectionChange={setSelectedIds}
                  activeTool={activeTool}
                  toolOptions={toolOptions}
                  viewportWidth={viewportWidth}
                  components={componentsById}
                  onEnterComponent={handleEnterComponent}
                />
              </BuilderDataProvider>
            ) : (
              <div className="flex-1 flex items-center justify-center text-on-surface-variant/50 text-sm">
                Select a page from the left to start building.
              </div>
            )}
            <DragOverlay>
              {activeDrag ? (
                <div className="px-3 py-1.5 rounded-lg bg-secondary text-on-secondary text-xs font-medium shadow-lg">
                  {WIDGETS[activeDrag.widgetType]?.label || "Widget"}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
          {!editingComponentId && selectedNode?.type === INSTANCE_TYPE ? (
            <InstancePanel
              component={componentsById[selectedNode.props?.componentId]}
              components={components}
              node={selectedNode}
              onChange={(patch) => handlePropsChange(selectedNode.id, patch)}
              onEnterComponent={() => handleEnterComponent(selectedNode.props?.componentId)}
              onRemoveProperty={handleRemoveProperty}
            />
          ) : (
            <PropertiesPanel
              tree={tree || makeEmptyRoot()}
              selectedId={selectedId}
              selectedCount={selectedIds.length}
              onChange={selectedIds.length > 1 ? handlePropsChangeMany : handlePropsChange}
              models={models}
              roles={roles}
              designTokens={designTokens}
              variants={editingComponent?.variants || []}
              componentProperties={editingComponent?.properties || []}
            />
          )}
          {showCodePanel && (
            <div className="w-[420px] shrink-0 min-h-0 border-l border-white/5 p-2 bg-surface/10">
              <CodePanel
                isOpen={showCodePanel}
                projectId={projectId}
                tree={tree}
                componentName={editingComponent ? editingComponent.name : codeComponentName}
                asComponent={Boolean(editingComponentId)}
                onClose={() => setShowCodePanel(false)}
                onGenerate={handleSaveAndGenerate}
              />
            </div>
          )}
        </div>
      </div>
      {showTokensPanel && (
        <TokensPanel tokens={designTokens} onSave={handleSaveTokens} onClose={() => setShowTokensPanel(false)} />
      )}
    </div>
  );
}