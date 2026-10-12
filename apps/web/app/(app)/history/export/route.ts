import type { NextRequest } from "next/server";
import { ForbiddenError, UnauthenticatedError, requireApiUser } from "@/lib/auth";
import { listRuns } from "@/lib/data/runs";
import { recordAudit } from "@/lib/data/audit";
import { ANALYTE_KEYS, formatAnalyteValue } from "@/lib/analytes";
import { RESULT_STATE_META, type ResultState } from "@/lib/inference/policy";
import { parseRunFilter, type SearchParams } from "@/components/console/filter-params";

export const dynamic = "force-dynamic";

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = v instanceof Date ? v.toISOString() : String(v);
  // Guard against spreadsheet formula injection.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** GET /history/export?… — CSV of the filtered runs (auth required). */
export async function GET(req: NextRequest): Promise<Response> {
  let user;
  try {
    user = await requireApiUser("runs.read");
  } catch (e) {
    if (e instanceof UnauthenticatedError) return new Response("Unauthorized", { status: 401 });
    if (e instanceof ForbiddenError) return new Response("Forbidden", { status: 403 });
    throw e;
  }

  const sp: SearchParams = {};
  req.nextUrl.searchParams.forEach((v, k) => {
    sp[k] = v;
  });
  const filter = parseRunFilter(sp, { limit: 5000 });
  const { items } = await listRuns({ ...filter, offset: 0 });

  const header = [
    "run_code",
    "run_id",
    "sample_code",
    "subject_pseudonym",
    "synthetic",
    "mode",
    "image_source",
    "status",
    "quality_passed",
    "strip_product",
    "device",
    "operator",
    "reaction_seconds",
    "reaction_started_at",
    "captured_at",
    "created_at",
    "completed_at",
    "reviewed_by",
    "review_decision",
    "reviewed_at",
    ...ANALYTE_KEYS.flatMap((k) => [`${k}_state`, `${k}_value`, `${k}_unit`]),
  ];

  const lines = [header.join(",")];
  for (const it of items) {
    const byKey = new Map(it.resultSummary.map((r) => [r.analyteKey, r]));
    const row: unknown[] = [
      it.run.runCode,
      it.run.id,
      it.sample.sampleCode,
      it.sample.subjectPseudonym,
      it.run.synthetic || it.sample.synthetic ? "SYNTHETIC" : "",
      it.run.mode,
      it.run.imageSource,
      it.run.status,
      it.run.qualityPassed === null ? "" : it.run.qualityPassed ? "true" : "false",
      `${it.stripProduct.manufacturer} ${it.stripProduct.name}`,
      it.device ? `${it.device.name}${it.device.simulated ? " (simulated)" : ""}` : "",
      it.run.operatorLabel,
      it.run.reactionSeconds,
      it.run.reactionStartedAt,
      it.run.capturedAt,
      it.run.createdAt,
      it.run.completedAt,
      it.latestReview?.reviewerLabel,
      it.latestReview?.decision,
      it.latestReview?.createdAt,
    ];
    for (const k of ANALYTE_KEYS) {
      const r = byKey.get(k);
      const state = (r?.state ?? "") as ResultState | "";
      const shows = state !== "" && RESULT_STATE_META[state]?.showsValue && r?.value !== null && r?.value !== undefined;
      row.push(state, shows ? formatAnalyteValue(k, r!.value) : "", r?.unit ?? "");
    }
    lines.push(row.map(csvCell).join(","));
  }

  await recordAudit({ actor: user, action: "history.export", entityType: "analysis_run", entityId: "filtered", detail: { count: items.length, filter: { ...filter, page: undefined } } });

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return new Response("﻿" + lines.join("\r\n") + "\r\n", {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="vitra-runs-${stamp}.csv"`,
      "cache-control": "no-store",
    },
  });
}
