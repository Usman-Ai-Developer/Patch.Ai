// frontend/components/visualbuilder/GenericPreview.js
"use client";

import React from "react";
import { useBuilderData } from "./builderContext";

// Mirrors backend/builder/services/frontend/react/writers/visual_pages.py's
// render_generic(). Same "kind" switch, same spec fields, same token
// resolution rules — kept side by side intentionally so a change to one
// render kind is easy to eyeball against the other. This is a *canvas
// mockup* renderer (design-time only), not the actual generated JSX; it
// exists so every "generic"-tier widget's design-time look comes from the
// manifest instead of a hand-written Preview component per widget.

function resolveClass(template, props, spec) {
  const tokens = { ...props, extra: props.className || "" };

  if (spec.classFromLevel) {
    const level = props[spec.tagFromProp || "level"] ?? 2;
    tokens.levelClass = spec.classFromLevel[level] ?? spec.classFromLevel[2] ?? "";
  }
  if (spec.classMap) {
    Object.entries(spec.classMap).forEach(([propName, valueMap]) => {
      const value = props[propName];
      tokens[`${propName}Class`] = valueMap[value] ?? spec.classMapDefault ?? "";
    });
  }

  const filled = template.replace(/\{(\w+)\}/g, (_, key) => (tokens[key] ?? ""));
  return filled.split(/\s+/).filter(Boolean).join(" ");
}

// Mirrors backend/.../visual_pages.py's _inline_style(). Same defaults, same
// skip rules — a value at its default renders nothing, so the canvas mock
// only shows a style once it actually diverges from the generated app.
const STYLE_PROP_MAP = {
  backgroundColor: "transparent",
  color: "inherit",
  border: "none",
  borderRadius: "0px",
  boxShadow: "none",
  fontSize: "inherit",
  fontWeight: "normal",
  textAlign: "left",
  padding: "0px",
  margin: "0px",
};

function resolveColorToken(value, tokens, mode = "light") {
  if (typeof value !== "string" || !value.startsWith("@token:")) return value;
  const id = value.slice("@token:".length);
  const swatch = (tokens?.colors || []).find((t) => t.id === id);
  if (!swatch) return undefined;
  // Mode preview: dark uses the swatch's dark value (falling back to light).
  return mode === "dark" ? swatch.dark || swatch.value : swatch.value;
}

function inlineStyle(props, tokens, mode = "light") {
  const style = {};
  Object.entries(STYLE_PROP_MAP).forEach(([key, def]) => {
    let value = props[key];
    if (key === "backgroundColor" || key === "color") value = resolveColorToken(value, tokens, mode);
    if (value === undefined || value === null || value === "" || value === def) return;
    style[key] = value;
  });

  const width = props.width;
  if (width !== undefined && width !== null && width !== "" && width !== "auto") {
    style.width = typeof width === "number" ? `${width}px` : width;
  }
  const height = props.height;
  if (height !== undefined && height !== null && height !== "" && height !== "auto") {
    style.height = typeof height === "number" ? `${height}px` : height;
  }

  // Auto-layout sizing modes — mirrors backend _inline_style().
  if (props.widthMode === "hug") style.width = "fit-content";
  else if (props.widthMode === "fill") style.width = "100%";
  if (props.heightMode === "hug") style.height = "fit-content";
  else if (props.heightMode === "fill") style.height = "100%";

  // Auto-layout controls — inline overrides of the manifest's flex classes.
  if (props.flexDirection === "row" || props.flexDirection === "column") {
    style.flexDirection = props.flexDirection;
  }
  if (props.flexWrap === "wrap" || props.flexWrap === "nowrap") {
    style.flexWrap = props.flexWrap;
  }
  if (props.gapPx !== undefined && props.gapPx !== null && props.gapPx !== "") {
    style.gap = typeof props.gapPx === "number" ? `${props.gapPx}px` : props.gapPx;
  }

  if (props.rotation && props.rotation !== 0) {
    style.transform = `rotate(${props.rotation}deg)`;
  }
  if (props.opacity !== undefined && props.opacity !== null && props.opacity !== 1 && props.opacity !== "") {
    style.opacity = props.opacity;
  }

  // A textStyle token overrides fontSize/fontWeight wholesale, same as
  // backend/.../visual_pages.py's _inline_style().
  if (typeof props.textStyle === "string" && props.textStyle.startsWith("@token:")) {
    const id = props.textStyle.slice("@token:".length);
    const match = (tokens?.textStyles || []).find((t) => t.id === id);
    if (match) {
      if (match.fontSize) style.fontSize = match.fontSize;
      else delete style.fontSize;
      if (match.fontWeight) style.fontWeight = match.fontWeight;
      else delete style.fontWeight;
    }
  }

  return style;
}

function resolveHref(props, spec) {
  if (spec.hrefTemplate === "admin-url") {
    return "(admin URL)"; // real value only exists once the app is generated
  }
  if (spec.hrefProp) {
    return props[spec.hrefProp] || spec.hrefDefault || "";
  }
  return spec.hrefDefault || "";
}

export default function GenericPreview({ node, spec, children }) {
  const props = node.props || {};
  const { designTokens, activeMode } = useBuilderData();
  const style = inlineStyle(props, designTokens, activeMode);

  if (spec.kind === "container") {
    const cls = resolveClass(spec.classTemplate, props, spec);
    const Tag = spec.tag || "div";
    const title = spec.titleProp ? props[spec.titleProp] : null;
    return (
      <Tag className={cls} style={style}>
        {title ? <h3 className="text-sm font-semibold mb-2">{title}</h3> : null}
        {children}
      </Tag>
    );
  }

  if (spec.kind === "void") {
    const cls = resolveClass(spec.classTemplate, props, spec);
    const Tag = spec.tag || "div";
    return <Tag className={cls} style={style} />;
  }

  if (spec.kind === "text") {
    const cls = resolveClass(spec.classTemplate, props, spec);
    let Tag = spec.tag;
    if (spec.tagFromProp) {
      const level = props[spec.tagFromProp] ?? 2;
      Tag = spec.tagMap[level] || spec.tagMap[2];
    }
    const text = props[spec.textProp] || spec.textDefault || "";
    return <Tag className={cls} style={style}>{text}</Tag>;
  }

  if (spec.kind === "media") {
    const cls = resolveClass(spec.classTemplate, props, spec);
    return (
      <img
        src={props[spec.srcProp || "src"]}
        alt={props[spec.altProp || "alt"] || ""}
        className={cls}
        style={style}
      />
    );
  }

  if (spec.kind === "link") {
    const cls = resolveClass(spec.classTemplate, props, spec);
    const text = props[spec.textProp] || spec.textDefault || "";
    const href = resolveHref(props, spec);
    if (spec.hrefTemplate) {
      return (
        <a className={cls} style={style} title="Resolved from the generated app's API base URL">
          {text}
        </a>
      );
    }
    if (!href && spec.tag === "button") {
      return (
        <button type="button" className={cls} style={style}>
          {text}
        </button>
      );
    }
    return <span className={cls} style={style}>{text}</span>;
  }

  return <div className="text-xs text-red-400">Unknown generic render kind: {spec.kind}</div>;
}