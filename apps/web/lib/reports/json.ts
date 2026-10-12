import { ANALYTE_BY_KEY, formatAnalyteValue, isAnalyteKey } from "@/lib/analytes";
import { RESULT_STATE_META, type ResultState } from "@/lib/inference/policy";
import type { RunDetail } from "@/lib/data/contract";

export const REPORT_DISCLAIMER =
  "RESEARCH PROTOTYPE — NOT A MEDICAL DEVICE — NOT CLINICALLY VALIDATED. VITRA is an experimental computer-vision pipeline for controlled urine reagent-strip imaging (KJS-HC-03). Values are produced by calibration models that have not been validated against gold-standard laboratory methods; synthetic values have no clinical meaning. This document must not be used for diagnosis, treatment or any clinical decision.";

export const METHODOLOGY_TEXT =
  "The strip image is checked for format, resolution, blur, exposure, strip visibility, orientation and obstruction. The strip is localised, rectified and divided into pads according to the strip product's pad map. Per-pad colour features (sRGB mean/median/std, CIELAB mean/std, HSV mean) are extracted from an inset region of each pad. For each analyte, a calibration model specific to the strip product maps the 30-dimensional RGB feature vector (or the pad's own RGB) to an estimate; the result-state policy then decides whether a value may be shown and how it is labelled. No reference intervals are configured and no interpretation is performed.";

export const LIMITATIONS_TEXT =
  "Limitations: colour response depends on illumination, camera, reaction time and strip lot; models are trained on small datasets and, where marked synthetic, on computer-generated colours rather than real samples. Pad-level quality failures yield Indeterminate; whole-image failures yield Invalid image. Nothing here constitutes a measurement in the regulatory sense (CDSCO MDR 2017 / IVD) and no clinical validation study has been performed.";

export interface ReportAnalyteRow {
  analyte_key: string;
  analyte_label: string;
  state: ResultState;
  state_label: string;
  value: number | null;
  value_display: string;
  unit: string;
  interval_95: [number, number] | null;
  chart_scale: (number | string)[];
  pad_id: string | null;
  pad_quality: string | null;
  pad_flags: string[];
  model_id: string | null;
  model_version: string | null;
  model_status: string | null;
  provenance: "validated_model" | "real_data_model" | "synthetic_model" | "none";
  reason: string | null;
}

export interface ReportJson {
  report_type: "vitra_analysis_report";
  schema_version: "1.0";
  disclaimer: string;
  synthetic: boolean;
  generated_at: string;
  generated_by: string;
  pipeline_version: string | null;
  run: {
    id: string;
    run_code: string;
    status: string;
    mode: string;
    image_source: string;
    created_at: string;
    completed_at: string | null;
    captured_at: string | null;
    reaction_seconds: number | null;
    reaction_started_at: string | null;
    operator_label: string | null;
    error_message: string | null;
  };
  sample: { id: string; sample_code: string; subject_pseudonym: string | null; synthetic: boolean };
  device: { id: string; name: string; kind: string; simulated: boolean } | null;
  strip_product: { id: string; manufacturer: string; name: string; pad_count: number; pad_map: string[]; reaction_seconds: number };
  strip_batch: { id: string; lot_number: string; expires_on: string | null } | null;
  image: { sha256: string; mime_type: string; width: number | null; height: number | null; byte_size: number } | null;
  quality: { passed: boolean | null; checks: { id: string; label: string; status: string; value: string | number | null; threshold: string | null; message: string }[] };
  strip_geometry: Record<string, unknown> | null;
  warnings: string[];
  results: ReportAnalyteRow[];
  reviews: { reviewer: string; decision: string; note: string | null; at: string }[];
  methodology: string;
  limitations: string;
}

export function buildReportJson(detail: RunDetail, generatedBy: string, now = new Date()): ReportJson {
  const { run, sample, device, stripProduct, batch, image, pads, results, reviews } = detail;
  const rows: ReportAnalyteRow[] = results.map((r) => {
    const pad = pads.find((p) => p.padIndex === r.padIndex) ?? null;
    const key = r.analyteKey;
    const def = isAnalyteKey(key) ? ANALYTE_BY_KEY[key] : null;
    const state = r.state as ResultState;
    const meta = RESULT_STATE_META[state];
    const provenance: ReportAnalyteRow["provenance"] = !r.model ? "none" : r.model.status === "validated" ? "validated_model" : r.model.trainedOnSynthetic ? "synthetic_model" : "real_data_model";
    return {
      analyte_key: key,
      analyte_label: def?.label ?? key,
      state,
      state_label: meta?.label ?? state,
      value: meta?.showsValue ? r.value : null,
      value_display: meta?.showsValue && def ? formatAnalyteValue(def.key, r.value) : "—",
      unit: r.unit,
      interval_95: r.intervalLow !== null && r.intervalHigh !== null ? [r.intervalLow, r.intervalHigh] : null,
      chart_scale: def ? [...def.chartScale] : [],
      pad_id: pad?.padId ?? null,
      pad_quality: pad?.qualityStatus ?? null,
      pad_flags: pad?.flags ?? [],
      model_id: r.modelId,
      model_version: r.model?.version ?? null,
      model_status: r.model?.status ?? null,
      provenance,
      reason: r.reason,
    };
  });
  return {
    report_type: "vitra_analysis_report",
    schema_version: "1.0",
    disclaimer: REPORT_DISCLAIMER,
    synthetic: run.synthetic || sample.synthetic,
    generated_at: now.toISOString(),
    generated_by: generatedBy,
    pipeline_version: run.pipelineVersion,
    run: {
      id: run.id,
      run_code: run.runCode,
      status: run.status,
      mode: run.mode,
      image_source: run.imageSource,
      created_at: run.createdAt.toISOString(),
      completed_at: run.completedAt?.toISOString() ?? null,
      captured_at: run.capturedAt?.toISOString() ?? null,
      reaction_seconds: run.reactionSeconds,
      reaction_started_at: run.reactionStartedAt?.toISOString() ?? null,
      operator_label: run.operatorLabel,
      error_message: run.errorMessage,
    },
    sample: { id: sample.id, sample_code: sample.sampleCode, subject_pseudonym: sample.subjectPseudonym, synthetic: sample.synthetic },
    device: device ? { id: device.id, name: device.name, kind: device.kind, simulated: device.simulated } : null,
    strip_product: { id: stripProduct.id, manufacturer: stripProduct.manufacturer, name: stripProduct.name, pad_count: stripProduct.padCount, pad_map: stripProduct.padMap, reaction_seconds: stripProduct.reactionSeconds },
    strip_batch: batch ? { id: batch.id, lot_number: batch.lotNumber, expires_on: batch.expiresOn } : null,
    image: image ? { sha256: image.sha256, mime_type: image.mimeType, width: image.width, height: image.height, byte_size: image.byteSize } : null,
    quality: { passed: run.qualityPassed, checks: (run.qualityChecks ?? []).map((c) => ({ ...c })) },
    strip_geometry: run.stripGeometry ?? null,
    warnings: run.warnings ?? [],
    results: rows,
    reviews: [...reviews].reverse().map((rv) => ({ reviewer: rv.reviewerLabel, decision: rv.decision, note: rv.note, at: rv.createdAt.toISOString() })),
    methodology: METHODOLOGY_TEXT,
    limitations: LIMITATIONS_TEXT,
  };
}

export function renderReportJson(detail: RunDetail, generatedBy: string, now = new Date()): string {
  return JSON.stringify(buildReportJson(detail, generatedBy, now), null, 2);
}
