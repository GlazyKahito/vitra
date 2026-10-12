import { Skeleton, SkeletonText } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col bg-ink-0 px-10 py-10" aria-busy="true" aria-label="Loading">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="mt-16 max-w-[720px]">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="mt-4 h-10 w-full" />
        <Skeleton className="mt-2 h-10 w-3/4" />
        <SkeletonText lines={3} className="mt-8" />
      </div>
      <div className="mt-16 font-mono text-[10.5px] uppercase tracking-[0.14em] text-fg-4">Loading…</div>
    </div>
  );
}
