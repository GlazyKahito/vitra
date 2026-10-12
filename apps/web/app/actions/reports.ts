"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { generateReport } from "@/lib/data/reports";
import { toActionError, zodMessage, type ActionResult } from "@/app/actions/_shared";

const schema = z.object({ runId: z.string().min(1), format: z.enum(["pdf", "json"]) });

/** generateReportAction(runId, format) → { reportId, downloadUrl } */
export async function generateReportAction(runId: string, format: "pdf" | "json"): Promise<ActionResult<{ reportId: string; downloadUrl: string; byteSize: number }>> {
  try {
    const user = await requireUser("reports.generate");
    const parsed = schema.safeParse({ runId, format });
    if (!parsed.success) return { ok: false, error: zodMessage(parsed.error) };
    const report = await generateReport(parsed.data.runId, parsed.data.format, user);
    revalidatePath("/reports");
    revalidatePath(`/runs/${runId}`);
    return { ok: true, reportId: report.id, downloadUrl: `/api/reports/${report.id}`, byteSize: report.byteSize };
  } catch (err) {
    return toActionError(err);
  }
}
