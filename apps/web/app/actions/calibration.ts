"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { ANALYTE_BY_KEY, ANALYTE_KEYS } from "@/lib/analytes";
import { train, validateDataset } from "@/lib/cv/client";
import { createDataset, createModel, getDataset, listModels, setModelStatus } from "@/lib/data/calibration";
import { getStripProduct } from "@/lib/data/strips";
import { str, toActionError, zodMessage, type ActionResult } from "@/app/actions/_shared";

const MAX_CSV_BYTES = 20 * 1024 * 1024;

const importSchema = z.object({
  name: z.string().trim().min(2).max(120),
  stripProductId: z.string().min(1),
  stripBatchId: z.string().trim().optional(),
  synthetic: z.boolean(),
  notes: z.string().trim().max(2000).optional(),
});

/** importDatasetAction(formData): name, stripProductId, stripBatchId?, synthetic, notes?, file (CSV) | csvText */
export async function importDatasetAction(formData: FormData): Promise<ActionResult<{ datasetId: string; rows: number; issues: { level: string; message: string }[] }>> {
  try {
    const user = await requireUser("calibration.manage");
    const parsed = importSchema.safeParse({
      name: str(formData, "name"),
      stripProductId: str(formData, "stripProductId"),
      stripBatchId: str(formData, "stripBatchId") || undefined,
      synthetic: formData.get("synthetic") === "on" || formData.get("synthetic") === "true",
      notes: str(formData, "notes") || undefined,
    });
    if (!parsed.success) return { ok: false, error: zodMessage(parsed.error) };
    const d = parsed.data;
    const product = await getStripProduct(d.stripProductId);
    if (!product) return { ok: false, error: "Unknown strip product." };
    if (d.stripBatchId && !product.batches.some((b) => b.id === d.stripBatchId)) return { ok: false, error: "Batch does not belong to the strip product." };

    let csvText = str(formData, "csvText") ?? "";
    const file = formData.get("file");
    if (file instanceof Blob && file.size > 0) {
      if (file.size > MAX_CSV_BYTES) return { ok: false, error: "CSV exceeds 20 MB." };
      csvText = await file.text();
    }
    if (!csvText.trim()) return { ok: false, error: "Provide a CSV file." };

    const validation = await validateDataset({ csv_text: csvText, pad_count: product.padCount });
    if (!validation.ok) {
      const first = validation.issues.find((i) => i.level === "error");
      return { ok: false, error: `Dataset rejected: ${first?.message ?? (validation.missing_required.join(", ") || "validation failed")}` };
    }
    // A dataset declaring synthetic rows must be imported as synthetic; honesty over convenience.
    const synthetic = d.synthetic || validation.synthetic_rows > 0;
    const ds = await createDataset(
      {
        name: d.name,
        stripProductId: product.id,
        stripBatchId: d.stripBatchId,
        csvText,
        synthetic,
        notes: d.notes,
        validation: { ...validation },
        columns: validation.columns,
        rowCount: validation.rows,
      },
      user,
    );
    revalidatePath("/calibration");
    return { ok: true, datasetId: ds.id, rows: validation.rows, issues: validation.issues };
  } catch (err) {
    return toActionError(err);
  }
}

const trainSchema = z.object({
  datasetId: z.string().min(1),
  analyteKey: z.enum(ANALYTE_KEYS),
  modelType: z.enum(["linear", "poly2_ridge", "poly3_ridge", "knn", "rf"]).default("poly2_ridge"),
  featureSet: z.enum(["rgb30", "pad_rgb", "lab30"]).default("rgb30"),
  testFraction: z.coerce.number().min(0.1).max(0.5).default(0.25),
  seed: z.coerce.number().int().min(0).default(42),
  // Optional overrides from the form. Version doubles as the CV service model id, so it is restricted to
  // the characters the service keeps verbatim ([A-Za-z0-9._-]).
  version: z.string().trim().regex(/^[A-Za-z0-9._-]{1,80}$/, "version may only contain letters, digits, '.', '_' and '-'").optional(),
  padIndex: z.coerce.number().int().min(0).max(31).optional(),
});

/** trainModelAction(formData): datasetId, analyteKey, modelType?, featureSet?, testFraction?, seed?, version?, padIndex? */
export async function trainModelAction(formData: FormData): Promise<ActionResult<{ modelId: string; warning: string | null }>> {
  try {
    const user = await requireUser("calibration.manage");
    const parsed = trainSchema.safeParse({
      datasetId: str(formData, "datasetId"),
      analyteKey: str(formData, "analyteKey"),
      modelType: str(formData, "modelType") || undefined,
      featureSet: str(formData, "featureSet") || undefined,
      testFraction: str(formData, "testFraction") || undefined,
      seed: str(formData, "seed") || undefined,
      version: str(formData, "version")?.trim() || undefined,
      padIndex: str(formData, "padIndex")?.trim() || undefined,
    });
    if (!parsed.success) return { ok: false, error: zodMessage(parsed.error) };
    const d = parsed.data;
    const ds = await getDataset(d.datasetId);
    if (!ds) return { ok: false, error: "Dataset not found." };
    if (!ds.csvText) return { ok: false, error: "Dataset CSV is missing from storage." };
    const product = await getStripProduct(ds.stripProductId);
    if (!product) return { ok: false, error: "Strip product for dataset not found." };
    // padIndex: an explicit form value wins (must be inside the product's pad count); otherwise the analyte's
    // position in the pad map.
    if (d.padIndex !== undefined && d.padIndex >= product.padCount) return { ok: false, error: `padIndex must be between 0 and ${product.padCount - 1}.` };
    const padIndex = d.padIndex ?? product.padMap.indexOf(d.analyteKey);
    if (d.featureSet === "pad_rgb" && padIndex < 0) return { ok: false, error: "Analyte is not on this strip product's pad map." };

    const existing = await listModels({ analyteKey: d.analyteKey, stripProductId: product.id });
    // version: an explicit form value wins; otherwise derive the next free one. Versions are also CV model
    // ids, so a clash with an existing model would overwrite it in the CV model store: reject that.
    const taken = new Set(existing.flatMap((m) => [m.model.version, m.model.id]));
    let version = d.version;
    if (!version) {
      const stem = `${d.analyteKey}-${d.modelType.replace(/_ridge$/, "")}-${d.featureSet}`;
      let n = 1;
      while (taken.has(`${stem}-v${n}`)) n++;
      version = `${stem}-v${n}`;
    }
    if (taken.has(version)) return { ok: false, error: `A model with version "${version}" already exists for this analyte and strip product. Choose another version.` };
    const def = ANALYTE_BY_KEY[d.analyteKey];
    const out = await train({
      csv_text: ds.csvText,
      analyte: d.analyteKey,
      unit: def.unit,
      model_type: d.modelType,
      feature_set: d.featureSet,
      pad_index: padIndex >= 0 ? padIndex : undefined,
      test_fraction: d.testFraction,
      seed: d.seed,
      model_version: version,
    });
    const trainedOnSynthetic = ds.synthetic || out.synthetic_fraction > 0;
    const model = await createModel(
      {
        id: out.model_id,
        analyteKey: d.analyteKey,
        stripProductId: product.id,
        datasetId: ds.id,
        version,
        modelType: out.model_type,
        featureSet: out.feature_set,
        trainedOnSynthetic,
        referenceLow: out.reference_range?.[0] ?? null,
        referenceHigh: out.reference_range?.[1] ?? null,
        nTrain: out.n_train,
        nTest: out.n_test,
        trainingMeta: {
          synthetic_fraction: out.synthetic_fraction,
          sample_size_warning: out.sample_size_warning,
          seed: d.seed,
          test_fraction: d.testFraction,
          pad_index: padIndex,
          dataset_sha256: ds.sha256,
          created_at: out.created_at,
        },
        evaluations: [
          { split: "train", n: out.metrics.train.n ?? out.n_train, mae: out.metrics.train.mae, rmse: out.metrics.train.rmse, bias: out.metrics.train.bias ?? null, r2: out.metrics.train.r2, predictions: out.predictions.filter((p) => p.split === "train") },
          { split: "test", n: out.metrics.test.n ?? out.n_test, mae: out.metrics.test.mae, rmse: out.metrics.test.rmse, bias: out.metrics.test.bias ?? null, r2: out.metrics.test.r2, residualQuantiles: out.residual_quantiles, predictions: out.predictions.filter((p) => p.split === "test") },
          { split: "cv5", n: out.n_train + out.n_test, mae: out.metrics.cv5.mae, rmse: out.metrics.cv5.rmse, bias: null, r2: out.metrics.cv5.r2 },
        ],
      },
      user,
    );
    revalidatePath("/calibration");
    return { ok: true, modelId: model.id, warning: out.sample_size_warning };
  } catch (err) {
    return toActionError(err);
  }
}

const statusSchema = z.object({
  modelId: z.string().min(1),
  status: z.enum(["draft", "trained", "validated", "retired"]),
  evidence: z.string().trim().max(4000).optional(),
});

/** setModelStatusAction(formData): modelId, status, evidence? ("validated" needs admin + evidence) */
export async function setModelStatusAction(formData: FormData): Promise<ActionResult> {
  try {
    const parsed = statusSchema.safeParse({ modelId: str(formData, "modelId"), status: str(formData, "status"), evidence: str(formData, "evidence") || undefined });
    if (!parsed.success) return { ok: false, error: zodMessage(parsed.error) };
    const user = await requireUser(parsed.data.status === "validated" ? "models.validate" : "calibration.manage");
    await setModelStatus(parsed.data.modelId, parsed.data.status, parsed.data.evidence ?? null, user);
    revalidatePath("/calibration");
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}
