import "server-only";
import { and, asc, desc, eq, inArray, type SQL } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { calibrationDatasets, calibrationModels, modelEvaluations, referenceMeasurements, stripProducts } from "@/db/schema";
import { ANALYTES } from "@/lib/analytes";
import { newId } from "@/lib/ids";
import { readText, sha256, writeFile } from "@/lib/storage";
import { recordAudit } from "@/lib/data/audit";
import { getSettings } from "@/lib/data/settings";
import type { CalibrationDataset, CalibrationModel, CalibrationStatus, ModelEvaluation, ModelWithEvals, ReferenceMeasurement, SafeUser } from "@/lib/data/contract";

/* ───────── datasets ───────── */
export async function listDatasets(): Promise<CalibrationDataset[]> {
  const db = await getDb();
  return db.select().from(calibrationDatasets).orderBy(desc(calibrationDatasets.createdAt));
}

export async function getDataset(id: string): Promise<(CalibrationDataset & { csvText: string }) | null> {
  const db = await getDb();
  const [ds] = await db.select().from(calibrationDatasets).where(eq(calibrationDatasets.id, id)).limit(1);
  if (!ds) return null;
  let csvText = "";
  try {
    csvText = await readText(ds.storagePath);
  } catch {
    csvText = "";
  }
  return { ...ds, csvText };
}

export async function createDataset(
  input: {
    name: string;
    stripProductId: string;
    stripBatchId?: string;
    csvText: string;
    synthetic: boolean;
    notes?: string;
    validation: Record<string, unknown>;
    columns: string[];
    rowCount: number;
  },
  actor: SafeUser,
): Promise<CalibrationDataset> {
  const db = await getDb();
  const id = newId("ds");
  const existing = await db.select({ version: calibrationDatasets.version }).from(calibrationDatasets).where(eq(calibrationDatasets.name, input.name));
  const version = existing.reduce((m, r) => Math.max(m, r.version), 0) + 1;
  const storagePath = `datasets/${id}.csv`;
  const file = await writeFile(storagePath, input.csvText);
  const [row] = await db
    .insert(calibrationDatasets)
    .values({
      id,
      name: input.name,
      version,
      stripProductId: input.stripProductId,
      stripBatchId: input.stripBatchId ?? null,
      synthetic: input.synthetic,
      rowCount: input.rowCount,
      columns: input.columns,
      storagePath,
      sha256: file.sha256,
      validation: input.validation,
      notes: input.notes ?? null,
      createdById: actor.id,
    })
    .returning();
  await recordAudit({ actor, action: "dataset.import", entityType: "dataset", entityId: id, detail: { name: input.name, version, rowCount: input.rowCount, synthetic: input.synthetic, sha256: file.sha256 } });
  return row;
}

/* ───────── models ───────── */
async function attachEvals(models: { model: CalibrationModel; dataset: CalibrationDataset | null; stripProduct: typeof stripProducts.$inferSelect }[]): Promise<ModelWithEvals[]> {
  if (models.length === 0) return [];
  const db = await getDb();
  const evals = await db
    .select()
    .from(modelEvaluations)
    .where(inArray(modelEvaluations.modelId, models.map((m) => m.model.id)))
    .orderBy(asc(modelEvaluations.split));
  return models.map((m) => ({ ...m, evaluations: evals.filter((e) => e.modelId === m.model.id) }));
}

export async function listModels(filter: { analyteKey?: string; stripProductId?: string } = {}): Promise<ModelWithEvals[]> {
  const db = await getDb();
  const conds: SQL[] = [];
  if (filter.analyteKey) conds.push(eq(calibrationModels.analyteKey, filter.analyteKey));
  if (filter.stripProductId) conds.push(eq(calibrationModels.stripProductId, filter.stripProductId));
  const rows = await db
    .select({ model: calibrationModels, dataset: calibrationDatasets, stripProduct: stripProducts })
    .from(calibrationModels)
    .leftJoin(calibrationDatasets, eq(calibrationDatasets.id, calibrationModels.datasetId))
    .innerJoin(stripProducts, eq(stripProducts.id, calibrationModels.stripProductId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(calibrationModels.createdAt));
  return attachEvals(rows);
}

export async function getModel(id: string): Promise<ModelWithEvals | null> {
  const db = await getDb();
  const rows = await db
    .select({ model: calibrationModels, dataset: calibrationDatasets, stripProduct: stripProducts })
    .from(calibrationModels)
    .leftJoin(calibrationDatasets, eq(calibrationDatasets.id, calibrationModels.datasetId))
    .innerJoin(stripProducts, eq(stripProducts.id, calibrationModels.stripProductId))
    .where(eq(calibrationModels.id, id))
    .limit(1);
  const [withEvals] = await attachEvals(rows);
  return withEvals ?? null;
}

export async function createModel(
  input: {
    id: string;
    analyteKey: string;
    stripProductId: string;
    datasetId: string;
    version: string;
    modelType: string;
    featureSet: string;
    trainedOnSynthetic: boolean;
    referenceLow: number | null;
    referenceHigh: number | null;
    nTrain: number;
    nTest: number;
    trainingMeta: Record<string, unknown>;
    evaluations: {
      split: string;
      n: number;
      mae: number | null;
      rmse: number | null;
      bias: number | null;
      r2: number | null;
      residualQuantiles?: Record<string, number>;
      predictions?: ModelEvaluation["predictions"];
    }[];
  },
  actor: SafeUser,
): Promise<CalibrationModel> {
  const db = await getDb();
  const [model] = await db
    .insert(calibrationModels)
    .values({
      id: input.id,
      analyteKey: input.analyteKey,
      stripProductId: input.stripProductId,
      datasetId: input.datasetId,
      version: input.version,
      modelType: input.modelType,
      featureSet: input.featureSet,
      status: "trained",
      trainedOnSynthetic: input.trainedOnSynthetic,
      referenceLow: input.referenceLow,
      referenceHigh: input.referenceHigh,
      nTrain: input.nTrain,
      nTest: input.nTest,
      trainingMeta: input.trainingMeta,
      createdById: actor.id,
    })
    .returning();
  if (input.evaluations.length) {
    await db.insert(modelEvaluations).values(
      input.evaluations.map((e) => ({
        id: newId("ev"),
        modelId: model.id,
        split: e.split,
        n: e.n,
        mae: e.mae,
        rmse: e.rmse,
        bias: e.bias,
        r2: e.r2,
        residualQuantiles: e.residualQuantiles ?? null,
        predictions: e.predictions ?? null,
      })),
    );
  }
  await recordAudit({ actor, action: "model.train", entityType: "model", entityId: model.id, detail: { analyteKey: input.analyteKey, modelType: input.modelType, featureSet: input.featureSet, trainedOnSynthetic: input.trainedOnSynthetic, nTrain: input.nTrain, nTest: input.nTest } });
  return model;
}

/** "validated" requires non-empty evidence AND an admin actor; synthetic-trained models can never be validated. */
export async function setModelStatus(id: string, status: CalibrationModel["status"], evidence: string | null, actor: SafeUser): Promise<void> {
  const db = await getDb();
  const [model] = await db.select().from(calibrationModels).where(eq(calibrationModels.id, id)).limit(1);
  if (!model) throw new Error("Model not found");
  if (status === "validated") {
    if (actor.roleKey !== "admin") throw new Error("Only an administrator can mark a model as validated.");
    if (!evidence || evidence.trim().length < 20) throw new Error("Validation requires a written evidence statement (≥ 20 characters) referencing the reference-method comparison.");
    if (model.trainedOnSynthetic) throw new Error("A model trained on synthetic data cannot be validated.");
  }
  await db
    .update(calibrationModels)
    .set({ status, validationEvidence: status === "validated" ? evidence?.trim() ?? null : model.validationEvidence })
    .where(eq(calibrationModels.id, id));
  await recordAudit({ actor, action: `model.${status === "validated" ? "validate" : status === "retired" ? "retire" : "status"}`, entityType: "model", entityId: id, detail: { from: model.status, to: status, evidence: status === "validated" ? evidence : undefined } });
}

/* ───────── status / lookup ───────── */
function statusFor(model: CalibrationModel | null): CalibrationStatus["perAnalyte"][number]["status"] {
  if (!model) return "none";
  if (model.status === "validated") return "validated";
  if (model.trainedOnSynthetic) return "synthetic_only";
  return "experimental";
}

export async function getCalibrationStatus(stripProductId?: string): Promise<CalibrationStatus[]> {
  const db = await getDb();
  const settings = await getSettings();
  const products = await db
    .select()
    .from(stripProducts)
    .where(stripProductId ? eq(stripProducts.id, stripProductId) : undefined)
    .orderBy(asc(stripProducts.createdAt));
  const models = await db
    .select()
    .from(calibrationModels)
    .where(inArray(calibrationModels.status, ["trained", "validated"]))
    .orderBy(desc(calibrationModels.createdAt));
  return products.map((p) => ({
    stripProductId: p.id,
    stripProductName: p.name,
    perAnalyte: ANALYTES.map((a) => {
      const candidates = models.filter((m) => m.stripProductId === p.id && m.analyteKey === a.key);
      // Prefer validated → real-data trained → synthetic; newest within tier.
      const model =
        candidates.find((m) => m.status === "validated") ?? candidates.find((m) => !m.trainedOnSynthetic) ?? candidates[0] ?? null;
      const trainedAt = model?.createdAt ?? null;
      const ageDays = trainedAt ? Math.floor((Date.now() - trainedAt.getTime()) / 86400_000) : null;
      return {
        analyteKey: a.key,
        model,
        status: statusFor(model),
        trainedAt,
        ageDays,
        recalibrationDue: ageDays !== null && ageDays > settings.recalibrationIntervalDays,
      };
    }),
  }));
}

/**
 * Active model for inference. Research mode only accepts models trained on real reference data;
 * demo mode also accepts synthetic-trained models. Validated models win, then newest trained.
 */
export async function findActiveModel(analyteKey: string, stripProductId: string, mode: "research" | "demo"): Promise<CalibrationModel | null> {
  const db = await getDb();
  const conds: SQL[] = [
    eq(calibrationModels.analyteKey, analyteKey),
    eq(calibrationModels.stripProductId, stripProductId),
    inArray(calibrationModels.status, ["trained", "validated"]),
  ];
  if (mode === "research") conds.push(eq(calibrationModels.trainedOnSynthetic, false));
  const rows = await db.select().from(calibrationModels).where(and(...conds)).orderBy(desc(calibrationModels.createdAt));
  return rows.find((m) => m.status === "validated") ?? rows.find((m) => !m.trainedOnSynthetic) ?? rows[0] ?? null;
}

export async function listReferenceMeasurements(sampleCode?: string): Promise<ReferenceMeasurement[]> {
  const db = await getDb();
  return db
    .select()
    .from(referenceMeasurements)
    .where(sampleCode ? eq(referenceMeasurements.sampleCode, sampleCode) : undefined)
    .orderBy(desc(referenceMeasurements.measuredAt))
    .limit(500);
}

export const datasetSha = sha256;
