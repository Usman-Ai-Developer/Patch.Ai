// frontend/app/project/[id]/page.js

"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Sidebar from "../../../components/Sidebar";
import FileTree from "../../../components/FileTree";
import CodeViewer from "../../../components/CodeViewer";
import ChatPanel from "../../../components/ChatPanel";
import { SkeletonWorkspace } from "../../../components/Skeleton";
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
} from "../../../lib/api";
import { isAuthenticated } from "../../../lib/auth";

export default function ProjectWorkspace() {
  const { id: projectId } = useParams();
  const router = useRouter();

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [projects, setProjects] = useState([]);
  const [scrollToIndex, setScrollToIndex] = useState(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState("");

  // ----- Auth & data loading -----
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
      } catch (e) {
        toast.error("Failed to load workspace");
        router.push("/");
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId, router]);

  // ----- File selection -----
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

  // ----- Chat -----
  async function handleSend(text) {
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setBusy(true);
    try {
      const res = await sendChatMessage(projectId, text);
      setMessages((prev) => [...prev, res.message]);
      setFiles(res.files);
      const touched = new Set((res.message.file_ops || []).map((o) => o.path));
      setRecentPaths(touched);
      if (activePath && touched.has(activePath)) selectFile(activePath);
      const history = await getChatHistory(projectId);
      setFacts(history.facts || []);
      toast.success("AI responded");
    } catch (e) {
      toast.error(`Chat error: ${e.message}`);
      setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${e.message}`, file_ops: [] }]);
    } finally {
      setBusy(false);
    }
  }

  // ----- Sync -----
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

  // ----- Rename -----
  async function handleRename(e) {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed || trimmed === projectName) {
      setIsRenaming(false);
      return;
    }
    try {
      const updated = await updateProject(projectId, trimmed);
      setProjectName(updated.name);
      setIsRenaming(false);
      toast.success("Project renamed");
    } catch (err) {
      toast.error(`Rename failed: ${err.message}`);
    }
  }

  // ----- Download -----
  function handleDownloadProject() {
    downloadProject(projectId);
    toast.success("Download started");
  }

  function handleDownloadCurrentFile() {
    if (!activePath) return;
    downloadFile(projectId, activePath);
    toast.success("Download started");
  }

  // ----- Delete project -----
  async function handleDeleteProject() {
    if (!confirm(`Delete "${projectName}" and all its files? This cannot be undone.`)) return;
    try {
      await deleteProject(projectId);
      toast.success("Project deleted");
      router.push("/");
    } catch (err) {
      toast.error(`Failed to delete project: ${err.message}`);
    }
  }

  // ----- File deleted callback -----
  function handleFileDeleted(deletedPath) {
    setFiles((prev) => prev.filter((f) => f.path !== deletedPath));
    if (activePath === deletedPath) {
      setActivePath(null);
      setFileContent("");
    }
  }

  // ----- Prepare user messages for sidebar -----
  const userMessages = messages
    .map((m, index) => ({ ...m, index }))
    .filter((m) => m.role === "user");

  // ----- Loading state -----
  if (loading) {
    return <SkeletonWorkspace />;
  }

  // ----- Render -----
  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="border-b border-line px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/")} className="flex items-center gap-2">
            <img src="/logo.png" alt="patch/" className="h-6 w-auto" />
            <span className="text-brand-100 text-sm font-semibold">patch/</span>
          </button>
          {isRenaming ? (
            <form onSubmit={handleRename} className="flex items-center gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
                className="bg-panel border border-line rounded-sm px-2 py-1 text-xs text-text outline-none focus:border-brand-100"
              />
              <button type="submit" className="text-xs text-brand-100 hover:text-brand-300 transition-colors">
                save
              </button>
              <button
                type="button"
                onClick={() => { setIsRenaming(false); setNewName(projectName); }}
                className="text-xs text-subtext hover:text-text transition-colors"
              >
                cancel
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-subtext truncate max-w-xs">{projectName}</span>
              <button
                onClick={() => setIsRenaming(true)}
                className="text-subtext hover:text-brand-100 text-xs transition-colors"
                title="Rename project"
              >
                ✎
              </button>
              <button
                onClick={handleDeleteProject}
                className="text-subtext hover:text-red-400 text-xs transition-colors"
                title="Delete project"
              >
                ✕
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadProject}
            className="text-xs text-subtext border border-line rounded-sm px-3 py-1.5 hover:border-brand-200 hover:text-brand-100 transition-all"
            title="Download entire project as ZIP"
          >
            ⬇ project
          </button>
          {activePath && (
            <button
              onClick={handleDownloadCurrentFile}
              className="text-xs text-subtext border border-line rounded-sm px-3 py-1.5 hover:border-brand-200 hover:text-brand-100 transition-all"
              title="Download current file"
            >
              ⬇ file
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
            className="text-xs text-subtext border border-line rounded-sm px-3 py-1.5 hover:border-brand-200 hover:text-brand-100 transition-all disabled:opacity-40"
          >
            {syncing ? "syncing…" : "sync .zip"}
          </button>
        </div>
      </div>

      {/* Main workspace */}
      <div className="flex-1 flex min-h-0">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((c) => !c)}
          projects={projects}
          currentProjectId={projectId}
          onSelectProject={(id) => router.push(`/project/${id}`)}
          onNewProject={() => router.push("/?new=1")}
          userMessages={userMessages}
          onJumpToMessage={setScrollToIndex}
        />
        <div className="w-[220px] border-r border-line overflow-y-auto py-2 shrink-0">
          <FileTree
            files={files}
            onSelect={selectFile}
            activePath={activePath}
            recentPaths={recentPaths}
            projectId={projectId}
            onFileDeleted={handleFileDeleted}
          />
        </div>
        <div className="flex-1 min-w-0">
          <CodeViewer path={activePath} content={fileContent} loading={fileLoading} />
        </div>
        <div className="w-[360px] border-l border-line min-h-0 shrink-0">
          <ChatPanel
            messages={messages}
            onSend={handleSend}
            busy={busy}
            facts={facts}
            scrollToIndex={scrollToIndex}
          />
        </div>
      </div>
    </div>
  );
}