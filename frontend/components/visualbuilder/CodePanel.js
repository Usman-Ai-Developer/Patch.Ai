// frontend/components/visualbuilder/CodePanel.js
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { renderPageCode } from "../../lib/api";

const DEBOUNCE_MS = 400;

function ActionButton({
  children,
  icon,
  title,
  onClick,
  disabled = false,
  primary = false,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        primary
          ? "border-secondary/30 bg-secondary/15 text-secondary hover:bg-secondary/25"
          : "border-white/5 bg-white/5 text-on-surface-variant hover:bg-white/10 hover:text-on-surface"
      }`}
    >
      <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
        {icon}
      </span>
      {children}
    </button>
  );
}

/**
 * Live preview of the JSX that the visual layout compiles to.
 *
 * The panel asks the backend renderer for the same file "Generate" would
 * write, so the user can inspect it without touching the canvas. It never
 * mutates the tree and it never writes files — only "Save & Generate" (when
 * the parent wires `onGenerate`) persists and generates.
 */
export default function CodePanel({
  projectId,
  tree,
  componentName,
  onClose,
  onGenerate,
  isOpen = false,
  asComponent = false,
}) {
  const [code, setCode] = useState("");
  const [hash, setHash] = useState("");
  const [file, setFile] = useState("");
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);

  // Monotonic request id: only the newest request may touch state.
  const requestRef = useRef(0);
  const debounceRef = useRef(null);

  const pageName = componentName || "MyPage";
  const defaultPath = asComponent
    ? `src/components/visual/${pageName}.jsx`
    : `src/pages/${pageName}.jsx`;

  // Switching page/project must not keep showing the previous page's file
  // while the new request is still in flight. (Same-page tree edits keep the
  // old code visible while it regenerates, which is much less jarring.)
  useEffect(() => {
    setCode("");
    setHash("");
    setFile("");
    setError("");
  }, [projectId, componentName, asComponent]);

  const generate = useCallback(async () => {
    if (!projectId || !tree) return;

    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setGenerating(true);
    setError("");

    try {
      const result = await renderPageCode(projectId, tree, componentName || "MyPage", asComponent);
      // A newer request (or a close) superseded this one: drop the response.
      if (requestRef.current !== requestId) return;
      if (typeof result?.code !== "string" || !result.code) {
        setCode("");
        setHash("");
        setFile("");
        setError("The render endpoint returned no code for this layout.");
        return;
      }
      setCode(result.code);
      setHash(typeof result?.hash === "string" ? result.hash : "");
      setFile(typeof result?.file === "string" ? result.file : "");
    } catch (err) {
      if (requestRef.current !== requestId) return;
      setError(
        err?.message || "Could not render the code. The render endpoint may be unavailable."
      );
    } finally {
      if (requestRef.current === requestId) setGenerating(false);
    }
  }, [projectId, tree, componentName, asComponent]);

  // Debounced fetch: opening the panel and every subsequent tree edit both
  // go through the 400 ms timer, so dragging a widget does not fire a request
  // per mouse move.
  useEffect(() => {
    if (!isOpen) {
      // Invalidate in-flight work and drop the pending debounce on close.
      requestRef.current += 1;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      setGenerating(false);
      return undefined;
    }
    if (!projectId || !tree) {
      setGenerating(false);
      return undefined;
    }

    // Invalidate any response that belongs to a tree snapshot older than this
    // one before the debounce even starts, so a slow in-flight render can
    // never paint code for a layout that has already been superseded.
    requestRef.current += 1;

    // Show the subtle "generating…" state during the debounce window too.
    setGenerating(true);

    const timer = setTimeout(() => {
      debounceRef.current = null;
      generate();
    }, DEBOUNCE_MS);
    debounceRef.current = timer;

    return () => {
      clearTimeout(timer);
      if (debounceRef.current === timer) debounceRef.current = null;
    };
  }, [isOpen, projectId, tree, componentName, generate]);

  // Never apply a response after unmount.
  useEffect(
    () => () => {
      requestRef.current += 1;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    []
  );

  const displayCode = useMemo(() => code.replace(/\r\n?/g, "\n"), [code]);

  // One text node for the whole gutter instead of a DOM node per line —
  // a 4,000-line file stays a single <pre> of text.
  const { lineCount, gutter } = useMemo(() => {
    if (!displayCode) return { lineCount: 0, gutter: "" };
    const count = displayCode.split("\n").length;
    const numbers = new Array(count);
    for (let i = 0; i < count; i += 1) numbers[i] = i + 1;
    return { lineCount: count, gutter: numbers.join("\n") };
  }, [displayCode]);

  async function handleCopy() {
    if (!code) {
      toast.error("Nothing to copy yet — the code has not been generated.");
      return;
    }
    try {
      if (!navigator?.clipboard?.writeText) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(code);
      toast.success("Generated code copied to clipboard");
    } catch (err) {
      toast.error(
        err?.message ? `Copy failed: ${err.message}` : "Copy failed — clipboard access was blocked."
      );
    }
  }

  function handleDownload() {
    if (!code) {
      toast.error("Nothing to download yet — the code has not been generated.");
      return;
    }
    try {
      const filename = `${pageName.replace(/[^a-zA-Z0-9_$]/g, "") || "Page"}.jsx`;
      const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Give the browser a moment to start the download before revoking.
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      toast.success(`Downloaded ${filename}`);
    } catch {
      toast.error("Could not download the generated file.");
    }
  }

  function handleRegenerate() {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    generate();
  }

  function handleSaveAndGenerate() {
    if (typeof onGenerate !== "function") {
      toast.error("Save & Generate is not connected on this screen.");
      return;
    }
    try {
      const result = onGenerate();
      if (result && typeof result.then === "function") {
        result.catch((err) => toast.error(err?.message || "Failed to save and generate"));
      }
    } catch (err) {
      toast.error(err?.message || "Failed to save and generate");
    }
  }

  if (!isOpen) return null;

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-white/5 bg-surface/30 shadow-[0_0_40px_rgba(0,0,0,0.35)] backdrop-blur-xl">
      {/* ─── Header ────────────────────────────────────────────────── */}
      <div className="flex shrink-0 flex-col gap-2 border-b border-white/5 px-3 pb-2.5 pt-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="material-symbols-outlined shrink-0 text-[16px] text-secondary" aria-hidden="true">
              code
            </span>
            <h2 className="shrink-0 text-sm font-semibold text-on-surface">Generated code</h2>
            <span
              className="max-w-[120px] truncate rounded-full border border-secondary/20 bg-secondary/10 px-1.5 py-0.5 text-[10px] font-medium text-secondary"
              title={`Component: ${pageName}`}
            >
              {pageName}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onClose?.()}
            title="Close generated code"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-on-surface-variant/60 transition-colors hover:bg-white/5 hover:text-error"
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
              close
            </span>
            <span className="sr-only">Close</span>
          </button>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span
            className="truncate font-mono text-[10px] text-on-surface-variant/50"
            title={file || defaultPath}
          >
            {file || defaultPath}
          </span>
          <span className="flex shrink-0 items-center gap-2">
            {hash && (
              <span
                className="font-mono text-[10px] text-on-surface-variant/30"
                title={`Content hash ${hash}`}
              >
                {hash.slice(0, 8)}
              </span>
            )}
            {generating && (
              <span
                className="flex items-center gap-1 text-[10px] text-on-surface-variant/60"
                aria-live="polite"
              >
                <span className="material-symbols-outlined animate-spin text-[12px]" aria-hidden="true">
                  autorenew
                </span>
                generating…
              </span>
            )}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <ActionButton
            title="Copy the generated JSX to the clipboard"
            onClick={handleCopy}
            disabled={!code}
            icon="content_copy"
          >
            Copy
          </ActionButton>
          <ActionButton
            title={`Download ${pageName}.jsx`}
            onClick={handleDownload}
            disabled={!code}
            icon="download"
          >
            Download
          </ActionButton>
          <ActionButton
            title="Regenerate from the current layout immediately"
            onClick={handleRegenerate}
            disabled={!projectId || !tree}
            icon="refresh"
          >
            Regenerate
          </ActionButton>
          <ActionButton
            title={
              onGenerate
                ? "Save the layout to the blueprint and generate the real component"
                : "Not connected — pass onGenerate to enable"
            }
            onClick={handleSaveAndGenerate}
            disabled={!onGenerate}
            icon="rocket_launch"
            primary
          >
            {"Save & Generate"}
          </ActionButton>
        </div>
      </div>

      {/* ─── Body ──────────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 p-2">
        {error && (
          <div
            role="alert"
            className="flex shrink-0 items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-2.5 py-2"
          >
            <span className="material-symbols-outlined mt-px text-[14px] text-red-300" aria-hidden="true">
              error
            </span>
            <div className="min-w-0 flex-1">
              <p className="break-words text-[11px] leading-snug text-red-200/90">{error}</p>
              <p className="mt-0.5 text-[10px] text-red-200/50">
                Only this preview failed — the canvas and layout are unaffected.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={!projectId || !tree}
              title="Retry code generation"
              className="shrink-0 rounded-lg border border-red-400/20 bg-red-400/10 px-2 py-0.5 text-[11px] font-medium text-red-200 transition-colors hover:bg-red-400/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Retry
            </button>
          </div>
        )}

        <div
          role="region"
          aria-label="Generated code"
          aria-busy={generating}
          tabIndex={0}
          className="min-h-0 flex-1 overflow-auto rounded-xl border border-white/5 bg-black/25 outline-none focus-visible:ring-1 focus-visible:ring-secondary/40"
        >
          {displayCode ? (
            <div className="flex min-w-full w-max items-stretch">
              {/* Gutter: one text node, sticky while scrolling sideways. */}
              <div
                aria-hidden="true"
                className="sticky left-0 z-10 shrink-0 select-none whitespace-pre border-r border-white/5 bg-surface-container-low px-2 py-3 text-right font-mono text-[11px] leading-5 text-on-surface-variant/35"
              >
                {gutter}
              </div>
              {/* The whole file in a single <pre> — no node per line. */}
              <pre className="whitespace-pre px-3 py-3 font-mono text-[11px] leading-5 text-on-surface/90 selection:bg-secondary/20">
                {displayCode}
              </pre>
            </div>
          ) : (
            <div className="flex h-full min-h-[140px] flex-col items-center justify-center gap-2 px-6 text-center">
              <span
                className={`material-symbols-outlined text-2xl text-on-surface-variant/25 ${
                  generating ? "animate-spin" : ""
                }`}
                aria-hidden="true"
              >
                {generating ? "autorenew" : "code"}
              </span>
              <p className="text-[11px] leading-relaxed text-on-surface-variant/50">
                {generating
                  ? "Generating code from your layout…"
                  : error
                  ? "No code to show yet."
                  : !projectId || !tree
                  ? "Select a page with a layout to preview its generated code."
                  : "Preparing generated code…"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ─── Footer ────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-white/5 px-3 py-1.5 text-[10px] text-on-surface-variant/40">
        <span>{lineCount > 0 ? `${lineCount} line${lineCount === 1 ? "" : "s"}` : "No code yet"}</span>
        <span title="This preview is read-only; edit the layout on the canvas">Read-only preview</span>
      </div>
    </div>
  );
}
