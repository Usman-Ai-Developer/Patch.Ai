"use client";

export default function AppList({ apps, onSelectApp, onNewApp }) {
  const appMeta = {
    users: { icon: 'account_circle', desc: 'Manage user accounts, authentication, profiles and permissions.' },
    jobs: { icon: 'work', desc: 'Manage job listings and positions.' },
    interviews: { icon: 'description', desc: 'Handle interviews and evaluations.' },
    hr: { icon: 'business_center', desc: 'Human resource management.' },
    analytics: { icon: 'analytics', desc: 'Reports and analytics.' },
  };

  const getMeta = (appName) => {
    const lower = appName.toLowerCase();
    return appMeta[lower] || { icon: 'apps', desc: 'Manage your application.' };
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-surface/10">
      {/* ─── Header ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-headline-lg text-headline-lg text-on-surface">Installed Apps</h3>
        <button
          onClick={onNewApp}
          className="flex items-center gap-1 px-4 py-2 bg-secondary text-on-secondary text-sm font-bold rounded-xl hover:shadow-[0_0_30px_rgba(78,223,145,0.3)] transition-all"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          Create New App
        </button>
      </div>

      {/* ─── Empty State ───────────────────────────────────────────── */}
      {apps.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant/30 mb-4">inbox</span>
          <p className="text-on-surface-variant text-lg">No apps found</p>
          <p className="text-on-surface-variant/60 text-sm mt-1">Create your first app using the button above.</p>
        </div>
      ) : (
        /* ─── Grid ──────────────────────────────────────────────────── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {apps.map((app, index) => {
            const meta = getMeta(app.name);
            return (
              <div
                key={`${app.name}-${index}`}
                onClick={() => onSelectApp(app.name)}
                className="glass-card rounded-2xl p-5 hover:border-secondary/40 hover:shadow-[0_0_30px_rgba(78,223,145,0.05)] transition-all cursor-pointer hover:-translate-y-1 group"
              >
                <div className="flex flex-col items-start gap-3">
                  <span className="material-symbols-outlined text-3xl text-secondary/80 group-hover:text-secondary transition-colors">
                    {meta.icon}
                  </span>
                  <div>
                    <h4 className="font-headline-lg text-headline-lg-mobile lg:text-headline-lg text-on-surface group-hover:text-secondary transition-colors">
                      {app.name}
                    </h4>
                    <p className="font-body-md text-body-md text-on-surface-variant/80 mt-1 leading-relaxed">{meta.desc}</p>
                  </div>
                  <div className="mt-2 text-xs text-on-surface-variant/50 flex items-center gap-1 font-medium">
                    <span>Click to configure</span>
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}