"use client";

import { useState, useMemo } from "react";
import toast from "react-hot-toast";
import { downloadFile, deleteFile } from "../lib/api";

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
  expandedFolders,
  toggleFolder,
}) {
  if (node.__file) {
    const isRecent = recentPaths.has(node.__file.path);
    const isActive = activePath === node.__file.path;
    const filePath = node.__file.path;

    async function handleDelete(e) {
      e.stopPropagation();
      if (!confirm(`Delete "${filePath}"? This cannot be undone.`)) return;
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
      <div className="group flex items-center justify-between hover:bg-panel/60 rounded-sm transition-colors">
        <div
          onClick={() => onSelect(filePath)}
          style={{ paddingLeft: depth * 14 + 8 }}
          className={`cursor-pointer text-sm py-1 truncate rounded-sm flex-1 ${
            isActive ? "bg-line text-brand-100" : "text-text"
          }`}
          title={filePath}
        >
          {isRecent && <span className="text-mint mr-1">●</span>}
          <span className="mr-1">📄</span>
          {name}
        </div>
        <div className="flex items-center gap-1 pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleDownload}
            className="text-subtext hover:text-brand-100 text-xs transition-colors"
            title="Download file"
          >
            ⬇
          </button>
          <button
            onClick={handleDelete}
            className="text-subtext hover:text-red-400 text-xs transition-colors"
            title="Delete file"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  const children = node.__children || {};
  const folderKey = path || name;
  const isExpanded = expandedFolders.has(folderKey);

  const toggle = (e) => {
    e.stopPropagation();
    toggleFolder(folderKey);
  };

  const sortedEntries = Object.entries(children).sort(([a], [b]) => {
    const aIsFolder = !children[a].__file;
    const bIsFolder = !children[b].__file;
    if (aIsFolder && !bIsFolder) return -1;
    if (!aIsFolder && bIsFolder) return 1;
    return a.localeCompare(b);
  });

  return (
    <div>
      <div
        style={{ paddingLeft: depth * 14 + 8 }}
        className="flex items-center gap-1 text-xs uppercase tracking-wide text-subtext py-1 cursor-pointer hover:text-text transition-colors"
        onClick={toggle}
      >
        <span className="mr-1">{isExpanded ? "📂" : "📁"}</span>
        {name}/
        <span className="text-[10px] ml-1 text-subtext/60">
          {isExpanded ? "▾" : "▸"}
        </span>
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
              expandedFolders={expandedFolders}
              toggleFolder={toggleFolder}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FileTree({
  files,
  onSelect,
  activePath,
  recentPaths,
  projectId,
  onFileDeleted,
}) {
  const tree = useMemo(() => buildTree(files), [files]);
  const [expandedFolders, setExpandedFolders] = useState(new Set());

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
  if (topLevelFolders.length === 1 && !expandedFolders.size) {
    const [folderName] = topLevelFolders[0];
    setExpandedFolders(new Set([folderName]));
  }

  return (
    <div className="overflow-y-auto h-full">
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
          expandedFolders={expandedFolders}
          toggleFolder={toggleFolder}
        />
      ))}
    </div>
  );
}