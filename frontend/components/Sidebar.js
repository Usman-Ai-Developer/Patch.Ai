// frontend/components/Sidebar.js
"use client";

import { useState } from "react";

function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export default function Sidebar({
  collapsed,
  onToggle,
  projects,
  currentProjectId,
  onSelectProject,
  onNewProject,
  userMessages,
  onJumpToMessage,
}) {
  const [tab, setTab] = useState("projects");

  if (collapsed) {
    return (
      <div className="w-10 border-r border-white/5 bg-surface/20 backdrop-blur-sm flex flex-col items-center py-3 gap-4">
        <button
          onClick={onToggle}
          className="text-on-surface-variant hover:text-secondary transition-colors"
          title="Expand sidebar"
        >
          <span className="material-symbols-outlined text-sm">chevron_right</span>
        </button>
      </div>
    );
  }

  return (
    <div className="w-60 border-r border-white/5 bg-surface/20 backdrop-blur-sm flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <div className="flex gap-3 text-xs font-label-caps uppercase tracking-widest">
          <button
            onClick={() => setTab("projects")}
            className={`transition-colors ${
              tab === "projects"
                ? "text-secondary font-semibold"
                : "text-on-surface-variant hover:text-primary"
            }`}
          >
            Projects
          </button>
          <button
            onClick={() => setTab("history")}
            className={`transition-colors ${
              tab === "history"
                ? "text-secondary font-semibold"
                : "text-on-surface-variant hover:text-primary"
            }`}
          >
            History
          </button>
        </div>
        <button
          onClick={onToggle}
          className="text-on-surface-variant hover:text-secondary transition-colors"
          title="Collapse sidebar"
        >
          <span className="material-symbols-outlined text-sm">chevron_left</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto py-2">
        {tab === "projects" && (
          <div>
            <button
              onClick={onNewProject}
              className="w-full text-left px-3 py-1.5 text-xs font-medium text-secondary hover:bg-secondary/10 transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              New Project
            </button>
            {projects.length === 0 && (
              <div className="px-3 py-2 text-xs text-on-surface-variant/50">No other projects yet</div>
            )}
            {projects.map((p) => (
              <div
                key={p.id}
                onClick={() => onSelectProject(p.id)}
                className={`px-3 py-1.5 text-xs cursor-pointer truncate flex items-center justify-between transition-colors rounded-lg mx-1 ${
                  p.id === currentProjectId
                    ? "bg-secondary/10 text-secondary font-medium"
                    : "text-on-surface hover:bg-surface-container/50"
                }`}
                title={p.name}
              >
                <span className="truncate">{p.name}</span>
                <span className="text-on-surface-variant/50 ml-2 shrink-0 text-[10px]">
                  {timeAgo(p.last_active_at)}
                </span>
              </div>
            ))}
          </div>
        )}

        {tab === "history" && (
          <div>
            {userMessages.length === 0 && (
              <div className="px-3 py-2 text-xs text-on-surface-variant/50">No messages yet in this project</div>
            )}
            {userMessages.map((m, i) => (
              <div
                key={i}
                onClick={() => onJumpToMessage(m.index)}
                className="px-3 py-1.5 text-xs text-on-surface hover:bg-surface-container/50 cursor-pointer truncate transition-colors rounded-lg mx-1"
                title={m.content}
              >
                {m.content}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}