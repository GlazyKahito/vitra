/**
 * DATA-LAYER CONTRACT — shared between the data-layer agent (implements) and the
 * screens agent (consumes). Function names and shapes here are binding.
 *
 * Implementations live in lib/data/<module>.ts and must export exactly these
 * names. All functions are server-only (called from server components, server
 * actions and route handlers).
 */
import type {
  analysisRuns, samples, images, stripProducts, stripBatches, devices, deviceEvents,
  padSegmentations, colourFeatures, analyteResults, calibrationDatasets, calibrationModels,
  modelEvaluations, clinicalReviews, reports, auditEvents, users, referenceMeasurements,
} from "@/db/schema";
import type { ResultState } from "@/lib/inference/policy";

export type Run = typeof analysisRuns.$inferSelect;
export type Sample = typeof samples.$inferSelect;
export type ImageRow = typeof images.$inferSelect;
export type StripProduct = typeof stripProducts.$inferSelect;
export type StripBatch = typeof stripBatches.$inferSelect;
export type Device = typeof devices.$inferSelect;
export type DeviceEvent = typeof deviceEvents.$inferSelect;
export type PadSeg = typeof padSegmentations.$inferSelect;
export type ColourFeature = typeof colourFeatures.$inferSelect;
export type AnalyteResult = typeof analyteResults.$inferSelect;
export type CalibrationDataset = typeof calibrationDatasets.$inferSelect;
export type CalibrationModel = typeof calibrationModels.$inferSelect;
export type ModelEvaluation = typeof modelEvaluations.$inferSelect;
export type ClinicalReview = typeof clinicalReviews.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type AuditEvent = typeof auditEvents.$inferSelect;
export type User = typeof users.$inferSelect;
export type ReferenceMeasurement = typeof referenceMeasurements.$inferSelect;

export type SafeUser = Pick<User, "id" | "email" | "displayName" | "roleKey" | "active">;

/* ───────── lib/data/runs.ts ───────── */
export interface RunListFilter {
  q?: string; // matches runCode / sampleCode / subjectPseudonym
  status?: Run["status"] | "all";
  mode?: "research" | "demo" | "all";
  stripProductId?: string;
  synthetic?: "all" | "only" | "exclude";
  from?: string; // ISO date
  to?: string;
  limit?: number;
  offset?: number;
}
export interface RunListItem {
  run: Run;
  sample: Sample;
  stripProduct: StripProduct;
  device: Device | null;
  resultSummary: { analyteKey: string; state: ResultState; value: number | null; unit: string }[];
  latestReview: ClinicalReview | null;
}
export interface RunDetail extends RunListItem {
  image: ImageRow | null;
  batch: StripBatch | null;
  operator: SafeUser | null;
  pads: (PadSeg & { features: ColourFeature | null })[];
  results: (AnalyteResult & { model: CalibrationModel | null })[];
  reviews: ClinicalReview[];
  reports: Report[];
  audit: AuditEvent[];
  previousRunsForSubject: { run: Run; results: AnalyteResult[] }[];
}
export interface ConsoleStats {
  totalRuns: number;
  runsLast7d: number;
  byStatus: Record<string, number>;
  byMode: Record<string, number>;
  syntheticRuns: number;
  qualityFailuresLast30: number;
  pendingReview: number;
  reviewedLast7d: number;
  runsPerDay: { date: string; count: number; invalid: number }[]; // last 14 days
  recentQualityFailures: { run: Run; sample: Sample; failedChecks: string[] }[];
  analyteStateCounts: { analyteKey: string; counts: Partial<Record<ResultState, number>> }[];
  analyteValueSeries: { analyteKey: string; unit: string; points: { runCode: string; at: string; value: number; state: ResultState; synthetic: boolean }[] }[];
}
// listRuns(filter): Promise<{ items: RunListItem[]; total: number }>
// getRun(id): Promise<RunDetail | null>
// getRunByCode(code): Promise<RunDetail | null>
// getConsoleStats(): Promise<ConsoleStats>
// getRecentActivity(limit): Promise<AuditEvent[]>

/* ───────── lib/data/samples.ts ───────── */
export interface SampleListItem { sample: Sample; runCount: number; lastRunAt: Date | null; lastStatus: string | null; referenceCount: number }
export interface SampleDetail { sample: Sample; runs: RunListItem[]; references: ReferenceMeasurement[]; trend: { analyteKey: string; unit: string; points: { runCode: string; at: string; value: number | null; state: ResultState }[] }[] }
// listSamples(q?: string, opts?: {synthetic?: "all"|"only"|"exclude"; limit?: number}): Promise<SampleListItem[]>
// getSample(id): Promise<SampleDetail | null>
// createSample(input: { sampleCode: string; subjectPseudonym?: string; metadata?: Record<string, unknown>; synthetic?: boolean }, actor: SafeUser): Promise<Sample>
// nextSampleCode(): Promise<string>

/* ───────── lib/data/strips.ts ───────── */
// listStripProducts(): Promise<(StripProduct & { batches: StripBatch[] })[]>
// getStripProduct(id): Promise<(StripProduct & { batches: StripBatch[] }) | null>
// updateStripProduct(id, patch: Partial<Pick<StripProduct, "padMap"|"reactionSeconds"|"geometry"|"notes">>, actor): Promise<void>

/* ───────── lib/data/devices.ts ───────── */
export interface DeviceWithHealth { device: Device; recentEvents: DeviceEvent[]; errorCount24h: number; lastCapture: DeviceEvent | null; health: "simulated" | "online" | "degraded" | "offline" }
// listDevices(): Promise<DeviceWithHealth[]>
// getDevice(id): Promise<(DeviceWithHealth & { events: DeviceEvent[] }) | null>
// recordDeviceEvent(deviceId, ev: { kind: string; level?: "info"|"warn"|"error"; message: string; payload?: Record<string, unknown>; simulated?: boolean }): Promise<DeviceEvent>
// simulateDeviceTick(deviceId): Promise<DeviceEvent>  // simulated adapter: generates a heartbeat/capture/error event, clearly simulated

/* ───────── lib/data/calibration.ts ───────── */
export interface ModelWithEvals { model: CalibrationModel; dataset: CalibrationDataset | null; stripProduct: StripProduct; evaluations: ModelEvaluation[] }
export interface CalibrationStatus { stripProductId: string; stripProductName: string; perAnalyte: { analyteKey: string; model: CalibrationModel | null; status: "none" | "synthetic_only" | "experimental" | "validated"; trainedAt: Date | null; ageDays: number | null; recalibrationDue: boolean }[] }
// listDatasets(): Promise<CalibrationDataset[]>
// getDataset(id): Promise<(CalibrationDataset & { csvText: string }) | null>
// createDataset(input: { name: string; stripProductId: string; stripBatchId?: string; csvText: string; synthetic: boolean; notes?: string; validation: Record<string, unknown>; columns: string[]; rowCount: number }, actor): Promise<CalibrationDataset>
// listModels(filter?: { analyteKey?: string; stripProductId?: string }): Promise<ModelWithEvals[]>
// getModel(id): Promise<ModelWithEvals | null>
// createModel(input: { id: string; analyteKey: string; stripProductId: string; datasetId: string; version: string; modelType: string; featureSet: string; trainedOnSynthetic: boolean; referenceLow: number|null; referenceHigh: number|null; nTrain: number; nTest: number; trainingMeta: Record<string, unknown>; evaluations: { split: string; n: number; mae: number|null; rmse: number|null; bias: number|null; r2: number|null; residualQuantiles?: Record<string, number>; predictions?: ModelEvaluation["predictions"] }[] }, actor): Promise<CalibrationModel>
// setModelStatus(id, status: CalibrationModel["status"], evidence: string | null, actor): Promise<void>   // "validated" requires non-empty evidence and admin
// getCalibrationStatus(stripProductId?: string): Promise<CalibrationStatus[]>
// findActiveModel(analyteKey, stripProductId, mode: "research"|"demo"): Promise<CalibrationModel | null>
// listReferenceMeasurements(sampleCode?: string): Promise<ReferenceMeasurement[]>

/* ───────── lib/data/reviews.ts ───────── */
export interface ReviewQueueItem extends RunListItem { waitingSince: Date; criticalFlags: string[] }
// listReviewQueue(filter?: { status?: "pending_review"|"reviewed"|"rejected"|"all"; q?: string }): Promise<ReviewQueueItem[]>
// submitReview(runId, input: { decision: "accepted"|"rejected"|"needs_repeat"|"note"; note?: string }, actor): Promise<ClinicalReview>

/* ───────── lib/data/reports.ts ───────── */
// listReports(filter?: { q?: string; format?: "pdf"|"json"|"all" }): Promise<(Report & { run: Run; sample: Sample })[]>
// generateReport(runId, format: "pdf"|"json", actor): Promise<Report>   // builds file under STORAGE_DIR/reports, inserts row, audit
// getReportFile(reportId): Promise<{ report: Report; absPath: string } | null>

/* ───────── lib/data/audit.ts ───────── */
// recordAudit(ev: { actor: SafeUser | null; action: string; entityType: string; entityId: string; detail?: Record<string, unknown> }): Promise<void>
// listAudit(filter?: { entityType?: string; entityId?: string; limit?: number }): Promise<AuditEvent[]>

/* ───────── lib/data/settings.ts ───────── */
export interface AppSettingsShape {
  defaultStripProductId: string;
  defaultReactionSeconds: number;
  recalibrationIntervalDays: number;
  demoModeEnabled: boolean;
  requireReviewForReports: boolean;
  cvServiceUrl: string;
}
// getSettings(): Promise<AppSettingsShape>
// updateSettings(patch: Partial<AppSettingsShape>, actor): Promise<AppSettingsShape>

/* ───────── lib/analysis/run-analysis.ts ───────── */
export interface StartAnalysisInput {
  sampleId: string;
  stripProductId: string;
  stripBatchId?: string | null;
  deviceId?: string | null;
  mode: "research" | "demo";
  imageSource: "upload" | "browser_camera" | "device" | "synthetic";
  operatorLabel?: string;
  reactionSeconds?: number;
  reactionStartedAt?: string | null;
  file: { bytes: Uint8Array; mimeType: string; fileName: string };
}
// startAnalysis(input, actor): Promise<{ runId: string; runCode: string; status: Run["status"] }>
//   → stores image, calls CV service /v1/analyze, persists pads/features/quality, applies policy per analyte, persists results, audit.
//   If CV service unreachable: run.status = "failed" with errorMessage, results state "unavailable".

/* ───────── lib/auth ───────── */
// getCurrentUser(): Promise<SafeUser | null>
// requireUser(permission?: Permission): Promise<SafeUser>  // throws/redirects
// can(user: SafeUser | null, permission: Permission): boolean
export type Permission =
  | "runs.create" | "runs.read" | "samples.manage" | "reviews.write" | "reports.generate" | "reports.read"
  | "calibration.manage" | "models.validate" | "devices.manage" | "settings.manage" | "audit.read" | "users.manage";
