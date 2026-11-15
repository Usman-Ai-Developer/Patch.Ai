"use client";

import { useState, useMemo, useEffect } from "react";
import toast from "react-hot-toast";
import { downloadFile, deleteFile, deleteDirectory } from "../lib/api";
import { useConfirm } from "../hooks/useConfirm";

function buildTree(files) {
  const root = { __children: {} };
  for (const f of files) {
    const normalized = f.path.replace(/\\/g, "/");
    const parts = normalized.split("/");
    let node = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      if (isLast) {
        node.__children[part] = { __file: f };
      } else {
        if (!node.__children[part]) {
          node.__children[part] = { __children: {} };
        }
        node = node.__children[part];
      }
    }
  }
  return root;
}

function Node({
  name,
  node,
  depth,
  path,
  onSelect,
  activePath,
  recentPaths,
  projectId,
  onFileDeleted,
  onDirectoryDeleted,
  expandedFolders,
  toggleFolder,
}) {
  const { confirm, ConfirmDialog } = useConfirm(); // ← useConfirm hook

  // ─── File node ──────────────────────────────────────────────────────
  if (node.__file) {
    const isRecent = recentPaths.has(node.__file.path);
    const isActive = activePath === node.__file.path;
    const filePath = node.__file.path;

    async function handleDelete(e) {
      e.stopPropagation();
      const confirmed = await confirm({
        title: `Delete "${filePath}"?`,
        message: "This file will be permanently removed. This cannot be undone.",
        confirmText: "Delete File",
        variant: "danger",
      });
      if (!confirmed) return;

      try {
        await deleteFile(projectId, filePath);
        toast.success(`Deleted: ${filePath}`);
        onFileDeleted?.(filePath);
        if (activePath === filePath) {
          onSelect(null);
        }
      } catch (err) {
        toast.error(`Failed to delete: ${err.message}`);
      }
    }

    function handleDownload(e) {
      e.stopPropagation();
      downloadFile(projectId, filePath);
    }

    return (
      <>
        {ConfirmDialog} {/* ← Render dialog */}
        <div className="group flex items-center justify-between hover:bg-surface-container/50 rounded-lg transition-colors">
          <div
            onClick={() => onSelect(filePath)}
            style={{ paddingLeft: depth * 14 + 8 }}
            className={`cursor-pointer text-sm py-1.5 truncate rounded-lg flex-1 flex items-center gap-1.5 ${
              isActive ? "bg-secondary/10 text-secondary font-medium" : "text-on-surface hover:text-primary"
            }`}
            title={filePath}
          >
            {isRecent && <span className="w-1.5 h-1.5 rounded-full bg-secondary flex-shrink-0"></span>}
            <span className="material-symbols-outlined text-sm flex-shrink-0">description</span>
            <span className="truncate">{name}</span>
          </div>
          <div className="flex items-center gap-1 pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleDownload}
              className="text-on-surface-variant hover:text-secondary transition-colors"
              title="Download file"
            >
              <span className="material-symbols-outlined text-sm">download</span>
            </button>
            <button
              onClick={handleDelete}
              className="text-on-surface-variant hover:text-error transition-colors"
              title="Delete file"
            >
              <span className="material-symbols-outlined text-sm">delete</span>
            </button>
          </div>
        </div>
      </>
    );
  }

  // ─── Folder node ──────────────────────────────────────────────────
  const children = node.__children || {};
  const folderKey = path || name;
  const isExpanded = expandedFolders.has(folderKey);

  const toggle = (e) => {
    e.stopPropagation();
    toggleFolder(folderKey);
  };

  async function handleDeleteDirectory(e) {
    e.stopPropagation();
    const folderPath = path || name;
    const confirmed = await confirm({
      title: `Delete directory "${folderPath}"?`,
      message: "All files and subdirectories inside will be permanently removed. This cannot be undone.",
      confirmText: "Delete Directory",
      variant: "danger",
    });
    if (!confirmed) return;

    try {
      await deleteDirectory(projectId, folderPath);
      toast.success(`Deleted directory: ${folderPath}`);
      onDirectoryDeleted?.();
    } catch (err) {
      toast.error(`Failed to delete directory: ${err.message}`);
    }
  }

  const sortedEntries = Object.entries(children).sort(([a], [b]) => {
    const aIsFolder = !children[a].__file;
    const bIsFolder = !children[b].__file;
    if (aIsFolder && !bIsFolder) return -1;
    if (!aIsFolder && bIsFolder) return 1;
    return a.localeCompare(b);
  });

  return (
    <>
      {ConfirmDialog} {/* ← Render dialog */}
      <div>
        <div
          style={{ paddingLeft: depth * 14 + 8 }}
          className="flex items-center gap-1 text-xs uppercase tracking-wide text-on-surface-variant py-1.5 cursor-pointer hover:text-primary transition-colors group"
          onClick={toggle}
        >
          <span className="material-symbols-outlined text-sm mr-0.5">
            {isExpanded ? "folder_open" : "folder"}
          </span>
          <span className="font-medium">{name}/</span>
          <span className="text-[10px] text-on-surface-variant/50">
            {isExpanded ? "▾" : "▸"}
          </span>
          <button
            onClick={handleDeleteDirectory}
            className="ml-auto text-on-surface-variant hover:text-error opacity-0 group-hover:opacity-100 transition-opacity"
            title="Delete directory"
          >
            <span className="material-symbols-outlined text-sm">delete</span>
          </button>
        </div>
        {isExpanded && (
          <div>
            {sortedEntries.map(([childName, childNode]) => (
              <Node
                key={childName}
                name={childName}
                node={childNode}
                depth={depth + 1}
                path={folderKey + "/" + childName}
                onSelect={onSelect}
                activePath={activePath}
                recentPaths={recentPaths}
                projectId={projectId}
                onFileDeleted={onFileDeleted}
                onDirectoryDeleted={onDirectoryDeleted}
                expandedFolders={expandedFolders}
                toggleFolder={toggleFolder}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default function FileTree({
  files,
  onSelect,
  activePath,
  recentPaths,
  projectId,
  onFileDeleted,
  onDirectoryDeleted,
}) {
  const tree = useMemo(() => buildTree(files), [files]);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [initialized, setInitialized] = useState(false);

  const toggleFolder = (folderKey) => {
    setExpandedFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(folderKey)) {
        newSet.delete(folderKey);
      } else {
        newSet.add(folderKey);
      }
      return newSet;
    });
  };

  const rootChildren = tree.__children || {};
  const rootEntries = Object.entries(rootChildren).sort(([a], [b]) => {
    const aIsFolder = !rootChildren[a].__file;
    const bIsFolder = !rootChildren[b].__file;
    if (aIsFolder && !bIsFolder) return -1;
    if (!aIsFolder && bIsFolder) return 1;
    return a.localeCompare(b);
  });

  const topLevelFolders = rootEntries.filter(([_, node]) => !node.__file);
  useEffect(() => {
    if (!initialized && topLevelFolders.length === 1) {
      const [folderName] = topLevelFolders[0];
      setExpandedFolders(new Set([folderName]));
      setInitialized(true);
    }
  }, [initialized, topLevelFolders]);

  return (
    <div className="overflow-y-auto h-full px-2">
      {rootEntries.map(([childName, childNode]) => (
        <Node
          key={childName}
          name={childName}
          node={childNode}
          depth={0}
          path={childName}
          onSelect={onSelect}
          activePath={activePath}
          recentPaths={recentPaths}
          projectId={projectId}
          onFileDeleted={onFileDeleted}
          onDirectoryDeleted={onDirectoryDeleted}
          expandedFolders={expandedFolders}
          toggleFolder={toggleFolder}
        />
      ))}
    </div>
  );
}