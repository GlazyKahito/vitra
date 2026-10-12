# VITRA architecture

Research prototype. Not a medical device. Not clinically validated. All bundled data and models are SYNTHETIC.

## System overview

```
 Raspberry Pi enclosure / simulated device          Browser (desktop, ≥1280 px)
          │  POST /api/ingest (device key)                   │  server actions + pages (session cookie)
          ▼                                                  ▼
 ┌──────────────────────────── apps/web (Next.js 15) ────────────────────────────┐
 │ middleware.ts → x-vitra-path                                                    │
 │ app/(app)/* screens ─ app/actions/* (zod) ─ app/api/* route handlers            │
 │        │                    │                        │                          │
 │        ▼                    ▼                        ▼                          │
 │ lib/auth (scrypt, sessions, RBAC)   lib/analysis/run-analysis.ts   lib/reports  │
 │        │                    │            │                 │                     │
 │        ▼                    ▼            ▼                 ▼                     │
 │ lib/data/* (all SQL via Drizzle)   lib/cv/client.ts   lib/inference/policy.ts   │
 │        │                                 │                                       │
 │        ▼                                 │ HTTP JSON / multipart                 │
 │ lib/db.ts: PostgreSQL (DATABASE_URL)     │ X-Vitra-Service-Token                 │
 │            or PGlite (local / demo)      │                                       │
 │ lib/storage.ts: STORAGE_DIR files        │                                       │
 └──────────────────────────────────────────┼───────────────────────────────────────┘
                                            ▼
                       services/cv (Starlette + OpenCV + scikit-learn)
                       quality → localize → segment → features → overlay
                       calibration: validate / train / infer, MODEL_STORE_DIR/*.joblib
```

The web app owns all state: database rows, stored files, audit trail. The CV service is stateless apart from its model store. The browser and the devices never call the CV service directly. The HTTP contract is in [cv-service-contract.md](cv-service-contract.md).

## Web app (`apps/web`)

| Layer | Where | Notes |
| --- | --- | --- |
| Pages | `app/page.tsx` (landing), `app/methodology`, `app/login`, `app/(app)/*` | `(app)/layout.tsx` guards the session and provides the ephemeral-demo flag. Each page renders `<AppShell>` itself. |
| Server actions | `app/actions/*.ts` | zod-validated; return `{ ok: true, … }` or `{ ok: false, error }`; permission-checked with `requireUser(permission)`. |
| Route handlers | `app/api/{health,ingest,files/[...path],reports/[id],runs/[id],cv/synthetic-strip}` | Device ingestion, protected file serving, report download, health. |
| Data access | `lib/data/*.ts` (`server-only`) | The only code that queries the DB. The binding API is in `lib/data/contract.ts`. |
| Auth | `lib/auth/*` | scrypt hashes; sessions table keyed by a peppered SHA-256 of the cookie token; 5 roles × 12 permissions (`lib/auth/permissions.ts`). |
| Analysis | `lib/analysis/run-analysis.ts` | Synchronous orchestration (see below). |
| Policy | `lib/inference/policy.ts` | Decides each analyte's result state; unit-tested. |
| Reports | `lib/reports/{pdf,json}.ts` | pdf-lib PDF and JSON, stored under `STORAGE_DIR/reports`, SHA-256 recorded. |
| Storage | `lib/storage.ts` | Path-traversal-safe file store rooted at `STORAGE_DIR`. |
| Runtime mode | `lib/runtime-mode.ts` | Detects the temporary Vercel demo fallback and picks `/tmp` paths. |

### Analysis flow (`startAnalysis`)

1. Validate the image: magic bytes and size, at most 15 MB. Store it under `images/`.
2. Call the CV service `/v1/analyze` with the strip product's pad map and geometry. The service returns:
   - quality checks
   - strip geometry
   - per-pad ROI, quality and colour features
   - the `rgb_30` / `lab_30` vectors
   - an overlay and a strip crop
3. Persist `pad_segmentations`, `colour_features` and the run's quality, geometry and feature vectors.
4. Handle each analyte:
   1. `findActiveModel(analyte, product, mode)` picks the model.
   2. `/v1/infer` runs it.
   3. `decideResult()` maps the image/pad quality, the model status (synthetic, trained, validated) and the prediction to a state:
      - `measured`
      - `experimental`
      - `synthetic`
      - `out_of_range`
      - `indeterminate`
      - `invalid_image`
      - `unavailable`
      - `calibration_required`
   4. Persist the result in `analyte_results`.
5. Set the run status and write audit events.
   - If the CV service is unreachable, the run is stored as `failed` and every analyte as `unavailable`. Nothing is inferred.

Synthetic-trained models produce values only in **demo** mode, labelled `synthetic`. In research mode they yield `calibration_required`. A model can be marked `validated` only by an admin with written evidence. A database `CHECK` forbids validating a synthetic-trained model.

### Database

PostgreSQL 15+ is the primary engine (`DATABASE_URL`, node-postgres). Embedded PGlite is used for local development and for the temporary Vercel demo fallback. There are 23 tables, created by the hand-written SQL in `db/migrations/` and mirrored in `db/schema.ts`. Details: [database.md](database.md).

`getDb()` (`lib/db.ts`) memoises one Drizzle instance per process. When there is no `DATABASE_URL` and the app runs on Vercel, it works like this:
1. The first call opens PGlite in `/tmp/vitra-pglite`.
2. It applies pending migrations.
3. It runs `db/seed.ts` if that directory has never been seeded.

The promise is shared, so concurrent first requests wait on a single bootstrap. A failed bootstrap is not cached.

### Seed and fixtures

`db/seed.ts` is deterministic: it uses a seeded PRNG. It is also idempotent: it removes and recreates `seed-*` rows. It creates:
- 4 users, 2 strip products, 3 batches, 2 devices (one simulated)
- 18 synthetic samples and 36 runs with results, reviews and an audit trail
- a 240-row synthetic calibration CSV
- 3 synthetic fixture models

Six SYNTHETIC strip renders are vendored in `db/fixtures/strips/`; they are copies of `services/cv/fixtures`. The seed copies them into storage and points seeded image rows at them.

`scripts/bootstrap-models.ts` (`npm run models:bootstrap`) trains the 3 seeded model ids inside the CV service from the seeded CSV. It then replaces the fixture evaluation rows with the service's real metrics on that synthetic data.

## CV service (`services/cv`)

| Module | Role |
| --- | --- |
| `quality.py` | 9 whole-image checks: format, resolution, blur, over/underexposure, strip visible, orientation, obstruction, pads visible. |
| `localize.py` | Otsu threshold on both polarities, `minAreaRect`, perspective warp, handle-side detection and flip. |
| `segment.py` | LAB saliency profile and grid fitting to find pads; fixed-geometry fallback. |
| `features.py` | Per-pad RGB / CIELAB / HSV statistics; `rgb_30`, `lab_30`. |
| `overlay.py` | Annotated overlay PNG. |
| `calibration.py` | Dataset validation; linear, poly2/poly3 ridge, kNN and RF models; group-aware split; `GroupKFold` CV; empirical 95 % interval from held-out residual quantiles; joblib model store. |
| `synthetic.py` | Synthetic strip renderer and dataset generator (demo/testing only). |
| `app.py` | Starlette app; optional `X-Vitra-Service-Token` check. |

## Deployment shapes

| Shape | Database | Files | CV service |
| --- | --- | --- | --- |
| Local dev | PGlite `apps/web/.data/pglite` | `apps/web/storage` | `python run.py` on :8001 |
| Production / shared | **PostgreSQL 15+** via `DATABASE_URL` (e.g. Neon, Vercel Postgres, `sslmode=require`) | `STORAGE_DIR` (default `/tmp/vitra-storage` on Vercel: writable, not durable; seeded fixture images fall back to the bundled `db/fixtures/strips`). Durable object storage is not implemented. | Hosted separately; `CV_SERVICE_URL` + `CV_SERVICE_TOKEN` |
| Vercel without DB (temporary demo) | PGlite `/tmp/vitra-pglite`, auto-migrated and seeded per cold instance | `/tmp/vitra-storage` | Usually none → analysis `unavailable` |
