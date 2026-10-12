import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { requireApiUser, ForbiddenError, UnauthenticatedError } from "@/lib/auth";
import { recordAudit } from "@/lib/data/audit";
import { getReportFile } from "@/lib/data/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  let user;
  try {
    user = await requireApiUser("reports.read");
  } catch (err) {
    if (err instanceof UnauthenticatedError) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw err;
  }
  const { id } = await ctx.params;
  const found = await getReportFile(id);
  if (!found) return NextResponse.json({ error: "not_found" }, { status: 404 });
  let data: Buffer;
  try {
    data = await fs.readFile(found.absPath);
  } catch {
    return NextResponse.json({ error: "file_missing" }, { status: 404 });
  }
  await recordAudit({ actor: user, action: "report.download", entityType: "run", entityId: found.report.runId, detail: { reportId: id, format: found.report.format, sha256: found.report.sha256 } });
  const fileName = path.basename(found.report.storagePath);
  return new Response(new Uint8Array(data), {
    status: 200,
    headers: {
      "content-type": found.report.format === "pdf" ? "application/pdf" : "application/json; charset=utf-8",
      "content-length": String(data.byteLength),
      "content-disposition": `attachment; filename="${fileName}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
