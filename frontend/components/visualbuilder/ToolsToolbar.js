// frontend/components/visualbuilder/ToolsToolbar.js
"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";

const TOOLS = {
  SELECT: "select",
  FRAME: "frame",
  SHAPES: "shapes",
  PEN: "pen",
  TEXT: "text",
  COMMENT: "comment",
  COMPONENTS: "components",
  DRAW: "draw",
  PROTOTYPE: "prototype",
  CODE: "code",
};

const SHAPE_OPTIONS = [
  { label: "Rectangle", icon: "crop_square", type: "rectangle" },
  { label: "Circle", icon: "circle", type: "circle" },
  { label: "Rounded Rectangle", icon: "rounded_corner", type: "rounded-rectangle" },
  { label: "Line", icon: "horizontal_rule", type: "line" },
];

// Renders a dropdown anchored to `anchorRef`, escaping the canvas stacking
// context via a portal to document.body so it paints on top of the canvas.
function PortalDropdown({ anchorRef, open, onClose, children }) {
  const [rect, setRect] = useState(null);

  const measure = useCallback(() => {
    if (!anchorRef.current) return;
    const r = anchorRef.current.getBoundingClientRect();
    setRect({ left: r.left, top: r.bottom + 6, width: r.width });
  }, []);

  useEffect(() => {
    if (open) {
      measure();
      window.addEventListener("scroll", measure, true);
      window.addEventListener("resize", measure);
    }
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [open, measure]);

  if (!open || !rect) return null;

  return createPortal(
    <div
      className="fixed z-[60] bg-surface-container-highest border border-white/10 rounded-lg shadow-lg p-1 min-w-[160px]"
      style={{
        left: rect.left,
        top: rect.top,
        minWidth: rect.width,
      }}
      onMouseLeave={onClose}
    >
      {children}
    </div>,
    document.body
  );
}

function DropdownButton({ icon, label, active, onClick, hasDropdown, anchorRef, open, onToggle }) {
  return (
    <button
      type="button"
      ref={anchorRef}
      onClick={onToggle}
      className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
        active
          ? "bg-secondary/20 text-secondary"
          : "hover:bg-white/5 text-on-surface-variant hover:text-on-surface"
      }`}
    >
      <span className="material-symbols-outlined text-[18px]">{icon}</span>
      <span className="text-[10px] hidden sm:inline">{label}</span>
      {hasDropdown && (
        <span className="material-symbols-outlined text-[12px]">expand_more</span>
      )}
    </button>
  );
}

export default function ToolsToolbar({ activeTool, onToolChange }) {
  const [showShapeDropdown, setShowShapeDropdown] = useState(false);
  const [showComponentDropdown, setShowComponentDropdown] = useState(false);
  const shapeAnchorRef = useRef(null);
  const componentAnchorRef = useRef(null);

  const closeDropdowns = () => {
    setShowShapeDropdown(false);
    setShowComponentDropdown(false);
  };

  const handleShapeSelect = (shapeType) => {
    setShowShapeDropdown(false);
    onToolChange(TOOLS.SHAPES, { shapeType });
  };

  const handleToolClick = (tool) => {
    if (tool === TOOLS.SHAPES) {
      setShowShapeDropdown((prev) => !prev);
      setShowComponentDropdown(false);
      return;
    }
    if (tool === TOOLS.COMPONENTS) {
      setShowComponentDropdown((prev) => !prev);
      setShowShapeDropdown(false);
      return;
    }
    closeDropdowns();
    onToolChange(tool);
  };

  const isActive = (tool) => activeTool === tool;

  return (
    <>
      <div className="flex items-center gap-1 px-3 py-1 border-b border-white/5 bg-surface-container-high/50 backdrop-blur-sm overflow-x-auto shrink-0">
        {/* Select */}
        <DropdownButton
          icon="select"
          label="Select"
          active={isActive(TOOLS.SELECT)}
          onClick={() => closeDropdowns()}
          onToggle={() => onToolChange(TOOLS.SELECT)}
        />

        {/* Frame */}
        <DropdownButton
          icon="crop_free"
          label="Frame"
          active={isActive(TOOLS.FRAME)}
          onClick={() => closeDropdowns()}
          onToggle={() => onToolChange(TOOLS.FRAME)}
        />

        {/* Shapes with dropdown */}
        <div className="relative shrink-0">
          <DropdownButton
            icon="shapes"
            label="Shapes"
            active={isActive(TOOLS.SHAPES)}
            hasDropdown
            anchorRef={shapeAnchorRef}
            open={showShapeDropdown}
            onToggle={() => handleToolClick(TOOLS.SHAPES)}
          />
          <PortalDropdown
            anchorRef={shapeAnchorRef}
            open={showShapeDropdown}
            onClose={closeDropdowns}
          >
            {SHAPE_OPTIONS.map((shape) => (
              <button
                key={shape.type}
                className="flex items-center gap-2 w-full px-3 py-1.5 rounded hover:bg-white/10 text-xs transition-colors"
                onClick={() => handleShapeSelect(shape.type)}
              >
                <span className="material-symbols-outlined text-[16px]">{shape.icon}</span>
                {shape.label}
              </button>
            ))}
          </PortalDropdown>
        </div>

        {/* Pen */}
        <DropdownButton
          icon="edit"
          label="Pen"
          active={isActive(TOOLS.PEN)}
          onClick={() => closeDropdowns()}
          onToggle={() => onToolChange(TOOLS.PEN)}
        />

        {/* Text */}
        <DropdownButton
          icon="text_fields"
          label="Text"
          active={isActive(TOOLS.TEXT)}
          onClick={() => closeDropdowns()}
          onToggle={() => onToolChange(TOOLS.TEXT)}
        />

        {/* Comment */}
        <DropdownButton
          icon="comment"
          label="Comment"
          active={isActive(TOOLS.COMMENT)}
          onClick={() => closeDropdowns()}
          onToggle={() => onToolChange(TOOLS.COMMENT)}
        />

        {/* Components with dropdown */}
        <div className="relative shrink-0">
          <DropdownButton
            icon="widgets"
            label="Components"
            active={isActive(TOOLS.COMPONENTS)}
            hasDropdown
            anchorRef={componentAnchorRef}
            open={showComponentDropdown}
            onToggle={() => handleToolClick(TOOLS.COMPONENTS)}
          />
          <PortalDropdown
            anchorRef={componentAnchorRef}
            open={showComponentDropdown}
            onClose={closeDropdowns}
          >
            <button className="flex items-center gap-2 w-full px-3 py-1.5 rounded hover:bg-white/10 text-xs transition-colors">
              <span className="material-symbols-outlined text-[16px]">grid_view</span>
              All Components
            </button>
            <button className="flex items-center gap-2 w-full px-3 py-1.5 rounded hover:bg-white/10 text-xs transition-colors">
              <span className="material-symbols-outlined text-[16px]">dashboard</span>
              Templates
            </button>
            <button className="flex items-center gap-2 w-full px-3 py-1.5 rounded hover:bg-white/10 text-xs transition-colors">
              <span className="material-symbols-outlined text-[16px]">add</span>
              Create Component
            </button>
          </PortalDropdown>
        </div>

        {/* Draw */}
        <DropdownButton
          icon="brush"
          label="Draw"
          active={isActive(TOOLS.DRAW)}
          onClick={() => closeDropdowns()}
          onToggle={() => onToolChange(TOOLS.DRAW)}
        />

        {/* Prototype */}
        <DropdownButton
          icon="device_hub"
          label="Prototype"
          active={isActive(TOOLS.PROTOTYPE)}
          onClick={() => closeDropdowns()}
          onToggle={() => onToolChange(TOOLS.PROTOTYPE)}
        />

        {/* Code */}
        <DropdownButton
          icon="code"
          label="Code"
          active={isActive(TOOLS.CODE)}
          onClick={() => closeDropdowns()}
          onToggle={() => onToolChange(TOOLS.CODE)}
        />
      </div>
    </>
  );
}
