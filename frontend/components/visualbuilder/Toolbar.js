// frontend/components/visualbuilder/Toolbar.js
"use client";

import React from "react";

export default function Toolbar({
  selectedIds,
  onAlign,
  onDistribute,
  onGroup,
  onUngroup,
  onReorder,
  canGroup = false,
  canUngroup = false,
  canReorder = false,
}) {
  const count = selectedIds?.length || 0;

  return (
    <div className="flex items-center gap-1 px-3 py-1 border-b border-white/5 bg-surface-container-high/50 backdrop-blur-sm overflow-x-auto whitespace-nowrap">
      <span className="text-[10px] text-on-surface-variant/60 mr-1 shrink-0">Align</span>
      <Group>
        <Button icon="align_horizontal_left" title="Align left" onClick={() => onAlign("left")} disabled={count < 2} />
        <Button icon="align_horizontal_center" title="Align center" onClick={() => onAlign("center")} disabled={count < 2} />
        <Button icon="align_horizontal_right" title="Align right" onClick={() => onAlign("right")} disabled={count < 2} />
        <Button icon="align_vertical_top" title="Align top" onClick={() => onAlign("top")} disabled={count < 2} />
        <Button icon="align_vertical_center" title="Align middle" onClick={() => onAlign("middle")} disabled={count < 2} />
        <Button icon="align_vertical_bottom" title="Align bottom" onClick={() => onAlign("bottom")} disabled={count < 2} />
      </Group>

      <Divider />

      <span className="text-[10px] text-on-surface-variant/60 mr-1 shrink-0">Distribute</span>
      <Group>
        <Button icon="space_horizontal" title="Distribute horizontally" onClick={() => onDistribute("horizontal")} disabled={count < 3} />
        <Button icon="space_vertical" title="Distribute vertically" onClick={() => onDistribute("vertical")} disabled={count < 3} />
      </Group>

      <Divider />

      <Group>
        <Button icon="select_all" title="Group (⌘G)" onClick={onGroup} disabled={!canGroup} />
        <Button icon="deselect" title="Ungroup (⌘⇧G)" onClick={onUngroup} disabled={!canUngroup} />
      </Group>

      <Divider />

      <Group>
        <Button icon="arrow_upward" title="Bring forward" onClick={() => onReorder("forward")} disabled={!canReorder} />
        <Button icon="arrow_downward" title="Send backward" onClick={() => onReorder("backward")} disabled={!canReorder} />
        <Button icon="vertical_align_top" title="Bring to front" onClick={() => onReorder("front")} disabled={!canReorder} />
        <Button icon="vertical_align_bottom" title="Send to back" onClick={() => onReorder("back")} disabled={!canReorder} />
      </Group>
    </div>
  );
}

function Group({ children }) {
  return <div className="flex items-center gap-0.5">{children}</div>;
}

function Divider() {
  return <div className="w-px h-5 bg-white/10 mx-1 shrink-0" />;
}

function Button({ icon, title, onClick, disabled }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
    >
      <span className="material-symbols-outlined text-[18px]">{icon}</span>
    </button>
  );
}