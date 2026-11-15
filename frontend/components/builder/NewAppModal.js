export default function NewAppModal({
  isOpen,
  onClose,
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
          <h3 className="font-headline-lg text-headline-lg text-on-surface">Create a New App</h3>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-error transition-colors"
            title="Close"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>

        {/* ─── Input ────────────────────────────────────────────────── */}
        <div className="mb-4">
          <label htmlFor="appName" className="block text-xs font-label-caps uppercase tracking-widest text-on-surface-variant mb-1">
            App Name
          </label>
          <input
            id="appName"
            type="text"
            value={appName}
            onChange={(e) => setAppName(e.target.value)}
            placeholder="e.g., blog"
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
          <p className="text-xs text-on-surface-variant/60 mt-1">The app name must be a valid Python identifier.</p>
        </div>

        {/* ─── Actions ────────────────────────────────────────────────── */}
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-on-surface-variant hover:text-on-surface transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={loading || !appName.trim() || !isValidAppName(appName.trim())}
            className="flex items-center gap-1 px-4 py-2 bg-secondary text-on-secondary text-sm font-bold rounded-xl hover:shadow-[0_0_30px_rgba(78,223,145,0.3)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-on-secondary/30 border-t-on-secondary rounded-full animate-spin"></span>
                Creating…
              </>
            ) : (
              "Create"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}