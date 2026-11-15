// frontend/components/visualbuilder/ToolsToolbar.js
"use client";

import React, { useState } from "react";

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

export default function ToolsToolbar({ activeTool, onToolChange }) {
  const [showShapeDropdown, setShowShapeDropdown] = useState(false);
  const [showComponentDropdown, setShowComponentDropdown] = useState(false);

  const handleShapeSelect = (shapeType) => {
    setShowShapeDropdown(false);
    onToolChange(TOOLS.SHAPES, { shapeType });
  };

  const handleToolClick = (tool) => {
    if (tool === TOOLS.SHAPES) {
      setShowShapeDropdown(!showShapeDropdown);
      return;
    }
    if (tool === TOOLS.COMPONENTS) {
      setShowComponentDropdown(!showComponentDropdown);
      return;
    }
    setShowShapeDropdown(false);
    setShowComponentDropdown(false);
    onToolChange(tool);
  };

  const isActive = (tool) => activeTool === tool;

  return (
    <div className="flex items-center gap-1 px-3 py-1 border-b border-white/5 bg-surface-container-high/50 backdrop-blur-sm overflow-x-auto">
      {/* Select */}
      <ToolButton
        icon="select"
        label="Select"
        active={isActive(TOOLS.SELECT)}
        onClick={() => handleToolClick(TOOLS.SELECT)}
      />

      {/* Frame */}
      <ToolButton
        icon="crop_free"
        label="Frame"
        active={isActive(TOOLS.FRAME)}
        onClick={() => handleToolClick(TOOLS.FRAME)}
      />

      {/* Shapes with dropdown */}
      <div className="relative">
        <ToolButton
          icon="shapes"
          label="Shapes"
          active={isActive(TOOLS.SHAPES)}
          onClick={() => handleToolClick(TOOLS.SHAPES)}
          hasDropdown
        />
        {showShapeDropdown && (
          <div className="absolute top-full left-0 mt-1 bg-surface-container-highest border border-white/10 rounded-lg shadow-lg p-1 z-50 min-w-[160px]">
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
          </div>
        )}
      </div>

      {/* Pen */}
      <ToolButton
        icon="edit"
        label="Pen"
        active={isActive(TOOLS.PEN)}
        onClick={() => handleToolClick(TOOLS.PEN)}
      />

      {/* Text */}
      <ToolButton
        icon="text_fields"
        label="Text"
        active={isActive(TOOLS.TEXT)}
        onClick={() => handleToolClick(TOOLS.TEXT)}
      />

      {/* Comment */}
      <ToolButton
        icon="comment"
        label="Comment"
        active={isActive(TOOLS.COMMENT)}
        onClick={() => handleToolClick(TOOLS.COMMENT)}
      />

      {/* Components with dropdown */}
      <div className="relative">
        <ToolButton
          icon="widgets"
          label="Components"
          active={isActive(TOOLS.COMPONENTS)}
          onClick={() => handleToolClick(TOOLS.COMPONENTS)}
          hasDropdown
        />
        {showComponentDropdown && (
          <div className="absolute top-full left-0 mt-1 bg-surface-container-highest border border-white/10 rounded-lg shadow-lg p-1 z-50 min-w-[160px]">
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
          </div>
        )}
      </div>

      {/* Draw */}
      <ToolButton
        icon="brush"
        label="Draw"
        active={isActive(TOOLS.DRAW)}
        onClick={() => handleToolClick(TOOLS.DRAW)}
      />

      {/* Prototype */}
      <ToolButton
        icon="device_hub"
        label="Prototype"
        active={isActive(TOOLS.PROTOTYPE)}
        onClick={() => handleToolClick(TOOLS.PROTOTYPE)}
      />

      {/* Code */}
      <ToolButton
        icon="code"
        label="Code"
        active={isActive(TOOLS.CODE)}
        onClick={() => handleToolClick(TOOLS.CODE)}
      />
    </div>
  );
}

function ToolButton({ icon, label, active, onClick, hasDropdown }) {
  return (
    <button
      type="button"
      onClick={onClick}
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