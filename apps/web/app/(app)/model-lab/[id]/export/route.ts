import { NextResponse, type NextRequest } from "next/server";
import { requireApiUser, ForbiddenError, UnauthenticatedError } from "@/lib/auth";
import { getModel } from "@/lib/data/calibration";
import { recordAudit } from "@/lib/data/audit";
import { allPredictions, evalFor, perBatch, predictionsCsv } from "@/components/model-lab/metrics";
import { PROTOTYPE_LINE } from "@/components/common/prototype-banner";

export const dynamic = "force-dynamic";

/**
 * GET /model-lab/<id>/export?format=json|csv
 * Evaluation report for one calibration model. JSON carries metrics + predictions;
 * CSV carries predictions only (with a comment header noting synthetic status).
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireApiUser("runs.read");
  } catch (e) {
    if (e instanceof UnauthenticatedError) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }
  const { id } = await ctx.params;
  const format = req.nextUrl.searchParams.get("format") === "csv" ? "csv" : "json";
  const m = await getModel(id);
  if (!m) return NextResponse.json({ error: "model_not_found" }, { status: 404 });

  const preds = allPredictions(m);
  const safeName = m.model.id.replace(/[^a-zA-Z0-9._-]+/g, "_");
  await recordAudit({ actor: user, action: "model.export", entityType: "calibration_model", entityId: m.model.id, detail: { format } });

  if (format === "csv") {
    const header = `# VITRA model evaluation export · model_id=${m.model.id} · analyte=${m.model.analyteKey} · trained_on_synthetic=${m.model.trainedOnSynthetic} · status=${m.model.status}\n# ${PROTOTYPE_LINE}\n`;
    return new NextResponse(header + predictionsCsv(preds), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${safeName}-predictions.csv"`,
        "cache-control": "no-store",
      },
    });
  }

  const body = {
    disclaimer: PROTOTYPE_LINE,
    synthetic_training_data: m.model.trainedOnSynthetic,
    exported_at: new Date().toISOString(),
    exported_by: user.displayName,
    model: {
      id: m.model.id,
      version: m.model.version,
      analyte: m.model.analyteKey,
      strip_product: { id: m.stripProduct.id, name: m.stripProduct.name },
      dataset: m.dataset ? { id: m.dataset.id, name: m.dataset.name, version: m.dataset.version, synthetic: m.dataset.synthetic } : null,
      model_type: m.model.modelType,
      feature_set: m.model.featureSet,
      status: m.model.status,
      reference_range: [m.model.referenceLow, m.model.referenceHigh],
      n_train: m.model.nTrain,
      n_test: m.model.nTest,
      created_at: m.model.createdAt,
      validation_evidence: m.model.validationEvidence,
      training_meta: m.model.trainingMeta,
    },
    metrics: Object.fromEntries(
      (["train", "test", "cv5"] as const).map((s) => {
        const e = evalFor(m, s);
        return [s, e ? { n: e.n, mae: e.mae, rmse: e.rmse, bias: e.bias, r2: e.r2, residual_quantiles: e.residualQuantiles } : null];
      }),
    ),
    per_batch: perBatch(preds),
    predictions: preds,
  };
  return NextResponse.json(body, {
    headers: {
      "content-disposition": `attachment; filename="${safeName}-evaluation.json"`,
      "cache-control": "no-store",
    },
  });
}
