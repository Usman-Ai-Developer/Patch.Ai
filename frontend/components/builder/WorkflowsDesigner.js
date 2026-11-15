"use client";

export default function WorkflowsDesigner({ appName, onBack, onClose }) {
  return (
    <div className="h-full flex flex-col bg-ink">
      <div className="flex items-center justify-between px-4 py-2 border-b border-line shrink-0">
        <button
          onClick={onBack}
          className="text-xs px-3 py-1 bg-brand-100/20 text-brand-100 rounded hover:bg-brand-100/30 transition-colors"
        >
          ← Back to Features
        </button>
        <span className="text-sm text-subtext">Workflows Designer – {appName}</span>
        <button onClick={onClose} className="text-subtext hover:text-red-400 text-sm">
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center justify-center">
        <div className="text-6xl mb-4">🔄</div>
        <h3 className="text-xl font-semibold text-text">Workflows Designer</h3>
        <p className="text-subtext mt-2 text-center max-w-md">
          Build automated processes and business logic:
        </p>
        <ul className="text-sm text-subtext/80 mt-4 space-y-1 text-center">
          <li>• Visual workflow builder (drag & drop)</li>
          <li>• Triggers, conditions, and actions</li>
          <li>• Integration with models and events</li>
          <li>• Audit logs and monitoring</li>
        </ul>
        <div className="mt-6 text-xs text-subtext/50 bg-panel border border-line px-4 py-2 rounded">
          Coming soon – check back for updates!
        </div>
      </div>
    </div>
  );
}