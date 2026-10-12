-- VITRA initial schema. Mirrors apps/web/db/schema.ts (Drizzle). Hand-written, applied by db/migrate.ts.
-- Enum-like text columns are constrained with CHECK so the database rejects unknown states.

-- ───────────── auth ─────────────
CREATE TABLE IF NOT EXISTS roles (
  key         text PRIMARY KEY CHECK (key IN ('admin','clinician','operator','researcher','viewer')),
  label       text NOT NULL,
  description text NOT NULL
);

CREATE TABLE IF NOT EXISTS permissions (
  key         text PRIMARY KEY,
  description text NOT NULL
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_key       text NOT NULL REFERENCES roles(key) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES permissions(key) ON DELETE CASCADE,
  PRIMARY KEY (role_key, permission_key)
);

CREATE TABLE IF NOT EXISTS users (
  id            text PRIMARY KEY,
  email         text NOT NULL,
  display_name  text NOT NULL,
  password_hash text NOT NULL,
  role_key      text NOT NULL REFERENCES roles(key),
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users (email);

CREATE TABLE IF NOT EXISTS sessions (
  id         text PRIMARY KEY,
  user_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  user_agent text
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);

-- ───────────── strip products ─────────────
CREATE TABLE IF NOT EXISTS strip_products (
  id               text PRIMARY KEY,
  manufacturer     text NOT NULL,
  name             text NOT NULL,
  pad_count        integer NOT NULL DEFAULT 10 CHECK (pad_count BETWEEN 1 AND 20),
  pad_map          jsonb NOT NULL,
  reaction_seconds integer NOT NULL DEFAULT 120 CHECK (reaction_seconds >= 0),
  geometry         jsonb,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS strip_batches (
  id               text PRIMARY KEY,
  strip_product_id text NOT NULL REFERENCES strip_products(id) ON DELETE CASCADE,
  lot_number       text NOT NULL,
  expires_on       text,
  received_on      text,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS strip_batches_lot_idx ON strip_batches (strip_product_id, lot_number);

-- ───────────── analytes ─────────────
CREATE TABLE IF NOT EXISTS analyte_definitions (
  key         text PRIMARY KEY,
  label       text NOT NULL,
  unit        text NOT NULL,
  kind        text NOT NULL CHECK (kind IN ('continuous','qualitative')),
  chart_scale jsonb NOT NULL,
  span_low    real NOT NULL,
  span_high   real NOT NULL,
  decimals    integer NOT NULL DEFAULT 0,
  critical    boolean NOT NULL DEFAULT false,
  sort_order  integer NOT NULL
);

-- ───────────── devices ─────────────
CREATE TABLE IF NOT EXISTS devices (
  id                     text PRIMARY KEY,
  name                   text NOT NULL,
  kind                   text NOT NULL CHECK (kind IN ('simulated','raspberry_pi')),
  simulated              boolean NOT NULL DEFAULT true,
  hardware_id            text,
  software_version       text,
  camera_model           text,
  illumination_profile   jsonb,
  calibration_profile_id text,
  api_key_hash           text,
  last_seen_at           timestamptz,
  status                 text NOT NULL DEFAULT 'offline' CHECK (status IN ('online','offline','degraded','simulated')),
  created_at             timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS devices_name_idx ON devices (name);

CREATE TABLE IF NOT EXISTS device_events (
  id         text PRIMARY KEY,
  device_id  text NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  kind       text NOT NULL CHECK (kind IN ('heartbeat','capture_started','capture_completed','error','illumination_change','calibration')),
  level      text NOT NULL DEFAULT 'info' CHECK (level IN ('info','warn','error')),
  message    text NOT NULL,
  payload    jsonb,
  simulated  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS device_events_device_idx ON device_events (device_id, created_at);

-- ───────────── samples / images ─────────────
CREATE TABLE IF NOT EXISTS samples (
  id                text PRIMARY KEY,
  sample_code       text NOT NULL,
  subject_pseudonym text,
  synthetic         boolean NOT NULL DEFAULT false,
  metadata          jsonb,
  created_by_id     text REFERENCES users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS samples_code_idx ON samples (sample_code);
CREATE INDEX IF NOT EXISTS samples_subject_idx ON samples (subject_pseudonym);

CREATE TABLE IF NOT EXISTS images (
  id              text PRIMARY KEY,
  sample_id       text REFERENCES samples(id) ON DELETE SET NULL,
  source          text NOT NULL CHECK (source IN ('upload','browser_camera','device','synthetic')),
  device_id       text REFERENCES devices(id) ON DELETE SET NULL,
  storage_path    text NOT NULL,
  overlay_path    text,
  strip_crop_path text,
  mime_type       text NOT NULL,
  byte_size       integer NOT NULL CHECK (byte_size >= 0),
  width           integer,
  height          integer,
  sha256          text NOT NULL,
  captured_at     timestamptz,
  idempotency_key text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS images_idem_idx ON images (idempotency_key);
CREATE INDEX IF NOT EXISTS images_sample_idx ON images (sample_id);

-- ───────────── calibration (models referenced by analyte_results, so created first) ─────────────
CREATE TABLE IF NOT EXISTS calibration_datasets (
  id               text PRIMARY KEY,
  name             text NOT NULL,
  version          integer NOT NULL DEFAULT 1,
  strip_product_id text NOT NULL REFERENCES strip_products(id),
  strip_batch_id   text REFERENCES strip_batches(id) ON DELETE SET NULL,
  synthetic        boolean NOT NULL DEFAULT false,
  row_count        integer NOT NULL CHECK (row_count >= 0),
  columns          jsonb NOT NULL,
  storage_path     text NOT NULL,
  sha256           text NOT NULL,
  validation       jsonb,
  notes            text,
  created_by_id    text REFERENCES users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS calibration_models (
  id                   text PRIMARY KEY,
  analyte_key          text NOT NULL REFERENCES analyte_definitions(key),
  strip_product_id     text NOT NULL REFERENCES strip_products(id),
  dataset_id           text REFERENCES calibration_datasets(id) ON DELETE SET NULL,
  version              text NOT NULL,
  model_type           text NOT NULL CHECK (model_type IN ('linear','poly2_ridge','poly3_ridge','knn','rf')),
  feature_set          text NOT NULL CHECK (feature_set IN ('rgb30','pad_rgb','lab30')),
  status               text NOT NULL DEFAULT 'trained' CHECK (status IN ('draft','trained','validated','retired')),
  trained_on_synthetic boolean NOT NULL DEFAULT false,
  reference_low        real,
  reference_high       real,
  n_train              integer,
  n_test               integer,
  training_meta        jsonb,
  validation_evidence  text,
  created_by_id        text REFERENCES users(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  -- A validated model must carry evidence and can never be synthetic-trained.
  CONSTRAINT calib_models_validated_evidence CHECK (status <> 'validated' OR (validation_evidence IS NOT NULL AND trained_on_synthetic = false))
);
CREATE INDEX IF NOT EXISTS calib_models_analyte_idx ON calibration_models (analyte_key, strip_product_id, status);

CREATE TABLE IF NOT EXISTS model_evaluations (
  id                 text PRIMARY KEY,
  model_id           text NOT NULL REFERENCES calibration_models(id) ON DELETE CASCADE,
  split              text NOT NULL CHECK (split IN ('train','test','cv5')),
  n                  integer NOT NULL CHECK (n >= 0),
  mae                real,
  rmse               real,
  bias               real,
  r2                 real,
  residual_quantiles jsonb,
  predictions        jsonb,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS model_eval_model_idx ON model_evaluations (model_id);

CREATE TABLE IF NOT EXISTS reference_measurements (
  id          text PRIMARY KEY,
  sample_id   text REFERENCES samples(id) ON DELETE SET NULL,
  sample_code text NOT NULL,
  analyte_key text NOT NULL REFERENCES analyte_definitions(key),
  value       real NOT NULL,
  unit        text NOT NULL,
  method      text NOT NULL CHECK (method IN ('lab_analyser','manual_chart','synthetic')),
  synthetic   boolean NOT NULL DEFAULT false,
  measured_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ref_meas_sample_idx ON reference_measurements (sample_code, analyte_key);

-- ───────────── analysis ─────────────
CREATE TABLE IF NOT EXISTS analysis_runs (
  id                  text PRIMARY KEY,
  run_code            text NOT NULL,
  sample_id           text NOT NULL REFERENCES samples(id) ON DELETE RESTRICT,
  image_id            text REFERENCES images(id) ON DELETE SET NULL,
  strip_product_id    text NOT NULL REFERENCES strip_products(id),
  strip_batch_id      text REFERENCES strip_batches(id) ON DELETE SET NULL,
  device_id           text REFERENCES devices(id) ON DELETE SET NULL,
  operator_id         text REFERENCES users(id) ON DELETE SET NULL,
  operator_label      text,
  mode                text NOT NULL DEFAULT 'research' CHECK (mode IN ('research','demo')),
  image_source        text NOT NULL CHECK (image_source IN ('upload','browser_camera','device','synthetic')),
  status              text NOT NULL CHECK (status IN ('queued','processing','invalid_image','calibration_required','pending_review','reviewed','rejected','failed')),
  reaction_seconds    integer,
  reaction_started_at timestamptz,
  captured_at         timestamptz,
  pipeline_version    text,
  quality_passed      boolean,
  quality_checks      jsonb,
  strip_geometry      jsonb,
  feature_vector      jsonb,
  timings             jsonb,
  warnings            jsonb,
  synthetic           boolean NOT NULL DEFAULT false,
  error_message       text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS analysis_runs_code_idx ON analysis_runs (run_code);
CREATE INDEX IF NOT EXISTS analysis_runs_sample_idx ON analysis_runs (sample_id);
CREATE INDEX IF NOT EXISTS analysis_runs_status_idx ON analysis_runs (status);
CREATE INDEX IF NOT EXISTS analysis_runs_created_idx ON analysis_runs (created_at);

CREATE TABLE IF NOT EXISTS pad_segmentations (
  id              text PRIMARY KEY,
  run_id          text NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  pad_index       integer NOT NULL CHECK (pad_index >= 0),
  pad_id          text NOT NULL,
  analyte_key     text REFERENCES analyte_definitions(key),
  roi             jsonb NOT NULL,
  roi_source      text NOT NULL CHECK (roi_source IN ('detected','fixed')),
  quality_status  text NOT NULL CHECK (quality_status IN ('ok','warn','fail')),
  quality_metrics jsonb,
  flags           jsonb
);
CREATE UNIQUE INDEX IF NOT EXISTS pad_seg_run_pad_idx ON pad_segmentations (run_id, pad_index);

CREATE TABLE IF NOT EXISTS colour_features (
  id                  text PRIMARY KEY,
  pad_segmentation_id text NOT NULL REFERENCES pad_segmentations(id) ON DELETE CASCADE,
  rgb_mean            jsonb NOT NULL,
  rgb_median          jsonb NOT NULL,
  rgb_std             jsonb NOT NULL,
  lab_mean            jsonb NOT NULL,
  lab_std             jsonb,
  hsv_mean            jsonb,
  pixel_count         integer NOT NULL CHECK (pixel_count >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS colour_features_pad_idx ON colour_features (pad_segmentation_id);

CREATE TABLE IF NOT EXISTS analyte_results (
  id            text PRIMARY KEY,
  run_id        text NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  analyte_key   text NOT NULL REFERENCES analyte_definitions(key),
  pad_index     integer,
  state         text NOT NULL CHECK (state IN ('measured','experimental','synthetic','out_of_range','indeterminate','invalid_image','unavailable','calibration_required')),
  value         real,
  unit          text NOT NULL,
  interval_low  real,
  interval_high real,
  model_id      text REFERENCES calibration_models(id) ON DELETE SET NULL,
  reason        text,
  -- States that must not show a number carry no value.
  CONSTRAINT analyte_results_value_state CHECK (value IS NULL OR state IN ('measured','experimental','synthetic'))
);
CREATE UNIQUE INDEX IF NOT EXISTS analyte_results_run_key_idx ON analyte_results (run_id, analyte_key);

-- ───────────── review / reports / audit ─────────────
CREATE TABLE IF NOT EXISTS clinical_reviews (
  id             text PRIMARY KEY,
  run_id         text NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  reviewer_id    text REFERENCES users(id) ON DELETE SET NULL,
  reviewer_label text NOT NULL,
  decision       text NOT NULL CHECK (decision IN ('accepted','rejected','needs_repeat','note')),
  note           text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reviews_run_idx ON clinical_reviews (run_id, created_at);

CREATE TABLE IF NOT EXISTS reports (
  id              text PRIMARY KEY,
  run_id          text NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  format          text NOT NULL CHECK (format IN ('pdf','json')),
  storage_path    text NOT NULL,
  byte_size       integer NOT NULL CHECK (byte_size >= 0),
  sha256          text NOT NULL,
  generated_by_id text REFERENCES users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reports_run_idx ON reports (run_id);

CREATE TABLE IF NOT EXISTS audit_events (
  id          text PRIMARY KEY,
  actor_id    text REFERENCES users(id) ON DELETE SET NULL,
  actor_label text NOT NULL,
  action      text NOT NULL,
  entity_type text NOT NULL,
  entity_id   text NOT NULL,
  detail      jsonb,
  ip          text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_entity_idx ON audit_events (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_created_idx ON audit_events (created_at);

CREATE TABLE IF NOT EXISTS app_settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
