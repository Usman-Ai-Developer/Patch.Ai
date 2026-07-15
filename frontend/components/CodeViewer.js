"use client";

import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { SkeletonText } from "./Skeleton";

// Map file extensions to language for syntax highlighting
const getLanguage = (path) => {
  if (!path) return "text";
  const ext = path.split(".").pop().toLowerCase();
  const map = {
    js: "javascript",
    jsx: "jsx",
    ts: "typescript",
    tsx: "tsx",
    py: "python",
    rb: "ruby",
    go: "go",
    rs: "rust",
    java: "java",
    c: "c",
    cpp: "cpp",
    h: "c",
    hpp: "cpp",
    php: "php",
    html: "html",
    css: "css",
    scss: "scss",
    json: "json",
    yml: "yaml",
    yaml: "yaml",
    toml: "toml",
    md: "markdown",
    sql: "sql",
    sh: "bash",
    xml: "xml",
    env: "bash",
    gitignore: "text",
    txt: "text",
    ini: "ini",
    cfg: "ini",
  };
  return map[ext] || "text";
};

export default function CodeViewer({ path, content, loading }) {
  if (!path) {
    return (
      <div className="h-full flex items-center justify-center text-subtext text-sm">
        select a file to view it
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex flex-col">
        <div className="border-b border-line px-4 py-2 text-xs text-subtext truncate">
          {path}
        </div>
        <div className="flex-1 overflow-auto p-4 space-y-2">
          <SkeletonText className="h-4 w-full" />
          <SkeletonText className="h-4 w-5/6" />
          <SkeletonText className="h-4 w-3/4" />
          <SkeletonText className="h-4 w-full" />
          <SkeletonText className="h-4 w-2/3" />
        </div>
      </div>
    );
  }

  const language = getLanguage(path);

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-line px-4 py-2 text-xs text-subtext truncate">
        {path}
      </div>
      <div className="flex-1 overflow-auto p-4">
        <SyntaxHighlighter
          language={language}
          style={oneDark}
          customStyle={{
            background: "transparent",      // remove the default grey background
            padding: 0,
            fontSize: "13px",
            fontFamily: "JetBrains Mono, Menlo, monospace",
          }}
          codeTagProps={{
            style: {
              background: "transparent",    // also remove background from code tag
            },
          }}
          wrapLines
          wrapLongLines
        >
          {content}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}