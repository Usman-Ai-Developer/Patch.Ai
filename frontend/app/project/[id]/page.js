"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import WorkspaceHeader from "../../../components/WorkspaceHeader";
import WorkspacePanels from "../../../components/WorkspacePanels";
import TerminalPanel from "../../../components/TerminalPanel";
import BuilderPanel from "../../../components/BuilderPanel";
import { SkeletonWorkspace } from "../../../components/Skeleton";
import { isAuthenticated } from "../../../lib/auth";
import { useConfirm } from "../../../hooks/useConfirm";
import {
  getProject,
  listProjects,
  getFileTree,
  getFileContent,
  getChatHistory,
  sendChatMessage,
  syncProject,
  updateProject,
  downloadProject,
  downloadFile,
  deleteProject,
  startPreview,
  getPreviewStatus,
  stopPreview,
  refreshFileTree,
  getBlueprint,
  updateBlueprint,
} from "../../../lib/api";

export default function ProjectWorkspace() {
  const { id: projectId } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { confirm, ConfirmDialog } = useConfirm();

  // ---------- State ----------
  const [loading, setLoading] = useState(true);
  const [projectName, setProjectName] = useState("");
  const [files, setFiles] = useState([]);
  const [activePath, setActivePath] = useState(null);
  const [fileContent, setFileContent] = useState("");
  const [fileLoading, setFileLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [facts, setFacts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [recentPaths, setRecentPaths] = useState(new Set());
  const [syncing, setSyncing] = useState(false);
  const syncInputRef = useRef(null);

  // ─── Collapsed by default ──────────────────────────────────────────
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [chatCollapsed, setChatCollapsed] = useState(true);

  const [projects, setProjects] = useState([]);
  const [scrollToIndex, setScrollToIndex] = useState(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [showTerminal, setShowTerminal] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [syncingFiles, setSyncingFiles] = useState(false);
  const [previewRunning, setPreviewRunning] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);

  // ---------- Auth & Data Loading ----------
  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login");
      return;
    }
    if (!projectId) return;
    (async () => {
      setLoading(true);
      try {
        const [project, tree, history, allProjects] = await Promise.all([
          getProject(projectId),
          getFileTree(projectId),
          getChatHistory(projectId),
          listProjects(),
        ]);
        setProjectName(project.name);
        setNewName(project.name);
        setFiles(tree);
        setMessages(history.messages);
        setFacts(history.facts || []);
        setProjects(allProjects.filter((p) => p.id !== projectId));
        setActivePath(null);
        setFileContent("");

        if (searchParams.get('openBuilder') === 'true') {
          setShowBuilder(true);
          router.replace(`/project/${projectId}`);
        }
      } catch (e) {
        toast.error("Failed to load workspace");
        router.push("/dashboard");
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId, router, searchParams]);

  // ---------- Refresh workspace ----------
  const refreshWorkspace = useCallback(async () => {
    try {
      const [tree, history] = await Promise.all([
        getFileTree(projectId),
        getChatHistory(projectId),
      ]);
      setFiles(tree);
      setMessages(history.messages);
      setFacts(history.facts || []);
    } catch (e) {
      toast.error("Failed to refresh workspace");
    }
  }, [projectId]);

  // ---------- File selection ----------
  const selectFile = useCallback(
    async (path) => {
      setActivePath(path);
      setFileLoading(true);
      try {
        const res = await getFileContent(projectId, path);
        setFileContent(res.content);
      } catch (e) {
        toast.error(`Could not load file: ${e.message}`);
        setFileContent(`// could not load file: ${e.message}`);
      } finally {
        setFileLoading(false);
      }
    },
    [projectId]
  );

  // ---------- Close file ----------
  const closeFile = useCallback(() => {
    setActivePath(null);
    setFileContent("");
  }, []);

  // ---------- Chat ----------
  async function handleSend(text) {
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setBusy(true);
    try {
      const res = await sendChatMessage(projectId, text);

      const assistantMessage = {
        ...res.message,
        diffs: res.diffs || [],
        pending_ops: res.pending_ops || [],
        status: res.message.status || "pending",
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (res.files) setFiles(res.files);

      const touched = new Set((res.message.file_ops || []).map((o) => o.path));
      setRecentPaths(touched);
      if (activePath && touched.has(activePath)) selectFile(activePath);

      const history = await getChatHistory(projectId);
      setFacts(history.facts || []);

      toast.success("Response received – review changes");
    } catch (e) {
      toast.error(`Chat error: ${e.message}`);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${e.message}`, file_ops: [], status: "failed" },
      ]);
    } finally {
      setBusy(false);
    }
  }

  // ---------- Sync .zip ----------
  async function handleSyncFile(file) {
    if (!file || !file.name.endsWith(".zip")) {
      toast.error("Please choose a .zip to sync.");
      return;
    }
    setSyncing(true);
    try {
      const res = await syncProject(projectId, file);
      setFiles(res.files);
      toast.success("Sync successful");
    } catch (e) {
      toast.error(`Sync failed: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  }

  // ---------- Rename ----------
  async function handleRename(e) {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed || trimmed === projectName) {
      setIsRenaming(false);
      return;
    }
    try {
      // 1. Update the project name in the database
      const updated = await updateProject(projectId, trimmed);
      setProjectName(updated.name);

      // 2. Also update the blueprint's project_name to keep it in sync
      try {
        const blueprint = await getBlueprint(projectId);
        if (blueprint) {
          await updateBlueprint(projectId, {
            ...blueprint.data,
            project_name: trimmed,
          });
        }
      } catch (blueprintErr) {
        // Silently fail – blueprint may not exist yet
        console.debug("Blueprint not found or update failed:", blueprintErr);
      }

      setIsRenaming(false);
      toast.success("Project renamed");
    } catch (err) {
      toast.error(`Rename failed: ${err.message}`);
    }
  }

  // ---------- Download ----------
  async function handleDownloadProject() {
    try {
      await downloadProject(projectId, projectName);
      toast.success("Download started");
    } catch (e) {
      toast.error(e.message || "Failed to download project");
    }
  }

  async function handleDownloadCurrentFile() {
    if (!activePath) return;
    try {
      await downloadFile(projectId, activePath);
      toast.success("Download started");
    } catch (e) {
      toast.error(e.message || "Failed to download file");
    }
  }

  // ---------- Delete project ----------
  async function handleDeleteProject() {
    const confirmed = await confirm({
      title: `Delete "${projectName}"?`,
      message: "All files and data associated with this project will be permanently removed. This cannot be undone.",
      confirmText: "Delete Project",
      variant: "danger",
    });
    if (!confirmed) return;

    try {
      await deleteProject(projectId);
      toast.success("Project deleted");
      router.push("/dashboard");
    } catch (err) {
      toast.error(`Failed to delete project: ${err.message}`);
    }
  }

  // ---------- File deleted callback ----------
  function handleFileDeleted(deletedPath) {
    setFiles((prev) => prev.filter((f) => f.path !== deletedPath));
    if (activePath === deletedPath) {
      setActivePath(null);
      setFileContent("");
    }
  }

  // ---------- Preview Toggle ----------
  async function handlePreviewToggle() {
    if (previewRunning) {
      setPreviewLoading(true);
      try {
        await stopPreview(projectId);
        setPreviewRunning(false);
        toast.success("Preview stopped");
      } catch (e) {
        toast.error(e.message || "Failed to stop preview");
      } finally {
        setPreviewLoading(false);
      }
    } else {
      setPreviewLoading(true);
      try {
        const data = await startPreview(projectId);
        setPreviewRunning(true);
        const urls = (data.urls && data.urls.length ? data.urls : [data.url]).filter(Boolean);
        urls.forEach((url) => window.open(url, "_blank"));
        if (urls.length > 1) {
          toast.success(`Opened ${urls.length} servers in new tabs`);
        } else {
          toast.success("Preview opened in new tab");
        }
      } catch (e) {
        toast.error(e.message || "Failed to start preview");
      } finally {
        setPreviewLoading(false);
      }
    }
  }

  // ---------- Sync Files (Refresh File Tree) ----------
  async function handleSyncFiles() {
    setSyncingFiles(true);
    try {
      const data = await refreshFileTree(projectId);
      setFiles(data);
      toast.success("File tree refreshed");
    } catch (e) {
      toast.error(e.message || "Failed to refresh file tree");
    } finally {
      setSyncingFiles(false);
    }
  }

  // ---------- User messages for sidebar ----------
  const userMessages = messages
    .map((m, index) => ({ ...m, index }))
    .filter((m) => m.role === "user");

  // ---------- Check preview status on mount ----------
  useEffect(() => {
    if (!projectId) return;
    getPreviewStatus(projectId)
      .then((data) => setPreviewRunning(data.running))
      .catch(() => setPreviewRunning(false));
  }, [projectId]);

  // ---------- Loading ----------
  if (loading) {
    return <SkeletonWorkspace />;
  }

  // ---------- Render ----------
  return (
    <div className="landing-body text-on-surface selection:bg-primary-container selection:text-on-primary-container relative min-h-screen">
      {ConfirmDialog}

      {/* Background Elements */}
      <div className="grid-overlay"></div>
      <div className="atmospheric-glow top-0 -left-64"></div>
      <div className="atmospheric-glow bottom-0 -right-64"></div>
      <div className="curved-line w-[1000px] h-[1000px] -top-1/2 -left-1/4"></div>
      <div className="curved-line w-[800px] h-[800px] -bottom-1/4 -right-1/4"></div>

      <div className="h-screen flex flex-col relative z-10">
        <WorkspaceHeader
          projectName={projectName}
          isRenaming={isRenaming}
          newName={newName}
          setNewName={setNewName}
          handleRename={handleRename}
          setIsRenaming={setIsRenaming}
          handleDeleteProject={handleDeleteProject}
          activePath={activePath}
          handleDownloadProject={handleDownloadProject}
          handleDownloadCurrentFile={handleDownloadCurrentFile}
          syncInputRef={syncInputRef}
          handleSyncFile={handleSyncFile}
          syncing={syncing}
          syncingFiles={syncingFiles}
          handleSyncFiles={handleSyncFiles}
          showTerminal={showTerminal}
          setShowTerminal={setShowTerminal}
          chatCollapsed={chatCollapsed}
          setChatCollapsed={setChatCollapsed}
          previewRunning={previewRunning}
          previewLoading={previewLoading}
          handlePreviewToggle={handlePreviewToggle}
          showBuilder={showBuilder}
          setShowBuilder={setShowBuilder}
        />

        {/* Main workspace (three panels) */}
        <WorkspacePanels
          sidebarCollapsed={sidebarCollapsed}
          setSidebarCollapsed={setSidebarCollapsed}
          projects={projects}
          currentProjectId={projectId}
          onSelectProject={(id) => router.push(`/project/${id}`)}
          onNewProject={() => router.push("/dashboard")}
          userMessages={userMessages}
          onJumpToMessage={setScrollToIndex}
          files={files}
          onSelectFile={selectFile}
          activePath={activePath}
          recentPaths={recentPaths}
          projectId={projectId}
          onFileDeleted={handleFileDeleted}
          fileContent={fileContent}
          fileLoading={fileLoading}
          messages={messages}
          onSend={handleSend}
          busy={busy}
          facts={facts}
          scrollToIndex={scrollToIndex}
          onMessageStatusChange={refreshWorkspace}
          chatCollapsed={chatCollapsed}
          setChatCollapsed={setChatCollapsed}
          showTerminal={showTerminal}
          onCloseTerminal={() => setShowTerminal(false)}
          onCloseFile={closeFile}
        />

        {/* ─── Terminal panel ───────────────────────────────────────── */}
        {showTerminal && (
          <div className="border-t border-white/5 shrink-0 w-full">
            <TerminalPanel projectId={projectId} onClose={() => setShowTerminal(false)} />
          </div>
        )}

        {/* ─── Builder panel ──────────────────────────────────────────── */}
        {showBuilder && (
          <div className="h-[480px] border-t border-white/5 shrink-0 w-full">
            <BuilderPanel
              projectId={projectId}
              projectName={projectName} // <-- NEW: pass project name
              onClose={() => setShowBuilder(false)}
              onProjectStarted={handleSyncFiles}
              onRefreshWorkspace={handleSyncFiles}
              onSelectFile={selectFile}
            />
          </div>
        )}
      </div>
    </div>
  );
}