/**
 * Workspace loading state. Rendered inside the persistent chrome while a page
 * renders on the server: an instrument-style skeleton with a slow shimmer
 * (static under reduced motion).
 */
export default function WorkspaceLoading() {
  return (
    <div className="ws-loading" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading workspace view…</span>

      <div className="ws-pagehead mb-7 flex items-end justify-between gap-10 pb-6" aria-hidden>
        <div>
          <div className="ws-skel h-2.5 w-28" />
          <div className="ws-skel mt-4 h-10 w-[360px] rounded-[6px]" />
        </div>
        <div className="flex gap-2 pb-1">
          <div className="ws-skel h-8 w-24 rounded-[7px]" />
          <div className="ws-skel h-8 w-28 rounded-[7px]" />
        </div>
      </div>

      <div className="flex flex-col gap-4" aria-hidden>
        <div className="panel grid grid-cols-5 divide-x divide-line">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-3 px-5 py-4">
              <div className="ws-skel h-2.5 w-20" />
              <div className="ws-skel h-7 w-16 rounded-[5px]" />
              <div className="ws-skel h-2 w-24" />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-12 gap-4">
          <div className="panel col-span-8 p-5">
            <div className="ws-skel h-2.5 w-24" />
            <div className="ws-skel mt-3 h-4 w-48" />
            <div className="mt-6 flex h-[180px] items-end gap-3 border-b border-line pb-px">
              {[46, 72, 38, 90, 64, 55, 80, 30, 68, 50, 76, 42, 60, 84].map((h, i) => (
                <div key={i} className="ws-skel flex-1 rounded-[2px]" style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
          <div className="col-span-4 flex flex-col gap-4">
            {[0, 1].map((k) => (
              <div key={k} className="panel p-5">
                <div className="ws-skel h-2.5 w-24" />
                <div className="ws-skel mt-3 h-4 w-40" />
                <div className="mt-5 flex flex-col gap-2.5">
                  {[0, 1, 2].map((r) => (
                    <div key={r} className="ws-skel h-3" style={{ width: `${92 - r * 14}%` }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="border-b border-line px-5 py-4">
            <div className="ws-skel h-2.5 w-16" />
            <div className="ws-skel mt-3 h-4 w-32" />
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-6 border-b border-line px-5 py-3.5 last:border-b-0">
              <div className="ws-skel h-3 w-20" />
              <div className="ws-skel h-3 w-24" />
              <div className="ws-skel h-5 w-28 rounded-[4px]" />
              <div className="ws-skel h-3 flex-1" />
              <div className="ws-skel h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
