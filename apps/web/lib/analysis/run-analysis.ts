import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { analysisRuns, analyteResults, colourFeatures, images, padSegmentations, samples, stripProducts } from "@/db/schema";
import { ANALYTE_BY_KEY, isAnalyteKey, type AnalyteKey } from "@/lib/analytes";
import { decideResult, runStatusFromStates, type ModelCandidate, type ResultState } from "@/lib/inference/policy";
import { analyze, CvServiceError, infer, type AnalyzeResponse, type PadResult } from "@/lib/cv/client";
import { newId } from "@/lib/ids";
import { extensionForMime, writeFile } from "@/lib/storage";
import { validateImage } from "@/lib/analysis/image-validate";
import { recordAudit } from "@/lib/data/audit";
import { findActiveModel } from "@/lib/data/calibration";
import { nextRunCode } from "@/lib/data/runs";
import { recordDeviceEvent } from "@/lib/data/devices";
import type { CalibrationModel, Run, SafeUser, StartAnalysisInput } from "@/lib/data/contract";

export class AnalysisInputError extends Error {
  readonly code: "invalid_image" | "sample_not_found" | "strip_product_not_found" | "mode_not_allowed";
  constructor(code: AnalysisInputError["code"], message: string) {
    super(message);
    this.name = "AnalysisInputError";
    this.code = code;
  }
}

export interface StartAnalysisResult {
  runId: string;
  runCode: string;
  status: Run["status"];
}

export interface StartAnalysisOptions {
  /** Device ingestion sets this so a duplicate Idempotency-Key maps to the existing run. */
  idempotencyKey?: string | null;
  capturedAt?: Date | null;
}

function toCandidate(m: CalibrationModel): ModelCandidate {
  return {
    id: m.id,
    analyte: m.analyteKey as AnalyteKey,
    stripProductId: m.stripProductId,
    version: m.version,
    status: m.status as ModelCandidate["status"],
    trainedOnSynthetic: m.trainedOnSynthetic,
    referenceRange: m.referenceLow !== null && m.referenceHigh !== null ? [m.referenceLow, m.referenceHigh] : null,
  };
}

async function storeB64Png(relPath: string, b64: string | null): Promise<string | null> {
  if (!b64) return null;
  try {
    await writeFile(relPath, Buffer.from(b64, "base64"));
    return relPath;
  } catch {
    return null;
  }
}

/**
 * Full analysis pipeline for one image:
 * store original → CV /v1/analyze → store overlay/strip → persist image/run/pads/features →
 * per-analyte model lookup + inference + policy → analyte_results → run status → audit.
 */
export async function startAnalysis(input: StartAnalysisInput, actor: SafeUser | null, opts: StartAnalysisOptions = {}): Promise<StartAnalysisResult> {
  const db = await getDb();

  const validation = validateImage(input.file.bytes, input.file.mimeType);
  if (!validation.ok) throw new AnalysisInputError("invalid_image", validation.message);

  const [sample] = await db.select().from(samples).where(eq(samples.id, input.sampleId)).limit(1);
  if (!sample) throw new AnalysisInputError("sample_not_found", "Sample not found.");
  const [product] = await db.select().from(stripProducts).where(eq(stripProducts.id, input.stripProductId)).limit(1);
  if (!product) throw new AnalysisInputError("strip_product_not_found", "Strip product not found.");

  const runId = newId("run");
  const imageId = newId("img");
  const ext = extensionForMime(validation.mimeType);
  const originalPath = `images/${imageId}.${ext}`;
  const original = await writeFile(originalPath, input.file.bytes);
  const synthetic = sample.synthetic || input.imageSource === "synthetic";

  await db.insert(images).values({
    id: imageId,
    sampleId: sample.id,
    source: input.imageSource,
    deviceId: input.deviceId ?? null,
    storagePath: originalPath,
    mimeType: validation.mimeType,
    byteSize: original.byteSize,
    sha256: original.sha256,
    capturedAt: opts.capturedAt ?? null,
    idempotencyKey: opts.idempotencyKey ?? null,
  });

  // Allocate a run code; retry once on a unique-index collision.
  let runCode = await nextRunCode();
  const baseRun: typeof analysisRuns.$inferInsert = {
    id: runId,
    runCode,
    sampleId: sample.id,
    imageId,
    stripProductId: product.id,
    stripBatchId: input.stripBatchId ?? null,
    deviceId: input.deviceId ?? null,
    operatorId: actor?.id ?? null,
    operatorLabel: input.operatorLabel ?? (actor ? actor.displayName : input.deviceId ? "device" : null),
    mode: input.mode,
    imageSource: input.imageSource,
    status: "processing",
    reactionSeconds: input.reactionSeconds ?? product.reactionSeconds,
    reactionStartedAt: input.reactionStartedAt ? new Date(input.reactionStartedAt) : null,
    capturedAt: opts.capturedAt ?? null,
    synthetic,
  };
  try {
    await db.insert(analysisRuns).values(baseRun);
  } catch {
    runCode = `${await nextRunCode()}`;
    await db.insert(analysisRuns).values({ ...baseRun, runCode });
  }
  await recordAudit({ actor, action: "run.create", entityType: "run", entityId: runId, detail: { runCode, sampleCode: sample.sampleCode, mode: input.mode, imageSource: input.imageSource, synthetic, deviceId: input.deviceId ?? null } });

  /* ── CV analyze ── */
  let cv: AnalyzeResponse;
  try {
    cv = await analyze(input.file, {
      pad_count: product.padCount,
      pad_map: product.padMap,
      geometry: (product.geometry as { mode?: "auto" | "fixed"; pad_centers?: number[]; pad_size?: number; roi_inset?: number } | null) ?? { mode: "auto" },
      handle_side: "auto",
    });
  } catch (err) {
    const e = err instanceof CvServiceError ? err : new CvServiceError("bad_response", (err as Error).message);
    const message = e.unreachable ? `CV service unreachable: ${e.message}` : `CV service error (${e.code}): ${e.message}`;
    await db.update(analysisRuns).set({ status: "failed", errorMessage: message, completedAt: new Date() }).where(eq(analysisRuns.id, runId));
    await db.insert(analyteResults).values(
      product.padMap.filter(isAnalyteKey).map((key, padIndex) => ({
        id: newId("res"),
        runId,
        analyteKey: key,
        padIndex,
        state: "unavailable" satisfies ResultState,
        value: null,
        unit: ANALYTE_BY_KEY[key].unit,
        reason: message,
      })),
    );
    await recordAudit({ actor, action: "run.failed", entityType: "run", entityId: runId, detail: { runCode, code: e.code, message } });
    if (input.deviceId) await recordDeviceEvent(input.deviceId, { kind: "error", level: "error", message: `Run ${runCode} failed: ${message}`, simulated: false });
    return { runId, runCode, status: "failed" };
  }

  /* ── persist CV output ── */
  const overlayPath = await storeB64Png(`overlays/${imageId}.png`, cv.overlay_png_base64);
  const stripCropPath = await storeB64Png(`strips/${imageId}.png`, cv.strip_png_base64);
  await db.update(images).set({ overlayPath, stripCropPath, width: cv.image.width, height: cv.image.height }).where(eq(images.id, imageId));

  const padByAnalyte = new Map<string, PadResult>();
  for (const pad of cv.pads) {
    const segId = newId("pad");
    await db.insert(padSegmentations).values({
      id: segId,
      runId,
      padIndex: pad.pad_index,
      padId: pad.pad_id,
      analyteKey: isAnalyteKey(pad.analyte) ? pad.analyte : null,
      roi: pad.roi,
      roiSource: pad.roi_source,
      qualityStatus: pad.quality.status,
      qualityMetrics: { uniformity: pad.quality.uniformity, specular_fraction: pad.quality.specular_fraction, coverage: pad.quality.coverage, edge_contrast: pad.quality.edge_contrast },
      flags: pad.quality.flags,
    });
    await db.insert(colourFeatures).values({
      id: newId("cf"),
      padSegmentationId: segId,
      rgbMean: pad.features.rgb_mean,
      rgbMedian: pad.features.rgb_median,
      rgbStd: pad.features.rgb_std,
      labMean: pad.features.lab_mean,
      labStd: pad.features.lab_std,
      hsvMean: pad.features.hsv_mean,
      pixelCount: pad.features.pixel_count,
    });
    padByAnalyte.set(pad.analyte, pad);
  }

  /* ── per-analyte decision ── */
  const states: ResultState[] = [];
  const imagePassed = cv.quality.passed;
  for (let padIndex = 0; padIndex < product.padMap.length; padIndex++) {
    const key = product.padMap[padIndex];
    if (!isAnalyteKey(key)) continue;
    const pad = padByAnalyte.get(key) ?? null;
    const model = imagePassed && pad && pad.quality.status !== "fail" ? await findActiveModel(key, product.id, input.mode) : null;
    const candidate = model ? toCandidate(model) : null;
    let prediction: number | null = null;
    let interval: [number, number] | null = null;
    let inferenceError: string | null = null;
    // Only call the service when the policy could actually surface a value.
    const eligible = candidate && candidate.status !== "retired" && candidate.status !== "draft" && !(candidate.trainedOnSynthetic && input.mode !== "demo");
    if (eligible && candidate) {
      try {
        const out = await infer({ model_id: candidate.id, rgb_30: cv.feature_vector.rgb_30, lab_30: cv.feature_vector.lab_30 });
        prediction = out.value;
        interval = out.interval_95;
      } catch (err) {
        inferenceError = err instanceof CvServiceError ? `Inference failed (${err.code}): ${err.message}` : (err as Error).message;
      }
    }
    const decision = decideResult({ analyte: key, mode: input.mode, imagePassed, pad: pad ? { status: pad.quality.status } : null, model: candidate, prediction, inferenceError });
    states.push(decision.state);
    await db.insert(analyteResults).values({
      id: newId("res"),
      runId,
      analyteKey: key,
      padIndex: pad?.pad_index ?? padIndex,
      state: decision.state,
      value: decision.value,
      unit: ANALYTE_BY_KEY[key].unit,
      intervalLow: decision.value !== null && interval ? interval[0] : null,
      intervalHigh: decision.value !== null && interval ? interval[1] : null,
      modelId: candidate?.id ?? null,
      reason: decision.reason,
    });
  }

  const status = runStatusFromStates(states, imagePassed);
  await db
    .update(analysisRuns)
    .set({
      status,
      pipelineVersion: cv.pipeline_version,
      qualityPassed: imagePassed,
      qualityChecks: cv.quality.checks,
      stripGeometry: { ...cv.strip },
      featureVector: cv.feature_vector,
      timings: cv.timings_ms,
      warnings: cv.warnings,
      completedAt: new Date(),
    })
    .where(eq(analysisRuns.id, runId));
  await recordAudit({ actor, action: "run.complete", entityType: "run", entityId: runId, detail: { runCode, status, qualityPassed: imagePassed, states } });
  if (input.deviceId) await recordDeviceEvent(input.deviceId, { kind: "capture_completed", level: "info", message: `Run ${runCode} analysed (${status})`, payload: { runId, runCode }, simulated: false });
  return { runId, runCode, status };
}
