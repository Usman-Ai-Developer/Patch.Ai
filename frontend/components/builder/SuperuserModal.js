export default function SuperuserModal({
  isOpen,
  onClose,
  data,
  setData,
  onSubmit,
  loading,
}) {
  if (!isOpen) return null;

  const { username, email, password, password2 } = data;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-panel border border-line rounded-xl max-w-md w-full">
        <div className="flex items-center justify-between p-4 border-b border-line">
          <h3 className="text-lg font-semibold text-text">Create Superuser</h3>
          <button onClick={onClose} className="text-subtext hover:text-text text-xl">
            ✕
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-xs text-subtext mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setData({ ...data, username: e.target.value })}
              className="w-full bg-ink border border-line rounded-sm px-3 py-2 text-text outline-none focus:border-brand-100"
              placeholder="admin"
            />
          </div>
          <div>
            <label className="block text-xs text-subtext mb-1">Email (optional)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setData({ ...data, email: e.target.value })}
              className="w-full bg-ink border border-line rounded-sm px-3 py-2 text-text outline-none focus:border-brand-100"
              placeholder="admin@example.com"
            />
          </div>
          <div>
            <label className="block text-xs text-subtext mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setData({ ...data, password: e.target.value })}
              className="w-full bg-ink border border-line rounded-sm px-3 py-2 text-text outline-none focus:border-brand-100"
              placeholder="••••••••"
            />
            <p className="text-xs text-subtext/60 mt-1">Minimum 8 characters.</p>
          </div>
          <div>
            <label className="block text-xs text-subtext mb-1">Confirm Password</label>
            <input
              type="password"
              value={password2}
              onChange={(e) => setData({ ...data, password2: e.target.value })}
              className="w-full bg-ink border border-line rounded-sm px-3 py-2 text-text outline-none focus:border-brand-100"
              placeholder="••••••••"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 p-4 border-t border-line">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-line rounded-sm text-subtext hover:text-text"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={loading}
            className="px-4 py-2 bg-gradient-brand text-white rounded-sm font-semibold hover:bg-gradient-brand-hover transition-all disabled:opacity-40"
          >
            {loading ? "Creating…" : "Create Superuser"}
          </button>
        </div>
      </div>
    </div>
  );
}