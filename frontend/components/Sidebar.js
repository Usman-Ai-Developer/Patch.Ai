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
  const [tab, setTab] = useState("projects"); // "projects" | "history"

  if (collapsed) {
    return (
      <div className="w-10 border-r border-line flex flex-col items-center py-3 gap-4">
        <button onClick={onToggle} className="text-subtext hover:text-brand-100 text-sm transition-colors" title="expand sidebar">
          ▸
        </button>
      </div>
    );
  }

  return (
    <div className="w-60 border-r border-line flex flex-col min-h-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-line">
        <div className="flex gap-3 text-xs">
          <button
            onClick={() => setTab("projects")}
            className={tab === "projects" ? "text-brand-100" : "text-subtext hover:text-text transition-colors"}
          >
            projects
          </button>
          <button
            onClick={() => setTab("history")}
            className={tab === "history" ? "text-brand-100" : "text-subtext hover:text-text transition-colors"}
          >
            history
          </button>
        </div>
        <button onClick={onToggle} className="text-subtext hover:text-brand-100 text-sm transition-colors" title="collapse sidebar">
          ◂
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {tab === "projects" && (
          <div>
            <button
              onClick={onNewProject}
              className="w-full text-left px-3 py-1.5 text-xs text-brand-100 hover:bg-panel transition-colors"
            >
              + new project
            </button>
            {projects.map((p) => (
              <div
                key={p.id}
                onClick={() => onSelectProject(p.id)}
                className={`px-3 py-1.5 text-xs cursor-pointer truncate flex items-center justify-between transition-colors ${
                  p.id === currentProjectId ? "bg-line text-brand-100" : "text-text hover:bg-panel"
                }`}
                title={p.name}
              >
                <span className="truncate">{p.name}</span>
                <span className="text-subtext ml-2 shrink-0">{timeAgo(p.last_active_at)}</span>
              </div>
            ))}
            {projects.length === 0 && (
              <div className="px-3 py-2 text-xs text-subtext">no other projects yet</div>
            )}
          </div>
        )}

        {tab === "history" && (
          <div>
            {userMessages.length === 0 && (
              <div className="px-3 py-2 text-xs text-subtext">no messages yet in this project</div>
            )}
            {userMessages.map((m, i) => (
              <div
                key={i}
                onClick={() => onJumpToMessage(m.index)}
                className="px-3 py-1.5 text-xs text-text hover:bg-panel cursor-pointer truncate transition-colors"
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