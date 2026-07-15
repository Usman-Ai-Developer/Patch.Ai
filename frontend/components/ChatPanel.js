"use client";

import { useState, useRef, useEffect } from "react";

export default function ChatPanel({ messages, onSend, busy, facts = [], scrollToIndex = null }) {
  const [input, setInput] = useState("");
  const [showFacts, setShowFacts] = useState(false);
  const bottomRef = useRef(null);
  const messageRefs = useRef([]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    if (scrollToIndex === null) return;
    messageRefs.current[scrollToIndex]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [scrollToIndex]);

  function submit(e) {
    e.preventDefault();
    if (!input.trim() || busy) return;
    onSend(input.trim());
    setInput("");
  }

  return (
    <div className="h-full flex flex-col">
      {facts.length > 0 && (
        <div className="border-b border-line px-4 py-1.5">
          <button
            onClick={() => setShowFacts((s) => !s)}
            className="text-[11px] text-subtext hover:text-brand-100 transition-colors"
          >
            {showFacts ? "▾" : "▸"} {facts.length} remembered fact{facts.length === 1 ? "" : "s"}
          </button>
          {showFacts && (
            <ul className="mt-1 space-y-0.5">
              {facts.map((f, i) => (
                <li key={i} className="text-[11px] text-subtext pl-3">· {f}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {messages.length === 0 && (
          <div className="text-subtext text-sm">
            describe what to add, remove, or fix. e.g. "add input validation to the
            signup form" or "remove the unused Logger class"
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} ref={(el) => (messageRefs.current[i] = el)}>
            <div className={`text-xs mb-1 ${m.role === "user" ? "text-brand-100" : "text-mint"}`}>
              {m.role === "user" ? "you" : "patch/"}
            </div>
            <div className="text-sm text-text whitespace-pre-wrap">{m.content}</div>
            {m.file_ops && m.file_ops.length > 0 && (
              <div className="mt-2 space-y-1">
                {m.file_ops.map((op, j) => (
                  <div key={j} className="text-xs flex items-center gap-2">
                    <span
                      className={`px-1.5 py-0.5 rounded-sm text-[10px] uppercase ${
                        op.op === "delete"
                          ? "bg-red-900/40 text-red-300"
                          : op.op === "create"
                          ? "bg-mint/20 text-mint"
                          : "bg-brand-100/20 text-brand-100"
                      }`}
                    >
                      {op.op}
                    </span>
                    <span className="text-subtext truncate">{op.path}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div>
            <div className="text-xs mb-1 text-mint">patch/</div>
            <div className="text-sm text-subtext blink-cursor">thinking</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={submit} className="border-t border-line p-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="describe a change…"
          disabled={busy}
          className="flex-1 bg-panel border border-line rounded-sm px-3 py-2 text-sm text-text placeholder:text-subtext outline-none focus:border-brand-100 transition-colors"
        />
        <button
          type="submit"
          disabled={busy}
          className="px-4 py-2 bg-gradient-brand text-white text-sm rounded-sm font-semibold hover:bg-gradient-brand-hover transition-all disabled:opacity-40"
        >
          run
        </button>
      </form>
    </div>
  );
}