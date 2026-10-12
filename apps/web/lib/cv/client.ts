/**
 * Typed HTTP client for the VITRA CV service (docs/cv-service-contract.md v1).
 * Server-side only; the browser never talks to the service directly.
 */

export const CV_SERVICE_URL = (process.env.CV_SERVICE_URL ?? "http://127.0.0.1:8001").replace(/\/+$/, "");

/* ───────── contract types (snake_case mirrors the JSON) ───────── */
export type CvErrorCode =
  | "unsupported_format"
  | "decode_failed"
  | "file_too_large"
  | "invalid_config"
  | "invalid_dataset"
  | "insufficient_data"
  | "model_not_found"
  | "feature_mismatch"
  | "unauthorized"
  | "unreachable"
  | "timeout"
  | "bad_response";

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  pipeline_version: string;
  opencv_version: string;
  models_loaded: number;
}

export interface QualityCheck {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  value: string | number | null;
  threshold: string | null;
  message: string;
}

export interface Quality {
  passed: boolean;
  checks: QualityCheck[];
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface StripGeometry {
  found: boolean;
  polygon: [number, number][];
  bbox: Box;
  angle_deg: number;
  rotated_90: boolean;
  flipped: boolean;
  rectified_width: number;
  rectified_height: number;
}

export interface PadFeatures {
  rgb_mean: number[];
  rgb_median: number[];
  rgb_std: number[];
  lab_mean: number[];
  lab_std: number[];
  hsv_mean: number[];
  pixel_count: number;
}

export type PadQualityFlag = "low_uniformity" | "specular" | "low_contrast" | "clipped" | "occluded" | string;

export interface PadQuality {
  status: "ok" | "warn" | "fail";
  uniformity: number;
  specular_fraction: number;
  coverage: number;
  edge_contrast: number;
  flags: PadQualityFlag[];
}

export interface PadResult {
  pad_index: number;
  pad_id: string;
  analyte: string;
  roi: Box;
  roi_source: "detected" | "fixed";
  features: PadFeatures;
  quality: PadQuality;
}

export interface AnalyzeConfig {
  pad_count?: number;
  pad_map?: string[];
  geometry?: {
    mode?: "auto" | "fixed";
    pad_centers?: number[];
    pad_size?: number;
    roi_inset?: number;
  };
  min_width?: number;
  min_height?: number;
  handle_side?: "left" | "right" | "auto";
}

export interface AnalyzeResponse {
  pipeline_version: string;
  image: { width: number; height: number; format: string; sha256: string };
  quality: Quality;
  strip: StripGeometry;
  pads: PadResult[];
  feature_vector: { rgb_30: number[]; lab_30: number[] };
  strip_png_base64: string | null;
  overlay_png_base64: string | null;
  timings_ms: Record<string, number>;
  warnings: string[];
}

export interface ValidateDatasetRequest {
  csv_text: string;
  pad_count: number;
}

export interface ValidateDatasetResponse {
  ok: boolean;
  rows: number;
  columns: string[];
  feature_columns: string[];
  reference_columns: string[];
  missing_required: string[];
  missing_values: Record<string, number>;
  non_numeric: Record<string, number>;
  duplicate_rows: number;
  duplicate_sample_ids: string[];
  per_analyte_counts: Record<string, number>;
  synthetic_rows: number;
  issues: { level: "info" | "warn" | "error" | string; message: string }[];
}

export type ModelType = "linear" | "poly2_ridge" | "poly3_ridge" | "knn" | "rf";
export type FeatureSet = "rgb30" | "pad_rgb" | "lab30";

export interface TrainRequest {
  csv_text: string;
  analyte: string;
  unit: string;
  model_type: ModelType;
  feature_set: FeatureSet;
  pad_index?: number;
  test_fraction?: number;
  seed?: number;
  model_version: string;
}

export interface Metrics {
  mae: number;
  rmse: number;
  bias?: number;
  r2: number;
  n?: number;
}

export interface PredictionPoint {
  sample_id: string;
  reference: number;
  predicted: number;
  residual: number;
  split: string;
}

export interface TrainResponse {
  model_id: string;
  analyte: string;
  unit: string;
  model_type: ModelType;
  feature_set: FeatureSet;
  n_train: number;
  n_test: number;
  synthetic_fraction: number;
  reference_range: [number, number];
  metrics: { train: Metrics; test: Metrics; cv5: Metrics };
  residual_quantiles: { p05: number; p50: number; p95: number };
  predictions: PredictionPoint[];
  sample_size_warning: string | null;
  created_at: string;
}

export interface InferRequest {
  model_id: string;
  rgb_30: number[];
  lab_30: number[];
}

export interface InferResponse {
  model_id: string;
  analyte: string;
  unit: string;
  value: number;
  within_reference_range: boolean;
  reference_range: [number, number];
  interval_95: [number, number] | null;
  synthetic_training_data: boolean;
}

export interface SyntheticStripRequest {
  seed?: number;
  levels?: Partial<Record<string, number>>;
  width?: number;
  height?: number;
  rotation_deg?: number;
  blur?: number;
  exposure?: number;
}

/* ───────── errors ───────── */
export class CvServiceError extends Error {
  readonly code: CvErrorCode;
  readonly status: number | null;
  constructor(code: CvErrorCode, message: string, status: number | null = null) {
    super(message);
    this.name = "CvServiceError";
    this.code = code;
    this.status = status;
  }
  /** True when the service could not be reached at all (as opposed to rejecting the request). */
  get unreachable(): boolean {
    return this.code === "unreachable" || this.code === "timeout";
  }
}

/* ───────── transport ───────── */
const DEFAULT_TIMEOUTS = { health: 3_000, analyze: 60_000, validate: 30_000, train: 180_000, infer: 15_000, synthetic: 30_000 } as const;

function authHeaders(): Record<string, string> {
  const token = process.env.CV_SERVICE_TOKEN;
  return token ? { "X-Vitra-Service-Token": token } : {};
}

async function parseError(res: Response): Promise<CvServiceError> {
  let code: CvErrorCode = "bad_response";
  let message = `CV service responded ${res.status}`;
  try {
    const body = (await res.json()) as { error?: { code?: string; message?: string } };
    if (body?.error?.code) code = body.error.code as CvErrorCode;
    if (body?.error?.message) message = body.error.message;
  } catch {
    /* non-JSON error body */
  }
  if (res.status === 401 && code === "bad_response") code = "unauthorized";
  return new CvServiceError(code, message, res.status);
}

async function request(path: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${CV_SERVICE_URL}${path}`, { ...init, signal: ctrl.signal, cache: "no-store", headers: { ...(init.headers as Record<string, string> | undefined), ...authHeaders() } });
    if (!res.ok) throw await parseError(res);
    return res;
  } catch (err) {
    if (err instanceof CvServiceError) throw err;
    const e = err as { name?: string; message?: string; cause?: { code?: string } };
    if (e?.name === "AbortError") throw new CvServiceError("timeout", `CV service timed out after ${timeoutMs} ms (${path})`);
    throw new CvServiceError("unreachable", `CV service unreachable at ${CV_SERVICE_URL}: ${e?.cause?.code ?? e?.message ?? "fetch failed"}`);
  } finally {
    clearTimeout(timer);
  }
}

async function requestJson<T>(path: string, init: RequestInit, timeoutMs: number): Promise<T> {
  const res = await request(path, init, timeoutMs);
  try {
    return (await res.json()) as T;
  } catch {
    throw new CvServiceError("bad_response", `CV service returned non-JSON for ${path}`, res.status);
  }
}

/* ───────── public API ───────── */
export async function health(timeoutMs: number = DEFAULT_TIMEOUTS.health): Promise<HealthResponse> {
  return requestJson<HealthResponse>("/health", { method: "GET" }, timeoutMs);
}

export async function analyze(
  file: { bytes: Uint8Array; mimeType: string; fileName: string },
  config?: AnalyzeConfig,
  timeoutMs: number = DEFAULT_TIMEOUTS.analyze,
): Promise<AnalyzeResponse> {
  const form = new FormData();
  form.append("file", new Blob([file.bytes as BlobPart], { type: file.mimeType }), file.fileName);
  if (config) form.append("config", JSON.stringify(config));
  return requestJson<AnalyzeResponse>("/v1/analyze", { method: "POST", body: form }, timeoutMs);
}

export async function validateDataset(req: ValidateDatasetRequest, timeoutMs: number = DEFAULT_TIMEOUTS.validate): Promise<ValidateDatasetResponse> {
  return requestJson<ValidateDatasetResponse>("/v1/calibration/validate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(req) }, timeoutMs);
}

export async function train(req: TrainRequest, timeoutMs: number = DEFAULT_TIMEOUTS.train): Promise<TrainResponse> {
  return requestJson<TrainResponse>("/v1/calibration/train", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(req) }, timeoutMs);
}

export async function infer(req: InferRequest, timeoutMs: number = DEFAULT_TIMEOUTS.infer): Promise<InferResponse> {
  return requestJson<InferResponse>("/v1/infer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(req) }, timeoutMs);
}

/** Renders a SYNTHETIC strip PNG. Never present these as patient samples. */
export async function syntheticStrip(req: SyntheticStripRequest, timeoutMs: number = DEFAULT_TIMEOUTS.synthetic): Promise<Uint8Array> {
  const res = await request("/v1/synthetic/strip", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(req) }, timeoutMs);
  return new Uint8Array(await res.arrayBuffer());
}

export const cvClient = { health, analyze, validateDataset, train, infer, syntheticStrip };
