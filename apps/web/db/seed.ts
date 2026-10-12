/**
 * Deterministic, idempotent seed. Every generated record is SYNTHETIC (synthetic = true) and uses a
 * seeded PRNG (no Math.random). Re-running removes rows whose ids start with "seed-" and recreates them,
 * so edits made to non-seed rows survive.
 *
 *   tsx db/seed.ts
 *
 * NOTE: lib/data/* modules import "server-only" and cannot be loaded by tsx; the seed writes through
 * Drizzle directly and mirrors the same conventions.
 */
import path from "node:path";
import { inArray, like, sql } from "drizzle-orm";
import { getDb, type Db } from "@/lib/db";
import {
  analysisRuns, analyteDefinitions, analyteResults, appSettings, auditEvents, calibrationDatasets, calibrationModels,
  clinicalReviews, colourFeatures, deviceEvents, devices, images, modelEvaluations, padSegmentations, permissions,
  referenceMeasurements, reports, rolePermissions, roles, samples, sessions, stripBatches, stripProducts, users,
  type QualityCheck,
} from "@/db/schema";
import { ANALYTES, ANALYTE_BY_KEY, DEFAULT_PAD_MAP, DEFAULT_REACTION_SECONDS, demoColor, hexToRgb, type AnalyteKey } from "@/lib/analytes";
import { hashPassword } from "@/lib/auth/password";
import { PERMISSIONS, PERMISSION_DESCRIPTIONS, ROLE_KEYS, ROLE_LABELS, ROLE_PERMISSIONS } from "@/lib/auth/permissions";
import { ensureStorageDirs, writeFile } from "@/lib/storage";
import { runMigrations } from "@/db/migrate";

/* ───────── seeded PRNG (mulberry32) ───────── */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261012);
const r = (lo: number, hi: number) => lo + rand() * (hi - lo);
const ri = (lo: number, hi: number) => Math.floor(r(lo, hi + 1));
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const round = (v: number, d = 2) => Number(v.toFixed(d));
function saltFromRng(): Buffer {
  const b = Buffer.alloc(16);
  for (let i = 0; i < 16; i++) b[i] = ri(0, 255);
  return b;
}

/* ───────── colour maths (sRGB → CIELAB D65, HSV) ───────── */
function srgbToLab([R, G, B]: number[]): number[] {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const rl = lin(R), gl = lin(G), bl = lin(B);
  const X = (rl * 0.4124 + gl * 0.3576 + bl * 0.1805) / 0.95047;
  const Y = rl * 0.2126 + gl * 0.7152 + bl * 0.0722;
  const Z = (rl * 0.0193 + gl * 0.1192 + bl * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [round(116 * f(Y) - 16), round(500 * (f(X) - f(Y))), round(200 * (f(Y) - f(Z)))];
}
function rgbToHsv([R, G, B]: number[]): number[] {
  const rr = R / 255, gg = G / 255, bb = B / 255;
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb), d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === rr) h = ((gg - bb) / d) % 6;
    else if (max === gg) h = (bb - rr) / d + 2;
    else h = (rr - gg) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return [round(h, 1), round(max === 0 ? 0 : d / max, 3), round(max, 3)];
}
function padRgb(key: AnalyteKey, level: number, noise = 3): number[] {
  return hexToRgb(demoColor(key, level)).map((c) => round(Math.max(0, Math.min(255, c + r(-noise, noise))), 2));
}

/* ───────── constants ───────── */
const SEED_VERSION = 3;
const NOW = new Date();
const daysAgo = (d: number, h = 0, m = 0) => new Date(NOW.getTime() - d * 86400_000 - h * 3600_000 - m * 60_000);
const CONTINUOUS = ANALYTES.filter((a) => a.kind === "continuous").map((a) => a.key);
const MODEL_RANGES: Record<"glucose" | "protein" | "ph", [number, number]> = { glucose: [0, 1000], protein: [0, 300], ph: [5, 8.5] };
const PIPELINE = "vitra-cv/0.1.0";

const ID = {
  user: (k: string) => `seed-user-${k}`,
  product: { paramcare: "seed-strip-paramcare10", syn: "seed-strip-syn10p" },
  batch: (k: string) => `seed-batch-${k}`,
  device: { sim: "seed-device-sim-01", pi: "seed-device-pi-01" },
  dataset: "seed-dataset-synthetic-calibration-v1",
  model: (a: string) => `${a}-poly2-v1`, // matches the CV contract's example model ids
};

/* ───────── seed steps ───────── */
async function wipeSeedRows(db: Db): Promise<void> {
  await db.delete(auditEvents).where(like(auditEvents.id, "seed-%"));
  await db.delete(reports).where(like(reports.id, "seed-%"));
  await db.delete(clinicalReviews).where(like(clinicalReviews.id, "seed-%"));
  await db.delete(analysisRuns).where(like(analysisRuns.id, "seed-%"));
  await db.delete(images).where(like(images.id, "seed-%"));
  await db.delete(referenceMeasurements).where(like(referenceMeasurements.id, "seed-%"));
  await db.delete(samples).where(like(samples.id, "seed-%"));
  await db.delete(modelEvaluations).where(like(modelEvaluations.id, "seed-%"));
  await db.delete(calibrationModels).where(inArray(calibrationModels.id, ["glucose", "protein", "ph"].map(ID.model)));
  await db.delete(calibrationDatasets).where(like(calibrationDatasets.id, "seed-%"));
  await db.delete(deviceEvents).where(like(deviceEvents.id, "seed-%"));
  await db.delete(devices).where(like(devices.id, "seed-%"));
  await db.delete(stripBatches).where(like(stripBatches.id, "seed-%"));
  await db.delete(stripProducts).where(like(stripProducts.id, "seed-%"));
  await db.delete(sessions).where(like(sessions.userId, "seed-%"));
  await db.delete(users).where(like(users.id, "seed-%"));
}

async function seedAuth(db: Db): Promise<Record<string, string>> {
  for (const key of ROLE_KEYS) {
    await db.insert(roles).values({ key, ...ROLE_LABELS[key] }).onConflictDoUpdate({ target: roles.key, set: { label: ROLE_LABELS[key].label, description: ROLE_LABELS[key].description } });
  }
  for (const key of PERMISSIONS) {
    await db.insert(permissions).values({ key, description: PERMISSION_DESCRIPTIONS[key] }).onConflictDoUpdate({ target: permissions.key, set: { description: PERMISSION_DESCRIPTIONS[key] } });
  }
  await db.delete(rolePermissions);
  await db.insert(rolePermissions).values(ROLE_KEYS.flatMap((roleKey) => ROLE_PERMISSIONS[roleKey].map((permissionKey) => ({ roleKey, permissionKey }))));

  const accounts = [
    { key: "admin", email: "admin@vitra.local", displayName: "Admin (seed)", roleKey: "admin", pw: process.env.SEED_ADMIN_PASSWORD ?? "vitra-admin" },
    { key: "clinician", email: "clinician@vitra.local", displayName: "Dr. Clinician (seed)", roleKey: "clinician", pw: process.env.SEED_CLINICIAN_PASSWORD ?? "vitra-clinician" },
    { key: "operator", email: "operator@vitra.local", displayName: "Operator (seed)", roleKey: "operator", pw: process.env.SEED_OPERATOR_PASSWORD ?? "vitra-operator" },
    { key: "researcher", email: "researcher@vitra.local", displayName: "Researcher (seed)", roleKey: "researcher", pw: process.env.SEED_RESEARCHER_PASSWORD ?? "vitra-researcher" },
  ];
  const ids: Record<string, string> = {};
  for (const a of accounts) {
    const id = ID.user(a.key);
    await db.delete(users).where(sql`${users.email} = ${a.email}`);
    await db.insert(users).values({ id, email: a.email, displayName: a.displayName, passwordHash: await hashPassword(a.pw, saltFromRng()), roleKey: a.roleKey, active: true, createdAt: daysAgo(45) });
    ids[a.key] = id;
  }
  return ids;
}

async function seedAnalytes(db: Db): Promise<void> {
  for (const [i, a] of ANALYTES.entries()) {
    const row = { key: a.key, label: a.label, unit: a.unit, kind: a.kind, chartScale: [...a.chartScale], spanLow: a.span[0], spanHigh: a.span[1], decimals: a.decimals, critical: a.critical, sortOrder: i };
    await db.insert(analyteDefinitions).values(row).onConflictDoUpdate({ target: analyteDefinitions.key, set: row });
  }
}

async function seedStrips(db: Db): Promise<void> {
  await db.insert(stripProducts).values([
    {
      id: ID.product.paramcare,
      manufacturer: "Paramcare",
      name: "Paramcare 10-parameter — placeholder record, confirm pad order with product insert",
      padCount: 10,
      padMap: [...DEFAULT_PAD_MAP],
      reactionSeconds: DEFAULT_REACTION_SECONDS,
      geometry: { mode: "auto", pad_size: 0.62, roi_inset: 0.18 },
      notes: "PLACEHOLDER. Pad order, chart blocks and reaction time copied from typical 10-parameter inserts; must be confirmed against the actual Paramcare product insert before use. No calibration model exists for this product.",
      createdAt: daysAgo(40),
    },
    {
      id: ID.product.syn,
      manufacturer: "VITRA (synthetic)",
      name: "Synthetic 10-pad reference strip SYN-10P",
      padCount: 10,
      padMap: [...DEFAULT_PAD_MAP],
      reactionSeconds: DEFAULT_REACTION_SECONDS,
      geometry: { mode: "fixed", pad_centers: [0.14, 0.22, 0.3, 0.38, 0.46, 0.54, 0.62, 0.7, 0.78, 0.86], pad_size: 0.62, roi_inset: 0.18 },
      notes: "Computer-rendered strip produced by the CV service's /v1/synthetic/strip endpoint. Exists only to exercise the pipeline; colours follow the demo ramps in lib/analytes.ts and have no chemistry behind them.",
      createdAt: daysAgo(40),
    },
  ]);
  await db.insert(stripBatches).values([
    { id: ID.batch("pc-a1"), stripProductId: ID.product.paramcare, lotNumber: "PC-PLACEHOLDER-A1", expiresOn: "2027-06-30", receivedOn: "2026-09-01", notes: "Placeholder lot; replace with the real lot number from the bottle.", createdAt: daysAgo(39) },
    { id: ID.batch("pc-b2"), stripProductId: ID.product.paramcare, lotNumber: "PC-PLACEHOLDER-B2", expiresOn: "2027-09-30", receivedOn: "2026-09-20", notes: "Placeholder lot.", createdAt: daysAgo(20) },
    { id: ID.batch("syn-001"), stripProductId: ID.product.syn, lotNumber: "SYN-LOT-001", expiresOn: null, receivedOn: "2026-09-01", notes: "Synthetic — no physical lot.", createdAt: daysAgo(39) },
  ]);
}

async function seedDevices(db: Db): Promise<void> {
  // The simulated device ships with a documented dev key so `/api/ingest` can be exercised with curl (docs/device-api.md).
  const simKeyHash = await hashPassword("vdk_sim01_dev_key_do_not_use_in_production", saltFromRng());
  await db.insert(devices).values([
    {
      id: ID.device.sim,
      name: "SIM-01",
      kind: "simulated",
      simulated: true,
      hardwareId: "simulated-adapter",
      softwareVersion: "sim-0.1.0",
      cameraModel: "simulated 1600x600 renderer",
      illuminationProfile: { type: "simulated", white_led_lux: 420, note: "No physical illumination; values are fixed fixtures." },
      apiKeyHash: simKeyHash,
      lastSeenAt: daysAgo(0, 1),
      status: "simulated",
      createdAt: daysAgo(35),
    },
    {
      id: ID.device.pi,
      name: "VITRA-PI-01",
      kind: "raspberry_pi",
      simulated: false,
      hardwareId: null,
      softwareVersion: null,
      cameraModel: "Raspberry Pi Camera Module 3 (planned)",
      illuminationProfile: { type: "planned", note: "Enclosed white LED ring; profile to be measured on the prototype." },
      apiKeyHash: null,
      lastSeenAt: null, // never connected
      status: "offline",
      createdAt: daysAgo(35),
    },
  ]);

  const rotation = ["heartbeat", "heartbeat", "heartbeat", "capture_started", "capture_completed", "heartbeat", "illumination_change", "heartbeat", "calibration", "error"] as const;
  const events: (typeof deviceEvents.$inferInsert)[] = [];
  for (let i = 0; i < 40; i++) {
    const kind = rotation[i % rotation.length];
    const at = daysAgo(30 - i * 0.74, ri(0, 5), ri(0, 59));
    const base = { id: `seed-devev-${String(i + 1).padStart(3, "0")}`, deviceId: ID.device.sim, simulated: true, createdAt: at };
    switch (kind) {
      case "heartbeat":
        events.push({ ...base, kind, level: "info", message: "[SIMULATED] heartbeat", payload: { simulated: true, cpu_temp_c: round(r(35, 42), 1), uptime_s: 600 + i * 1800, free_mb: ri(380, 460) } });
        break;
      case "capture_started":
        events.push({ ...base, kind, level: "info", message: "[SIMULATED] capture started — reaction timer 120 s", payload: { simulated: true, reaction_seconds: 120, exposure_ms: 8 } });
        break;
      case "capture_completed":
        events.push({ ...base, kind, level: "info", message: "[SIMULATED] capture completed — frame queued", payload: { simulated: true, width: 1600, height: 600 } });
        break;
      case "illumination_change":
        events.push({ ...base, kind, level: "warn", message: "[SIMULATED] illumination drift; LED profile re-applied", payload: { simulated: true, lux_before: ri(400, 420), lux_after: ri(430, 450) } });
        break;
      case "calibration":
        events.push({ ...base, kind, level: "info", message: "[SIMULATED] white-reference check passed", payload: { simulated: true, white_ref_rgb: [round(r(240, 250)), round(r(240, 250)), round(r(238, 248))] } });
        break;
      case "error":
        events.push({ ...base, kind, level: "error", message: "[SIMULATED] camera timeout (synthetic fault for UI testing)", payload: { simulated: true, code: "E_CAM_TIMEOUT" } });
        break;
    }
  }
  await db.insert(deviceEvents).values(events);
}

interface SeedSample { id: string; code: string; subject: string; levels: Record<AnalyteKey, number> }

async function seedSamples(db: Db, operatorId: string): Promise<SeedSample[]> {
  // Subjects A–D carry several samples each so subject trends have 3–4+ points; E–H are single samples.
  const subjects = ["SUBJ-SYN-A", "SUBJ-SYN-A", "SUBJ-SYN-A", "SUBJ-SYN-A", "SUBJ-SYN-B", "SUBJ-SYN-B", "SUBJ-SYN-B", "SUBJ-SYN-B", "SUBJ-SYN-C", "SUBJ-SYN-C", "SUBJ-SYN-C", "SUBJ-SYN-D", "SUBJ-SYN-D", "SUBJ-SYN-D", "SUBJ-SYN-E", "SUBJ-SYN-F", "SUBJ-SYN-G", "SUBJ-SYN-H"];
  const subjectBase = new Map<string, Record<AnalyteKey, number>>();
  const out: SeedSample[] = [];
  for (let i = 0; i < 18; i++) {
    const subject = subjects[i];
    if (!subjectBase.has(subject)) {
      subjectBase.set(subject, Object.fromEntries(ANALYTES.map((a) => [a.key, r(0.1, 0.8)])) as Record<AnalyteKey, number>);
    }
    const base = subjectBase.get(subject)!;
    const levels = Object.fromEntries(ANALYTES.map((a) => [a.key, Math.max(0, Math.min(1, base[a.key] + r(-0.12, 0.12)))])) as Record<AnalyteKey, number>;
    const code = `SYN-${String(i + 1).padStart(4, "0")}`;
    const id = `seed-sample-${String(i + 1).padStart(4, "0")}`;
    await db.insert(samples).values({ id, sampleCode: code, subjectPseudonym: subject, synthetic: true, metadata: { synthetic: true, generator: "db/seed.ts", note: "Synthetic sample — no human material." }, createdById: operatorId, createdAt: daysAgo(31 - i * 1.6) });
    out.push({ id, code, subject, levels });
  }
  // A few synthetic "reference" rows so the sample detail screen has something to show (method = synthetic).
  const refs: (typeof referenceMeasurements.$inferInsert)[] = [];
  for (const s of out.slice(0, 6)) {
    for (const key of ["glucose", "protein", "ph"] as const) {
      const [lo, hi] = MODEL_RANGES[key];
      refs.push({ id: `seed-ref-${s.code}-${key}`, sampleId: s.id, sampleCode: s.code, analyteKey: key, value: round(lo + s.levels[key] * (hi - lo), ANALYTE_BY_KEY[key].decimals), unit: ANALYTE_BY_KEY[key].unit, method: "synthetic", synthetic: true, measuredAt: daysAgo(30), createdAt: daysAgo(30) });
    }
  }
  await db.insert(referenceMeasurements).values(refs);
  return out;
}

/* ───────── calibration dataset + models ───────── */
function csvRow(cells: (string | number)[]): string {
  return cells.join(",");
}

async function seedCalibration(db: Db, researcherId: string): Promise<void> {
  const header = ["sample_id", "strip_product", "batch", "synthetic", "split", ...Array.from({ length: 10 }, (_, p) => ["r", "g", "b"].map((c) => `p${String(p + 1).padStart(2, "0")}_${c}`)).flat(), ...Array.from({ length: 10 }, (_, p) => ["l", "a", "bb"].map((c) => `p${String(p + 1).padStart(2, "0")}_${c}`)).flat(), ...CONTINUOUS.map((k) => `ref_${k}`)];
  const rows: { sampleId: string; split: "train" | "test"; refs: Record<string, number> }[] = [];
  const lines = [csvRow(header)];
  for (let i = 0; i < 240; i++) {
    const sampleId = `SYNCAL-${String(i + 1).padStart(4, "0")}`;
    const split: "train" | "test" = i % 4 === 3 ? "test" : "train";
    const levels = Object.fromEntries(DEFAULT_PAD_MAP.map((k) => [k, rand()])) as Record<AnalyteKey, number>;
    const rgb = DEFAULT_PAD_MAP.map((k) => padRgb(k, levels[k], 4));
    const lab = rgb.map(srgbToLab);
    const refs: Record<string, number> = {};
    for (const k of CONTINUOUS) {
      const [lo, hi] = (MODEL_RANGES as Record<string, [number, number]>)[k] ?? ANALYTE_BY_KEY[k].span;
      refs[k] = round(lo + levels[k] * (hi - lo), ANALYTE_BY_KEY[k].decimals);
    }
    rows.push({ sampleId, split, refs });
    lines.push(csvRow([sampleId, "SYN-10P", "SYN-LOT-001", "true", split, ...rgb.flat(), ...lab.flat(), ...CONTINUOUS.map((k) => refs[k])]));
  }
  const csv = lines.join("\n") + "\n";
  const storagePath = "datasets/synthetic_calibration_v1.csv";
  const file = await writeFile(storagePath, csv);
  await db.insert(calibrationDatasets).values({
    id: ID.dataset,
    name: "Synthetic calibration set v1 (SYN-10P)",
    version: 1,
    stripProductId: ID.product.syn,
    stripBatchId: ID.batch("syn-001"),
    synthetic: true,
    rowCount: 240,
    columns: header,
    storagePath,
    sha256: file.sha256,
    validation: { ok: true, rows: 240, synthetic_rows: 240, per_analyte_counts: Object.fromEntries(CONTINUOUS.map((k) => [k, 240])), issues: [{ level: "info", message: "All rows are synthetic (generated from demo colour ramps)." }], source: "db/seed.ts" },
    notes: "SYNTHETIC. Colours derived from lib/analytes.ts demo ramps with seeded noise; reference values are the generating levels mapped to a nominal range. Demonstrates the import → train → infer loop only.",
    createdById: researcherId,
    createdAt: daysAgo(28),
  });

  for (const key of ["glucose", "protein", "ph"] as const) {
    const [lo, hi] = MODEL_RANGES[key];
    const dec = ANALYTE_BY_KEY[key].decimals;
    const sd = (hi - lo) * 0.045;
    const mkPoints = (subset: typeof rows, n: number, split: string) =>
      subset.slice(0, n).map((row) => {
        const reference = row.refs[key];
        const predicted = round(reference + r(-sd * 1.8, sd * 1.8), dec);
        return { sample_id: row.sampleId, reference, predicted, residual: round(predicted - reference, dec), split, batch: "SYN-LOT-001" };
      });
    const metrics = (pts: { reference: number; predicted: number; residual: number }[]) => {
      const n = pts.length;
      const mae = pts.reduce((s, p) => s + Math.abs(p.residual), 0) / n;
      const rmse = Math.sqrt(pts.reduce((s, p) => s + p.residual ** 2, 0) / n);
      const bias = pts.reduce((s, p) => s + p.residual, 0) / n;
      const mean = pts.reduce((s, p) => s + p.reference, 0) / n;
      const ssTot = pts.reduce((s, p) => s + (p.reference - mean) ** 2, 0);
      const ssRes = pts.reduce((s, p) => s + p.residual ** 2, 0);
      return { n, mae: round(mae, 3), rmse: round(rmse, 3), bias: round(bias, 3), r2: round(ssTot === 0 ? 0 : 1 - ssRes / ssTot, 4) };
    };
    const trainPts = mkPoints(rows.filter((x) => x.split === "train"), 60, "train");
    const testPts = mkPoints(rows.filter((x) => x.split === "test"), 60, "test");
    const cvPts = mkPoints(rows.filter((x) => x.split === "train").slice(60), 60, "cv5");
    const sortedRes = [...testPts.map((p) => p.residual)].sort((a, b) => a - b);
    const q = (p: number) => round(sortedRes[Math.min(sortedRes.length - 1, Math.floor(p * sortedRes.length))], dec);
    const residualQuantiles = { p05: q(0.05), p50: q(0.5), p95: q(0.95) };
    const nTrain = rows.filter((x) => x.split === "train").length;
    const nTest = rows.length - nTrain;
    await db.insert(calibrationModels).values({
      id: ID.model(key),
      analyteKey: key,
      stripProductId: ID.product.syn,
      datasetId: ID.dataset,
      version: `${key}-poly2-v1`,
      modelType: "poly2_ridge",
      featureSet: "rgb30",
      status: "trained",
      trainedOnSynthetic: true,
      referenceLow: lo,
      referenceHigh: hi,
      nTrain,
      nTest,
      trainingMeta: { synthetic_fraction: 1, seed: 42, test_fraction: 0.25, fixture: true, note: "Seeded fixture: evaluation points are synthetic and were not produced by the CV service. Train a model from the dataset to replace it.", dataset_sha256: file.sha256 },
      validationEvidence: null,
      createdById: researcherId,
      createdAt: daysAgo(27),
    });
    await db.insert(modelEvaluations).values([
      { id: `seed-eval-${key}-train`, modelId: ID.model(key), split: "train", ...metrics(trainPts), predictions: trainPts, createdAt: daysAgo(27) },
      { id: `seed-eval-${key}-test`, modelId: ID.model(key), split: "test", ...metrics(testPts), residualQuantiles, predictions: testPts, createdAt: daysAgo(27) },
      { id: `seed-eval-${key}-cv5`, modelId: ID.model(key), split: "cv5", ...metrics(cvPts), predictions: cvPts, createdAt: daysAgo(27) },
    ]);
  }
}

/* ───────── runs ───────── */
function qualityChecks(fail: "blur" | "overexposure" | "strip_visible" | "obstruction" | null): QualityCheck[] {
  const ok = (id: string, label: string, value: string | number, threshold: string, message: string): QualityCheck => ({ id, label, status: "pass", value, threshold, message });
  const checks: QualityCheck[] = [
    ok("format", "File format", "png", "jpeg|png|webp|bmp|tiff", "Supported format."),
    ok("resolution", "Resolution", "1600x600", ">= 640x200", "Resolution sufficient."),
    ok("blur", "Sharpness (Laplacian var.)", round(r(180, 420), 1), ">= 60", "Image is sharp."),
    ok("overexposure", "Overexposure", round(r(0, 0.6), 2), "<= 2% clipped", "No clipped highlights."),
    ok("underexposure", "Underexposure", round(r(0, 0.8), 2), "<= 5% dark", "Exposure adequate."),
    ok("strip_visible", "Strip visible", "yes", "strip found", "Strip localised."),
    ok("orientation", "Orientation", round(r(-3, 3), 1), "|angle| <= 15°", "Within tolerance."),
    ok("obstruction", "Obstruction", round(r(0, 0.3), 2), "<= 2% occluded", "No obstruction."),
    ok("pads_visible", "Pads visible", 10, "== 10", "All pads located."),
  ];
  if (!fail) return checks;
  const idx = checks.findIndex((c) => c.id === fail);
  const failed: Record<string, QualityCheck> = {
    blur: { id: "blur", label: "Sharpness (Laplacian var.)", status: "fail", value: round(r(12, 40), 1), threshold: ">= 60", message: "Image too blurry to segment pads reliably." },
    overexposure: { id: "overexposure", label: "Overexposure", status: "fail", value: round(r(6, 14), 2), threshold: "<= 2% clipped", message: "Clipped highlights on pad surfaces." },
    strip_visible: { id: "strip_visible", label: "Strip visible", status: "fail", value: "no", threshold: "strip found", message: "No strip-shaped region found." },
    obstruction: { id: "obstruction", label: "Obstruction", status: "fail", value: round(r(8, 20), 2), threshold: "<= 2% occluded", message: "Foreign object covers part of the strip." },
  };
  checks[idx] = failed[fail];
  if (fail === "strip_visible") checks[checks.length - 1] = { id: "pads_visible", label: "Pads visible", status: "fail", value: 0, threshold: "== 10", message: "No pads located." };
  return checks;
}

async function seedRuns(db: Db, seedSamples: SeedSample[], userIds: Record<string, string>): Promise<{ runIds: string[]; audits: (typeof auditEvents.$inferInsert)[] }> {
  const audits: (typeof auditEvents.$inferInsert)[] = [];
  const runIds: string[] = [];
  const invalidSet = new Set([8, 17, 26, 35]);
  const researchSet = new Set([2, 7, 12, 20, 25, 30]);
  const rejectedSet = new Set([4, 22]);
  const failKinds = ["blur", "overexposure", "strip_visible", "obstruction"] as const;
  let auditSeq = 0;
  const audit = (ev: Omit<typeof auditEvents.$inferInsert, "id">) => audits.push({ id: `seed-audit-${String(++auditSeq).padStart(4, "0")}`, ...ev });
  const actorLabel = (k: string) => `${k === "admin" ? "Admin (seed)" : k === "clinician" ? "Dr. Clinician (seed)" : k === "operator" ? "Operator (seed)" : "Researcher (seed)"} <${k}@vitra.local>`;

  for (let i = 0; i < 36; i++) {
    const sample = seedSamples[i % 18];
    const runNo = i + 1;
    const runId = `seed-run-${String(runNo).padStart(4, "0")}`;
    const runCode = `R-${String(runNo).padStart(6, "0")}`;
    const createdAt = daysAgo(29.5 - i * 0.8, ri(0, 3), ri(0, 59));
    const completedAt = new Date(createdAt.getTime() + ri(4, 11) * 1000);
    const isInvalid = invalidSet.has(i);
    const isResearch = researchSet.has(i);
    const mode = isResearch ? "research" : "demo";
    const productId = isResearch ? ID.product.paramcare : ID.product.syn;
    const batchId = isResearch ? (i % 2 ? ID.batch("pc-b2") : ID.batch("pc-a1")) : ID.batch("syn-001");
    const viaDevice = i % 3 === 0;
    const imageSource = viaDevice ? "device" : isResearch ? "upload" : "synthetic";
    const operatorKey = viaDevice ? null : i % 2 ? "operator" : "researcher";
    const imageId = `seed-image-${String(runNo).padStart(4, "0")}`;
    // Run-level drift so trends move: later runs for a subject shift levels slightly.
    const drift = (i % 18) / 18;
    const levels = Object.fromEntries(ANALYTES.map((a) => [a.key, Math.max(0, Math.min(1, sample.levels[a.key] + (drift - 0.5) * 0.15 + r(-0.04, 0.04)))])) as Record<AnalyteKey, number>;

    // Image row. Seeded runs point at placeholder paths; files are not rendered by the seed (synthetic PNGs come from the CV service on demand).
    await db.insert(images).values({
      id: imageId,
      sampleId: sample.id,
      source: imageSource,
      deviceId: viaDevice ? ID.device.sim : null,
      storagePath: `images/${imageId}.png`,
      overlayPath: isInvalid ? null : `overlays/${imageId}.png`,
      stripCropPath: isInvalid ? null : `strips/${imageId}.png`,
      mimeType: "image/png",
      byteSize: ri(180_000, 420_000),
      width: 1600,
      height: 600,
      sha256: Array.from({ length: 64 }, () => "0123456789abcdef"[ri(0, 15)]).join(""),
      capturedAt: createdAt,
      idempotencyKey: viaDevice ? `${ID.device.sim}:seed-${runNo}` : null,
      createdAt,
    });

    const failKind = isInvalid ? failKinds[[...invalidSet].indexOf(i)] : null;
    const checks = qualityChecks(failKind);
    const qualityPassed = !isInvalid;
    const angle = round(r(-2.5, 2.5), 2);
    const stripGeometry = isInvalid && failKind === "strip_visible"
      ? { found: false, polygon: [], bbox: { x: 0, y: 0, w: 0, h: 0 }, angle_deg: 0, rotated_90: false, flipped: false, rectified_width: 0, rectified_height: 0 }
      : { found: true, polygon: [[120, 190], [1480, 196], [1478, 410], [118, 404]], bbox: { x: 118, y: 190, w: 1362, h: 220 }, angle_deg: angle, rotated_90: false, flipped: false, rectified_width: 1360, rectified_height: 216 };

    const rgbVec: number[] = [];
    const labVec: number[] = [];
    const padStates = new Map<AnalyteKey, "ok" | "warn" | "fail">();
    if (!isInvalid) {
      for (let p = 0; p < 10; p++) {
        const key = DEFAULT_PAD_MAP[p];
        const rgbMean = padRgb(key, levels[key]);
        const labMean = srgbToLab(rgbMean);
        rgbVec.push(...rgbMean);
        labVec.push(...labMean);
        const roll = rand();
        const qualityStatus: "ok" | "warn" | "fail" = roll < 0.06 ? "fail" : roll < 0.2 ? "warn" : "ok";
        padStates.set(key, qualityStatus);
        const flags = qualityStatus === "fail" ? [pick(["specular", "occluded", "low_contrast"])] : qualityStatus === "warn" ? [pick(["low_uniformity", "clipped"])] : [];
        const segId = `seed-pad-${String(runNo).padStart(4, "0")}-${p}`;
        await db.insert(padSegmentations).values({
          id: segId,
          runId,
          padIndex: p,
          padId: `P${String(p + 1).padStart(2, "0")}`,
          analyteKey: key,
          roi: { x: 60 + p * 128, y: 40, w: 96, h: 136 },
          roiSource: isResearch ? "detected" : "fixed",
          qualityStatus,
          qualityMetrics: { uniformity: round(qualityStatus === "fail" ? r(0.4, 0.65) : qualityStatus === "warn" ? r(0.7, 0.85) : r(0.88, 0.99), 3), specular_fraction: round(flags.includes("specular") ? r(0.1, 0.3) : r(0, 0.02), 3), coverage: round(flags.includes("occluded") ? r(0.4, 0.7) : r(0.96, 1), 3), edge_contrast: round(flags.includes("low_contrast") ? r(0.05, 0.12) : r(0.3, 0.55), 3) },
          flags,
        });
        await db.insert(colourFeatures).values({
          id: `seed-cf-${String(runNo).padStart(4, "0")}-${p}`,
          padSegmentationId: segId,
          rgbMean,
          rgbMedian: rgbMean.map((c) => round(c + r(-1, 1), 2)),
          rgbStd: [round(r(1.5, 5), 2), round(r(1.5, 5), 2), round(r(1.5, 5), 2)],
          labMean,
          labStd: [round(r(0.4, 1.6), 2), round(r(0.3, 1.2), 2), round(r(0.3, 1.2), 2)],
          hsvMean: rgbToHsv(rgbMean),
          pixelCount: ri(7800, 8400),
        });
      }
    }

    // Results via the same policy the live pipeline applies.
    const states: string[] = [];
    for (let p = 0; p < 10; p++) {
      const key = DEFAULT_PAD_MAP[p];
      const def = ANALYTE_BY_KEY[key];
      let state: string;
      let value: number | null = null;
      let intervalLow: number | null = null;
      let intervalHigh: number | null = null;
      let modelId: string | null = null;
      let reason: string;
      const padState = padStates.get(key);
      const hasModel = !isResearch && (key === "glucose" || key === "protein" || key === "ph");
      if (isInvalid) {
        state = "invalid_image";
        reason = "Image failed quality checks.";
      } else if (padState === "fail") {
        state = "indeterminate";
        reason = "Pad region failed quality checks.";
      } else if (!hasModel) {
        state = "calibration_required";
        reason = isResearch ? `No trained calibration model for ${def.label} on this strip product.` : `No trained calibration model for ${def.label} on this strip product.`;
      } else {
        const k = key as "glucose" | "protein" | "ph";
        const [lo, hi] = MODEL_RANGES[k];
        state = "synthetic";
        modelId = ID.model(k);
        value = round(lo + levels[key] * (hi - lo) + r(-(hi - lo) * 0.03, (hi - lo) * 0.03), def.decimals);
        value = Math.max(lo, Math.min(hi, value));
        intervalLow = round(Math.max(lo, value - (hi - lo) * 0.08), def.decimals);
        intervalHigh = round(Math.min(hi, value + (hi - lo) * 0.08), def.decimals);
        reason = "Synthetic-data model (demo mode).";
      }
      states.push(state);
      await db.insert(analyteResults).values({ id: `seed-res-${String(runNo).padStart(4, "0")}-${key}`, runId, analyteKey: key, padIndex: p, state, value, unit: def.unit, intervalLow, intervalHigh, modelId, reason });
    }

    let status: string;
    if (isInvalid) status = "invalid_image";
    else if (isResearch) status = "calibration_required";
    else if (rejectedSet.has(i)) status = "rejected";
    else status = i % 2 === 0 ? "reviewed" : "pending_review";

    const operatorId = operatorKey ? userIds[operatorKey] : null;
    await db.insert(analysisRuns).values({
      id: runId,
      runCode,
      sampleId: sample.id,
      imageId,
      stripProductId: productId,
      stripBatchId: batchId,
      deviceId: viaDevice ? ID.device.sim : null,
      operatorId,
      operatorLabel: viaDevice ? "device SIM-01 (simulated)" : operatorKey === "operator" ? "Operator (seed)" : "Researcher (seed)",
      mode,
      imageSource,
      status,
      reactionSeconds: DEFAULT_REACTION_SECONDS,
      reactionStartedAt: new Date(createdAt.getTime() - DEFAULT_REACTION_SECONDS * 1000),
      capturedAt: createdAt,
      pipelineVersion: PIPELINE,
      qualityPassed,
      qualityChecks: checks,
      stripGeometry,
      featureVector: isInvalid ? null : { rgb_30: rgbVec, lab_30: labVec },
      timings: { decode: ri(8, 20), quality: ri(20, 60), localize: ri(30, 90), segment: ri(10, 30), features: ri(5, 15), total: ri(90, 220) },
      warnings: isInvalid ? ["Synthetic fixture: quality failure injected for UI testing."] : isResearch ? ["No calibration model exists for this strip product; values withheld."] : ["Synthetic demo run: values come from a model trained on synthetic data."],
      synthetic: true,
      errorMessage: null,
      createdAt,
      completedAt,
    });
    runIds.push(runId);

    const actorKey = operatorKey ?? "operator";
    audit({ actorId: operatorId, actorLabel: viaDevice ? "device SIM-01 (simulated)" : actorLabel(actorKey), action: "run.create", entityType: "run", entityId: runId, detail: { runCode, sampleCode: sample.code, mode, imageSource, synthetic: true }, createdAt });
    audit({ actorId: operatorId, actorLabel: viaDevice ? "device SIM-01 (simulated)" : actorLabel(actorKey), action: "run.complete", entityType: "run", entityId: runId, detail: { runCode, status: isInvalid ? "invalid_image" : isResearch ? "calibration_required" : "pending_review", qualityPassed, states }, createdAt: completedAt });

    // Reviews for demo runs that reached a decision.
    if (status === "reviewed" || status === "rejected") {
      const reviewedAt = new Date(completedAt.getTime() + ri(2, 30) * 3600_000);
      const decision = status === "rejected" ? "rejected" : "accepted";
      const note = status === "rejected"
        ? pick(["Pad P03 flagged specular; repeat capture under the enclosure.", "Strip angle and pad coverage marginal; repeat with fresh strip."])
        : pick(["Synthetic demo run reviewed for pipeline QA only.", "Pipeline output consistent with synthetic levels; no clinical interpretation.", "Reviewed as part of demo walkthrough."]);
      await db.insert(clinicalReviews).values({ id: `seed-review-${String(runNo).padStart(4, "0")}`, runId, reviewerId: userIds.clinician, reviewerLabel: "Dr. Clinician (seed) (clinician)", decision, note, createdAt: reviewedAt });
      audit({ actorId: userIds.clinician, actorLabel: actorLabel("clinician"), action: `review.${decision}`, entityType: "run", entityId: runId, detail: { runCode, statusAfter: status }, createdAt: reviewedAt });
      if (i % 6 === 0) {
        await db.insert(clinicalReviews).values({ id: `seed-review-${String(runNo).padStart(4, "0")}-note`, runId, reviewerId: userIds.clinician, reviewerLabel: "Dr. Clinician (seed) (clinician)", decision: "note", note: "Follow-up: compare with the subject's earlier synthetic runs.", createdAt: new Date(reviewedAt.getTime() + 600_000) });
        audit({ actorId: userIds.clinician, actorLabel: actorLabel("clinician"), action: "review.note", entityType: "run", entityId: runId, detail: { runCode }, createdAt: new Date(reviewedAt.getTime() + 600_000) });
      }
    }
  }

  // System / auth / calibration events to round out the trail.
  audit({ actorId: userIds.admin, actorLabel: actorLabel("admin"), action: "seed.apply", entityType: "system", entityId: "seed", detail: { version: SEED_VERSION, synthetic: true }, createdAt: daysAgo(31) });
  audit({ actorId: userIds.researcher, actorLabel: actorLabel("researcher"), action: "dataset.import", entityType: "dataset", entityId: ID.dataset, detail: { rowCount: 240, synthetic: true }, createdAt: daysAgo(28) });
  for (const k of ["glucose", "protein", "ph"]) audit({ actorId: userIds.researcher, actorLabel: actorLabel("researcher"), action: "model.train", entityType: "model", entityId: ID.model(k), detail: { analyteKey: k, trainedOnSynthetic: true, fixture: true }, createdAt: daysAgo(27) });
  for (const [k, d] of [["admin", 30], ["researcher", 28], ["operator", 24], ["clinician", 20], ["operator", 12], ["clinician", 6], ["admin", 2]] as const) {
    audit({ actorId: userIds[k], actorLabel: actorLabel(k), action: "auth.login", entityType: "user", entityId: userIds[k], detail: null, createdAt: daysAgo(d, ri(0, 9)) });
  }
  audit({ actorId: userIds.admin, actorLabel: actorLabel("admin"), action: "device.key_rotate", entityType: "device", entityId: ID.device.sim, detail: { name: "SIM-01" }, createdAt: daysAgo(33) });
  audit({ actorId: userIds.admin, actorLabel: actorLabel("admin"), action: "settings.update", entityType: "app_settings", entityId: "app", detail: { changed: { demoModeEnabled: true } }, createdAt: daysAgo(32) });
  return { runIds, audits };
}

async function seedSettings(db: Db): Promise<void> {
  // Default strip product is the synthetic SYN-10P: it is the only product with (synthetic) models, so the
  // out-of-the-box demo flow produces labelled synthetic values instead of "calibration required" everywhere.
  const defaults: Record<string, unknown> = {
    defaultStripProductId: ID.product.syn,
    defaultReactionSeconds: DEFAULT_REACTION_SECONDS,
    recalibrationIntervalDays: 90,
    demoModeEnabled: true,
    requireReviewForReports: false,
    cvServiceUrl: process.env.CV_SERVICE_URL ?? "http://127.0.0.1:8001",
    "seed.version": SEED_VERSION,
    "seed.appliedAt": NOW.toISOString(),
  };
  for (const [key, value] of Object.entries(defaults)) {
    await db.insert(appSettings).values({ key, value }).onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: sql`now()` } });
  }
}

export async function seed(db?: Db, log: (s: string) => void = console.log): Promise<void> {
  const d = db ?? (await getDb());
  await runMigrations(d, log);
  await ensureStorageDirs();
  log("removing previous seed rows");
  await wipeSeedRows(d);
  log("roles, permissions, users");
  const userIds = await seedAuth(d);
  log("analytes, strip products, devices");
  await seedAnalytes(d);
  await seedStrips(d);
  await seedDevices(d);
  log("samples");
  const seedSamplesRows = await seedSamples(d, userIds.operator);
  log("calibration dataset + models (synthetic)");
  await seedCalibration(d, userIds.researcher);
  log("runs, results, reviews, audit");
  const { audits } = await seedRuns(d, seedSamplesRows, userIds);
  await d.insert(auditEvents).values(audits);
  await seedSettings(d);
  log(`seed v${SEED_VERSION} complete: 4 users, 2 strip products, 3 batches, 2 devices, 18 samples, 36 runs, 3 synthetic models, ${audits.length} audit events`);
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(process.cwd(), "db", "seed.ts");
if (isDirect) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
