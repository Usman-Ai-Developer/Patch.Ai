"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function WorkspaceHeader({
  projectName,
  isRenaming,
  newName,
  setNewName,
  handleRename,
  setIsRenaming,
  handleDeleteProject,
  activePath,
  handleDownloadProject,
  handleDownloadCurrentFile,
  syncInputRef,
  handleSyncFile,
  syncing,
  syncingFiles,
  handleSyncFiles,
  showTerminal,
  setShowTerminal,
  chatCollapsed,
  setChatCollapsed,
  previewRunning,
  previewLoading,
  handlePreviewToggle,
  showBuilder,
  setShowBuilder,
}) {
  const router = useRouter();

  return (
    <header className="glass-header shadow-2xl flex-shrink-0 z-20">
      <div className="flex items-center justify-between h-auto min-h-16 py-2 px-4 sm:px-margin max-w-full flex-wrap gap-2">
        {/* ─── Left: Brand + Project Name ──────────────────────────── */}
        <div className="flex items-center gap-3 flex-shrink-0 min-w-0">
          <Link href="/dashboard" className="flex items-center gap-2 flex-shrink-0">
            <span className="font-headline-lg text-headline-lg font-extrabold tracking-tighter text-primary text-lg sm:text-2xl">
              Patch
            </span>
            <div className="w-2 h-2 rounded-full bg-secondary ai-pulse"></div>
          </Link>
          <div className="h-6 w-px bg-white/10 flex-shrink-0"></div>
          {isRenaming ? (
            <form onSubmit={handleRename} className="flex items-center gap-2 flex-1 min-w-0">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
                className="bg-surface-container-low border border-outline-variant rounded-lg px-2 py-1 text-sm text-on-surface outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all flex-1 min-w-0"
              />
              <button type="submit" className="text-secondary hover:underline text-sm font-medium whitespace-nowrap">
                Save
              </button>
              <button
                type="button"
                onClick={() => { setIsRenaming(false); setNewName(projectName); }}
                className="text-on-surface-variant hover:text-on-surface text-sm whitespace-nowrap"
              >
                Cancel
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-body-md text-body-md text-on-surface truncate max-w-[100px] sm:max-w-xs">
                {projectName}
              </span>
              <button
                onClick={() => setIsRenaming(true)}
                className="flex items-center gap-1 text-xs text-on-surface-variant hover:text-primary transition-colors whitespace-nowrap"
                title="Rename project"
              >
                <span className="material-symbols-outlined text-base">edit</span>
                <span className="text-xs">Rename</span>
              </button>
              <button
                onClick={handleDeleteProject}
                className="flex items-center gap-1 text-xs text-on-surface-variant hover:text-error transition-colors whitespace-nowrap"
                title="Delete project"
              >
                <span className="material-symbols-outlined text-base">delete</span>
                <span className="text-xs">Delete</span>
              </button>
            </div>
          )}
        </div>

        {/* ─── Right: Actions ────────────────────────────────────────── */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end flex-1">
          <button
            onClick={handleDownloadProject}
            className="flex items-center gap-1 text-xs px-2.5 sm:px-3 py-1.5 rounded-full border border-outline-variant text-on-surface-variant hover:text-primary hover:border-secondary transition-all font-medium whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            <span>Project</span>
          </button>

          {activePath && (
            <button
              onClick={handleDownloadCurrentFile}
              className="flex items-center gap-1 text-xs px-2.5 sm:px-3 py-1.5 rounded-full border border-outline-variant text-on-surface-variant hover:text-primary hover:border-secondary transition-all font-medium whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-sm">download</span>
              <span>File</span>
            </button>
          )}

          <input
            ref={syncInputRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={(e) => handleSyncFile(e.target.files[0])}
          />
          <button
            onClick={() => syncInputRef.current?.click()}
            disabled={syncing}
            className="flex items-center gap-1 text-xs px-2.5 sm:px-3 py-1.5 rounded-full bg-surface-container-high text-on-surface-variant hover:text-primary hover:bg-surface-container-highest transition-all font-medium disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-sm">cloud_upload</span>
            <span>{syncing ? "Syncing…" : "Sync ZIP"}</span>
          </button>

          <button
            onClick={handleSyncFiles}
            disabled={syncingFiles}
            className={`flex items-center gap-1 text-xs px-2.5 sm:px-3 py-1.5 rounded-full transition-all font-medium whitespace-nowrap ${
              syncingFiles
                ? "opacity-40 cursor-not-allowed"
                : "bg-surface-container-high text-on-surface-variant hover:text-primary hover:bg-surface-container-highest"
            }`}
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            <span>{syncingFiles ? "Refreshing…" : "Refresh"}</span>
          </button>

          <button
            onClick={() => setShowTerminal(!showTerminal)}
            className={`flex items-center gap-1 text-xs px-2.5 sm:px-3 py-1.5 rounded-full transition-all font-medium whitespace-nowrap ${
              showTerminal
                ? "bg-secondary/20 text-secondary"
                : "bg-surface-container-high text-on-surface-variant hover:text-primary hover:bg-surface-container-highest"
            }`}
          >
            <span className="material-symbols-outlined text-sm">terminal</span>
            <span>{showTerminal ? "Hide" : ""} Terminal</span>
          </button>

          <button
            onClick={() => setChatCollapsed(!chatCollapsed)}
            className={`flex items-center gap-1 text-xs px-2.5 sm:px-3 py-1.5 rounded-full transition-all font-medium whitespace-nowrap ${
              !chatCollapsed
                ? "bg-secondary/20 text-secondary"
                : "bg-surface-container-high text-on-surface-variant hover:text-primary hover:bg-surface-container-highest"
            }`}
          >
            <span className="material-symbols-outlined text-sm">chat</span>
            <span>{!chatCollapsed ? "Hide" : ""} Chat</span>
          </button>

          <button
            onClick={handlePreviewToggle}
            disabled={previewLoading}
            className={`flex items-center gap-1 text-xs px-2.5 sm:px-3 py-1.5 rounded-full transition-all font-medium whitespace-nowrap ${
              previewLoading
                ? "opacity-40 cursor-not-allowed"
                : previewRunning
                ? "bg-error-container/10 text-error hover:bg-error-container/20"
                : "bg-surface-container-high text-on-surface-variant hover:text-primary hover:bg-surface-container-highest"
            }`}
          >
            <span className="material-symbols-outlined text-sm">
              {previewRunning ? "stop" : "play_arrow"}
            </span>
            <span>{previewLoading ? "Loading…" : previewRunning ? "Stop" : "Preview"}</span>
          </button>

          <button
            onClick={() => setShowBuilder(!showBuilder)}
            className={`flex items-center gap-1 text-xs px-2.5 sm:px-3 py-1.5 rounded-full transition-all font-medium whitespace-nowrap ${
              showBuilder
                ? "bg-secondary/20 text-secondary"
                : "bg-surface-container-high text-on-surface-variant hover:text-primary hover:bg-surface-container-highest"
            }`}
          >
            <span className="material-symbols-outlined text-sm">dashboard</span>
            <span>{showBuilder ? "Hide" : ""} Builder</span>
          </button>
        </div>
      </div>
    </header>
  );
}