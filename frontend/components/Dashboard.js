"use client";

import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { clearTokens } from "../lib/auth";
import { deleteProject, downloadProject } from "../lib/api";
import { SkeletonDashboard } from './Skeleton';

function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function Dashboard({ projects, onOpen, onNew, onProjectDeleted, loading }) {
  const router = useRouter();

  function logout() {
    clearTokens();
    window.location.href = "/";
  }

  async function handleDelete(id, e) {
    e.stopPropagation();
    if (!confirm("Delete this project and all its files? This cannot be undone.")) return;
    try {
      await deleteProject(id);
      toast.success("Project deleted");
      onProjectDeleted?.(id);
    } catch (err) {
      toast.error(`Failed to delete: ${err.message}`);
    }
  }

  function handleDownload(id, e) {
    e.stopPropagation();
    downloadProject(id);
  }

  if (loading) {
    return <SkeletonDashboard />;
  }

  return (
    <div className="min-h-screen px-6 py-10 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="patch/" className="h-8 w-auto" />
          <div className="text-2xl font-semibold tracking-tight">
            <span className="glow-text">patch/</span>
            <span className="blink-cursor"></span>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={logout}
            className="text-xs text-subtext hover:text-red-400 transition-colors"
          >
            logout
          </button>
          <button
            onClick={onNew}
            className="px-4 py-2 bg-gradient-brand text-white text-sm rounded-sm font-semibold hover:bg-gradient-brand-hover transition-all"
          >
            new project
          </button>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="text-subtext text-sm border border-line rounded-md p-8 text-center">
          no projects yet — upload a .zip to get started
        </div>
      ) : (
        <div className="space-y-2">
          {projects.map((p) => (
            <div
              key={p.id}
              onClick={() => onOpen(p.id)}
              className="border border-line rounded-md px-4 py-3 flex items-center justify-between cursor-pointer hover:border-brand-200 transition-colors group"
            >
              <div>
                <div className="text-sm text-text">{p.name}</div>
                <div className="text-xs text-subtext mt-0.5">
                  {p.file_count} file{p.file_count === 1 ? "" : "s"} · active {timeAgo(p.last_active_at)}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={(e) => handleDownload(p.id, e)}
                  className="text-subtext hover:text-brand-100 text-sm opacity-0 group-hover:opacity-100 transition-all"
                  title="Download project as ZIP"
                >
                  ⬇
                </button>
                <button
                  onClick={(e) => handleDelete(p.id, e)}
                  className="text-subtext hover:text-red-400 text-sm opacity-0 group-hover:opacity-100 transition-all"
                  title="Delete project"
                >
                  ✕
                </button>
                <div className="text-brand-100 text-sm font-medium">open →</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}