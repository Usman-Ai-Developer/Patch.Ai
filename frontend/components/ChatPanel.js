"use client";

import { useState, useRef, useEffect } from "react";
import DiffViewer from "./DiffViewer";
import { applyOperations, rejectOperations } from "../lib/api";
import toast from "react-hot-toast";

export default function ChatPanel({
  messages,
  onSend,
  busy,
  facts = [],
  scrollToIndex = null,
  projectId,
  onMessageStatusChange,
  onCollapse,
}) {
  const [input, setInput] = useState("");
  const [showFacts, setShowFacts] = useState(false);
  const [pendingMessageId, setPendingMessageId] = useState(null);
  const bottomRef = useRef(null);
  const messageRefs = useRef([]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    if (scrollToIndex === null) return;
    messageRefs.current[scrollToIndex]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [scrollToIndex]);

  useEffect(() => {
    const pending = messages.find((m) => m.status === "pending");
    setPendingMessageId(pending?.id || null);
  }, [messages]);

  function submit(e) {
    e.preventDefault();
    if (!input.trim() || busy) return;
    if (pendingMessageId) {
      toast.error("Please apply or reject pending changes first.");
      return;
    }
    onSend(input.trim());
    setInput("");
  }

  async function handleApply(messageId) {
    try {
      await applyOperations(projectId, messageId);
      toast.success("Changes applied");
      onMessageStatusChange?.();
    } catch (err) {
      toast.error(`Failed to apply: ${err.message}`);
    }
  }

  async function handleReject(messageId) {
    try {
      await rejectOperations(projectId, messageId);
      toast.success("Changes rejected");
      onMessageStatusChange?.();
    } catch (err) {
      toast.error(`Failed to reject: ${err.message}`);
    }
  }

  return (
    <div className="h-full flex flex-col bg-surface/50 backdrop-blur-sm">
      {/* ─── Header ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5 shrink-0">
        <span className="text-xs font-label-caps uppercase tracking-widest text-on-surface-variant">Chat</span>
        <button
          onClick={onCollapse}
          className="text-on-surface-variant hover:text-error transition-colors text-sm"
          title="Collapse chat panel"
        >
          <span className="material-symbols-outlined text-base">close</span>
        </button>
      </div>

      {/* ─── Facts toggle ──────────────────────────────────────────── */}
      {facts.length > 0 && (
        <div className="border-b border-white/5 px-4 py-1.5">
          <button
            onClick={() => setShowFacts((s) => !s)}
            className="flex items-center gap-1 text-[11px] text-on-surface-variant hover:text-secondary transition-colors font-medium"
          >
            <span className="material-symbols-outlined text-sm">{showFacts ? "expand_less" : "expand_more"}</span>
            {facts.length} remembered fact{facts.length === 1 ? "" : "s"}
          </button>
          {showFacts && (
            <ul className="mt-1 space-y-0.5">
              {facts.map((f, i) => (
                <li key={i} className="text-[11px] text-on-surface-variant/70 pl-3 border-l border-secondary/30">
                  {f}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ─── Messages area ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {messages.length === 0 && (
          <div className="text-on-surface-variant/60 text-sm italic">
            Describe what to add, remove, or fix. e.g. "add input validation to the signup form"
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} ref={(el) => (messageRefs.current[i] = el)}>
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`text-xs font-semibold ${
                  m.role === "user" ? "text-secondary" : "text-primary"
                }`}
              >
                {m.role === "user" ? "You" : "Patch"}
              </span>
              {m.status === "pending" && (
                <span className="text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">
                  ⏳ pending
                </span>
              )}
              {m.status === "applied" && (
                <span className="text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
                  ✅ applied
                </span>
              )}
              {m.status === "rejected" && (
                <span className="text-xs text-error bg-error-container/10 px-2 py-0.5 rounded-full">
                  ❌ rejected
                </span>
              )}
              {m.status === "failed" && (
                <span className="text-xs text-error bg-error-container/10 px-2 py-0.5 rounded-full">
                  ⚠️ failed
                </span>
              )}
            </div>

            <div className="text-sm text-on-surface whitespace-pre-wrap">
              {m.content}
            </div>

            {m.diffs && m.diffs.length > 0 && (
              <div className="mt-3 space-y-3">
                {m.diffs.map((diff, idx) => (
                  <DiffViewer
                    key={idx}
                    oldContent={diff.old}
                    newContent={diff.new}
                    path={m.file_ops?.[idx]?.path || `file-${idx}`}
                    error={diff.error}
                  />
                ))}
              </div>
            )}

            {m.status === "pending" && (
              <div className="mt-3 flex gap-3">
                <button
                  onClick={() => handleApply(m.id)}
                  className="px-4 py-1.5 bg-secondary text-on-secondary text-xs font-bold rounded-xl hover:shadow-[0_0_20px_rgba(78,223,145,0.3)] transition-all"
                >
                  Apply Changes
                </button>
                <button
                  onClick={() => handleReject(m.id)}
                  className="px-4 py-1.5 border border-error/30 text-error text-xs font-medium rounded-xl hover:bg-error/10 transition-all"
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        ))}

        {busy && (
          <div>
            <div className="text-xs font-semibold text-secondary mb-1">Patch</div>
            <div className="text-sm text-on-surface-variant/60 flex items-center gap-2">
              <span className="w-2 h-2 bg-secondary rounded-full animate-pulse"></span>
              thinking…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ─── Input form ───────────────────────────────────────────── */}
      <form onSubmit={submit} className="border-t border-white/5 p-3 flex gap-2 bg-surface-container-low/30">
        <input
          id="chat-input"
          name="message"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            pendingMessageId
              ? "Please apply or reject pending changes..."
              : "Describe a change…"
          }
          disabled={busy || !!pendingMessageId}
          className="flex-1 bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        />
        <button
          type="submit"
          disabled={busy || !!pendingMessageId}
          className="px-4 py-2 bg-secondary text-on-secondary text-sm font-bold rounded-xl hover:shadow-[0_0_30px_rgba(78,223,145,0.3)] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-sm">send</span>
          Send
        </button>
      </form>
    </div>
  );
}