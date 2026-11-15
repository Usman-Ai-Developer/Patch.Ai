"use client";

import { useState, useEffect, useRef } from "react";
import AceEditor from "react-ace";

// ─── Ace modes ──────────────────────────────────────────────────────────
import "ace-builds/src-noconflict/mode-python";
import "ace-builds/src-noconflict/mode-javascript";
import "ace-builds/src-noconflict/mode-typescript";
import "ace-builds/src-noconflict/mode-json";
import "ace-builds/src-noconflict/mode-markdown";
import "ace-builds/src-noconflict/mode-yaml";
import "ace-builds/src-noconflict/mode-sql";
import "ace-builds/src-noconflict/mode-sh";
import "ace-builds/src-noconflict/mode-css";
import "ace-builds/src-noconflict/mode-scss";
import "ace-builds/src-noconflict/mode-java";
import "ace-builds/src-noconflict/mode-c_cpp";
import "ace-builds/src-noconflict/mode-php";
import "ace-builds/src-noconflict/mode-ruby";
import "ace-builds/src-noconflict/mode-html";
import "ace-builds/src-noconflict/mode-xml";
import "ace-builds/src-noconflict/mode-text";
import "ace-builds/src-noconflict/mode-kotlin";
import "ace-builds/src-noconflict/mode-dockerfile";
import "ace-builds/src-noconflict/mode-golang";

// ─── Theme: One Dark ──────────────────────────────────────────────────
import "ace-builds/src-noconflict/theme-one_dark";

import { SkeletonText } from "./Skeleton";
import toast from "react-hot-toast";
import { updateFileContent } from "../lib/api";

// ─── Custom CSS – clean Ace styles ──────────────────────────────────
const cleanStyles = `
  .ace-one_dark {
    background: transparent !important;
    color: #d4d4d4 !important;
    font-family: 'JetBrains Mono', Consolas, Monaco, 'Courier New', monospace !important;
  }

  .ace-one_dark .ace_gutter {
    background: rgba(0, 0, 0, 0.2) !important;
    color: #858585 !important;
    border-right: 1px solid rgba(255, 255, 255, 0.05) !important;
  }

  .ace-one_dark .ace_gutter-cell {
    padding-left: 12px;
    padding-right: 12px;
  }

  .ace-one_dark .ace_active-line {
    background: rgba(255, 255, 255, 0.06) !important;
  }

  .ace-one_dark .ace_gutter-active-line {
    background: transparent !important;
  }

  .ace-one_dark .ace_cursor {
    color: #aeafad !important;
    width: 2px !important;
  }

  .ace-one_dark .ace_marker-layer .ace_selection {
    background: rgba(38, 79, 120, 0.6) !important;
  }

  .ace-one_dark .ace_marker-layer .ace_selected-word {
    border: 1px solid rgba(58, 61, 65, 0.6) !important;
  }

  .ace-one_dark .ace_indent-guide {
    background: linear-gradient(
      to bottom,
      transparent 0%,
      transparent 50%,
      rgba(255, 255, 255, 0.08) 50%,
      rgba(255, 255, 255, 0.08) 100%
    ) right repeat-y;
    background-size: 1px 4px;
  }

  .ace-one_dark .ace_fold {
    background: #3794ff !important;
  }
`;

const getAceMode = (path) => {
  if (!path) return "text";

  const fileName = path.split("/").pop().toLowerCase();

  if (fileName === "dockerfile") return "dockerfile";
  if (fileName === ".env" || fileName === ".env.local") return "sh";
  if (fileName === ".gitignore") return "text";

  const ext = fileName.includes(".") ? fileName.split(".").pop() : fileName;

  const map = {
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    py: "python",
    rb: "ruby",
    go: "golang",
    kt: "kotlin",
    java: "java",
    c: "c_cpp",
    cpp: "c_cpp",
    cc: "c_cpp",
    cxx: "c_cpp",
    h: "c_cpp",
    hpp: "c_cpp",
    php: "php",
    html: "html",
    htm: "html",
    xml: "xml",
    svg: "xml",
    css: "css",
    scss: "scss",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    md: "markdown",
    sql: "sql",
    sh: "sh",
    bash: "sh",
    zsh: "sh",
    txt: "text",
    ini: "text",
    cfg: "text",
    conf: "text",
    toml: "text",
  };

  return map[ext] || "text";
};

export default function CodeViewer({ path, content, loading, projectId, onCloseFile }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const editorRef = useRef(null);

  useEffect(() => {
    setEditContent(content || "");
    setOriginalContent(content || "");
    setIsEditing(false);
    setHasUnsavedChanges(false);
  }, [content]);

  const handleEditToggle = () => {
    if (isEditing) {
      if (hasUnsavedChanges && !confirm("You have unsaved changes. Discard them?")) {
        return;
      }
      setEditContent(originalContent);
      setHasUnsavedChanges(false);
      setIsEditing(false);
    } else {
      setEditContent(content || "");
      setOriginalContent(content || "");
      setHasUnsavedChanges(false);
      setIsEditing(true);
    }
  };

  const handleContentChange = (value) => {
    setEditContent(value);
    setHasUnsavedChanges(value !== originalContent);
  };

  const handleSave = async () => {
    const pid = projectId || window.location.pathname.split("/")[2];
    if (!pid) {
      toast.error("Project ID missing. Please refresh the page.");
      return;
    }

    setSaving(true);
    try {
      await updateFileContent(pid, path, editContent);
      setOriginalContent(editContent);
      setHasUnsavedChanges(false);
      toast.success("File saved");
    } catch (err) {
      toast.error(`Failed to save: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleUndo = () => {
    setEditContent(originalContent);
    setHasUnsavedChanges(false);
    toast("Changes undone", { icon: "↩️" });
  };

  const handleClose = () => {
    if (hasUnsavedChanges && !confirm("You have unsaved changes. Close anyway?")) {
      return;
    }
    if (onCloseFile) {
      onCloseFile();
    }
  };

  if (!path) {
    return (
      <div className="h-full flex items-center justify-center text-on-surface-variant/50 text-sm">
        <span className="material-symbols-outlined text-4xl mr-2">description</span>
        Select a file to view it
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex flex-col bg-surface/30 backdrop-blur-sm">
        <div className="border-b border-white/5 px-4 py-2 text-xs text-on-surface-variant truncate">
          {path}
        </div>
        <div className="flex-1 overflow-auto p-4 space-y-2">
          <SkeletonText className="h-4 w-full" />
          <SkeletonText className="h-4 w-5/6" />
          <SkeletonText className="h-4 w-3/4" />
          <SkeletonText className="h-4 w-full" />
        </div>
      </div>
    );
  }

  const mode = getAceMode(path);

  return (
    <div className="h-full flex flex-col bg-surface/30 backdrop-blur-sm">
      <style>{cleanStyles}</style>

      {/* ─── Header ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
        <span className="text-xs text-on-surface-variant font-mono truncate">
          {path}
        </span>
        <div className="flex items-center gap-2">
          {/* ─── Close Button ──────────────────────────────────────── */}
          <button
            onClick={handleClose}
            className="text-on-surface-variant hover:text-error transition-colors"
            title="Close file"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>

          {isEditing ? (
            <>
              <button
                onClick={handleUndo}
                className="flex items-center gap-1 text-xs text-on-surface-variant hover:text-primary transition-colors"
                title="Undo changes"
              >
                <span className="material-symbols-outlined text-sm">undo</span>
                <span className="hidden sm:inline">Undo</span>
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !hasUnsavedChanges}
                className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
                  saving || !hasUnsavedChanges
                    ? "bg-surface-container-high text-on-surface-variant/40 cursor-not-allowed"
                    : "bg-secondary text-on-secondary hover:shadow-[0_0_20px_rgba(78,223,145,0.3)]"
                }`}
              >
                <span className="material-symbols-outlined text-sm">save</span>
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                onClick={handleEditToggle}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border border-outline-variant text-on-surface-variant hover:text-primary hover:border-secondary transition-all font-medium"
              >
                <span className="material-symbols-outlined text-sm">visibility</span>
                <span className="hidden sm:inline">View</span>
              </button>
            </>
          ) : (
            <button
              onClick={handleEditToggle}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-surface-container-high text-on-surface-variant hover:text-primary hover:bg-surface-container-highest transition-all font-medium"
            >
              <span className="material-symbols-outlined text-sm">edit</span>
              <span className="hidden sm:inline">Edit</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── Editor ────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0">
        <AceEditor
          ref={editorRef}
          mode={mode}
          theme="one_dark"
          value={isEditing ? editContent : content || ""}
          onChange={handleContentChange}
          readOnly={!isEditing}
          width="100%"
          height="100%"
          name="code-viewer"
          editorProps={{
            $blockScrolling: true,
          }}
          setOptions={{
            showLineNumbers: true,
            showPrintMargin: false,
            tabSize: 2,
            fontSize: 14,
            fontFamily: "JetBrains Mono, Consolas, Monaco, 'Courier New', monospace",
            highlightActiveLine: true,
            highlightGutterLine: true,
            displayIndentGuides: true,
            scrollPastEnd: 0.3,
            useWorker: false,
            wrap: false,
          }}
          style={{
            background: "transparent",
            border: "none",
          }}
        />
      </div>
    </div>
  );
}