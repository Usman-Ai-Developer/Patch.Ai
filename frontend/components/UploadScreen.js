"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { createProject, startProject } from "../lib/api";

const ACCEPT =
  ".zip,.py,.js,.jsx,.ts,.tsx,.json,.html,.htm,.css,.scss,.md,.txt,.yml,.yaml,.toml,.sql,.sh,.xml,.ini,.cfg,.java,.c,.cpp,.h,.hpp,.go,.rs,.rb,.php,.vue,.env,.gitignore";

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function isValidAppName(name) {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

export default function UploadScreen({ onSuccess, onCancel }) {
  const router = useRouter();
  const [mode, setMode] = useState("from-scratch");
  const [projectName, setProjectName] = useState("");
  const [framework, setFramework] = useState("drf");
  const [appName, setAppName] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  function addFiles(fileList) {
    const incoming = Array.from(fileList);
    setAttachments((prev) => [...prev, ...incoming]);
    // Auto‑fill project name only for upload mode, but only if empty
    if (mode === "upload" && !projectName) {
      const zipFile = incoming.find((f) => f.name.endsWith(".zip"));
      if (zipFile) {
        setProjectName(zipFile.name.replace(/\.zip$/, ""));
      } else if (incoming.length === 1) {
        const name = incoming[0].name.replace(/\.[^.]+$/, "");
        if (name) setProjectName(name);
      }
    }
  }

  function removeAttachment(index) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;

    if (mode === "from-scratch") {
      if (!projectName.trim()) {
        toast.error("Please provide a project name.");
        return;
      }
      if (appName && !isValidAppName(appName)) {
        toast.error("App name must be a valid Python identifier.");
        return;
      }
    } else {
      // Upload mode: require at least one file
      if (attachments.length === 0) {
        toast.error("Please upload at least one file.");
        return;
      }
    }

    setLoading(true);
    try {
      // ─── Build payload ──────────────────────────────────────────
      const payload = {
        message: mode === "from-scratch" 
          ? `Create a new ${framework} project` 
          : "Upload existing project",
        name: projectName.trim() || (mode === "from-scratch" ? `My ${framework} Project` : "Untitled"),
      };

      if (mode === "upload") {
        const zipIndex = attachments.findIndex((f) => f.name.endsWith(".zip"));
        const zipFile = zipIndex >= 0 ? attachments[zipIndex] : null;
        const looseFiles = zipIndex >= 0
          ? attachments.filter((_, i) => i !== zipIndex)
          : attachments;
        if (zipFile) payload.zipFile = zipFile;
        if (looseFiles.length > 0) payload.looseFiles = looseFiles;
      }

      // ─── Create project ────────────────────────────────────────
      const response = await createProject(payload);
      const project = response?.project;
      if (!project || !project.id) {
        console.error("Project creation response:", response);
        throw new Error("Project created but no ID returned.");
      }
      
      toast.success(`Project "${project.name}" created!`);

      // ─── Start project (only for from-scratch) ──────────────
      if (mode === "from-scratch") {
        try {
          await startProject(
            project.id,
            framework,
            project.name || projectName,
            appName.trim() || undefined
          );
          toast.success(`Project initialized with ${framework}!`);
        } catch (startErr) {
          console.error("Start project error:", startErr);
          toast.error(`Project created but failed to start: ${startErr.message}`);
        }
      }

      // ─── Redirect ────────────────────────────────────────────────
      if (onSuccess) {
        onSuccess(project);
      } else {
        router.push(`/project/${project.id}?openBuilder=true`);
      }
    } catch (err) {
      console.error("UploadScreen error:", err);
      toast.error(err.message || "Failed to create project");
    } finally {
      setLoading(false);
    }
  }

  const hasInput = mode === "from-scratch"
    ? projectName.trim() !== ""
    : attachments.length > 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-lg">
      {/* ─── Mode Toggle ───────────────────────────────────────────── */}
      <div className="flex rounded-xl bg-surface-container-low p-1 border border-white/5">
        <button
          type="button"
          onClick={() => setMode("from-scratch")}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
            mode === "from-scratch"
              ? "bg-secondary text-on-secondary shadow-[0_0_20px_rgba(78,223,145,0.1)]"
              : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <span className="flex items-center justify-center gap-1">
            <span className="material-symbols-outlined text-sm">rocket_launch</span>
            Start from Scratch
          </span>
        </button>
        <button
          type="button"
          onClick={() => setMode("upload")}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
            mode === "upload"
              ? "bg-secondary text-on-secondary shadow-[0_0_20px_rgba(78,223,145,0.1)]"
              : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <span className="flex items-center justify-center gap-1">
            <span className="material-symbols-outlined text-sm">cloud_upload</span>
            Upload Project
          </span>
        </button>
      </div>

      {/* ─── Start from Scratch ───────────────────────────────────── */}
      {mode === "from-scratch" && (
        <div className="glass-card rounded-2xl p-6 max-w-md w-full mx-auto">
          {/* ─── Project Name (required) ───────────────────────────── */}
          <div className="mb-4">
            <label htmlFor="projectName-scratch" className="block text-xs font-label-caps uppercase tracking-widest text-on-surface-variant mb-1">
              Project Name <span className="text-error">*</span>
            </label>
            <input
              id="projectName-scratch"
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g., My Blog API"
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
            />
            <p className="text-xs text-on-surface-variant/50 mt-1">This will be the name of your project.</p>
          </div>

          {/* ─── Framework ───────────────────────────────────────────── */}
          <div className="mb-4">
            <label htmlFor="framework" className="block text-xs font-label-caps uppercase tracking-widest text-on-surface-variant mb-1">
              Framework
            </label>
            <select
              id="framework"
              value={framework}
              onChange={(e) => setFramework(e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
            >
              <option value="drf">Django REST Framework</option>
              <option value="nextjs">Next.js</option>
              <option value="nodejs">Node.js</option>
              <option value="php">PHP</option>
            </select>
          </div>

          {/* ─── Initial App Name ────────────────────────────────────── */}
          <div className="mb-2">
            <label htmlFor="appName" className="block text-xs font-label-caps uppercase tracking-widest text-on-surface-variant mb-1">
              Initial App Name <span className="text-on-surface-variant/40">(optional)</span>
            </label>
            <input
              id="appName"
              type="text"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              placeholder="e.g., api"
              className={`w-full bg-surface-container-low border rounded-lg px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all ${
                appName && !isValidAppName(appName) ? "border-error" : "border-outline-variant"
              }`}
            />
            {appName && !isValidAppName(appName) && (
              <p className="text-xs text-error mt-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">warning</span>
                Use only letters, underscores, and digits (must start with a letter or underscore).
              </p>
            )}
            <p className="text-xs text-on-surface-variant/60 mt-1">If left blank, a name will be generated.</p>
          </div>
        </div>
      )}

      {/* ─── Upload Project ────────────────────────────────────────── */}
      {mode === "upload" && (
        <div>
          {/* ─── No project name field here ─────────────────────────── */}

          {/* ─── Attachments ─────────────────────────────────────────── */}
          <label className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant block mb-xs">
            Attachments <span className="text-on-surface-variant/40">(required)</span>
          </label>

          <div
            className={`border border-dashed rounded-xl p-md text-center transition-colors ${
              dragging
                ? "border-secondary bg-secondary/5"
                : "border-outline-variant hover:border-secondary/60"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (e.dataTransfer.files.length > 0) {
                addFiles(e.dataTransfer.files);
              }
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                if (e.target.files.length > 0) {
                  addFiles(e.target.files);
                  e.target.value = "";
                }
              }}
            />
            {attachments.length === 0 ? (
              <>
                <span className="material-symbols-outlined text-4xl text-on-surface-variant/40 block mb-sm">cloud_upload</span>
                <p className="text-on-surface-variant/60 text-sm mb-sm">
                  Drag & drop files here, or click to browse
                </p>
                <p className="text-xs text-on-surface-variant/40 mb-sm">
                  Supported: .zip, .py, .js, .html, .md, .json, and more.
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  className="text-secondary hover:underline text-sm font-medium disabled:opacity-40"
                >
                  Choose files
                </button>
              </>
            ) : (
              <div className="flex flex-wrap gap-2">
                {attachments.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 bg-surface-container-low border border-outline-variant rounded-lg px-2 py-1 text-xs"
                  >
                    <span className="material-symbols-outlined text-sm text-on-surface-variant">insert_drive_file</span>
                    <span className="text-on-surface truncate max-w-[140px]">{f.name}</span>
                    <span className="text-on-surface-variant/60">{formatSize(f.size)}</span>
                    <button
                      onClick={() => removeAttachment(i)}
                      className="text-on-surface-variant hover:text-error transition-colors"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  className="text-secondary hover:underline text-sm font-medium disabled:opacity-40"
                >
                  + Add more
                </button>
              </div>
            )}
          </div>
          <p className="text-xs text-on-surface-variant/50 mt-xs">Upload a .zip file or individual files to include in your project.</p>
        </div>
      )}

      {/* ─── Actions ──────────────────────────────────────────────── */}
      <div className="flex justify-end gap-md pt-sm border-t border-white/5">
        <button
          type="button"
          onClick={onCancel}
          className="px-lg py-sm text-on-surface-variant hover:text-on-surface transition-colors font-body-md text-body-md"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || !hasInput}
          className="flex items-center gap-2 bg-secondary text-on-secondary font-bold px-3xl py-sm rounded-xl hover:shadow-[0_0_30px_rgba(78,223,145,0.3)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-on-secondary/30 border-t-on-secondary rounded-full animate-spin"></span>
              Creating…
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-base">rocket_launch</span>
              {mode === "from-scratch" ? "Start Project" : "Upload Project"}
            </>
          )}
        </button>
      </div>
    </form>
  );
}