import "server-only";
import { asc, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { appSettings, stripProducts } from "@/db/schema";
import { DEFAULT_REACTION_SECONDS } from "@/lib/analytes";
import { recordAudit } from "@/lib/data/audit";
import type { AppSettingsShape, SafeUser } from "@/lib/data/contract";

export const SETTINGS_DEFAULTS: AppSettingsShape = {
  defaultStripProductId: "",
  defaultReactionSeconds: DEFAULT_REACTION_SECONDS,
  recalibrationIntervalDays: 90,
  demoModeEnabled: true,
  requireReviewForReports: false,
  cvServiceUrl: process.env.CV_SERVICE_URL ?? "http://127.0.0.1:8001",
};

const KEYS = Object.keys(SETTINGS_DEFAULTS) as (keyof AppSettingsShape)[];

function coerce<K extends keyof AppSettingsShape>(key: K, raw: unknown): AppSettingsShape[K] {
  const def = SETTINGS_DEFAULTS[key];
  if (typeof def === "number") return (typeof raw === "number" && Number.isFinite(raw) ? raw : def) as AppSettingsShape[K];
  if (typeof def === "boolean") return (typeof raw === "boolean" ? raw : def) as AppSettingsShape[K];
  return (typeof raw === "string" ? raw : def) as AppSettingsShape[K];
}

export async function getSettings(): Promise<AppSettingsShape> {
  const db = await getDb();
  const rows = await db.select().from(appSettings);
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const raw: Record<string, unknown> = {};
  for (const k of KEYS) raw[k] = coerce(k, map.get(k));
  const out = raw as unknown as AppSettingsShape;
  if (!out.defaultStripProductId) {
    const first = await db.select({ id: stripProducts.id }).from(stripProducts).orderBy(asc(stripProducts.createdAt)).limit(1);
    out.defaultStripProductId = first[0]?.id ?? "";
  }
  return out;
}

export async function updateSettings(patch: Partial<AppSettingsShape>, actor: SafeUser): Promise<AppSettingsShape> {
  const db = await getDb();
  const before = await getSettings();
  const changed: Record<string, unknown> = {};
  for (const k of KEYS) {
    if (!(k in patch) || patch[k] === undefined) continue;
    const v = coerce(k, patch[k]);
    changed[k] = v;
    await db
      .insert(appSettings)
      .values({ key: k, value: v })
      .onConflictDoUpdate({ target: appSettings.key, set: { value: v, updatedAt: sql`now()` } });
  }
  await recordAudit({ actor, action: "settings.update", entityType: "app_settings", entityId: "app", detail: { before, changed } });
  return getSettings();
}
