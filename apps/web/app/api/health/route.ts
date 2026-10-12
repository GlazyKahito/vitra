import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { health as cvHealth, CV_SERVICE_URL } from "@/lib/cv/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const startedAt = Date.now();
  let db: { ok: boolean; driver: string; error?: string } = { ok: false, driver: process.env.DATABASE_URL ? "postgres" : "pglite" };
  try {
    const d = await getDb();
    await d.execute(sql`select 1`);
    db = { ...db, ok: true };
  } catch (err) {
    db = { ...db, ok: false, error: (err as Error).message };
  }
  let cv: Record<string, unknown> = { ok: false, url: CV_SERVICE_URL };
  try {
    const h = await cvHealth(2500);
    cv = { ok: h.status === "ok", url: CV_SERVICE_URL, version: h.version, pipeline_version: h.pipeline_version, opencv_version: h.opencv_version, models_loaded: h.models_loaded };
  } catch (err) {
    cv = { ok: false, url: CV_SERVICE_URL, error: (err as Error).message };
  }
  const ok = db.ok; // CV being down degrades but does not fail the web app.
  return NextResponse.json(
    {
      status: ok ? (cv.ok ? "ok" : "degraded") : "error",
      service: "vitra-web",
      version: "0.1.0",
      db,
      cv,
      latency_ms: Date.now() - startedAt,
      disclaimer: "Research prototype. Not a medical device. Not clinically validated.",
    },
    { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
