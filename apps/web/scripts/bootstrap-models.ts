/**
 * Trains the seeded SYNTHETIC calibration models inside the CV service so live demo inference works.
 *
 *   npm run models:bootstrap            (tsx scripts/bootstrap-models.ts)
 *
 * Why: db/seed.ts inserts calibration_models rows (glucose-poly2-v1, protein-poly2-v1, ph-poly2-v1) as DB
 * fixtures only. The CV service keeps its own model store (MODEL_STORE_DIR/<model_id>.joblib), so until a
 * model with the same id is trained there, /v1/infer returns model_not_found and demo runs show
 * "unavailable". This script trains each seeded model id from the seeded synthetic dataset CSV via
 * POST /v1/calibration/train, then replaces the seeded fixture evaluation rows with the metrics the
 * service actually computed. Every model stays trained_on_synthetic = true and status "trained".
 *
 * If the CV service is not reachable the script logs that clearly and exits 0 without changing anything,
 * so it is safe to chain after `npm run db:seed`.
 */
import "@/db/load-env";
import path from "node:path";
import { eq, inArray } from "drizzle-orm";
import { closeDb, getDb } from "@/lib/db";
import { auditEvents, calibrationDatasets, calibrationModels, modelEvaluations } from "@/db/schema";
import { CV_SERVICE_URL, CvServiceError, health as cvHealth, train, type ModelType, type FeatureSet } from "@/lib/cv/client";
import { ANALYTE_BY_KEY, isAnalyteKey } from "@/lib/analytes";
import { readText } from "@/lib/storage";

const SEED_DATASET_ID = "seed-dataset-synthetic-calibration-v1";
const SEED_MODEL_IDS = ["glucose-poly2-v1", "protein-poly2-v1", "ph-poly2-v1"];

function log(s: string): void {
  console.log(`[bootstrap-models] ${s}`);
}

async function main(): Promise<number> {
  log(`CV service: ${CV_SERVICE_URL}`);
  try {
    const h = await cvHealth(3000);
    log(`CV service reachable (${h.service} ${h.version}, pipeline ${h.pipeline_version}, ${h.models_loaded} model(s) loaded)`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`SKIPPED: CV service is not reachable (${msg}).`);
    log("Start it first (cd services/cv && python run.py), or set CV_SERVICE_URL, then re-run `npm run models:bootstrap`.");
    log("Until then demo runs report analyte values as \"unavailable\"; nothing was changed.");
    return 0;
  }

  const db = await getDb();
  const [dataset] = await db.select().from(calibrationDatasets).where(eq(calibrationDatasets.id, SEED_DATASET_ID)).limit(1);
  if (!dataset) {
    log(`FAILED: seeded dataset ${SEED_DATASET_ID} not found. Run \`npm run db:seed\` first.`);
    return 1;
  }
  let csvText: string;
  try {
    csvText = await readText(dataset.storagePath);
  } catch {
    log(`FAILED: dataset CSV missing from storage (${dataset.storagePath}). Re-run \`npm run db:seed\` (it rewrites the file).`);
    return 1;
  }

  const models = await db.select().from(calibrationModels).where(inArray(calibrationModels.id, SEED_MODEL_IDS));
  if (models.length === 0) {
    log("FAILED: no seeded calibration models found. Run `npm run db:seed` first.");
    return 1;
  }

  let failures = 0;
  for (const model of models) {
    if (!isAnalyteKey(model.analyteKey)) continue;
    const def = ANALYTE_BY_KEY[model.analyteKey];
    const seed = typeof model.trainingMeta?.seed === "number" ? model.trainingMeta.seed : 42;
    const testFraction = typeof model.trainingMeta?.test_fraction === "number" ? model.trainingMeta.test_fraction : 0.25;
    try {
      const out = await train({
        csv_text: csvText,
        analyte: model.analyteKey,
        unit: def.unit,
        model_type: model.modelType as ModelType,
        feature_set: model.featureSet as FeatureSet,
        test_fraction: testFraction,
        seed,
        model_version: model.id, // the CV model id must equal the DB model id used by inference
      });
      if (out.model_id !== model.id) throw new Error(`CV service stored the model as ${out.model_id}, expected ${model.id}`);

      await db
        .update(calibrationModels)
        .set({
          trainedOnSynthetic: true,
          referenceLow: out.reference_range?.[0] ?? model.referenceLow,
          referenceHigh: out.reference_range?.[1] ?? model.referenceHigh,
          nTrain: out.n_train,
          nTest: out.n_test,
          trainingMeta: {
            ...(model.trainingMeta ?? {}),
            fixture: false,
            note: "Trained in the CV service by scripts/bootstrap-models.ts from the seeded SYNTHETIC dataset. Metrics are the service's own; they describe fit to synthetic data only.",
            synthetic_fraction: out.synthetic_fraction,
            sample_size_warning: out.sample_size_warning,
            seed,
            test_fraction: testFraction,
            dataset_sha256: dataset.sha256,
            created_at: out.created_at,
            bootstrapped_at: new Date().toISOString(),
          },
        })
        .where(eq(calibrationModels.id, model.id));

      await db.delete(modelEvaluations).where(eq(modelEvaluations.modelId, model.id));
      const key = model.analyteKey;
      await db.insert(modelEvaluations).values([
        { id: `seed-eval-${key}-train`, modelId: model.id, split: "train", n: out.metrics.train.n ?? out.n_train, mae: out.metrics.train.mae, rmse: out.metrics.train.rmse, bias: out.metrics.train.bias ?? null, r2: out.metrics.train.r2, predictions: out.predictions.filter((p) => p.split === "train") },
        { id: `seed-eval-${key}-test`, modelId: model.id, split: "test", n: out.metrics.test.n ?? out.n_test, mae: out.metrics.test.mae, rmse: out.metrics.test.rmse, bias: out.metrics.test.bias ?? null, r2: out.metrics.test.r2, residualQuantiles: out.residual_quantiles, predictions: out.predictions.filter((p) => p.split === "test") },
        { id: `seed-eval-${key}-cv5`, modelId: model.id, split: "cv5", n: out.n_train + out.n_test, mae: out.metrics.cv5.mae, rmse: out.metrics.cv5.rmse, bias: null, r2: out.metrics.cv5.r2 },
      ]);
      await db.insert(auditEvents).values({
        id: `seed-audit-bootstrap-${model.id}-${Date.now()}`,
        actorId: null,
        actorLabel: "system (scripts/bootstrap-models.ts)",
        action: "model.train",
        entityType: "model",
        entityId: model.id,
        detail: { analyteKey: key, trainedOnSynthetic: true, bootstrap: true, n_train: out.n_train, n_test: out.n_test },
      });
      log(`trained ${model.id}: n_train=${out.n_train} n_test=${out.n_test} test MAE=${out.metrics.test.mae} ${def.unit} (SYNTHETIC data)${out.sample_size_warning ? ` — ${out.sample_size_warning}` : ""}`);
    } catch (err) {
      failures++;
      const msg = err instanceof CvServiceError ? `${err.code}: ${err.message}` : err instanceof Error ? err.message : String(err);
      log(`FAILED ${model.id}: ${msg}`);
    }
  }
  log(failures ? `${failures} model(s) failed.` : `done: ${models.length} model(s) available for demo inference.`);
  return failures ? 1 : 0;
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(process.cwd(), "scripts", "bootstrap-models.ts");
if (isDirect) {
  main()
    .then(async (code) => {
      await closeDb();
      process.exit(code);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
