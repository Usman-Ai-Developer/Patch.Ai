"use client";

import { useState, useEffect } from "react";
import { getFileTree, getFileContent, updateFileContent } from "../../lib/api";
import toast from "react-hot-toast";
import FileTree from "../FileTree";
import CodeViewer from "../CodeViewer";

// Normalize and clean file path for consistent checking
function isFrontendPath(path) {
  if (!path) return false;
  // Replace backslashes with forward slashes
  let normalized = path.replace(/\\/g, '/');
  // Remove leading slash if present
  if (normalized.startsWith('/')) {
    normalized = normalized.slice(1);
  }
  return normalized.startsWith('frontend/') || normalized.includes('/frontend/');
}

export default function FrontendExplorer({ projectId, onBack, onClose, onRefresh }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePath, setActivePath] = useState(null);
  const [fileContent, setFileContent] = useState("");
  const [fileLoading, setFileLoading] = useState(false);
  const [recentPaths, setRecentPaths] = useState(new Set());

  // Load file tree, filtering to frontend/ only
  useEffect(() => {
    async function fetchFiles() {
      try {
        const tree = await getFileTree(projectId);
        // Log the first few paths to see what we're getting
        console.log('[FrontendExplorer] First 5 file paths:', tree.slice(0, 5).map(f => f.path));
        const frontendFiles = tree.filter(f => isFrontendPath(f.path));
        console.log('[FrontendExplorer] Found frontend files:', frontendFiles.length);
        setFiles(frontendFiles);
      } catch (err) {
        console.error('[FrontendExplorer] Failed to load frontend files:', err);
        toast.error("Failed to load frontend files");
      } finally {
        setLoading(false);
      }
    }
    fetchFiles();
  }, [projectId]);

  // Select file
  const selectFile = async (path) => {
    setActivePath(path);
    setFileLoading(true);
    try {
      const res = await getFileContent(projectId, path);
      setFileContent(res.content);
    } catch (err) {
      toast.error(`Could not load file: ${err.message}`);
      setFileContent(`// could not load file: ${err.message}`);
    } finally {
      setFileLoading(false);
    }
  };

  const closeFile = () => {
    setActivePath(null);
    setFileContent("");
  };

  const onFileDeleted = (deletedPath) => {
    setFiles(prev => prev.filter(f => f.path !== deletedPath));
    if (activePath === deletedPath) {
      closeFile();
    }
  };

  const handleRefresh = async () => {
    try {
      const tree = await getFileTree(projectId);
      const frontendFiles = tree.filter(f => isFrontendPath(f.path));
      setFiles(frontendFiles);
      if (onRefresh) onRefresh();
      toast.success("Frontend files refreshed");
    } catch (err) {
      toast.error("Failed to refresh frontend files");
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* ─── Header ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-surface-container-high text-on-surface-variant hover:text-primary hover:bg-surface-container-highest transition-all font-medium"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          Back to Builder
        </button>
        <span className="text-sm text-on-surface-variant font-medium">Frontend Files</span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="text-on-surface-variant hover:text-secondary transition-colors"
            title="Refresh"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
          </button>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-error transition-colors"
            title="Close"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      </div>

      {/* ─── Main area: file tree + code viewer ──────────────────── */}
      <div className="flex-1 flex min-h-0">
        {/* File Tree */}
        <div className="w-[220px] border-r border-white/5 overflow-y-auto py-2 shrink-0">
          {loading ? (
            <div className="px-3 py-2 text-sm text-on-surface-variant/50">Loading files…</div>
          ) : files.length === 0 ? (
            <div className="px-3 py-2 text-sm text-on-surface-variant/50 text-center">
              No frontend files found.
              <button
                onClick={handleRefresh}
                className="block mt-2 text-secondary hover:underline text-xs"
              >
                Refresh
              </button>
            </div>
          ) : (
            <FileTree
              files={files}
              onSelect={selectFile}
              activePath={activePath}
              recentPaths={recentPaths}
              projectId={projectId}
              onFileDeleted={onFileDeleted}
              onDirectoryDeleted={() => {
                // Refresh the tree when a directory is deleted
                getFileTree(projectId).then(tree => {
                  const frontendFiles = tree.filter(f => isFrontendPath(f.path));
                  setFiles(frontendFiles);
                });
              }}
            />
          )}
        </div>

        {/* Code Viewer */}
        <div className="flex-1 min-w-0">
          <CodeViewer
            path={activePath}
            content={fileContent}
            loading={fileLoading}
            projectId={projectId}
            onCloseFile={closeFile}
          />
        </div>
      </div>
    </div>
  );
}