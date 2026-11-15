// frontend/components/WorkspacePanels.js
import Sidebar from "./Sidebar";
import FileTree from "./FileTree";
import CodeViewer from "./CodeViewer";
import ChatPanel from "./ChatPanel";

export default function WorkspacePanels({
  // Sidebar props
  sidebarCollapsed,
  setSidebarCollapsed,
  projects,
  currentProjectId,
  onSelectProject,
  onNewProject,
  userMessages,
  onJumpToMessage,
  // FileTree props
  files,
  onSelectFile,
  activePath,
  recentPaths,
  projectId,
  onFileDeleted,
  // CodeViewer props
  fileContent,
  fileLoading,
  onCloseFile,
  // Chat props
  messages,
  onSend,
  busy,
  facts,
  scrollToIndex,
  onMessageStatusChange,
  chatCollapsed,
  setChatCollapsed,
}) {
  return (
    <div className="flex-1 flex min-h-0 glass-card rounded-[36px] overflow-hidden border border-white/10 shadow-2xl">
      {/* ─── Sidebar ──────────────────────────────────────────────── */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((c) => !c)}
        projects={projects}
        currentProjectId={currentProjectId}
        onSelectProject={onSelectProject}
        onNewProject={onNewProject}
        userMessages={userMessages}
        onJumpToMessage={onJumpToMessage}
      />

      {/* ─── File Tree ────────────────────────────────────────────── */}
      <div className="w-[220px] border-r border-white/5 overflow-y-auto py-2 shrink-0 bg-surface/20">
        <FileTree
          files={files}
          onSelect={onSelectFile}
          activePath={activePath}
          recentPaths={recentPaths}
          projectId={projectId}
          onFileDeleted={onFileDeleted}
          onDirectoryDeleted={() => {}}
        />
      </div>

      {/* ─── Code Viewer ──────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 bg-surface/10">
        <CodeViewer
          path={activePath}
          content={fileContent}
          loading={fileLoading}
          projectId={projectId}
          onCloseFile={onCloseFile}
        />
      </div>

      {/* ─── Chat Panel ───────────────────────────────────────────── */}
      {!chatCollapsed && (
        <div className="w-[360px] border-l border-white/5 min-h-0 shrink-0 bg-surface/20">
          <ChatPanel
            messages={messages}
            onSend={onSend}
            busy={busy}
            facts={facts}
            scrollToIndex={scrollToIndex}
            projectId={projectId}
            onMessageStatusChange={onMessageStatusChange}
            onCollapse={() => setChatCollapsed(true)}
          />
        </div>
      )}
    </div>
  );
}