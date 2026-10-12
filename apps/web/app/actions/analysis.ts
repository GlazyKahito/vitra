"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { MAX_IMAGE_BYTES } from "@/lib/analysis/image-validate";
import { startAnalysis } from "@/lib/analysis/run-analysis";
import { createSample, getSampleByCode, nextSampleCode } from "@/lib/data/samples";
import { getSettings } from "@/lib/data/settings";
import { getStripProduct } from "@/lib/data/strips";
import { str, toActionError, zodMessage, type ActionResult } from "@/app/actions/_shared";

const schema = z.object({
  sampleId: z.string().min(1).optional(),
  sampleCode: z.string().trim().regex(/^[A-Za-z0-9._-]{2,40}$/).optional(),
  subjectPseudonym: z.string().trim().max(64).optional(),
  stripProductId: z.string().min(1).optional(),
  stripBatchId: z.string().trim().optional(),
  deviceId: z.string().trim().optional(),
  mode: z.enum(["research", "demo"]).default("research"),
  imageSource: z.enum(["upload", "browser_camera", "synthetic"]).default("upload"),
  reactionSeconds: z.coerce.number().int().min(0).max(3600).optional(),
  reactionStartedAt: z.string().trim().optional(),
  synthetic: z.boolean().default(false),
});

/**
 * startAnalysisAction(formData)
 * Fields: file (image), sampleId | sampleCode (+ subjectPseudonym to create), stripProductId, stripBatchId?,
 * deviceId?, mode, imageSource, reactionSeconds?, reactionStartedAt?, synthetic?
 */
export async function startAnalysisAction(formData: FormData): Promise<ActionResult<{ runId: string; runCode: string; status: string }>> {
  try {
    const user = await requireUser("runs.create");
    const parsed = schema.safeParse({
      sampleId: str(formData, "sampleId") || undefined,
      sampleCode: str(formData, "sampleCode") || undefined,
      subjectPseudonym: str(formData, "subjectPseudonym") || undefined,
      stripProductId: str(formData, "stripProductId") || undefined,
      stripBatchId: str(formData, "stripBatchId") || undefined,
      deviceId: str(formData, "deviceId") || undefined,
      mode: str(formData, "mode") || undefined,
      imageSource: str(formData, "imageSource") || undefined,
      reactionSeconds: str(formData, "reactionSeconds") || undefined,
      reactionStartedAt: str(formData, "reactionStartedAt") || undefined,
      synthetic: formData.get("synthetic") === "on" || formData.get("synthetic") === "true",
    });
    if (!parsed.success) return { ok: false, error: zodMessage(parsed.error) };
    const d = parsed.data;

    const file = formData.get("file");
    if (!(file instanceof Blob) || file.size === 0) return { ok: false, error: "Choose an image file." };
    if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: "Image exceeds the 15 MB limit." };

    const settings = await getSettings();
    if (d.mode === "demo" && !settings.demoModeEnabled) return { ok: false, error: "Demo mode is disabled in settings." };
    const product = await getStripProduct(d.stripProductId || settings.defaultStripProductId);
    if (!product) return { ok: false, error: "Select a strip product." };
    if (d.stripBatchId && !product.batches.some((b) => b.id === d.stripBatchId)) return { ok: false, error: "Batch does not belong to the selected strip product." };

    let sampleId = d.sampleId;
    if (!sampleId) {
      const code = d.sampleCode || (await nextSampleCode());
      const existing = await getSampleByCode(code);
      const sample = existing ?? (await createSample({ sampleCode: code, subjectPseudonym: d.subjectPseudonym, synthetic: d.synthetic || d.imageSource === "synthetic" }, user));
      sampleId = sample.id;
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await startAnalysis(
      {
        sampleId,
        stripProductId: product.id,
        stripBatchId: d.stripBatchId || null,
        deviceId: d.deviceId || null,
        mode: d.mode,
        imageSource: d.imageSource,
        operatorLabel: user.displayName,
        reactionSeconds: d.reactionSeconds,
        reactionStartedAt: d.reactionStartedAt || null,
        file: { bytes, mimeType: file.type, fileName: file instanceof File ? file.name : "upload" },
      },
      user,
    );
    revalidatePath("/console");
    revalidatePath("/runs");
    revalidatePath("/samples");
    revalidatePath("/review");
    return { ok: true, ...result };
  } catch (err) {
    return toActionError(err);
  }
}
