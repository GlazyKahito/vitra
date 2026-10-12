import { NextResponse, type NextRequest } from "next/server";
import { requireApiUser, ForbiddenError, UnauthenticatedError } from "@/lib/auth";
import { getRun, getRunByCode } from "@/lib/data/runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/runs/[id] → RunDetail (id or run code such as R-000012). */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    await requireApiUser("runs.read");
  } catch (err) {
    if (err instanceof UnauthenticatedError) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw err;
  }
  const { id } = await ctx.params;
  const detail = /^R-\d+$/.test(id) ? await getRunByCode(id) : await getRun(id);
  if (!detail) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(
    { ...detail, disclaimer: "Research prototype. Not a medical device. Not clinically validated." },
    { headers: { "cache-control": "private, no-store" } },
  );
}
