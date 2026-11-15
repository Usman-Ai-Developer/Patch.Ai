"use client";

import { useConfirm } from "../../hooks/useConfirm";

export default function AppDetails({ appName, onSelectFeature, onBack, onDeleteApp }) {
  const { confirm, ConfirmDialog } = useConfirm();

  const features = [
    { id: 'models', label: 'Models', icon: 'data_object', desc: 'Design database models and relationships' },
    { id: 'apis', label: 'APIs', icon: 'api', desc: 'Configure API endpoints, viewsets and routes' },
    { id: 'permissions', label: 'Permissions', icon: 'lock', desc: 'Manage permissions, roles and access control' },
    { id: 'admin', label: 'Admin', icon: 'settings', desc: 'Configure admin panel and interfaces' },
    // Workflows and AI Actions are upcoming; we'll hide them for now.
    // { id: 'workflows', label: 'Workflows', icon: 'sync_alt', desc: 'Automate processes and business logic' },
    // { id: 'ai-actions', label: 'AI Actions', icon: 'auto_awesome', desc: 'AI powered actions and automations' },
    // { id: 'settings', label: 'Settings', icon: 'tune', desc: 'App configuration and custom settings' },
  ];

  const handleDeleteApp = async () => {
    const confirmed = await confirm({
      title: `Delete "${appName}"?`,
      message: "All files and data associated with this app will be permanently removed. This cannot be undone.",
      confirmText: "Delete App",
      variant: "danger",
    });
    if (!confirmed) return;
    onDeleteApp(appName);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-surface/10">
      {ConfirmDialog}
      {/* ─── Header ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-surface-container-high text-on-surface-variant hover:text-primary hover:bg-surface-container-highest transition-all font-medium"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            Back
          </button>
          <h3 className="font-headline-lg text-headline-lg text-on-surface">{appName}</h3>
          <span className="text-xs text-on-surface-variant/60 font-medium">— What would you like to build today?</span>
        </div>
        <button
          onClick={handleDeleteApp}
          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-error-container/10 text-error border border-error/20 hover:bg-error-container/20 hover:border-error/40 transition-all font-medium"
        >
          <span className="material-symbols-outlined text-sm">delete</span>
          Delete App
        </button>
      </div>

      {/* ─── Features Grid ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {features.map((feature) => (
          <div
            key={feature.id}
            onClick={() => onSelectFeature(feature.id)}
            className="glass-card rounded-2xl p-5 hover:border-secondary/40 hover:shadow-[0_0_30px_rgba(78,223,145,0.05)] transition-all cursor-pointer hover:-translate-y-1 group"
          >
            <div className="flex flex-col items-start gap-2">
              <span className="material-symbols-outlined text-3xl text-secondary/80 group-hover:text-secondary transition-colors">
                {feature.icon}
              </span>
              <h4 className="font-headline-lg text-headline-lg-mobile lg:text-headline-lg text-on-surface group-hover:text-secondary transition-colors">
                {feature.label}
              </h4>
              <p className="font-body-md text-body-md text-on-surface-variant/80 leading-relaxed">{feature.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}