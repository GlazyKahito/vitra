"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Chip } from "@/components/ui/chip";
import { ResultSummaryChips } from "@/components/console/result-summary-chips";
import { RunStatusChip, SyntheticTag, ModeTag } from "@/components/console/run-status-chip";
import { cn, formatDateTime, formatRelative } from "@/lib/utils";
import { ReviewDrawer, type ReviewDrawerItem } from "./review-drawer";

export type QueueTab = "pending_review" | "reviewed" | "rejected" | "all";

const TABS: { key: QueueTab; label: string }[] = [
  { key: "pending_review", label: "Pending" },
  { key: "reviewed", label: "Reviewed" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

export function ReviewQueue({ items, tab, counts, canReview, initialRunId }: { items: ReviewDrawerItem[]; tab: QueueTab; counts: Partial<Record<QueueTab, number>>; canReview: boolean; initialRunId: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [openId, setOpenId] = useState<string | null>(initialRunId);

  useEffect(() => setOpenId(initialRunId), [initialRunId]);

  const setParam = useCallback(
    (k: string, v: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (v === null) next.delete(k);
      else next.set(k, v);
      router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
    },
    [params, pathname, router],
  );

  const open = items.find((i) => i.runId === openId) ?? null;
  const close = useCallback(() => {
    setOpenId(null);
    if (params.get("run")) setParam("run", null);
  }, [params, setParam]);

  return (
    <div className="panel flex flex-col">
      <div className="flex items-center justify-between border-b border-line px-5">
        <div className="flex gap-1" role="tablist">
          {TABS.map((t) => (
            <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setParam("status", t.key === "pending_review" ? null : t.key)} className={cn("-mb-px flex h-11 items-center gap-2 border-b-2 px-3 text-[13px]", tab === t.key ? "border-[var(--lux-gold)] text-[var(--lux-ivory)]" : "border-transparent text-fg-3 hover:text-fg")}>
              {t.label}
              {counts[t.key] !== undefined ? <span className="t-mono text-[10.5px] text-fg-4">{counts[t.key]}</span> : null}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const v = new FormData(e.currentTarget).get("q");
            setParam("q", typeof v === "string" && v.trim() ? v.trim() : null);
          }}
        >
          <input name="q" defaultValue={params.get("q") ?? ""} placeholder="Run or sample…" aria-label="Search queue" className="h-8 w-52 rounded-[var(--radius-sm)] border border-line-strong bg-ink-1 px-3 font-mono text-[12px] text-fg placeholder:text-fg-4 transition-[border-color,box-shadow] focus:border-[rgba(201,169,110,0.7)] focus:shadow-[0_0_0_3px_rgba(201,169,110,0.14)] focus:outline-none" />
        </form>
      </div>

      {items.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-1">
          <span className="t-eyebrow">Queue empty</span>
          <span className="text-[12px] text-fg-4">{tab === "pending_review" ? "No runs are waiting for review." : "No runs in this state."}</span>
        </div>
      ) : (
        <ul className="ws-rows divide-y divide-line">
          {items.map((it) => (
            <li key={it.runId}>
              <button type="button" onClick={() => setOpenId(it.runId)} className={cn("grid w-full grid-cols-[176px_124px_minmax(0,auto)_minmax(0,1fr)] items-center gap-x-6 gap-y-2.5 px-5 py-3.5 text-left transition-colors hover:bg-[rgba(201,169,110,0.035)]", openId === it.runId && "bg-[rgba(201,169,110,0.05)]")}>
                <div className="flex min-w-0 items-center gap-2">
                  <span className="t-mono whitespace-nowrap text-[13px] text-fg">{it.runCode}</span>
                  {it.synthetic ? <SyntheticTag /> : null}
                </div>
                <div className="min-w-0">
                  <div className="t-mono whitespace-nowrap text-[12px] text-fg-2">{it.sampleCode}</div>
                  {it.subjectPseudonym ? <div className="text-[11px] text-fg-4">{it.subjectPseudonym}</div> : null}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <RunStatusChip status={it.status} />
                  <ModeTag mode={it.mode} />
                </div>
                <div className="min-w-0 text-[11.5px] text-fg-3" title={formatDateTime(it.waitingSince)}>
                  {it.status === "pending_review" ? `waiting ${formatRelative(it.waitingSince)}` : it.latestReview ? `${it.latestReview.reviewerLabel} · ${formatRelative(it.latestReview.createdAt)}` : formatRelative(it.createdAt)}
                </div>
                <div className="col-span-full flex min-w-0 flex-wrap items-center gap-1.5">
                  {it.criticalFlags.length > 0 ? <Chip tone="notice">critical analyte unavailable</Chip> : null}
                  {it.qualityPassed === false ? <Chip tone="fault">image quality</Chip> : null}
                  <ResultSummaryChips entries={it.results} />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <ReviewDrawer item={open} canReview={canReview} onClose={close} />
    </div>
  );
}
