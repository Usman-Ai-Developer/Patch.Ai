"use client";

export default function BuilderHome({ onSelectBackend, onSelectFrontend, frontendExists }) {
  return (
    <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center p-8 bg-surface/10">
      <h2 className="font-display-sm text-display-sm text-on-surface mb-2">
        AI App Builder
      </h2>
      <p className="font-body-md text-body-md text-on-surface-variant mb-8">
        Choose your development area to get started
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl w-full">
        {/* ─── Backend Card ────────────────────────────────────────── */}
        <div
          onClick={onSelectBackend}
          className="glass-card rounded-2xl p-8 hover:border-secondary/40 hover:shadow-[0_0_40px_rgba(78,223,145,0.05)] transition-all cursor-pointer hover:-translate-y-1 text-center group"
        >
          <span className="material-symbols-outlined text-5xl text-secondary/80 mb-4 block group-hover:text-secondary transition-colors">
            construction
          </span>
          <h3 className="font-headline-lg text-headline-lg text-on-surface group-hover:text-secondary transition-colors">
            Backend
          </h3>
          <p className="font-body-md text-body-md text-on-surface-variant mt-2 leading-relaxed">
            Build APIs, database models, business logic, workflows and automations.
          </p>
        </div>

        {/* ─── Frontend Card ────────────────────────────────────────── */}
        <div
          onClick={onSelectFrontend}
          className="glass-card rounded-2xl p-8 hover:border-secondary/40 hover:shadow-[0_0_40px_rgba(78,223,145,0.05)] transition-all cursor-pointer hover:-translate-y-1 text-center group relative"
        >
          <span className="material-symbols-outlined text-5xl text-secondary/80 mb-4 block group-hover:text-secondary transition-colors">
            brush
          </span>
          <h3 className="font-headline-lg text-headline-lg text-on-surface group-hover:text-secondary transition-colors">
            Frontend
          </h3>
          <p className="font-body-md text-body-md text-on-surface-variant mt-2 leading-relaxed">
            Design beautiful interfaces, pages, components and layouts.
          </p>
          <span className={`inline-block mt-3 text-xs px-3 py-1 rounded-full font-medium ${
            frontendExists
              ? "bg-secondary/10 text-secondary border border-secondary/20"
              : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
          }`}>
            {frontendExists ? "✅ Generated" : "⚡ Generate now"}
          </span>
        </div>
      </div>
    </div>
  );
}