"use client";

import { useState } from "react";
import * as Diff from "diff";

export default function DiffViewer({ oldContent, newContent, path, error }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (error) {
    return (
      <div className="border border-error/50 rounded-xl p-3 bg-error-container/10 backdrop-blur-sm">
        <div className="flex items-start gap-2">
          <span className="material-symbols-outlined text-error text-lg">warning</span>
          <div>
            <div className="text-xs font-semibold text-error">Cannot apply this change</div>
            <div className="text-xs text-error/80 mt-0.5 font-mono">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  if (!oldContent && !newContent) return null;

  const isCreate = !oldContent && newContent;
  const isDelete = oldContent && !newContent;
  const isSame = oldContent === newContent;

  if (isSame) {
    return <div className="text-xs text-on-surface-variant/50 italic">No changes</div>;
  }

  const diff = Diff.diffLines(oldContent || "", newContent || "");

  let added = 0,
    removed = 0;
  diff.forEach((part) => {
    if (part.added) added += part.count || 0;
    if (part.removed) removed += part.count || 0;
  });

  const summary = isCreate
    ? `Create (${added} lines)`
    : isDelete
    ? `Delete (${removed} lines)`
    : `Edit (+${added}/-${removed})`;

  function renderDiffLines() {
    const lines = [];
    let oldLineNum = 1,
      newLineNum = 1;

    diff.forEach((part, partIndex) => {
      const value = part.value;
      const linesArr = value.split("\n");
      if (linesArr[linesArr.length - 1] === "") {
        linesArr.pop();
      }

      if (part.removed) {
        linesArr.forEach((line, i) => {
          const key = `rem-${partIndex}-${i}`;
          lines.push(
            <div key={key} className="flex font-mono text-sm hover:bg-surface-container/30">
              <div className="w-10 text-center text-on-surface-variant select-none bg-surface-container/30 py-0.5">
                {oldLineNum++}
              </div>
              <div className="flex-1 px-2 py-0.5 bg-error-container/30 text-error whitespace-pre overflow-x-auto">
                {line}
              </div>
              <div className="w-10 text-center text-on-surface-variant select-none bg-surface-container/30 py-0.5"></div>
              <div className="flex-1 px-2 py-0.5 bg-surface/10 text-on-surface-variant/30 whitespace-pre overflow-x-auto"></div>
            </div>
          );
        });
      } else if (part.added) {
        linesArr.forEach((line, i) => {
          const key = `add-${partIndex}-${i}`;
          lines.push(
            <div key={key} className="flex font-mono text-sm hover:bg-surface-container/30">
              <div className="w-10 text-center text-on-surface-variant select-none bg-surface-container/30 py-0.5"></div>
              <div className="flex-1 px-2 py-0.5 bg-surface/10 text-on-surface-variant/30 whitespace-pre overflow-x-auto"></div>
              <div className="w-10 text-center text-on-surface-variant select-none bg-surface-container/30 py-0.5">
                {newLineNum++}
              </div>
              <div className="flex-1 px-2 py-0.5 bg-secondary/20 text-secondary whitespace-pre overflow-x-auto">
                {line}
              </div>
            </div>
          );
        });
      } else {
        linesArr.forEach((line, i) => {
          const key = `same-${partIndex}-${i}`;
          lines.push(
            <div key={key} className="flex font-mono text-sm hover:bg-surface-container/30">
              <div className="w-10 text-center text-on-surface-variant select-none bg-surface-container/30 py-0.5">
                {oldLineNum++}
              </div>
              <div className="flex-1 px-2 py-0.5 text-on-surface whitespace-pre overflow-x-auto">
                {line}
              </div>
              <div className="w-10 text-center text-on-surface-variant select-none bg-surface-container/30 py-0.5">
                {newLineNum++}
              </div>
              <div className="flex-1 px-2 py-0.5 text-on-surface whitespace-pre overflow-x-auto">
                {line}
              </div>
            </div>
          );
        });
      }
    });

    return lines;
  }

  function renderCompactPreview() {
    const oldPreview = oldContent
      ? oldContent.split("\n").slice(0, 4).join("\n")
      : "(empty)";
    const newPreview = newContent
      ? newContent.split("\n").slice(0, 4).join("\n")
      : "(empty)";

    return (
      <div className="grid grid-cols-2 gap-1 p-2 text-xs text-on-surface/60 max-h-20 overflow-hidden">
        <div className="truncate whitespace-pre-wrap">{oldPreview}</div>
        <div className="truncate whitespace-pre-wrap">{newPreview}</div>
      </div>
    );
  }

  return (
    <>
      {/* ─── Compact Preview ──────────────────────────────────────────── */}
      <div
        className="glass-card rounded-xl overflow-hidden cursor-pointer hover:border-secondary/40 transition-all"
        onClick={() => setIsModalOpen(true)}
      >
        <div className="flex items-center justify-between px-3 py-1.5 text-xs text-on-surface-variant border-b border-white/5">
          <span className="truncate font-mono">{path}</span>
          <span className="flex items-center gap-1">
            {isCreate && <span className="material-symbols-outlined text-sm text-secondary">add</span>}
            {isDelete && <span className="material-symbols-outlined text-sm text-error">remove</span>}
            {!isCreate && !isDelete && <span className="material-symbols-outlined text-sm text-secondary">edit</span>}
            {summary}
          </span>
        </div>
        {renderCompactPreview()}
      </div>

      {/* ─── Modal ────────────────────────────────────────────────────── */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="glass-card rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 shrink-0">
              <span className="text-sm font-semibold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-base">diff</span>
                Diff: {path}
              </span>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-on-surface-variant hover:text-error transition-colors"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            {/* Diff content */}
            <div className="flex-1 overflow-auto p-2 bg-surface/20">
              <div className="bg-surface/40 rounded-xl overflow-auto border border-white/5">
                {/* Column headers */}
                <div className="flex font-mono text-xs text-on-surface-variant bg-surface-container/60 border-b border-white/5 sticky top-0 z-10">
                  <div className="w-10 text-center py-1">Old</div>
                  <div className="flex-1 px-2 py-1">Content</div>
                  <div className="w-10 text-center py-1">New</div>
                  <div className="flex-1 px-2 py-1">Content</div>
                </div>
                {renderDiffLines()}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-white/5 text-xs text-on-surface-variant shrink-0">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">info</span>
                {summary}
              </span>
              <span>Click outside or ✕ to close</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}