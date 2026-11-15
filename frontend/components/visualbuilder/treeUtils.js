// frontend/components/visualbuilder/treeUtils.js


// Pure helper functions for manipulating a widget tree.
import { WIDGETS } from "./WidgetRegistry";
let counter = 0;
export function newId(prefix = "w") {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter}`;
}

export function cloneTree(node) {
  return JSON.parse(JSON.stringify(node));
}

export function findNode(root, id) {
  if (!root) return null;
  if (root.id === id) return root;
  for (const child of root.children || []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

export function findParent(root, id, parent = null) {
  if (!root) return null;
  if (root.id === id) return parent;
  for (const child of root.children || []) {
    const found = findParent(child, id, root);
    if (found) return found;
  }
  return null;
}

export function removeNode(root, id) {
  const next = cloneTree(root);
  const parent = findParent(next, id);
  if (!parent) return next;
  parent.children = (parent.children || []).filter((c) => c.id !== id);
  return next;
}

export function insertNode(root, targetParentId, node, index = -1) {
  const next = cloneTree(root);
  const parent = findNode(next, targetParentId);
  if (!parent) return next;
  if (!parent.children) parent.children = [];
  const insertAt = index < 0 ? parent.children.length : index;
  parent.children.splice(insertAt, 0, node);
  return next;
}

export function moveNode(root, nodeId, targetParentId, index = -1) {
  const node = findNode(root, nodeId);
  if (!node) return root;
  if (findNode(node, targetParentId)) return root;
  const withoutNode = removeNode(root, nodeId);
  return insertNode(withoutNode, targetParentId, node, index);
}

// Moves nodeId to sit right after afterId, in afterId's parent. Used by the
// layers panel when you drop a row onto a non-container row (reparent +
// reorder in one step, instead of always dropping "into" the target).
export function moveNodeAfter(root, nodeId, afterId) {
  const node = findNode(root, nodeId);
  if (!node) return root;
  const parent = findParent(root, afterId);
  if (!parent) return root;
  if (nodeId === afterId) return root;
  if (findNode(node, parent.id)) return root; // can't move into own descendant
  const withoutNode = removeNode(root, nodeId);
  const parentInNext = findNode(withoutNode, parent.id);
  if (!parentInNext) return root;
  const idx = parentInNext.children.findIndex((c) => c.id === afterId);
  return insertNode(withoutNode, parent.id, node, idx < 0 ? -1 : idx + 1);
}

export function updateNodeProps(root, id, newProps) {
  const next = cloneTree(root);
  const node = findNode(next, id);
  if (!node) return next;
  node.props = { ...node.props, ...newProps };
  return next;
}

export function duplicateNode(root, id) {
  const node = findNode(root, id);
  if (!node) return root;
  const parent = findParent(root, id);
  if (!parent) return root;
  const copy = reassignIds(cloneTree(node));
  const next = cloneTree(root);
  const parentInNext = findNode(next, parent.id);
  const idx = parentInNext.children.findIndex((c) => c.id === id);
  parentInNext.children.splice(idx + 1, 0, copy);
  return next;
}

export function reassignIds(node) {
  node.id = newId(node.type?.toLowerCase() || "w");
  node.children = (node.children || []).map(reassignIds);
  return node;
}

export function countNodes(node) {
  if (!node) return 0;
  return 1 + (node.children || []).reduce((sum, c) => sum + countNodes(c), 0);
}

export function makeEmptyRoot() {
  return { id: "root", type: "Column", props: { gap: 4 }, children: [] };
}

// ─── Multi-select-aware helpers ─────────────────────────────────────
// (used by Canvas.js for marquee selection, copy/paste/duplicate, and
// keyboard reordering now that the canvas is real document flow instead
// of free x/y — "moving" a widget means changing its position among
// siblings, not dragging a pixel offset.)

export function removeNodes(root, ids) {
  const idSet = new Set(ids);
  let next = cloneTree(root);
  idSet.forEach((id) => {
    next = removeNode(next, id);
  });
  return next;
}

export function duplicateNodes(root, ids) {
  // Duplicate each selected node in place, skipping any id whose ancestor
  // is also selected (duplicating a container already duplicates its
  // selected children).
  const idSet = new Set(ids);
  const topLevel = ids.filter((id) => {
    let p = findParent(root, id);
    while (p) {
      if (idSet.has(p.id)) return false;
      p = findParent(root, p.id);
    }
    return true;
  });
  let next = cloneTree(root);
  const newIds = [];
  topLevel.forEach((id) => {
    next = duplicateNode(next, id);
    const parent = findParent(next, id);
    const idx = parent.children.findIndex((c) => c.id === id);
    newIds.push(parent.children[idx + 1]?.id);
  });
  return { tree: next, newIds: newIds.filter(Boolean) };
}

// Returns a deep-cloned, id-reassigned copy of each requested node —
// suitable for stashing in an in-memory clipboard and pasting later.
export function copyNodes(root, ids) {
  const idSet = new Set(ids);
  const topLevel = ids.filter((id) => {
    let p = findParent(root, id);
    while (p) {
      if (idSet.has(p.id)) return false;
      p = findParent(root, p.id);
    }
    return true;
  });
  return topLevel
    .map((id) => findNode(root, id))
    .filter(Boolean)
    .map((n) => cloneTree(n));
}

// Pastes clipboard nodes (from copyNodes) as new siblings right after
// `afterId`'s position, in the same parent. Falls back to appending to
// root's children if afterId is missing or has no parent.
export function pasteNodesAfter(root, afterId, clipboardNodes) {
  if (!clipboardNodes || clipboardNodes.length === 0) return { tree: root, newIds: [] };
  let next = cloneTree(root);
  const parent = afterId ? findParent(next, afterId) : null;
  const targetParentId = parent ? parent.id : "root";
  let insertAt = -1;
  if (parent) {
    const idx = parent.children.findIndex((c) => c.id === afterId);
    insertAt = idx + 1;
  }
  const newIds = [];
  clipboardNodes.forEach((node, i) => {
    const copy = reassignIds(cloneTree(node));
    newIds.push(copy.id);
    next = insertNode(next, targetParentId, copy, insertAt < 0 ? -1 : insertAt + i);
  });
  return { tree: next, newIds };
}

// Moves a node earlier/later among its siblings — the flow-layout
// equivalent of nudging, since position now comes from tree order rather
// than x/y. direction is -1 (up/earlier) or 1 (down/later).
export function reorderSibling(root, id, direction) {
  const next = cloneTree(root);
  const parent = findParent(next, id);
  if (!parent || !parent.children) return next;
  const idx = parent.children.findIndex((c) => c.id === id);
  const target = idx + direction;
  if (idx < 0 || target < 0 || target >= parent.children.length) return next;
  const [node] = parent.children.splice(idx, 1);
  parent.children.splice(target, 0, node);
  return next;
}

// ─── Grouping ─────────────────────────────────────────────────────
// Wraps the selected siblings in a new container (Figma's "Frame
// selection", mapped onto Row/Column/Section). `groupNode` is a fresh,
// childless node the caller builds (e.g. via WidgetRegistry.createDefaultNode)
// since treeUtils stays widget-agnostic. Returns the original root
// unchanged if the selection spans more than one parent — grouping across
// containers isn't well-defined in flow layout.
export function groupNodes(root, ids, groupNode) {
  if (!ids || ids.length < 1) return root;
  const idSet = new Set(ids);
  const firstParent = findParent(root, ids[0]);
  if (!firstParent) return root;
  const sameParent = ids.every((id) => {
    const p = findParent(root, id);
    return p && p.id === firstParent.id;
  });
  if (!sameParent) return root;

  const next = cloneTree(root);
  const parent = findNode(next, firstParent.id);
  const firstIndex = parent.children.findIndex((c) => idSet.has(c.id));
  const selectedNodes = parent.children.filter((c) => idSet.has(c.id));
  parent.children = parent.children.filter((c) => !idSet.has(c.id));
  const group = { ...cloneTree(groupNode), children: selectedNodes };
  parent.children.splice(firstIndex, 0, group);
  return next;
}

// Reverses groupNodes: lifts a container's children up into its own
// parent, at its own position, then removes the now-empty container.
export function ungroupNode(root, groupId) {
  const next = cloneTree(root);
  const group = findNode(next, groupId);
  const parent = findParent(next, groupId);
  if (!group || !parent) return root;
  const idx = parent.children.findIndex((c) => c.id === groupId);
  parent.children.splice(idx, 1, ...(group.children || []));
  return next;
}




// ─── Alignment ─────────────────────────────────────────────────────
export function alignNodes(root, ids, direction) {
  const next = cloneTree(root);
  const nodes = ids.map((id) => findNode(next, id)).filter(Boolean);
  if (nodes.length < 2) return next;

  const parent = findParent(next, ids[0]);
  if (!parent || !WIDGETS[parent.type]?.freePositioning) return next;
  const sameParent = ids.every((id) => {
    const p = findParent(next, id);
    return p && p.id === parent.id;
  });
  if (!sameParent) return next;

  const boxes = nodes.map((n) => ({
    id: n.id,
    x: n.props?.x ?? 0,
    y: n.props?.y ?? 0,
    width: n.props?.width ?? 80,
    height: n.props?.height ?? 40,
  }));

  let alignX, alignY;
  if (direction === "left") alignX = Math.min(...boxes.map((b) => b.x));
  else if (direction === "right") alignX = Math.max(...boxes.map((b) => b.x + b.width)) - boxes[0].width;
  else if (direction === "center") {
    const centerX = boxes.reduce((sum, b) => sum + b.x + b.width / 2, 0) / boxes.length;
    alignX = centerX - boxes[0].width / 2;
  }

  if (direction === "top") alignY = Math.min(...boxes.map((b) => b.y));
  else if (direction === "bottom") alignY = Math.max(...boxes.map((b) => b.y + b.height)) - boxes[0].height;
  else if (direction === "middle") {
    const centerY = boxes.reduce((sum, b) => sum + b.y + b.height / 2, 0) / boxes.length;
    alignY = centerY - boxes[0].height / 2;
  }

  nodes.forEach((node) => {
    const newProps = {};
    if (alignX !== undefined) newProps.x = alignX;
    if (alignY !== undefined) newProps.y = alignY;
    if (Object.keys(newProps).length) {
      node.props = { ...node.props, ...newProps };
    }
  });

  return next;
}

// ─── Distribute ─────────────────────────────────────────────────────
export function distributeNodes(root, ids, axis) {
  const next = cloneTree(root);
  const nodes = ids.map((id) => findNode(next, id)).filter(Boolean);
  if (nodes.length < 3) return next;

  const parent = findParent(next, ids[0]);
  if (!parent || !WIDGETS[parent.type]?.freePositioning) return next;
  const sameParent = ids.every((id) => {
    const p = findParent(next, id);
    return p && p.id === parent.id;
  });
  if (!sameParent) return next;

  const boxes = nodes.map((n) => ({
    id: n.id,
    x: n.props?.x ?? 0,
    y: n.props?.y ?? 0,
    width: n.props?.width ?? 80,
    height: n.props?.height ?? 40,
  }));

  boxes.sort((a, b) => (axis === "horizontal" ? a.x - b.x : a.y - b.y));

  const totalSpan = axis === "horizontal"
    ? boxes[boxes.length - 1].x + boxes[boxes.length - 1].width - boxes[0].x
    : boxes[boxes.length - 1].y + boxes[boxes.length - 1].height - boxes[0].y;

  const gap = (totalSpan - boxes.reduce((sum, b) => sum + (axis === "horizontal" ? b.width : b.height), 0)) / (boxes.length - 1);

  let pos = axis === "horizontal" ? boxes[0].x : boxes[0].y;
  for (let i = 0; i < boxes.length; i++) {
    const node = findNode(next, boxes[i].id);
    if (!node) continue;
    const newProps = {};
    if (axis === "horizontal") {
      newProps.x = Math.round(pos);
    } else {
      newProps.y = Math.round(pos);
    }
    node.props = { ...node.props, ...newProps };
    pos += (axis === "horizontal" ? boxes[i].width : boxes[i].height) + gap;
  }

  return next;
}

// ─── Z‑order ─────────────────────────────────────────────────────
export function reorderNode(root, id, action) {
  const next = cloneTree(root);
  const parent = findParent(next, id);
  if (!parent || !parent.children) return next;
  const idx = parent.children.findIndex((c) => c.id === id);
  if (idx === -1) return next;
  const target =
    action === "forward" ? idx + 1 :
    action === "backward" ? idx - 1 :
    action === "front" ? parent.children.length - 1 :
    action === "back" ? 0 : idx;
  if (target < 0 || target >= parent.children.length || target === idx) return next;
  const [node] = parent.children.splice(idx, 1);
  parent.children.splice(target, 0, node);
  return next;
}

// Replace a node in place (used when turning a selection into a component
// instance). Returns a new tree; the caller keeps the node's position.
export function replaceNode(root, id, newNode) {
  if (!root) return root;
  if (root.id === id) return newNode;
  if (!Array.isArray(root.children)) return root;
  return {
    ...root,
    children: root.children.map((child) => replaceNode(child, id, newNode)),
  };
}