import { ANALYTE_BY_KEY, type AnalyteKey } from "@/lib/analytes";

/**
 * Result-state policy. This is the single place that decides whether VITRA is
 * allowed to show a number for an analyte, and how that number is labelled.
 *
 * Nothing in VITRA is clinically validated. "measured" is only reachable when an
 * administrator marks a calibration model as validated AND attaches evidence —
 * no seeded model has that status.
 */
export const RESULT_STATES = [
  "measured", // validated calibration model, good image + pad
  "experimental", // model trained on real (non-synthetic) reference data, not validated
  "synthetic", // model trained on SYNTHETIC data — demo value only
  "out_of_range", // prediction outside the calibration model's reference range
  "indeterminate", // pad-level quality failure
  "invalid_image", // whole-image quality failure
  "unavailable", // inference could not run (CV service offline, error)
  "calibration_required", // no compatible calibration model
] as const;
export type ResultState = (typeof RESULT_STATES)[number];

export const RESULT_STATE_META: Record<ResultState, { label: string; tone: "signal" | "neutral" | "notice" | "muted" | "fault"; description: string; showsValue: boolean }> = {
  measured: { label: "Measured", tone: "signal", description: "Produced by a calibration model marked validated for this strip product, from an image that passed all quality checks.", showsValue: true },
  experimental: { label: "Experimental estimate", tone: "notice", description: "Model trained on real reference data but not validated. Research use only; not a clinical result.", showsValue: true },
  synthetic: { label: "Synthetic demo value", tone: "muted", description: "Model trained on SYNTHETIC data. The number demonstrates the pipeline and has no clinical meaning.", showsValue: true },
  out_of_range: { label: "Outside calibrated range", tone: "notice", description: "The model would extrapolate beyond the reference values it was trained on, so no value is reported.", showsValue: false },
  indeterminate: { label: "Indeterminate", tone: "neutral", description: "The pad region failed quality checks (uniformity, glare, occlusion or contrast).", showsValue: false },
  invalid_image: { label: "Invalid image", tone: "fault", description: "The image failed whole-image quality checks; no pad was analysed.", showsValue: false },
  unavailable: { label: "Inference unavailable", tone: "neutral", description: "Inference could not run (CV service offline or errored).", showsValue: false },
  calibration_required: { label: "Calibration required", tone: "neutral", description: "No compatible calibration model exists for this analyte and strip product.", showsValue: false },
};

export type AnalysisMode = "research" | "demo";

export interface ModelCandidate {
  id: string;
  analyte: AnalyteKey;
  stripProductId: string;
  version: string;
  status: "draft" | "trained" | "validated" | "retired";
  trainedOnSynthetic: boolean;
  referenceRange: [number, number] | null;
}

export interface PadQualityInput {
  status: "ok" | "warn" | "fail";
}

export interface DecideInput {
  analyte: AnalyteKey;
  mode: AnalysisMode;
  imagePassed: boolean;
  pad: PadQualityInput | null;
  model: ModelCandidate | null;
  prediction: number | null;
  inferenceError?: string | null;
}

export interface Decision {
  state: ResultState;
  value: number | null;
  reason: string;
}

/** Pure decision function — unit-tested in tests/unit/policy.test.ts. */
export function decideResult(i: DecideInput): Decision {
  if (!i.imagePassed) return { state: "invalid_image", value: null, reason: "Image failed quality checks." };
  if (!i.pad || i.pad.status === "fail") return { state: "indeterminate", value: null, reason: "Pad region failed quality checks." };
  if (!i.model || i.model.status === "retired" || i.model.status === "draft") {
    return { state: "calibration_required", value: null, reason: `No trained calibration model for ${ANALYTE_BY_KEY[i.analyte].label} on this strip product.` };
  }
  // Research mode never surfaces synthetic-model numbers.
  if (i.model.trainedOnSynthetic && i.mode !== "demo") {
    return { state: "calibration_required", value: null, reason: "Only a synthetic-data model exists; research mode requires a model trained on real reference measurements." };
  }
  if (i.inferenceError) return { state: "unavailable", value: null, reason: i.inferenceError };
  if (i.prediction === null || !Number.isFinite(i.prediction)) return { state: "unavailable", value: null, reason: "Model returned no value." };
  if (i.model.referenceRange) {
    const [lo, hi] = i.model.referenceRange;
    const pad = (hi - lo) * 0.02;
    if (i.prediction < lo - pad || i.prediction > hi + pad) {
      return { state: "out_of_range", value: null, reason: `Prediction outside the calibrated reference range ${lo}–${hi}.` };
    }
  }
  const value = clampToSpan(i.analyte, i.prediction);
  if (i.model.trainedOnSynthetic) return { state: "synthetic", value, reason: "Synthetic-data model (demo mode)." };
  if (i.model.status === "validated") return { state: "measured", value, reason: "Validated calibration model." };
  return { state: "experimental", value, reason: "Model not validated against gold-standard laboratory results." };
}

function clampToSpan(analyte: AnalyteKey, v: number): number {
  const [lo, hi] = ANALYTE_BY_KEY[analyte].span;
  return Math.min(hi, Math.max(lo, v));
}

/** Overall run status derived from per-analyte states. */
export function runStatusFromStates(states: ResultState[], imagePassed: boolean): "invalid_image" | "calibration_required" | "pending_review" {
  if (!imagePassed) return "invalid_image";
  if (states.every((s) => s === "calibration_required" || s === "unavailable")) return "calibration_required";
  return "pending_review";
}
