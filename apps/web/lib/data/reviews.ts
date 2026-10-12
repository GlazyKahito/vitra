import "server-only";
import { and, desc, eq, ilike, inArray, or, type SQL } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { analysisRuns, analyteResults, clinicalReviews, devices, samples, stripProducts } from "@/db/schema";
import { ANALYTE_BY_KEY, isAnalyteKey } from "@/lib/analytes";
import { newId } from "@/lib/ids";
import { recordAudit } from "@/lib/data/audit";
import { loadRunAttachments, summariseResults } from "@/lib/data/runs";
import type { AnalyteResult, ClinicalReview, ReviewQueueItem, SafeUser } from "@/lib/data/contract";

/**
 * Critical flags are structural, never clinical: an analyte flagged "critical" in KJS-HC-03
 * (false negatives matter) whose pad could not be read, or a whole-image failure.
 */
export function criticalFlagsFor(results: AnalyteResult[], qualityPassed: boolean | null): string[] {
  const flags: string[] = [];
  if (qualityPassed === false) flags.push("image_quality_failed");
  for (const r of results) {
    if (!isAnalyteKey(r.analyteKey)) continue;
    const def = ANALYTE_BY_KEY[r.analyteKey];
    if (def.critical && (r.state === "indeterminate" || r.state === "unavailable")) flags.push(`${def.key}_unreadable`);
  }
  return flags;
}

export async function listReviewQueue(filter: { status?: "pending_review" | "reviewed" | "rejected" | "all"; q?: string } = {}): Promise<ReviewQueueItem[]> {
  const db = await getDb();
  const status = filter.status ?? "pending_review";
  const conds: SQL[] = [];
  if (status === "all") conds.push(inArray(analysisRuns.status, ["pending_review", "reviewed", "rejected"]));
  else conds.push(eq(analysisRuns.status, status));
  if (filter.q && filter.q.trim()) {
    const like = `%${filter.q.trim()}%`;
    conds.push(or(ilike(analysisRuns.runCode, like), ilike(samples.sampleCode, like), ilike(samples.subjectPseudonym, like))!);
  }
  const rows = await db
    .select({ run: analysisRuns, sample: samples, stripProduct: stripProducts, device: devices })
    .from(analysisRuns)
    .innerJoin(samples, eq(samples.id, analysisRuns.sampleId))
    .innerJoin(stripProducts, eq(stripProducts.id, analysisRuns.stripProductId))
    .leftJoin(devices, eq(devices.id, analysisRuns.deviceId))
    .where(and(...conds))
    .orderBy(status === "pending_review" ? analysisRuns.createdAt : desc(analysisRuns.createdAt))
    .limit(300);
  const { resultsByRun, latestReviewByRun } = await loadRunAttachments(rows.map((r) => r.run.id));
  return rows.map((r) => {
    const results = resultsByRun.get(r.run.id) ?? [];
    return {
      run: r.run,
      sample: r.sample,
      stripProduct: r.stripProduct,
      device: r.device,
      resultSummary: summariseResults(results),
      latestReview: latestReviewByRun.get(r.run.id) ?? null,
      waitingSince: r.run.completedAt ?? r.run.createdAt,
      criticalFlags: criticalFlagsFor(results, r.run.qualityPassed),
    };
  });
}

const DECISION_TO_STATUS: Record<"accepted" | "rejected" | "needs_repeat" | "note", "reviewed" | "rejected" | null> = {
  accepted: "reviewed",
  rejected: "rejected",
  needs_repeat: "rejected",
  note: null,
};

export async function submitReview(
  runId: string,
  input: { decision: "accepted" | "rejected" | "needs_repeat" | "note"; note?: string },
  actor: SafeUser,
): Promise<ClinicalReview> {
  const db = await getDb();
  const [run] = await db.select().from(analysisRuns).where(eq(analysisRuns.id, runId)).limit(1);
  if (!run) throw new Error("Run not found");
  if (!["pending_review", "reviewed", "rejected"].includes(run.status)) {
    throw new Error(`Run ${run.runCode} is in status "${run.status}" and cannot be reviewed.`);
  }
  if (input.decision !== "note" && input.decision !== "accepted" && !(input.note && input.note.trim())) {
    throw new Error("A note is required when rejecting or requesting a repeat.");
  }
  const [review] = await db
    .insert(clinicalReviews)
    .values({
      id: newId("rev"),
      runId,
      reviewerId: actor.id,
      reviewerLabel: `${actor.displayName} (${actor.roleKey})`,
      decision: input.decision,
      note: input.note?.trim() || null,
    })
    .returning();
  const next = DECISION_TO_STATUS[input.decision];
  if (next) await db.update(analysisRuns).set({ status: next }).where(eq(analysisRuns.id, runId));
  await recordAudit({ actor, action: `review.${input.decision}`, entityType: "run", entityId: runId, detail: { runCode: run.runCode, reviewId: review.id, statusAfter: next ?? run.status } });
  return review;
}

export async function countResultsByState(runId: string): Promise<Record<string, number>> {
  const db = await getDb();
  const rows = await db.select({ state: analyteResults.state }).from(analyteResults).where(eq(analyteResults.runId, runId));
  const out: Record<string, number> = {};
  for (const r of rows) out[r.state] = (out[r.state] ?? 0) + 1;
  return out;
}
