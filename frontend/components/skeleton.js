// frontend/components/Skeleton.js

export function SkeletonText({ className = "" }) {
  return <div className={`animate-pulse bg-line rounded-sm ${className}`}></div>;
}

export function SkeletonBox({ className = "" }) {
  return <div className={`animate-pulse bg-line rounded-md ${className}`}></div>;
}

export function SkeletonCard({ className = "" }) {
  return (
    <div className={`border border-line rounded-md p-4 ${className}`}>
      <SkeletonText className="h-4 w-3/4 mb-2" />
      <SkeletonText className="h-3 w-1/2" />
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="min-h-screen px-6 py-10 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <SkeletonBox className="h-8 w-8" />
          <SkeletonText className="h-6 w-24" />
        </div>
        <div className="flex gap-3">
          <SkeletonText className="h-8 w-16" />
          <SkeletonText className="h-8 w-24" />
        </div>
      </div>
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}

export function SkeletonWorkspace() {
  return (
    <div className="h-screen flex flex-col">
      <div className="border-b border-line px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <SkeletonBox className="h-6 w-16" />
          <SkeletonText className="h-4 w-32" />
        </div>
        <div className="flex gap-3">
          <SkeletonText className="h-8 w-20" />
          <SkeletonText className="h-8 w-20" />
        </div>
      </div>
      <div className="flex-1 flex min-h-0">
        <div className="w-10 border-r border-line flex flex-col items-center py-3">
          <SkeletonBox className="h-6 w-6" />
        </div>
        <div className="w-[220px] border-r border-line p-2">
          <SkeletonText className="h-4 w-full mb-2" />
          <SkeletonText className="h-4 w-3/4 mb-2" />
          <SkeletonText className="h-4 w-1/2" />
        </div>
        <div className="flex-1 min-w-0 p-4">
          <SkeletonText className="h-6 w-1/3 mb-4" />
          <SkeletonText className="h-4 w-full mb-2" />
          <SkeletonText className="h-4 w-5/6 mb-2" />
          <SkeletonText className="h-4 w-4/6" />
        </div>
        <div className="w-[360px] border-l border-line p-4">
          <SkeletonText className="h-8 w-full mb-4" />
          <SkeletonText className="h-4 w-full mb-2" />
          <SkeletonText className="h-4 w-5/6" />
        </div>
      </div>
    </div>
  );
}