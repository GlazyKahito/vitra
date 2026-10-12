import { promises as fs } from "node:fs";
import { NextResponse, type NextRequest } from "next/server";
import { requireApiUser, ForbiddenError, UnauthenticatedError } from "@/lib/auth";
import { contentTypeFor, safeJoin, StoragePathError } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Serves files under STORAGE_DIR to authenticated users. Reports are served by /api/reports/[id] (audited). */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ path: string[] }> }): Promise<Response> {
  try {
    await requireApiUser("runs.read");
  } catch (err) {
    if (err instanceof UnauthenticatedError) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw err;
  }
  const { path: segments } = await ctx.params;
  const rel = (segments ?? []).map((s) => decodeURIComponent(s)).join("/");
  if (!/^(images|overlays|strips|datasets)\//.test(rel)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  let abs: string;
  try {
    abs = safeJoin(rel);
  } catch (err) {
    if (err instanceof StoragePathError) return NextResponse.json({ error: "bad_path" }, { status: 400 });
    throw err;
  }
  try {
    const data = await fs.readFile(abs);
    return new Response(new Uint8Array(data), {
      status: 200,
      headers: {
        "content-type": contentTypeFor(abs),
        "content-length": String(data.byteLength),
        "cache-control": "private, max-age=3600",
        "x-content-type-options": "nosniff",
        "content-disposition": "inline",
      },
    });
  } catch {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
}
