import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireApiUser, ForbiddenError, UnauthenticatedError } from "@/lib/auth";
import { ANALYTE_KEYS } from "@/lib/analytes";
import { CvServiceError, syntheticStrip } from "@/lib/cv/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const levelsSchema = z.record(z.enum(ANALYTE_KEYS), z.number().min(0).max(1));
const bodySchema = z.object({
  seed: z.number().int().min(0).max(2 ** 31 - 1).optional(),
  levels: levelsSchema.optional(),
  width: z.number().int().min(320).max(4096).optional(),
  height: z.number().int().min(120).max(2048).optional(),
  rotation_deg: z.number().min(-45).max(45).optional(),
  blur: z.number().min(0).max(20).optional(),
  exposure: z.number().min(0.2).max(3).optional(),
});

/** Proxies the CV service's synthetic strip renderer. Output is SYNTHETIC and labelled as such via headers. */
async function handle(input: unknown): Promise<Response> {
  try {
    await requireApiUser("runs.read");
  } catch (err) {
    if (err instanceof UnauthenticatedError) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw err;
  }
  const parsed = bodySchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 422 });
  try {
    const png = await syntheticStrip(parsed.data);
    return new Response(new Uint8Array(png).buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "content-type": "image/png",
        "cache-control": "private, no-store",
        "x-vitra-synthetic": "true",
        "content-disposition": `inline; filename="synthetic-strip-${parsed.data.seed ?? 0}.png"`,
      },
    });
  } catch (err) {
    if (err instanceof CvServiceError) return NextResponse.json({ error: err.code, message: err.message }, { status: err.unreachable ? 503 : 502 });
    throw err;
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  return handle(body);
}

export async function GET(req: NextRequest): Promise<Response> {
  const sp = req.nextUrl.searchParams;
  const num = (k: string) => (sp.has(k) ? Number(sp.get(k)) : undefined);
  const levels: Record<string, number> = {};
  for (const k of ANALYTE_KEYS) if (sp.has(k)) levels[k] = Number(sp.get(k));
  return handle({
    seed: num("seed"),
    width: num("width"),
    height: num("height"),
    rotation_deg: num("rotation_deg"),
    blur: num("blur"),
    exposure: num("exposure"),
    levels: Object.keys(levels).length ? levels : undefined,
  });
}
