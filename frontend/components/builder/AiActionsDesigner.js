"use client";

export default function AiActionsDesigner({ appName, onBack, onClose }) {
  return (
    <div className="h-full flex flex-col bg-surface/30 backdrop-blur-sm">
      {/* ─── Header ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-surface-container-high text-on-surface-variant hover:text-primary hover:bg-surface-container-highest transition-all font-medium"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          Back
        </button>
        <span className="text-sm text-on-surface-variant font-medium">AI Actions Designer – {appName}</span>
        <button
          onClick={onClose}
          className="text-on-surface-variant hover:text-error transition-colors"
          title="Close"
        >
          <span className="material-symbols-outlined text-sm">close</span>
        </button>
      </div>

      {/* ─── Content ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center justify-center">
        <span className="material-symbols-outlined text-7xl text-on-surface-variant/30 mb-4">auto_awesome</span>
        <h3 className="font-headline-lg text-headline-lg text-on-surface">AI Actions Designer</h3>
        <p className="font-body-md text-body-md text-on-surface-variant mt-2 text-center max-w-md">
          Create AI-powered actions and automations:
        </p>
        <ul className="font-body-md text-body-md text-on-surface-variant/80 mt-4 space-y-1 text-center">
          <li>• Generate code from natural language</li>
          <li>• AI-powered data transformations</li>
          <li>• Custom AI agents and workflows</li>
          <li>• Integration with Groq and OpenAI</li>
        </ul>
        <div className="mt-6 inline-flex items-center gap-2 text-xs px-4 py-2 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
          <span className="material-symbols-outlined text-sm">construction</span>
          Coming soon – check back for updates!
        </div>
      </div>
    </div>
  );
}