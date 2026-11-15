export default function StartProjectModal({
  isOpen,
  onClose,
  framework,
  setFramework,
  projectName,
  setProjectName,
  appName,
  setAppName,
  onSubmit,
  loading,
  isValidAppName,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card rounded-2xl p-6 max-w-md w-full">
        {/* ─── Header ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-headline-lg text-headline-lg text-on-surface">Start a New Project</h3>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-error transition-colors"
            title="Close"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
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

        {/* ─── Project Name ────────────────────────────────────────── */}
        <div className="mb-4">
          <label htmlFor="projectName" className="block text-xs font-label-caps uppercase tracking-widest text-on-surface-variant mb-1">
            Project Name <span className="text-on-surface-variant/40">(optional)</span>
          </label>
          <input
            id="projectName"
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="Leave blank to keep the current name"
            className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
          />
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

        {/* ─── Actions ──────────────────────────────────────────────── */}
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-on-surface-variant hover:text-on-surface transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={loading || (appName && !isValidAppName(appName))}
            className="flex items-center gap-1 px-4 py-2 bg-secondary text-on-secondary text-sm font-bold rounded-xl hover:shadow-[0_0_30px_rgba(78,223,145,0.3)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-on-secondary/30 border-t-on-secondary rounded-full animate-spin"></span>
                Starting…
              </>
            ) : (
              "Start Project"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}