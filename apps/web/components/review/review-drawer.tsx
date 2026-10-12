"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { StateChip } from "@/components/ui/state-chip";
import { Textarea } from "@/components/ui/field";
import { submitReviewAction } from "@/app/actions/reviews";
import { ANALYTE_BY_KEY, formatAnalyteValue, isAnalyteKey } from "@/lib/analytes";
import { RESULT_STATE_META, type ResultState } from "@/lib/inference/policy";
import { cn, formatDateTime } from "@/lib/utils";
import { RunStatusChip, SyntheticTag } from "@/components/console/run-status-chip";

export interface ReviewDrawerItem {
  runId: string;
  runCode: string;
  status: string;
  mode: string;
  synthetic: boolean;
  sampleCode: string;
  subjectPseudonym: string | null;
  createdAt: string;
  waitingSince: string;
  criticalFlags: string[];
  qualityPassed: boolean | null;
  results: { analyteKey: string; state: ResultState; value: number | null; unit: string }[];
  latestReview: { reviewerLabel: string; decision: string; note: string | null; createdAt: string } | null;
}

type Decision = "accepted" | "rejected" | "needs_repeat" | "note";

const DECISIONS: { key: Decision; label: string; blurb: string }[] = [
  { key: "accepted", label: "Accept", blurb: "Run moves to Reviewed. Reports can cite the review." },
  { key: "rejected", label: "Reject", blurb: "Run moves to Rejected; results stay stored for audit." },
  { key: "needs_repeat", label: "Needs repeat", blurb: "Run moves to Rejected and a fresh capture is expected." },
  { key: "note", label: "Note only", blurb: "Adds a note without changing the run status." },
];

export function ReviewDrawer({ item, canReview, onClose }: { item: ReviewDrawerItem | null; canReview: boolean; onClose: () => void }) {
  const router = useRouter();
  const [decision, setDecision] = useState<Decision>("accepted");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setDecision("accepted");
    setNote("");
    setError(null);
    setDone(null);
  }, [item?.runId]);

  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, onClose]);

  if (!item) return null;

  function submit() {
    if (!item || !canReview) return;
    setError(null);
    const fd = new FormData();
    fd.set("runId", item.runId);
    fd.set("decision", decision);
    if (note.trim()) fd.set("note", note.trim());
    startTransition(async () => {
      const res = await submitReviewAction(fd);
      if (res.ok) {
        setDone(`Recorded ${decision.replace("_", " ")} on ${item.runCode}.`);
        router.refresh();
      } else setError(res.error);
    });
  }

  const needsNote = decision === "rejected" || decision === "needs_repeat" || decision === "note";

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label={`Review ${item.runCode}`}>
      <button type="button" aria-label="Close" className="flex-1 bg-black/50" onClick={onClose} />
      <aside className="flex h-full w-[560px] flex-col border-l border-line bg-ink-1 shadow-[var(--shadow-panel)]">
        <header className="flex items-start justify-between border-b border-line px-5 py-4">
          <div>
            <div className="t-eyebrow">Review</div>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="t-mono text-[18px] text-fg">{item.runCode}</span>
              <RunStatusChip status={item.status} />
              {item.synthetic ? <SyntheticTag /> : null}
            </div>
            <div className="mt-1 text-[12px] text-fg-3">
              <span className="t-mono">{item.sampleCode}</span>
              {item.subjectPseudonym ? <span className="ml-2 text-fg-4">{item.subjectPseudonym}</span> : null}
              <span className="ml-2 text-fg-4">· {item.mode}</span>
              <span className="ml-2 text-fg-4">· waiting since {formatDateTime(item.waitingSince)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button href={`/analysis/${item.runId}`} variant="ghost" size="sm">
              Open run
            </Button>
            <button type="button" onClick={onClose} className="rounded p-1 text-fg-3 hover:text-fg" aria-label="Close drawer">
              <X className="size-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          {item.criticalFlags.length > 0 ? (
            <div className="mx-5 mt-4 rounded-[var(--radius-sm)] border border-[rgba(232,181,90,0.35)] bg-notice-dim px-3 py-2 text-[12px] text-fg-2">
              <span className="t-mono mr-2 text-[10px] uppercase tracking-[0.12em] text-notice">critical analyte unavailable</span>
              {item.criticalFlags.map((f) => f.replace(/_/g, " ")).join(", ")}
            </div>
          ) : null}

          <table className="table-instrument mt-2">
            <thead>
              <tr>
                <th>Analyte</th>
                <th>State</th>
                <th className="text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {item.results.map((r) => {
                const def = isAnalyteKey(r.analyteKey) ? ANALYTE_BY_KEY[r.analyteKey] : null;
                const shows = RESULT_STATE_META[r.state]?.showsValue && r.value !== null;
                return (
                  <tr key={r.analyteKey}>
                    <td className="text-fg">
                      {def?.label ?? r.analyteKey}
                      {def?.critical ? <span className="t-mono ml-1.5 text-[9.5px] uppercase tracking-[0.12em] text-fg-4">critical</span> : null}
                    </td>
                    <td>
                      <StateChip state={r.state} />
                    </td>
                    <td className="t-mono text-right">{shows && def ? `${formatAnalyteValue(def.key, r.value)} ${r.unit}` : <span className="text-fg-4">—</span>}</td>
                  </tr>
                );
              })}
              {item.results.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-fg-4">
                    No analyte results stored for this run.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>

          {item.latestReview ? (
            <div className="mx-5 mt-4 rounded-[var(--radius-sm)] border border-line px-3 py-2 text-[12px]">
              <div className="flex items-center justify-between">
                <span className="text-fg-2">
                  Last decision by <span className="text-fg">{item.latestReview.reviewerLabel}</span>
                </span>
                <span className="flex items-center gap-2">
                  <Chip tone={item.latestReview.decision === "accepted" ? "signal" : "neutral"}>{item.latestReview.decision.replace("_", " ")}</Chip>
                  <span className="t-mono text-[11px] text-fg-4">{formatDateTime(item.latestReview.createdAt)}</span>
                </span>
              </div>
              {item.latestReview.note ? <div className="mt-1 text-fg-3">{item.latestReview.note}</div> : null}
            </div>
          ) : null}

          <div className="px-5 py-5">
            <div className="t-eyebrow mb-2">Decision</div>
            <div className="grid grid-cols-2 gap-2">
              {DECISIONS.map((d) => (
                <label key={d.key} className={cn("flex cursor-pointer flex-col gap-0.5 rounded-[var(--radius-sm)] border p-3", decision === d.key ? "border-signal bg-signal-dim" : "border-line-strong hover:border-[rgba(255,255,255,0.3)]", !canReview && "cursor-not-allowed opacity-50")}>
                  <span className="flex items-center gap-2 text-[13px] text-fg">
                    <input type="radio" name="decision" value={d.key} checked={decision === d.key} onChange={() => setDecision(d.key)} disabled={!canReview} className="accent-[var(--color-signal)]" />
                    {d.label}
                  </span>
                  <span className="text-[11.5px] text-fg-4">{d.blurb}</span>
                </label>
              ))}
            </div>
            <div className="mt-4">
              <div className="t-eyebrow mb-1.5">Note {needsNote ? <span className="text-notice">· expected</span> : <span className="text-fg-4">· optional</span>}</div>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} disabled={!canReview} placeholder={canReview ? "Observations, reasons, follow-up…" : "Your role cannot record review decisions."} />
            </div>
            {error ? (
              <p className="mt-3 text-[12.5px] text-fault" role="alert">
                {error}
              </p>
            ) : null}
            {done ? (
              <p className="mt-3 text-[12.5px] text-signal" role="status">
                {done}
              </p>
            ) : null}
          </div>
        </div>

        <footer className="flex items-center justify-between border-t border-line px-5 py-3">
          <span className="text-[11.5px] text-fg-4">{canReview ? "Decision is attributed to you and timestamped in the audit trail." : "Read-only: reviews.write permission required."}</span>
          <Button onClick={submit} disabled={!canReview || pending} loading={pending}>
            Submit decision
          </Button>
        </footer>
      </aside>
    </div>
  );
}
