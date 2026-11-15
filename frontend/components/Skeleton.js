export function SkeletonText({ className = "" }) {
  return <div className={`animate-pulse bg-surface-container-high/60 rounded-lg ${className}`}></div>;
}

export function SkeletonBox({ className = "" }) {
  return <div className={`animate-pulse bg-surface-container-high/60 rounded-xl ${className}`}></div>;
}

export function SkeletonCard({ className = "" }) {
  return (
    <div className={`glass-card rounded-2xl p-lg ${className}`}>
      <SkeletonText className="h-5 w-3/4 mb-2" />
      <SkeletonText className="h-3 w-1/2" />
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="min-h-screen bg-surface text-on-surface p-margin max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-2xl">
        <div className="flex items-center gap-3">
          <SkeletonBox className="h-10 w-10" />
          <SkeletonText className="h-8 w-32" />
        </div>
        <div className="flex gap-3">
          <SkeletonText className="h-10 w-24 rounded-full" />
          <SkeletonText className="h-10 w-20 rounded-full" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-lg">
        {[1, 2, 3].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}

export function SkeletonWorkspace() {
  return (
    <div className="landing-body text-on-surface min-h-screen relative">
      {/* Background Elements (subtle) */}
      <div className="grid-overlay"></div>
      <div className="atmospheric-glow top-0 -left-64 opacity-30"></div>
      <div className="atmospheric-glow bottom-0 -right-64 opacity-30"></div>

      <div className="h-screen flex flex-col relative z-10">
        {/* ─── Header ────────────────────────────────────────────── */}
        <div className="glass-header shadow-2xl flex-shrink-0 h-16 px-margin flex items-center justify-between">
          <div className="flex items-center gap-4">
            <SkeletonBox className="h-8 w-20" />
            <SkeletonText className="h-4 w-32" />
          </div>
          <div className="flex items-center gap-3">
            <SkeletonText className="h-8 w-24 rounded-full" />
            <SkeletonText className="h-8 w-20 rounded-full" />
            <SkeletonText className="h-8 w-20 rounded-full" />
          </div>
        </div>

        {/* ─── Main area ──────────────────────────────────────────── */}
        <div className="flex-1 flex min-h-0">
          {/* Sidebar skeleton */}
          <div className="w-10 border-r border-white/5 bg-surface/30 backdrop-blur-sm flex flex-col items-center py-3">
            <SkeletonBox className="h-6 w-6" />
          </div>

          {/* File tree skeleton */}
          <div className="w-[220px] border-r border-white/5 bg-surface/30 backdrop-blur-sm p-3">
            <SkeletonText className="h-4 w-full mb-2" />
            <SkeletonText className="h-4 w-3/4 mb-2" />
            <SkeletonText className="h-4 w-1/2" />
            <div className="mt-4 space-y-2">
              <SkeletonText className="h-3 w-5/6" />
              <SkeletonText className="h-3 w-4/6" />
              <SkeletonText className="h-3 w-3/4" />
            </div>
          </div>

          {/* Code viewer skeleton */}
          <div className="flex-1 min-w-0 bg-surface/30 backdrop-blur-sm">
            <div className="border-b border-white/5 px-4 py-2 flex items-center justify-between">
              <SkeletonText className="h-4 w-48" />
              <div className="flex gap-2">
                <SkeletonText className="h-6 w-16 rounded-full" />
                <SkeletonText className="h-6 w-16 rounded-full" />
              </div>
            </div>
            <div className="p-4 space-y-2">
              <SkeletonText className="h-4 w-full" />
              <SkeletonText className="h-4 w-5/6" />
              <SkeletonText className="h-4 w-3/4" />
              <SkeletonText className="h-4 w-full" />
              <SkeletonText className="h-4 w-4/6" />
            </div>
          </div>

          {/* Chat panel skeleton */}
          <div className="w-[360px] border-l border-white/5 bg-surface/30 backdrop-blur-sm flex flex-col">
            <div className="border-b border-white/5 px-3 py-2 flex items-center justify-between">
              <SkeletonText className="h-4 w-16" />
              <SkeletonText className="h-4 w-6" />
            </div>
            <div className="flex-1 p-4 space-y-4">
              <SkeletonText className="h-4 w-3/4" />
              <SkeletonText className="h-4 w-5/6" />
              <SkeletonText className="h-4 w-2/3" />
            </div>
            <div className="border-t border-white/5 p-3 flex gap-2">
              <SkeletonText className="h-10 flex-1 rounded-lg" />
              <SkeletonText className="h-10 w-20 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}