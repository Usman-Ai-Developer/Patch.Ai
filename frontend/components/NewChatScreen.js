"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { clearTokens } from "../lib/auth";

const ACCEPT =
  ".zip,.py,.js,.jsx,.ts,.tsx,.json,.html,.htm,.css,.scss,.md,.txt,.yml,.yaml,.toml,.sql,.sh,.xml,.ini,.cfg,.java,.c,.cpp,.h,.hpp,.go,.rs,.rb,.php,.vue,.env,.gitignore";

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export default function NewChatScreen({ onCreate, error, busy }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [projectName, setProjectName] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  function logout() {
    clearTokens();
    window.location.href = "/";
  }

  function addFiles(fileList) {
    const incoming = Array.from(fileList);
    setAttachments((prev) => [...prev, ...incoming]);
  }

  function removeAttachment(index) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  function autoGrow(e) {
    setMessage(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 240) + "px";
  }

  function handleSend() {
    if (busy) return;
    if (!message.trim() && attachments.length === 0) {
      toast.error("Please enter a message or attach files.");
      return;
    }

    const zipIndex = attachments.findIndex((f) => f.name.endsWith(".zip"));
    const zipFile = zipIndex >= 0 ? attachments[zipIndex] : null;
    const looseFiles = attachments.filter((_, i) => i !== zipIndex);

    onCreate({
      name: projectName.trim() || undefined,
      message: message.trim(),
      zipFile,
      looseFiles,
    });
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      {/* ─── Header with Logout ─── */}
      <div className="w-full max-w-xl flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="patch/" className="h-8 w-auto" />
          <span className="text-xl font-semibold glow-text">patch/</span>
        </div>
        <button
          onClick={logout}
          className="text-xs text-subtext hover:text-red-400 transition-colors"
        >
          logout
        </button>
      </div>

      <div className="text-center mb-6">
        <p className="text-subtext text-sm max-w-md">
          describe what you want, attach files if you've got them — a .zip, or just
          individual .py, .html, whatever files you're working with.
        </p>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        className={`w-full max-w-xl rounded-lg border bg-panel/80 backdrop-blur-sm transition-colors ${
          dragging ? "border-brand-200" : "border-line"
        }`}
      >
        <div className="px-4 pt-3">
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="Project name (optional)"
            className="w-full bg-ink border border-line rounded-sm px-3 py-1.5 text-sm text-text placeholder:text-subtext outline-none focus:border-brand-100 transition-colors"
          />
        </div>

        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-3 pt-3">
            {attachments.map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 bg-ink border border-line rounded-sm px-2 py-1 text-xs"
              >
                <span className="text-text truncate max-w-[140px]">{f.name}</span>
                <span className="text-subtext">{formatSize(f.size)}</span>
                <button onClick={() => removeAttachment(i)} className="text-subtext hover:text-red-400 ml-1">
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={message}
          onChange={autoGrow}
          onKeyDown={handleKeyDown}
          placeholder="message patch/ — describe a change, or just attach files to get started…"
          rows={1}
          disabled={busy}
          className="w-full bg-transparent px-4 py-3 text-sm text-text placeholder:text-subtext outline-none resize-none"
        />

        <div className="flex items-center justify-between px-3 pb-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="text-subtext hover:text-brand-100 text-sm px-2 py-1 flex items-center gap-1"
            title="attach files or a .zip"
          >
            📎 <span className="text-xs">attach</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
          />
          <button
            onClick={handleSend}
            disabled={busy || (!message.trim() && attachments.length === 0)}
            className="px-4 py-1.5 bg-gradient-brand text-white text-sm rounded-sm font-semibold hover:bg-gradient-brand-hover transition-all disabled:opacity-40"
          >
            {busy ? "starting…" : "send →"}
          </button>
        </div>
      </div>

      {error && <div className="mt-4 text-sm text-red-400 max-w-xl text-center">{error}</div>}
    </div>
  );
}