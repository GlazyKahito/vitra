# VITRA database

Research prototype. Not a medical device. Not clinically validated.

## Engine

- **Default:** embedded [PGlite](https://pglite.dev) (PostgreSQL compiled to WASM) persisted under
  `apps/web/.data/pglite` (`PGLITE_DIR`). Zero setup; single process.
- **Optional:** real PostgreSQL 15+ via `DATABASE_URL` (node-postgres pool). Same SQL, same migrations.

`lib/db.ts` → `getDb()` returns one shared Drizzle instance. All queries live in `lib/data/*.ts`
(server-only); pages, server actions and route handlers call those modules and never touch Drizzle directly.

## Migrations

Hand-written SQL in `apps/web/db/migrations/NNNN_*.sql`, applied in filename order by `db/migrate.ts`
(`npm run db:migrate`). Applied files are tracked in `_migrations(name, applied_at)`.
`npm run db:reset` deletes the PGlite directory (or drops all VITRA tables on Postgres), re-applies
migrations and re-seeds. `db/schema.ts` is the typed mirror of the SQL; keep both in sync.

Enum-like text columns carry `CHECK` constraints (run status, result state, device kind, model type…),
and two business rules are enforced in the database as well as in code:

- `calibration_models`: `status = 'validated'` requires non-null `validation_evidence` and
  `trained_on_synthetic = false`.
- `analyte_results`: a numeric `value` is only allowed for states `measured`, `experimental`, `synthetic`.

## Entities

| Table | Purpose |
| --- | --- |
| `roles`, `permissions`, `role_permissions` | RBAC. Roles: admin, clinician, operator, researcher, viewer. Permission matrix in `lib/auth/permissions.ts` (seed mirrors it). |
| `users`, `sessions` | Local accounts (scrypt hashes) and cookie sessions (`id` = peppered SHA-256 of the cookie token, 7-day expiry). |
| `strip_products`, `strip_batches` | Reagent strip product (pad map left→right, reaction time, fixed-geometry baseline) and lots. |
| `analyte_definitions` | The ten KJS-HC-03 analytes with units, typical chart blocks and plotting spans (from `lib/analytes.ts`). Not reference intervals. |
| `devices`, `device_events` | Capture devices (`simulated` or `raspberry_pi`), their API-key hash, last-seen and status, plus event log. |
| `samples` | Pseudonymous samples (`sample_code`, optional `subject_pseudonym` for trends). Never names/MRNs. `synthetic` flag. |
| `images` | Stored originals (`storage_path` relative to `STORAGE_DIR`), overlay and rectified strip crops, sha256, idempotency key for device ingestion. |
| `analysis_runs` | One pipeline execution: status, mode (`research`/`demo`), image source, quality checks, strip geometry, 30-D feature vectors, timings, warnings, `synthetic`. |
| `pad_segmentations`, `colour_features` | Per-pad ROI, source (detected/fixed), quality status + metrics + flags; sRGB/CIELAB/HSV statistics. |
| `analyte_results` | One row per analyte per run: result state (see `lib/inference/policy.ts`), value/unit, 95 % interval, model used, reason. |
| `reference_measurements` | Reference values for samples (lab analyser, manual chart, or synthetic). |
| `calibration_datasets` | Imported CSVs (stored under `STORAGE_DIR/datasets`), validation report, `synthetic` flag. |
| `calibration_models`, `model_evaluations` | Trained models (id = CV service `model_id`), status lifecycle draft → trained → validated / retired, train/test/cv5 metrics and prediction points. |
| `clinical_reviews` | Review decisions (accepted / rejected / needs_repeat / note) with reviewer label. |
| `reports` | Generated PDF/JSON files (`STORAGE_DIR/reports`), size, sha256. |
| `audit_events` | Append-only trail: actor, action (`run.create`, `review.accepted`, `report.download`, `model.validate`…), entity, detail, IP. |
| `app_settings` | Key/value JSON settings (`lib/data/settings.ts` defines the typed shape and defaults). |

### Run status lifecycle

`queued` → `processing` → one of `invalid_image` | `calibration_required` | `pending_review` | `failed`
→ (review) `reviewed` | `rejected`.

### Result states

`measured`, `experimental`, `synthetic`, `out_of_range`, `indeterminate`, `invalid_image`, `unavailable`,
`calibration_required`. The mapping is the pure function `decideResult()`; `measured` is only reachable
through a model an administrator marked `validated` with written evidence. No seeded model has that status.

## Seed data (`npm run db:seed`)

Deterministic (seeded PRNG) and idempotent: rows with ids prefixed `seed-` are replaced on every run.
Everything generated is `synthetic = true`:

- 4 users (`admin@vitra.local`, `clinician@`, `operator@`, `researcher@`; passwords from `SEED_*_PASSWORD`).
- 2 strip products: a **placeholder** Paramcare 10-parameter record (pad order must be confirmed against
  the product insert) and the synthetic reference strip `SYN-10P`; 3 batches.
- Devices `SIM-01` (simulated, with a documented dev key) and `VITRA-PI-01` (Raspberry Pi, offline, never seen); ~40 simulated events.
- 18 samples `SYN-0001…SYN-0018` across pseudonymous subjects (several with 3–4+ runs for trends), 36 runs
  over the last 30 days: 4 `invalid_image`, 6 research-mode `calibration_required`, 2 `rejected`, the rest
  demo-mode `pending_review` / `reviewed` with per-pad features derived from the demo colour ramps and
  `synthetic` analyte values for glucose / protein / pH.
- One synthetic calibration dataset (240 rows, `STORAGE_DIR/datasets/synthetic_calibration_v1.csv`) and
  three synthetic-trained models (`glucose-poly2-v1`, `protein-poly2-v1`, `ph-poly2-v1`) whose evaluation
  points are seeded fixtures (`training_meta.fixture = true`), not CV-service output. Train from the dataset
  on the Calibration screen to replace them with real service-trained models.
- Clinical reviews, ~90 audit events, settings defaults.

Seeded image rows reference placeholder paths; the files are not rendered by the seed.

## Storage

Files never go in the database. `STORAGE_DIR` (default `apps/web/storage`) holds
`images/`, `overlays/`, `strips/`, `datasets/`, `reports/`. Paths stored in rows are relative; `lib/storage.ts`
refuses traversal. Files are served only to authenticated users via `/api/files/[...path]` (images, overlays,
strips, datasets) and `/api/reports/[id]` (reports, audited on download).
