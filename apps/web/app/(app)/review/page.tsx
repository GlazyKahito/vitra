import { Suspense } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { Panel } from "@/components/ui/panel";
import { RunStatusChip } from "@/components/console/run-status-chip";
import { ReviewQueue, type QueueTab } from "@/components/review/review-queue";
import type { ReviewDrawerItem } from "@/components/review/review-drawer";
import { requireUser, can } from "@/lib/auth";
import { logoutAction } from "@/lib/auth/actions";
import { listReviewQueue } from "@/lib/data/reviews";
import { getRun } from "@/lib/data/runs";
import type { ReviewQueueItem } from "@/lib/data/contract";
import type { ResultState } from "@/lib/inference/policy";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review queue" };

type SP = Record<string, string | string[] | undefined>;

function toDrawerItem(it: ReviewQueueItem): ReviewDrawerItem {
  return {
    runId: it.run.id,
    runCode: it.run.runCode,
    status: it.run.status,
    mode: it.run.mode,
    synthetic: it.run.synthetic || it.sample.synthetic,
    sampleCode: it.sample.sampleCode,
    subjectPseudonym: it.sample.subjectPseudonym,
    createdAt: new Date(it.run.createdAt).toISOString(),
    waitingSince: new Date(it.waitingSince).toISOString(),
    criticalFlags: it.criticalFlags,
    qualityPassed: it.run.qualityPassed,
    results: it.resultSummary.map((r) => ({ analyteKey: r.analyteKey, state: r.state as ResultState, value: r.value, unit: r.unit })),
    latestReview: it.latestReview ? { reviewerLabel: it.latestReview.reviewerLabel, decision: it.latestReview.decision, note: it.latestReview.note, createdAt: new Date(it.latestReview.createdAt).toISOString() } : null,
  };
}

export default async function ReviewPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser("runs.read");
  const sp = await searchParams;
  const statusParam = typeof sp.status === "string" ? sp.status : "pending_review";
  const tab: QueueTab = statusParam === "reviewed" || statusParam === "rejected" || statusParam === "all" ? statusParam : "pending_review";
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const runParam = typeof sp.run === "string" ? sp.run : null;

  const [items, pendingCount, reviewedCount, rejectedCount] = await Promise.all([
    listReviewQueue({ status: tab, q }),
    listReviewQueue({ status: "pending_review" }).then((r) => r.length),
    listReviewQueue({ status: "reviewed" }).then((r) => r.length),
    listReviewQueue({ status: "rejected" }).then((r) => r.length),
  ]);

  let drawerItems = items.map(toDrawerItem);
  // Deep link from a run page (?run=<id>) may target a run outside the current tab.
  if (runParam && !drawerItems.some((i) => i.runId === runParam)) {
    const r = await getRun(runParam);
    if (r) {
      drawerItems = [toDrawerItem({ ...r, waitingSince: r.run.completedAt ?? r.run.createdAt, criticalFlags: [] }), ...drawerItems];
    }
  }

  return (
    <AppShell user={user} eyebrow="06 / Review" title="Clinical review queue" onLogout={logoutAction}>
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-9">
          <Suspense fallback={null}>
            <ReviewQueue items={drawerItems} tab={tab} counts={{ pending_review: pendingCount, reviewed: reviewedCount, rejected: rejectedCount, all: pendingCount + reviewedCount + rejectedCount }} canReview={can(user, "reviews.write")} initialRunId={runParam} />
          </Suspense>
        </div>
        <div className="col-span-3 flex flex-col gap-4">
          <Panel eyebrow="Legend" title="Status transitions" flush>
            <ul className="divide-y divide-line text-[12px]">
              <li className="flex flex-col gap-1 px-5 py-3">
                <RunStatusChip status="pending_review" />
                <span className="text-fg-3">Pipeline finished and at least one analyte has a state other than calibration-required. Waiting for a decision.</span>
              </li>
              <li className="flex flex-col gap-1 px-5 py-3">
                <RunStatusChip status="reviewed" />
                <span className="text-fg-3">Decision: accepted. Reports generated afterwards cite the reviewer and timestamp.</span>
              </li>
              <li className="flex flex-col gap-1 px-5 py-3">
                <RunStatusChip status="rejected" />
                <span className="text-fg-3">Decision: rejected or needs repeat. Results remain stored for audit; a new run is expected.</span>
              </li>
              <li className="flex flex-col gap-1 px-5 py-3">
                <span className="t-mono text-[10.5px] uppercase tracking-[0.12em] text-fg-3">note</span>
                <span className="text-fg-3">Adds a note without changing status.</span>
              </li>
            </ul>
          </Panel>
          <Panel eyebrow="Flags" title="Critical analytes" flush>
            <div className="px-5 py-3 text-[12px] leading-relaxed text-fg-3">Glucose and blood are flagged when indeterminate or unavailable, because a false negative would matter most. A flag means the value is missing, not that it is abnormal. Nothing here is clinically validated.</div>
          </Panel>
          <div className="px-1 text-[11.5px] text-fg-4">{can(user, "reviews.write") ? `Decisions are attributed to ${user.displayName}.` : "Your role can view the queue but not record decisions."}</div>
        </div>
      </div>
    </AppShell>
  );
}
