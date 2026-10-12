import {
  pgTable,
  text,
  timestamp,
  integer,
  real,
  boolean,
  jsonb,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

/* ───────────── helpers ───────────── */
const id = () => text("id").primaryKey();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`);
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`);

/* ───────────── auth ───────────── */
export const roles = pgTable("roles", {
  key: text("key").primaryKey(), // admin | clinician | operator | researcher | viewer
  label: text("label").notNull(),
  description: text("description").notNull(),
});

export const permissions = pgTable("permissions", {
  key: text("key").primaryKey(),
  description: text("description").notNull(),
});

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleKey: text("role_key").notNull().references(() => roles.key, { onDelete: "cascade" }),
    permissionKey: text("permission_key").notNull().references(() => permissions.key, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.roleKey, t.permissionKey] })],
);

export const users = pgTable(
  "users",
  {
    id: id(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    passwordHash: text("password_hash").notNull(), // scrypt
    roleKey: text("role_key").notNull().references(() => roles.key),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: id(), // random token hash
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    userAgent: text("user_agent"),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/* ───────────── strip products ───────────── */
export const stripProducts = pgTable("strip_products", {
  id: id(),
  manufacturer: text("manufacturer").notNull(),
  name: text("name").notNull(),
  padCount: integer("pad_count").notNull().default(10),
  padMap: jsonb("pad_map").$type<string[]>().notNull(), // analyte keys, left→right
  reactionSeconds: integer("reaction_seconds").notNull().default(120),
  geometry: jsonb("geometry").$type<Record<string, unknown>>(), // fixed-geometry baseline for this product
  notes: text("notes"),
  createdAt: createdAt(),
});

export const stripBatches = pgTable(
  "strip_batches",
  {
    id: id(),
    stripProductId: text("strip_product_id").notNull().references(() => stripProducts.id, { onDelete: "cascade" }),
    lotNumber: text("lot_number").notNull(),
    expiresOn: text("expires_on"), // ISO date
    receivedOn: text("received_on"),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("strip_batches_lot_idx").on(t.stripProductId, t.lotNumber)],
);

/* ───────────── analytes ───────────── */
export const analyteDefinitions = pgTable("analyte_definitions", {
  key: text("key").primaryKey(),
  label: text("label").notNull(),
  unit: text("unit").notNull(),
  kind: text("kind").notNull(), // continuous | qualitative
  chartScale: jsonb("chart_scale").$type<(number | string)[]>().notNull(),
  spanLow: real("span_low").notNull(),
  spanHigh: real("span_high").notNull(),
  decimals: integer("decimals").notNull().default(0),
  critical: boolean("critical").notNull().default(false),
  sortOrder: integer("sort_order").notNull(),
});

/* ───────────── devices ───────────── */
export const devices = pgTable("devices", {
  id: id(),
  name: text("name").notNull(),
  kind: text("kind").notNull(), // simulated | raspberry_pi
  simulated: boolean("simulated").notNull().default(true),
  hardwareId: text("hardware_id"),
  softwareVersion: text("software_version"),
  cameraModel: text("camera_model"),
  illuminationProfile: jsonb("illumination_profile").$type<Record<string, unknown>>(),
  calibrationProfileId: text("calibration_profile_id"),
  apiKeyHash: text("api_key_hash"), // for /api/ingest
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  status: text("status").notNull().default("offline"), // online | offline | degraded | simulated
  createdAt: createdAt(),
});

export const deviceEvents = pgTable(
  "device_events",
  {
    id: id(),
    deviceId: text("device_id").notNull().references(() => devices.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // heartbeat | capture_started | capture_completed | error | illumination_change | calibration
    level: text("level").notNull().default("info"), // info | warn | error
    message: text("message").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    simulated: boolean("simulated").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("device_events_device_idx").on(t.deviceId, t.createdAt)],
);

/* ───────────── samples / images ───────────── */
export const samples = pgTable(
  "samples",
  {
    id: id(),
    sampleCode: text("sample_code").notNull(), // pseudonymous, e.g. S-2026-0001
    subjectPseudonym: text("subject_pseudonym"), // pseudonymous subject key for time-series (never a name/MRN)
    synthetic: boolean("synthetic").notNull().default(false),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("samples_code_idx").on(t.sampleCode), index("samples_subject_idx").on(t.subjectPseudonym)],
);

export const images = pgTable(
  "images",
  {
    id: id(),
    sampleId: text("sample_id").references(() => samples.id, { onDelete: "set null" }),
    source: text("source").notNull(), // upload | browser_camera | device | synthetic
    deviceId: text("device_id").references(() => devices.id, { onDelete: "set null" }),
    storagePath: text("storage_path").notNull(), // relative to STORAGE_DIR
    overlayPath: text("overlay_path"),
    stripCropPath: text("strip_crop_path"),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    width: integer("width"),
    height: integer("height"),
    sha256: text("sha256").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }),
    idempotencyKey: text("idempotency_key"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("images_idem_idx").on(t.idempotencyKey), index("images_sample_idx").on(t.sampleId)],
);

/* ───────────── analysis ───────────── */
export const analysisRuns = pgTable(
  "analysis_runs",
  {
    id: id(),
    runCode: text("run_code").notNull(), // R-000123
    sampleId: text("sample_id").notNull().references(() => samples.id, { onDelete: "restrict" }),
    imageId: text("image_id").references(() => images.id, { onDelete: "set null" }),
    stripProductId: text("strip_product_id").notNull().references(() => stripProducts.id),
    stripBatchId: text("strip_batch_id").references(() => stripBatches.id, { onDelete: "set null" }),
    deviceId: text("device_id").references(() => devices.id, { onDelete: "set null" }),
    operatorId: text("operator_id").references(() => users.id, { onDelete: "set null" }),
    operatorLabel: text("operator_label"),
    mode: text("mode").notNull().default("research"), // research | demo
    imageSource: text("image_source").notNull(), // upload | browser_camera | device | synthetic
    status: text("status").notNull(), // queued | processing | invalid_image | calibration_required | pending_review | reviewed | rejected | failed
    reactionSeconds: integer("reaction_seconds"),
    reactionStartedAt: timestamp("reaction_started_at", { withTimezone: true }),
    capturedAt: timestamp("captured_at", { withTimezone: true }),
    pipelineVersion: text("pipeline_version"),
    qualityPassed: boolean("quality_passed"),
    qualityChecks: jsonb("quality_checks").$type<QualityCheck[]>(),
    stripGeometry: jsonb("strip_geometry").$type<Record<string, unknown>>(),
    featureVector: jsonb("feature_vector").$type<{ rgb_30: number[]; lab_30: number[] }>(),
    timings: jsonb("timings").$type<Record<string, number>>(),
    warnings: jsonb("warnings").$type<string[]>(),
    synthetic: boolean("synthetic").notNull().default(false),
    errorMessage: text("error_message"),
    createdAt: createdAt(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("analysis_runs_code_idx").on(t.runCode),
    index("analysis_runs_sample_idx").on(t.sampleId),
    index("analysis_runs_status_idx").on(t.status),
    index("analysis_runs_created_idx").on(t.createdAt),
  ],
);

export const padSegmentations = pgTable(
  "pad_segmentations",
  {
    id: id(),
    runId: text("run_id").notNull().references(() => analysisRuns.id, { onDelete: "cascade" }),
    padIndex: integer("pad_index").notNull(),
    padId: text("pad_id").notNull(), // P01..P10
    analyteKey: text("analyte_key").references(() => analyteDefinitions.key),
    roi: jsonb("roi").$type<{ x: number; y: number; w: number; h: number }>().notNull(),
    roiSource: text("roi_source").notNull(), // detected | fixed
    qualityStatus: text("quality_status").notNull(), // ok | warn | fail
    qualityMetrics: jsonb("quality_metrics").$type<Record<string, unknown>>(),
    flags: jsonb("flags").$type<string[]>(),
  },
  (t) => [uniqueIndex("pad_seg_run_pad_idx").on(t.runId, t.padIndex)],
);

export const colourFeatures = pgTable(
  "colour_features",
  {
    id: id(),
    padSegmentationId: text("pad_segmentation_id").notNull().references(() => padSegmentations.id, { onDelete: "cascade" }),
    rgbMean: jsonb("rgb_mean").$type<number[]>().notNull(),
    rgbMedian: jsonb("rgb_median").$type<number[]>().notNull(),
    rgbStd: jsonb("rgb_std").$type<number[]>().notNull(),
    labMean: jsonb("lab_mean").$type<number[]>().notNull(),
    labStd: jsonb("lab_std").$type<number[]>(),
    hsvMean: jsonb("hsv_mean").$type<number[]>(),
    pixelCount: integer("pixel_count").notNull(),
  },
  (t) => [uniqueIndex("colour_features_pad_idx").on(t.padSegmentationId)],
);

export const analyteResults = pgTable(
  "analyte_results",
  {
    id: id(),
    runId: text("run_id").notNull().references(() => analysisRuns.id, { onDelete: "cascade" }),
    analyteKey: text("analyte_key").notNull().references(() => analyteDefinitions.key),
    padIndex: integer("pad_index"),
    state: text("state").notNull(), // ResultState
    value: real("value"),
    unit: text("unit").notNull(),
    intervalLow: real("interval_low"),
    intervalHigh: real("interval_high"),
    modelId: text("model_id").references(() => calibrationModels.id, { onDelete: "set null" }),
    reason: text("reason"),
  },
  (t) => [uniqueIndex("analyte_results_run_key_idx").on(t.runId, t.analyteKey)],
);

/* ───────────── calibration ───────────── */
export const referenceMeasurements = pgTable(
  "reference_measurements",
  {
    id: id(),
    sampleId: text("sample_id").references(() => samples.id, { onDelete: "set null" }),
    sampleCode: text("sample_code").notNull(),
    analyteKey: text("analyte_key").notNull().references(() => analyteDefinitions.key),
    value: real("value").notNull(),
    unit: text("unit").notNull(),
    method: text("method").notNull(), // lab_analyser | manual_chart | synthetic
    synthetic: boolean("synthetic").notNull().default(false),
    measuredAt: timestamp("measured_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("ref_meas_sample_idx").on(t.sampleCode, t.analyteKey)],
);

export const calibrationDatasets = pgTable("calibration_datasets", {
  id: id(),
  name: text("name").notNull(),
  version: integer("version").notNull().default(1),
  stripProductId: text("strip_product_id").notNull().references(() => stripProducts.id),
  stripBatchId: text("strip_batch_id").references(() => stripBatches.id, { onDelete: "set null" }),
  synthetic: boolean("synthetic").notNull().default(false),
  rowCount: integer("row_count").notNull(),
  columns: jsonb("columns").$type<string[]>().notNull(),
  storagePath: text("storage_path").notNull(), // CSV relative to STORAGE_DIR
  sha256: text("sha256").notNull(),
  validation: jsonb("validation").$type<Record<string, unknown>>(),
  notes: text("notes"),
  createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

export const calibrationModels = pgTable(
  "calibration_models",
  {
    id: id(), // model_id used by CV service store
    analyteKey: text("analyte_key").notNull().references(() => analyteDefinitions.key),
    stripProductId: text("strip_product_id").notNull().references(() => stripProducts.id),
    datasetId: text("dataset_id").references(() => calibrationDatasets.id, { onDelete: "set null" }),
    version: text("version").notNull(),
    modelType: text("model_type").notNull(), // linear | poly2_ridge | poly3_ridge | knn | rf
    featureSet: text("feature_set").notNull(), // rgb30 | pad_rgb | lab30
    status: text("status").notNull().default("trained"), // draft | trained | validated | retired
    trainedOnSynthetic: boolean("trained_on_synthetic").notNull().default(false),
    referenceLow: real("reference_low"),
    referenceHigh: real("reference_high"),
    nTrain: integer("n_train"),
    nTest: integer("n_test"),
    trainingMeta: jsonb("training_meta").$type<Record<string, unknown>>(),
    validationEvidence: text("validation_evidence"), // required to move to "validated"
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("calib_models_analyte_idx").on(t.analyteKey, t.stripProductId, t.status)],
);

export const modelEvaluations = pgTable(
  "model_evaluations",
  {
    id: id(),
    modelId: text("model_id").notNull().references(() => calibrationModels.id, { onDelete: "cascade" }),
    split: text("split").notNull(), // train | test | cv5
    n: integer("n").notNull(),
    mae: real("mae"),
    rmse: real("rmse"),
    bias: real("bias"),
    r2: real("r2"),
    residualQuantiles: jsonb("residual_quantiles").$type<Record<string, number>>(),
    predictions: jsonb("predictions").$type<{ sample_id: string; reference: number; predicted: number; residual: number; split: string; batch?: string }[]>(),
    createdAt: createdAt(),
  },
  (t) => [index("model_eval_model_idx").on(t.modelId)],
);

/* ───────────── review / reports / audit ───────────── */
export const clinicalReviews = pgTable(
  "clinical_reviews",
  {
    id: id(),
    runId: text("run_id").notNull().references(() => analysisRuns.id, { onDelete: "cascade" }),
    reviewerId: text("reviewer_id").references(() => users.id, { onDelete: "set null" }),
    reviewerLabel: text("reviewer_label").notNull(),
    decision: text("decision").notNull(), // accepted | rejected | needs_repeat | note
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("reviews_run_idx").on(t.runId, t.createdAt)],
);

export const reports = pgTable(
  "reports",
  {
    id: id(),
    runId: text("run_id").notNull().references(() => analysisRuns.id, { onDelete: "cascade" }),
    format: text("format").notNull(), // pdf | json
    storagePath: text("storage_path").notNull(),
    byteSize: integer("byte_size").notNull(),
    sha256: text("sha256").notNull(),
    generatedById: text("generated_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("reports_run_idx").on(t.runId)],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: id(),
    actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
    actorLabel: text("actor_label").notNull(),
    action: text("action").notNull(), // e.g. run.create, review.accept, report.download, model.validate
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    detail: jsonb("detail").$type<Record<string, unknown>>(),
    ip: text("ip"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_entity_idx").on(t.entityType, t.entityId), index("audit_created_idx").on(t.createdAt)],
);

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedAt: updatedAt(),
});

/* ───────────── types ───────────── */
export interface QualityCheck {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  value: string | number | null;
  threshold: string | null;
  message: string;
}

/* ───────────── relations ───────────── */
export const analysisRunsRelations = relations(analysisRuns, ({ one, many }) => ({
  sample: one(samples, { fields: [analysisRuns.sampleId], references: [samples.id] }),
  image: one(images, { fields: [analysisRuns.imageId], references: [images.id] }),
  stripProduct: one(stripProducts, { fields: [analysisRuns.stripProductId], references: [stripProducts.id] }),
  stripBatch: one(stripBatches, { fields: [analysisRuns.stripBatchId], references: [stripBatches.id] }),
  device: one(devices, { fields: [analysisRuns.deviceId], references: [devices.id] }),
  operator: one(users, { fields: [analysisRuns.operatorId], references: [users.id] }),
  pads: many(padSegmentations),
  results: many(analyteResults),
  reviews: many(clinicalReviews),
  reports: many(reports),
}));

export const padSegmentationsRelations = relations(padSegmentations, ({ one }) => ({
  run: one(analysisRuns, { fields: [padSegmentations.runId], references: [analysisRuns.id] }),
  features: one(colourFeatures, { fields: [padSegmentations.id], references: [colourFeatures.padSegmentationId] }),
}));

export const analyteResultsRelations = relations(analyteResults, ({ one }) => ({
  run: one(analysisRuns, { fields: [analyteResults.runId], references: [analysisRuns.id] }),
  model: one(calibrationModels, { fields: [analyteResults.modelId], references: [calibrationModels.id] }),
}));

export const samplesRelations = relations(samples, ({ many }) => ({
  runs: many(analysisRuns),
  referenceMeasurements: many(referenceMeasurements),
}));

export const calibrationModelsRelations = relations(calibrationModels, ({ one, many }) => ({
  dataset: one(calibrationDatasets, { fields: [calibrationModels.datasetId], references: [calibrationDatasets.id] }),
  stripProduct: one(stripProducts, { fields: [calibrationModels.stripProductId], references: [stripProducts.id] }),
  evaluations: many(modelEvaluations),
}));

export const devicesRelations = relations(devices, ({ many }) => ({
  events: many(deviceEvents),
}));

export const usersRelations = relations(users, ({ one }) => ({
  role: one(roles, { fields: [users.roleKey], references: [roles.key] }),
}));

export const schema = {
  roles, permissions, rolePermissions, users, sessions,
  stripProducts, stripBatches, analyteDefinitions,
  devices, deviceEvents,
  samples, images,
  analysisRuns, padSegmentations, colourFeatures, analyteResults,
  referenceMeasurements, calibrationDatasets, calibrationModels, modelEvaluations,
  clinicalReviews, reports, auditEvents, appSettings,
  analysisRunsRelations, padSegmentationsRelations, analyteResultsRelations, samplesRelations,
  calibrationModelsRelations, devicesRelations, usersRelations,
};
