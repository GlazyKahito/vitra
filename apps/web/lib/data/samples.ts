import "server-only";
import { and, asc, count, desc, eq, ilike, inArray, max, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { analysisRuns, analyteResults, devices, referenceMeasurements, samples, stripProducts } from "@/db/schema";
import { ANALYTES } from "@/lib/analytes";
import { newId } from "@/lib/ids";
import { recordAudit } from "@/lib/data/audit";
import { loadRunAttachments, summariseResults } from "@/lib/data/runs";
import type { ResultState } from "@/lib/inference/policy";
import type { RunListItem, SafeUser, Sample, SampleDetail, SampleListItem } from "@/lib/data/contract";

export async function listSamples(q?: string, opts: { synthetic?: "all" | "only" | "exclude"; limit?: number } = {}): Promise<SampleListItem[]> {
  const db = await getDb();
  const conds: SQL[] = [];
  if (q && q.trim()) {
    const like = `%${q.trim()}%`;
    conds.push(or(ilike(samples.sampleCode, like), ilike(samples.subjectPseudonym, like))!);
  }
  if (opts.synthetic === "only") conds.push(eq(samples.synthetic, true));
  if (opts.synthetic === "exclude") conds.push(eq(samples.synthetic, false));
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 1000);

  const rows = await db
    .select()
    .from(samples)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(samples.createdAt))
    .limit(limit);
  if (rows.length === 0) return [];
  const ids = rows.map((s) => s.id);

  const runAgg = await db
    .select({ sampleId: analysisRuns.sampleId, n: count(), last: max(analysisRuns.createdAt) })
    .from(analysisRuns)
    .where(inArray(analysisRuns.sampleId, ids))
    .groupBy(analysisRuns.sampleId);
  const lastRuns = await db
    .select({ sampleId: analysisRuns.sampleId, status: analysisRuns.status, createdAt: analysisRuns.createdAt })
    .from(analysisRuns)
    .where(inArray(analysisRuns.sampleId, ids))
    .orderBy(desc(analysisRuns.createdAt));
  const refAgg = await db
    .select({ sampleCode: referenceMeasurements.sampleCode, n: count() })
    .from(referenceMeasurements)
    .where(inArray(referenceMeasurements.sampleCode, rows.map((s) => s.sampleCode)))
    .groupBy(referenceMeasurements.sampleCode);

  const lastStatus = new Map<string, string>();
  for (const r of lastRuns) if (!lastStatus.has(r.sampleId)) lastStatus.set(r.sampleId, r.status);
  const aggMap = new Map(runAgg.map((r) => [r.sampleId, r]));
  const refMap = new Map(refAgg.map((r) => [r.sampleCode, Number(r.n)]));

  return rows.map((sample) => {
    const agg = aggMap.get(sample.id);
    return {
      sample,
      runCount: agg ? Number(agg.n) : 0,
      lastRunAt: agg?.last ? new Date(agg.last) : null,
      lastStatus: lastStatus.get(sample.id) ?? null,
      referenceCount: refMap.get(sample.sampleCode) ?? 0,
    };
  });
}

export async function getSample(id: string): Promise<SampleDetail | null> {
  const db = await getDb();
  const [sample] = await db.select().from(samples).where(eq(samples.id, id)).limit(1);
  if (!sample) return null;

  const runRows = await db
    .select({ run: analysisRuns, stripProduct: stripProducts, device: devices })
    .from(analysisRuns)
    .innerJoin(stripProducts, eq(stripProducts.id, analysisRuns.stripProductId))
    .leftJoin(devices, eq(devices.id, analysisRuns.deviceId))
    .where(eq(analysisRuns.sampleId, id))
    .orderBy(desc(analysisRuns.createdAt));
  const { resultsByRun, latestReviewByRun } = await loadRunAttachments(runRows.map((r) => r.run.id));
  const runs: RunListItem[] = runRows.map((r) => ({
    run: r.run,
    sample,
    stripProduct: r.stripProduct,
    device: r.device,
    resultSummary: summariseResults(resultsByRun.get(r.run.id) ?? []),
    latestReview: latestReviewByRun.get(r.run.id) ?? null,
  }));

  const references = await db
    .select()
    .from(referenceMeasurements)
    .where(or(eq(referenceMeasurements.sampleId, id), eq(referenceMeasurements.sampleCode, sample.sampleCode)))
    .orderBy(desc(referenceMeasurements.measuredAt));

  // Trend: all runs for the subject pseudonym (or just this sample), oldest → newest.
  const subjectRuns = sample.subjectPseudonym
    ? await db
        .select({ run: analysisRuns })
        .from(analysisRuns)
        .innerJoin(samples, eq(samples.id, analysisRuns.sampleId))
        .where(eq(samples.subjectPseudonym, sample.subjectPseudonym))
        .orderBy(asc(analysisRuns.createdAt))
    : runRows.slice().reverse().map((r) => ({ run: r.run }));
  const trendRuns = subjectRuns.map((r) => r.run);
  const trendResults = trendRuns.length
    ? await db.select().from(analyteResults).where(inArray(analyteResults.runId, trendRuns.map((r) => r.id)))
    : [];
  const trend: SampleDetail["trend"] = ANALYTES.map((a) => ({
    analyteKey: a.key,
    unit: a.unit,
    points: trendRuns.flatMap((run) => {
      const res = trendResults.find((r) => r.runId === run.id && r.analyteKey === a.key);
      return res ? [{ runCode: run.runCode, at: run.createdAt.toISOString(), value: res.value, state: res.state as ResultState }] : [];
    }),
  })).filter((t) => t.points.length > 0);

  return { sample, runs, references, trend };
}

export async function getSampleByCode(code: string): Promise<Sample | null> {
  const db = await getDb();
  const [s] = await db.select().from(samples).where(eq(samples.sampleCode, code)).limit(1);
  return s ?? null;
}

export async function createSample(
  input: { sampleCode: string; subjectPseudonym?: string; metadata?: Record<string, unknown>; synthetic?: boolean },
  actor: SafeUser,
): Promise<Sample> {
  const db = await getDb();
  const [inserted] = await db
    .insert(samples)
    .values({
      id: newId("smp"),
      sampleCode: input.sampleCode.trim(),
      subjectPseudonym: input.subjectPseudonym?.trim() || null,
      synthetic: input.synthetic ?? false,
      metadata: input.metadata ?? null,
      createdById: actor.id,
    })
    .returning();
  await recordAudit({ actor, action: "sample.create", entityType: "sample", entityId: inserted.id, detail: { sampleCode: inserted.sampleCode, synthetic: inserted.synthetic } });
  return inserted;
}

/** Sample created by device ingestion (no user actor). Simulated devices only produce synthetic samples. */
export async function createSampleFromDevice(input: { sampleCode: string; deviceName: string; simulated: boolean }): Promise<Sample> {
  const db = await getDb();
  const [inserted] = await db
    .insert(samples)
    .values({
      id: newId("smp"),
      sampleCode: input.sampleCode.trim(),
      synthetic: input.simulated,
      metadata: { created_by_device: input.deviceName },
      createdById: null,
    })
    .returning();
  await recordAudit({ actor: null, action: "sample.create", entityType: "sample", entityId: inserted.id, detail: { sampleCode: inserted.sampleCode, device: input.deviceName, synthetic: inserted.synthetic } });
  return inserted;
}

/** Next pseudonymous code in the form S-YYYY-NNNN (real samples; synthetic ones use SYN-NNNN). */
export async function nextSampleCode(): Promise<string> {
  const db = await getDb();
  const year = new Date().getUTCFullYear();
  const prefix = `S-${year}-`;
  const [last] = await db
    .select({ code: samples.sampleCode })
    .from(samples)
    .where(sql`${samples.sampleCode} like ${prefix + "%"}`)
    .orderBy(desc(samples.sampleCode))
    .limit(1);
  const n = last ? Number(last.code.slice(prefix.length)) : 0;
  return `${prefix}${String((Number.isFinite(n) ? n : 0) + 1).padStart(4, "0")}`;
}
