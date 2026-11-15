"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { listProjects, deleteProject, downloadProject } from "../../lib/api";
import { getAccessToken, clearTokens } from "../../lib/auth";
import UploadScreen from "../../components/UploadScreen";
import { useConfirm } from "../../hooks/useConfirm";

export default function Dashboard() {
  const router = useRouter();
  const { confirm, ConfirmDialog } = useConfirm();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    if (!getAccessToken()) {
      router.push("/login");
      return;
    }
    fetchProjects();
  }, []);

  async function fetchProjects() {
    setLoading(true);
    try {
      const data = await listProjects();
      setProjects(data);
    } catch (err) {
      toast.error("Failed to load projects");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteProject(id, name) {
    const confirmed = await confirm({
      title: `Delete "${name}"?`,
      message: "All files and data associated with this project will be permanently removed. This cannot be undone.",
      confirmText: "Delete Project",
      variant: "danger",
    });
    if (!confirmed) return;

    setDeletingId(id);
    try {
      await deleteProject(id);
      toast.success(`"${name}" deleted`);
      setProjects(projects.filter(p => p.id !== id));
    } catch (err) {
      toast.error(err.message || "Failed to delete project");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleDownloadProject(id, name) {
    try {
      await downloadProject(id, name);
      toast.success("Download started");
    } catch (err) {
      toast.error(err.message || "Failed to download project");
    }
  }

  function openProject(id) {
    router.push(`/project/${id}`);
  }

  async function handleLogout() {
    const confirmed = await confirm({
      title: "Log out?",
      message: "You will be redirected to the home page.",
      confirmText: "Log out",
      variant: "info",
    });
    if (!confirmed) return;

    clearTokens();
    router.push("/");
    toast.success("Logged out");
  }

  // ─── Loading ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="landing-body text-on-surface min-h-screen flex items-center justify-center">
        <div className="glass-card rounded-[28px] p-lg flex items-center gap-3">
          <span className="w-5 h-5 border-2 border-secondary/30 border-t-secondary rounded-full animate-spin"></span>
          <span className="text-on-surface-variant font-body-md">Loading your projects…</span>
        </div>
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <div className="landing-body text-on-surface selection:bg-primary-container selection:text-on-primary-container relative min-h-screen">
      {ConfirmDialog}

      {/* Background Elements */}
      <div className="grid-overlay"></div>
      <div className="atmospheric-glow top-0 -left-64"></div>
      <div className="atmospheric-glow bottom-0 -right-64"></div>
      <div className="curved-line w-[1000px] h-[1000px] -top-1/2 -left-1/4"></div>
      <div className="curved-line w-[800px] h-[800px] -bottom-1/4 -right-1/4"></div>

      {/* ─── Header ────────────────────────────────────────────────── */}
      <header className="fixed top-0 w-full z-50 glass-header shadow-2xl">
        <div className="flex items-center justify-between h-20 px-margin max-w-7xl mx-auto">
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link href="/dashboard" className="font-headline-lg text-headline-lg font-extrabold tracking-tighter text-primary">
              Patch
            </Link>
            <div className="w-2 h-2 rounded-full bg-secondary ai-pulse"></div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              onClick={() => setShowUploadModal(true)}
              className="bg-secondary text-on-secondary font-body-md text-body-md font-bold px-lg py-sm rounded-full active:scale-95 transition-all hover:shadow-[0_0_30px_rgba(78,223,145,0.3)] flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-base">add</span>
              New Project
            </button>
            <button
              onClick={handleLogout}
              className="text-on-surface-variant hover:text-error transition-colors font-body-md text-body-md active:scale-95 px-md py-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 pt-32 pb-3xl px-md lg:px-0">
        <div className="max-w-[1400px] mx-auto glass-card rounded-[36px] p-md lg:p-[80px]">
          {/* ─── Dashboard Header ────────────────────────────────── */}
          <div className="flex items-center justify-between mb-lg">
            <div>
              <h1 className="font-display-sm text-display-sm">Your Projects</h1>
              <p className="font-body-md text-body-md text-on-surface-variant">
                {projects.length} project{projects.length !== 1 ? 's' : ''} in your workspace
              </p>
            </div>
          </div>

          {/* ─── Projects Grid ────────────────────────────────────── */}
          {projects.length === 0 ? (
            <EmptyState onNewProject={() => setShowUploadModal(true)} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-lg">
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onOpen={openProject}
                  onDelete={handleDeleteProject}
                  onDownload={handleDownloadProject}
                  deletingId={deletingId}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ─── New Project Modal ────────────────────────────────────── */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card rounded-[28px] max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-lg border-b border-white/5">
              <h3 className="font-headline-lg text-headline-lg">Create or Upload a Project</h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-on-surface-variant hover:text-error transition-colors text-xl"
              >
                ✕
              </button>
            </div>
            <div className="p-lg">
              <UploadScreen
                onSuccess={(project) => {
                  setShowUploadModal(false);
                  toast.success(`Project "${project.name}" created!`);
                  router.push(`/project/${project.id}?openBuilder=true`);
                }}
                onCancel={() => setShowUploadModal(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Empty State ───────────────────────────────────────────────────
function EmptyState({ onNewProject }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="text-6xl mb-6">🚀</div>
      <h2 className="font-display-sm text-display-sm mb-sm">No projects yet</h2>
      <p className="font-body-md text-body-md text-on-surface-variant max-w-md">
        Start by creating your first project. You can upload an existing project or let the AI generate one for you.
      </p>
      <button
        onClick={onNewProject}
        className="mt-lg bg-secondary text-on-secondary font-bold px-3xl py-md rounded-xl hover:shadow-[0_0_30px_rgba(78,223,145,0.3)] transition-all inline-flex items-center gap-2"
      >
        <span className="material-symbols-outlined text-base">add</span>
        Create your first project
      </button>
    </div>
  );
}

// ─── Project Card ──────────────────────────────────────────────────
function ProjectCard({ project, onOpen, onDelete, onDownload, deletingId }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="feature-card rounded-[28px] p-lg flex flex-col group relative overflow-hidden cursor-pointer"
      onClick={() => onOpen(project.id)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Glow overlay */}
      <div
        className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${
          isHovered ? "opacity-100" : "opacity-0"
        }`}
        style={{
          background: `radial-gradient(circle at 50% 0%, rgba(78, 223, 145, 0.1) 0%, transparent 70%)`,
        }}
      />

      <div className="flex items-start justify-between mb-sm relative z-10">
        <h3 className="font-headline-lg text-headline-lg-mobile lg:text-headline-lg text-text truncate">
          {project.name}
        </h3>
        <span className="text-xs text-on-surface-variant/40 font-mono flex-shrink-0">
          {new Date(project.created_at).toLocaleDateString()}
        </span>
      </div>

      <div className="flex items-center gap-2 mt-auto pt-md border-t border-white/5 relative z-10">
        <button
          onClick={(e) => { e.stopPropagation(); onDownload(project.id, project.name); }}
          className="text-xs px-3 py-1.5 bg-surface-container-high text-on-surface-variant rounded-full hover:bg-surface-container-highest transition-colors font-medium"
        >
          Download
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(project.id, project.name); }}
          disabled={deletingId === project.id}
          className="text-xs px-3 py-1.5 bg-error-container/10 text-error rounded-full hover:bg-error-container/20 transition-colors font-medium disabled:opacity-40 ml-auto"
        >
          {deletingId === project.id ? '…' : 'Delete'}
        </button>
      </div>
    </div>
  );
}