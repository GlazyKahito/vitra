import "server-only";
import { and, count, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  analysisRuns,
  analyteResults,
  auditEvents,
  calibrationModels,
  clinicalReviews,
  colourFeatures,
  devices,
  images,
  padSegmentations,
  reports,
  samples,
  stripBatches,
  stripProducts,
  users,
} from "@/db/schema";
import { ANALYTE_BY_KEY, ANALYTES, isAnalyteKey } from "@/lib/analytes";
import type { ResultState } from "@/lib/inference/policy";
import type { AnalyteResult, AuditEvent, ClinicalReview, ConsoleStats, Run, RunDetail, RunListFilter, RunListItem, Sample } from "@/lib/data/contract";

export const RUN_STATUSES = ["queued", "processing", "invalid_image", "calibration_required", "pending_review", "reviewed", "rejected", "failed"] as const;

/* ───────── shared helpers ───────── */
function asState(s: string): ResultState {
  return s as ResultState;
}

/** Loads analyte results + latest review for a set of run ids. */
export async function loadRunAttachments(runIds: string[]): Promise<{
  resultsByRun: Map<string, AnalyteResult[]>;
  latestReviewByRun: Map<string, ClinicalReview>;
}> {
  const resultsByRun = new Map<string, AnalyteResult[]>();
  const latestReviewByRun = new Map<string, ClinicalReview>();
  if (runIds.length === 0) return { resultsByRun, latestReviewByRun };
  const db = await getDb();
  const results = await db.select().from(analyteResults).where(inArray(analyteResults.runId, runIds));
  for (const r of results) {
    const arr = resultsByRun.get(r.runId) ?? [];
    arr.push(r);
    resultsByRun.set(r.runId, arr);
  }
  const reviews = await db.select().from(clinicalReviews).where(inArray(clinicalReviews.runId, runIds)).orderBy(desc(clinicalReviews.createdAt));
  for (const rv of reviews) if (!latestReviewByRun.has(rv.runId)) latestReviewByRun.set(rv.runId, rv);
  return { resultsByRun, latestReviewByRun };
}

function orderResults(results: AnalyteResult[]): AnalyteResult[] {
  const order = new Map<string, number>(ANALYTES.map((a, i) => [a.key, i]));
  return [...results].sort((a, b) => (order.get(a.analyteKey) ?? 99) - (order.get(b.analyteKey) ?? 99));
}

export function summariseResults(results: AnalyteResult[]): RunListItem["resultSummary"] {
  return orderResults(results).map((r) => ({ analyteKey: r.analyteKey, state: asState(r.state), value: r.value, unit: r.unit }));
}

function buildWhere(filter: RunListFilter): SQL | undefined {
  const conds: SQL[] = [];
  if (filter.q && filter.q.trim()) {
    const q = `%${filter.q.trim()}%`;
    conds.push(or(ilike(analysisRuns.runCode, q), ilike(samples.sampleCode, q), ilike(samples.subjectPseudonym, q))!);
  }
  if (filter.status && filter.status !== "all") conds.push(eq(analysisRuns.status, filter.status));
  if (filter.mode && filter.mode !== "all") conds.push(eq(analysisRuns.mode, filter.mode));
  if (filter.stripProductId) conds.push(eq(analysisRuns.stripProductId, filter.stripProductId));
  if (filter.synthetic === "only") conds.push(eq(analysisRuns.synthetic, true));
  if (filter.synthetic === "exclude") conds.push(eq(analysisRuns.synthetic, false));
  if (filter.from) conds.push(gte(analysisRuns.createdAt, new Date(filter.from)));
  if (filter.to) {
    const to = new Date(filter.to);
    if (/^\d{4}-\d{2}-\d{2}$/.test(filter.to)) to.setUTCHours(23, 59, 59, 999);
    conds.push(lte(analysisRuns.createdAt, to));
  }
  return conds.length ? and(...conds) : undefined;
}

/* ───────── list ───────── */
export async function listRuns(filter: RunListFilter = {}): Promise<{ items: RunListItem[]; total: number }> {
  const db = await getDb();
  const where = buildWhere(filter);
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 500);
  const offset = Math.max(filter.offset ?? 0, 0);

  const rows = await db
    .select({ run: analysisRuns, sample: samples, stripProduct: stripProducts, device: devices })
    .from(analysisRuns)
    .innerJoin(samples, eq(samples.id, analysisRuns.sampleId))
    .innerJoin(stripProducts, eq(stripProducts.id, analysisRuns.stripProductId))
    .leftJoin(devices, eq(devices.id, analysisRuns.deviceId))
    .where(where)
    .orderBy(desc(analysisRuns.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: count() })
    .from(analysisRuns)
    .innerJoin(samples, eq(samples.id, analysisRuns.sampleId))
    .where(where);

  const { resultsByRun, latestReviewByRun } = await loadRunAttachments(rows.map((r) => r.run.id));
  const items: RunListItem[] = rows.map((r) => ({
    run: r.run,
    sample: r.sample,
    stripProduct: r.stripProduct,
    device: r.device,
    resultSummary: summariseResults(resultsByRun.get(r.run.id) ?? []),
    latestReview: latestReviewByRun.get(r.run.id) ?? null,
  }));
  return { items, total: Number(total) };
}

/* ───────── detail ───────── */
async function loadDetail(run: Run): Promise<RunDetail> {
  const db = await getDb();
  const [sampleRow] = await db.select().from(samples).where(eq(samples.id, run.sampleId)).limit(1);
  const [productRow] = await db.select().from(stripProducts).where(eq(stripProducts.id, run.stripProductId)).limit(1);
  const deviceRow = run.deviceId ? (await db.select().from(devices).where(eq(devices.id, run.deviceId)).limit(1))[0] ?? null : null;
  const imageRow = run.imageId ? (await db.select().from(images).where(eq(images.id, run.imageId)).limit(1))[0] ?? null : null;
  const batchRow = run.stripBatchId ? (await db.select().from(stripBatches).where(eq(stripBatches.id, run.stripBatchId)).limit(1))[0] ?? null : null;
  const operator = run.operatorId
    ? (
        await db
          .select({ id: users.id, email: users.email, displayName: users.displayName, roleKey: users.roleKey, active: users.active })
          .from(users)
          .where(eq(users.id, run.operatorId))
          .limit(1)
      )[0] ?? null
    : null;

  const padRows = await db
    .select({ pad: padSegmentations, features: colourFeatures })
    .from(padSegmentations)
    .leftJoin(colourFeatures, eq(colourFeatures.padSegmentationId, padSegmentations.id))
    .where(eq(padSegmentations.runId, run.id))
    .orderBy(padSegmentations.padIndex);

  const resultRows = await db
    .select({ result: analyteResults, model: calibrationModels })
    .from(analyteResults)
    .leftJoin(calibrationModels, eq(calibrationModels.id, analyteResults.modelId))
    .where(eq(analyteResults.runId, run.id));

  const reviews = await db.select().from(clinicalReviews).where(eq(clinicalReviews.runId, run.id)).orderBy(desc(clinicalReviews.createdAt));
  const reportRows = await db.select().from(reports).where(eq(reports.runId, run.id)).orderBy(desc(reports.createdAt));
  const audit = await db
    .select()
    .from(auditEvents)
    .where(and(eq(auditEvents.entityType, "run"), eq(auditEvents.entityId, run.id)))
    .orderBy(desc(auditEvents.createdAt))
    .limit(100);

  const results = orderResults(resultRows.map((r) => r.result)).map((res) => ({ ...res, model: resultRows.find((r) => r.result.id === res.id)?.model ?? null }));

  // Earlier runs for the same subject (time-series context).
  let previousRunsForSubject: RunDetail["previousRunsForSubject"] = [];
  if (sampleRow.subjectPseudonym) {
    const prev = await db
      .select({ run: analysisRuns })
      .from(analysisRuns)
      .innerJoin(samples, eq(samples.id, analysisRuns.sampleId))
      .where(and(eq(samples.subjectPseudonym, sampleRow.subjectPseudonym), sql`${analysisRuns.id} <> ${run.id}`, lte(analysisRuns.createdAt, run.createdAt)))
      .orderBy(desc(analysisRuns.createdAt))
      .limit(10);
    const { resultsByRun } = await loadRunAttachments(prev.map((p) => p.run.id));
    previousRunsForSubject = prev.map((p) => ({ run: p.run, results: orderResults(resultsByRun.get(p.run.id) ?? []) }));
  }

  return {
    run,
    sample: sampleRow,
    stripProduct: productRow,
    device: deviceRow,
    resultSummary: summariseResults(results),
    latestReview: reviews[0] ?? null,
    image: imageRow,
    batch: batchRow,
    operator,
    pads: padRows.map((p) => ({ ...p.pad, features: p.features })),
    results,
    reviews,
    reports: reportRows,
    audit,
    previousRunsForSubject,
  };
}

export async function getRun(id: string): Promise<RunDetail | null> {
  const db = await getDb();
  const [run] = await db.select().from(analysisRuns).where(eq(analysisRuns.id, id)).limit(1);
  return run ? loadDetail(run) : null;
}

export async function getRunByCode(code: string): Promise<RunDetail | null> {
  const db = await getDb();
  const [run] = await db.select().from(analysisRuns).where(eq(analysisRuns.runCode, code)).limit(1);
  return run ? loadDetail(run) : null;
}

/** Allocates the next run code (R-000001…). Serialised by the unique index; callers retry on conflict. */
export async function nextRunCode(): Promise<string> {
  const db = await getDb();
  const [{ n }] = await db.select({ n: count() }).from(analysisRuns);
  const [last] = await db.select({ runCode: analysisRuns.runCode }).from(analysisRuns).orderBy(desc(analysisRuns.runCode)).limit(1);
  const lastNum = last ? Number(last.runCode.replace(/^R-/, "")) : 0;
  return `R-${String(Math.max(Number(n), Number.isFinite(lastNum) ? lastNum : 0) + 1).padStart(6, "0")}`;
}

/* ───────── console stats (from stored rows only) ───────── */
function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function getConsoleStats(): Promise<ConsoleStats> {
  const db = await getDb();
  const now = new Date();
  const d7 = new Date(now.getTime() - 7 * 86400_000);
  const d14 = new Date(now.getTime() - 13 * 86400_000);
  d14.setUTCHours(0, 0, 0, 0);
  const d30 = new Date(now.getTime() - 30 * 86400_000);

  const [{ totalRuns }] = await db.select({ totalRuns: count() }).from(analysisRuns);
  const [{ runsLast7d }] = await db.select({ runsLast7d: count() }).from(analysisRuns).where(gte(analysisRuns.createdAt, d7));
  const [{ syntheticRuns }] = await db.select({ syntheticRuns: count() }).from(analysisRuns).where(eq(analysisRuns.synthetic, true));
  const [{ pendingReview }] = await db.select({ pendingReview: count() }).from(analysisRuns).where(eq(analysisRuns.status, "pending_review"));
  const [{ reviewedLast7d }] = await db.select({ reviewedLast7d: count() }).from(clinicalReviews).where(gte(clinicalReviews.createdAt, d7));

  const statusRows = await db.select({ status: analysisRuns.status, n: count() }).from(analysisRuns).groupBy(analysisRuns.status);
  const modeRows = await db.select({ mode: analysisRuns.mode, n: count() }).from(analysisRuns).groupBy(analysisRuns.mode);
  const byStatus: Record<string, number> = {};
  for (const s of RUN_STATUSES) byStatus[s] = 0;
  for (const r of statusRows) byStatus[r.status] = Number(r.n);
  const byMode: Record<string, number> = { research: 0, demo: 0 };
  for (const r of modeRows) byMode[r.mode] = Number(r.n);

  const [{ qualityFailuresLast30 }] = await db
    .select({ qualityFailuresLast30: count() })
    .from(analysisRuns)
    .where(and(gte(analysisRuns.createdAt, d30), eq(analysisRuns.qualityPassed, false)));

  // Runs per day, last 14 days.
  const recentRuns = await db
    .select({ createdAt: analysisRuns.createdAt, status: analysisRuns.status })
    .from(analysisRuns)
    .where(gte(analysisRuns.createdAt, d14));
  const perDay = new Map<string, { count: number; invalid: number }>();
  for (let i = 0; i < 14; i++) perDay.set(dayKey(new Date(d14.getTime() + i * 86400_000)), { count: 0, invalid: 0 });
  for (const r of recentRuns) {
    const k = dayKey(r.createdAt);
    const slot = perDay.get(k);
    if (!slot) continue;
    slot.count += 1;
    if (r.status === "invalid_image") slot.invalid += 1;
  }
  const runsPerDay = [...perDay.entries()].map(([date, v]) => ({ date, ...v }));

  // Recent quality failures.
  const failRows = await db
    .select({ run: analysisRuns, sample: samples })
    .from(analysisRuns)
    .innerJoin(samples, eq(samples.id, analysisRuns.sampleId))
    .where(eq(analysisRuns.qualityPassed, false))
    .orderBy(desc(analysisRuns.createdAt))
    .limit(6);
  const recentQualityFailures = failRows.map((r) => ({
    run: r.run,
    sample: r.sample,
    failedChecks: (r.run.qualityChecks ?? []).filter((c) => c.status === "fail").map((c) => c.label),
  }));

  // Per-analyte state counts (all runs).
  const stateRows = await db
    .select({ analyteKey: analyteResults.analyteKey, state: analyteResults.state, n: count() })
    .from(analyteResults)
    .groupBy(analyteResults.analyteKey, analyteResults.state);
  const analyteStateCounts = ANALYTES.map((a) => {
    const counts: Partial<Record<ResultState, number>> = {};
    for (const r of stateRows) if (r.analyteKey === a.key) counts[asState(r.state)] = Number(r.n);
    return { analyteKey: a.key, counts };
  });

  // Value series for analytes that have numeric values (last 30 days).
  const valueRows = await db
    .select({ analyteKey: analyteResults.analyteKey, value: analyteResults.value, state: analyteResults.state, unit: analyteResults.unit, runCode: analysisRuns.runCode, at: analysisRuns.createdAt, synthetic: analysisRuns.synthetic })
    .from(analyteResults)
    .innerJoin(analysisRuns, eq(analysisRuns.id, analyteResults.runId))
    .where(and(gte(analysisRuns.createdAt, d30), sql`${analyteResults.value} is not null`))
    .orderBy(analysisRuns.createdAt);
  const analyteValueSeries = ANALYTES.filter((a) => a.kind === "continuous")
    .map((a) => ({
      analyteKey: a.key,
      unit: a.unit,
      points: valueRows
        .filter((v) => v.analyteKey === a.key && v.value !== null)
        .map((v) => ({ runCode: v.runCode, at: v.at.toISOString(), value: v.value as number, state: asState(v.state), synthetic: v.synthetic })),
    }))
    .filter((s) => s.points.length > 0);

  return {
    totalRuns: Number(totalRuns),
    runsLast7d: Number(runsLast7d),
    byStatus,
    byMode,
    syntheticRuns: Number(syntheticRuns),
    qualityFailuresLast30: Number(qualityFailuresLast30),
    pendingReview: Number(pendingReview),
    reviewedLast7d: Number(reviewedLast7d),
    runsPerDay,
    recentQualityFailures,
    analyteStateCounts,
    analyteValueSeries,
  };
}

export async function getRecentActivity(limit = 20): Promise<AuditEvent[]> {
  const db = await getDb();
  return db.select().from(auditEvents).orderBy(desc(auditEvents.createdAt)).limit(Math.min(Math.max(limit, 1), 200));
}

/** Convenience for screens: label/unit lookups that tolerate unknown keys. */
export function analyteLabel(key: string): string {
  return isAnalyteKey(key) ? ANALYTE_BY_KEY[key].label : key;
}

export type { Run, Sample };
