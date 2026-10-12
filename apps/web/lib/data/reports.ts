import "server-only";
import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { analysisRuns, reports, samples } from "@/db/schema";
import { newId } from "@/lib/ids";
import { safeJoin, writeFile } from "@/lib/storage";
import { recordAudit } from "@/lib/data/audit";
import { getRun } from "@/lib/data/runs";
import { getSettings } from "@/lib/data/settings";
import { renderReportJson } from "@/lib/reports/json";
import { renderReportPdf } from "@/lib/reports/pdf";
import type { Report, Run, SafeUser, Sample } from "@/lib/data/contract";

export async function listReports(filter: { q?: string; format?: "pdf" | "json" | "all" } = {}): Promise<(Report & { run: Run; sample: Sample })[]> {
  const db = await getDb();
  const conds: SQL[] = [];
  if (filter.format && filter.format !== "all") conds.push(eq(reports.format, filter.format));
  if (filter.q && filter.q.trim()) {
    const like = `%${filter.q.trim()}%`;
    conds.push(or(ilike(analysisRuns.runCode, like), ilike(samples.sampleCode, like), ilike(samples.subjectPseudonym, like))!);
  }
  const rows = await db
    .select({ report: reports, run: analysisRuns, sample: samples })
    .from(reports)
    .innerJoin(analysisRuns, eq(analysisRuns.id, reports.runId))
    .innerJoin(samples, eq(samples.id, analysisRuns.sampleId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(reports.createdAt))
    .limit(300);
  return rows.map((r) => ({ ...r.report, run: r.run, sample: r.sample }));
}

export async function generateReport(runId: string, format: "pdf" | "json", actor: SafeUser): Promise<Report> {
  const detail = await getRun(runId);
  if (!detail) throw new Error("Run not found");
  const settings = await getSettings();
  if (settings.requireReviewForReports && detail.run.status !== "reviewed") {
    throw new Error("Settings require a completed clinical review before a report can be generated.");
  }
  if (["queued", "processing"].includes(detail.run.status)) throw new Error("Run has not completed yet.");

  const generatedBy = `${actor.displayName} (${actor.roleKey})`;
  const id = newId("rpt");
  const storagePath = `reports/${detail.run.runCode}-${id}.${format}`;
  const bytes = format === "pdf" ? await renderReportPdf(detail, generatedBy) : renderReportJson(detail, generatedBy);
  const file = await writeFile(storagePath, bytes);

  const db = await getDb();
  const [row] = await db
    .insert(reports)
    .values({ id, runId, format, storagePath, byteSize: file.byteSize, sha256: file.sha256, generatedById: actor.id })
    .returning();
  await recordAudit({ actor, action: "report.generate", entityType: "run", entityId: runId, detail: { reportId: id, format, sha256: file.sha256, runCode: detail.run.runCode, synthetic: detail.run.synthetic } });
  return row;
}

export async function getReportFile(reportId: string): Promise<{ report: Report; absPath: string } | null> {
  const db = await getDb();
  const [report] = await db.select().from(reports).where(eq(reports.id, reportId)).limit(1);
  if (!report) return null;
  return { report, absPath: safeJoin(report.storagePath) };
}
