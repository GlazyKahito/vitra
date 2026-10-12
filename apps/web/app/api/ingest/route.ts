import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { analysisRuns, images } from "@/db/schema";
import { verifySecret } from "@/lib/auth/password";
import { MAX_IMAGE_BYTES, validateImage } from "@/lib/analysis/image-validate";
import { AnalysisInputError, startAnalysis } from "@/lib/analysis/run-analysis";
import { recordAudit } from "@/lib/data/audit";
import { getDeviceByName, recordDeviceEvent } from "@/lib/data/devices";
import { createSampleFromDevice, getSampleByCode, nextSampleCode } from "@/lib/data/samples";
import { getSettings } from "@/lib/data/settings";
import { getStripProduct } from "@/lib/data/strips";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function err(status: number, code: string, message: string): Response {
  return NextResponse.json({ error: { code, message } }, { status, headers: { "cache-control": "no-store" } });
}

const DEVICE_ID_RE = /^[A-Za-z0-9._-]{2,64}$/;
const SAMPLE_CODE_RE = /^[A-Za-z0-9._-]{2,40}$/;

/**
 * POST /api/ingest — device ingestion (see docs/device-api.md).
 * Headers: X-Device-Id, X-Device-Key, Idempotency-Key (optional), X-Capture-Timestamp (optional ISO-8601).
 * Body: multipart/form-data with `file` (image), optional `sample_code`, `strip_product_id`, `strip_batch_id`,
 *       `mode` (research|demo), `reaction_seconds`, `reaction_started_at`.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const deviceName = req.headers.get("x-device-id")?.trim() ?? "";
  const deviceKey = req.headers.get("x-device-key") ?? "";
  if (!DEVICE_ID_RE.test(deviceName) || !deviceKey) return err(401, "unauthorized", "Missing or malformed X-Device-Id / X-Device-Key.");

  const device = await getDeviceByName(deviceName);
  const keyOk = await verifySecret(deviceKey, device?.apiKeyHash ?? null);
  if (!device || !keyOk) {
    await recordAudit({ actor: null, action: "ingest.unauthorized", entityType: "device", entityId: deviceName, detail: { reason: !device ? "unknown_device" : "bad_key" } });
    return err(401, "unauthorized", "Device id or key not recognised.");
  }

  const idempotencyKey = req.headers.get("idempotency-key")?.trim() || null;
  if (idempotencyKey && idempotencyKey.length > 200) return err(422, "invalid_request", "Idempotency-Key too long.");
  if (idempotencyKey) {
    const db = await getDb();
    const existing = await db
      .select({ run: analysisRuns })
      .from(images)
      .innerJoin(analysisRuns, eq(analysisRuns.imageId, images.id))
      .where(eq(images.idempotencyKey, `${device.id}:${idempotencyKey}`))
      .limit(1);
    if (existing[0]) {
      const r = existing[0].run;
      return NextResponse.json({ run_id: r.id, run_code: r.runCode, status: r.status, duplicate: true }, { status: 200, headers: { "cache-control": "no-store" } });
    }
  }

  const capturedRaw = req.headers.get("x-capture-timestamp");
  let capturedAt: Date | null = null;
  if (capturedRaw) {
    capturedAt = new Date(capturedRaw);
    if (Number.isNaN(capturedAt.getTime())) return err(422, "invalid_request", "X-Capture-Timestamp must be ISO-8601.");
  }

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > MAX_IMAGE_BYTES + 64 * 1024) return err(413, "file_too_large", "Payload exceeds 15 MB.");
  const ctype = req.headers.get("content-type") ?? "";
  if (!ctype.toLowerCase().startsWith("multipart/form-data")) return err(415, "unsupported_media_type", "Send multipart/form-data with a `file` field.");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return err(422, "invalid_request", "Malformed multipart body.");
  }
  const file = form.get("file");
  if (!(file instanceof Blob)) return err(422, "invalid_request", "Missing `file` field.");
  if (file.size > MAX_IMAGE_BYTES) return err(413, "file_too_large", "Image exceeds 15 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const validation = validateImage(bytes, file.type);
  if (!validation.ok) return err(validation.error === "too_large" ? 413 : 415, validation.error, validation.message);

  const settings = await getSettings();
  const stripProductId = String(form.get("strip_product_id") ?? "").trim() || settings.defaultStripProductId;
  const product = await getStripProduct(stripProductId);
  if (!product) return err(422, "invalid_request", "Unknown strip product.");
  const stripBatchId = String(form.get("strip_batch_id") ?? "").trim() || null;
  if (stripBatchId && !product.batches.some((b) => b.id === stripBatchId)) return err(422, "invalid_request", "Batch does not belong to the strip product.");
  const modeRaw = String(form.get("mode") ?? "research");
  if (modeRaw !== "research" && modeRaw !== "demo") return err(422, "invalid_request", "mode must be research or demo.");
  if (modeRaw === "demo" && !settings.demoModeEnabled) return err(422, "invalid_request", "Demo mode is disabled.");
  const reactionSecondsRaw = form.get("reaction_seconds");
  const reactionSeconds = reactionSecondsRaw ? Number(reactionSecondsRaw) : undefined;
  if (reactionSeconds !== undefined && !(Number.isInteger(reactionSeconds) && reactionSeconds >= 0 && reactionSeconds <= 3600)) return err(422, "invalid_request", "reaction_seconds out of range.");
  const reactionStartedAt = String(form.get("reaction_started_at") ?? "").trim() || null;
  if (reactionStartedAt && Number.isNaN(new Date(reactionStartedAt).getTime())) return err(422, "invalid_request", "reaction_started_at must be ISO-8601.");

  // Sample: given code (create when unknown) or a fresh code.
  const sampleCodeRaw = String(form.get("sample_code") ?? "").trim();
  if (sampleCodeRaw && !SAMPLE_CODE_RE.test(sampleCodeRaw)) return err(422, "invalid_request", "sample_code may only contain letters, digits, '.', '_' and '-'.");
  let sample = sampleCodeRaw ? await getSampleByCode(sampleCodeRaw) : null;
  if (!sample) {
    const code = sampleCodeRaw || (await nextSampleCode());
    sample = await createSampleFromDevice({ sampleCode: code, deviceName: device.name, simulated: device.simulated });
  }

  await recordDeviceEvent(device.id, { kind: "capture_started", level: "info", message: `Ingest received from ${device.name} (${validation.byteSize} bytes)`, payload: { sample_code: sample.sampleCode, idempotency_key: idempotencyKey }, simulated: device.simulated });

  try {
    const result = await startAnalysis(
      {
        sampleId: sample.id,
        stripProductId: product.id,
        stripBatchId,
        deviceId: device.id,
        mode: modeRaw,
        imageSource: "device",
        operatorLabel: `device ${device.name}`,
        reactionSeconds,
        reactionStartedAt,
        file: { bytes, mimeType: validation.mimeType, fileName: file instanceof File ? file.name : `capture.${validation.mimeType.split("/")[1]}` },
      },
      null,
      { idempotencyKey: idempotencyKey ? `${device.id}:${idempotencyKey}` : null, capturedAt },
    );
    await recordAudit({ actor: null, action: "ingest.accepted", entityType: "run", entityId: result.runId, detail: { device: device.name, runCode: result.runCode, status: result.status } });
    return NextResponse.json({ run_id: result.runId, run_code: result.runCode, status: result.status }, { status: 202, headers: { "cache-control": "no-store" } });
  } catch (e) {
    if (e instanceof AnalysisInputError) return err(e.code === "invalid_image" ? 415 : 422, e.code, e.message);
    // Unique-index collision on the idempotency key means a concurrent duplicate won.
    if (idempotencyKey && String((e as Error).message).toLowerCase().includes("idem")) return err(409, "conflict", "Duplicate Idempotency-Key in flight; retry to receive the existing run.");
    throw e;
  }
}
