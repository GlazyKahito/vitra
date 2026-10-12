# VITRA — Build fixes (12 Oct 2026)

Environment: `npm install` + `tsc --noEmit` + `next build` were run for the first time.

## Result
- `npm install` — OK (477 packages)
- `tsc --noEmit` — **309 errors → 0**
- `next build` — compiles, lints and generates all routes (verified with Google Fonts stubbed, because the sandbox could not reach fonts.googleapis.com; Vercel can, so the real `next/font/google` imports are unchanged)

## Changes

| # | File | Problem | Fix |
|---|------|---------|-----|
| 1 | `apps/web/tsconfig.json` | `include: **/*.ts` pulled in the offline stub types in `types-offline/` (react, next, three, motion), which shadowed the real packages and caused hundreds of bogus errors (JSX intrinsic elements, event handler types, `next/font`, `Clock.elapsedTime`, etc.) | Added `types-offline` to `exclude` (the stubs were later deleted once real packages were installed) |
| 2 | `apps/web/app/actions/calibration.ts` (~L50) | TS5076: `??` mixed with `\|\|` without parentheses (compile error) | `first?.message ?? (validation.missing_required.join(", ") \|\| "validation failed")` |
| 3 | `apps/web/lib/cv/client.ts` | `DEFAULT_TIMEOUTS` is `as const`, so parameter defaults were inferred as literal types (e.g. `3000`), rejecting `cvHealth(2500)` in `app/api/health/route.ts` | Typed every `timeoutMs` parameter as `number` |
| 4 | `apps/web/components/ui/panel.tsx` | `PanelProps extends HTMLAttributes` but redefines `title` as `ReactNode` (TS2430) | `extends Omit<HTMLAttributes<HTMLElement>, "title">` |
| 5 | `apps/web/app/api/cv/synthetic-strip/route.ts` | `Uint8Array` not assignable to `BodyInit` under newer TS lib types | Wrapped as `new Uint8Array(png).buffer as ArrayBuffer` |
| 6 | `/.gitignore` (new) | No ignore file | Ignores `node_modules`, `.next`, `.vercel`, `.data`, `storage`, `.env*` (keeps `.env.example`), Python caches |

## Data / backend pass (12 Oct 2026, later)

| Area | Change |
|---|---|
| `npm run db:migrate` ENOENT on `.data/pglite` | PGlite's Node FS adapter only does a non-recursive `mkdirSync(dataDir)`. `lib/db.ts` now creates the directory recursively first. |
| Migration "cannot insert multiple commands into a prepared statement" | `execRaw` runs multi-statement SQL through `PGlite.exec()`; node-postgres keeps the simple protocol. |
| Seed FK violation (pad rows before run row) | `db/seed.ts` inserts the run row first, then batch-inserts pads, features and results. |
| CLI scripts ignored `.env.local` | `db/load-env.ts` (`@next/env`) is loaded first by migrate, seed and bootstrap. |
| PostgreSQL TLS | `resolvePgSsl()`: `DATABASE_SSL` > `PGSSLMODE` > URL `sslmode`/`ssl`; certificates verified by default. |
| HANDOFF §6.2 | `trainModelAction` honours `version` (validated, clash-checked) and `padIndex`; auto versions pick the next free `-vN`. |
| HANDOFF §6.3 | `updateStripProductAction` and the pad-map editor gate use `calibration.manage`. |
| HANDOFF §6.4 | New-sample `notes` are stored in `samples.metadata.notes`. |
| HANDOFF §6.5 | `listReports` left-joins `users.displayName` as `generatedByLabel`. |
| HANDOFF §6.7 | `docs/device-api.md`: `X-Device-Id` is `devices.name`, not the row id. |
| HANDOFF §6.8 | `npm run models:bootstrap` trains the seeded model ids in the CV service and stores the real (synthetic-data) metrics. It skips cleanly when the service is down. |
| HANDOFF §6.9 | Six SYNTHETIC fixture PNGs are vendored in `apps/web/db/fixtures/strips`. The seed copies them to storage and seeded runs reference them. Overlay and crop stay empty, and each run's warnings say so. |
| HANDOFF §6.10 | `middleware.ts` sets `x-vitra-path` (path + query) for `requireUser`'s `next=`. |
| Vercel without `DATABASE_URL` | Temporary demo fallback: PGlite in `/tmp/vitra-pglite`, migrated and seeded on the first `getDb()` per cold instance, with an amber "Ephemeral demo instance · data resets" notice. `outputFileTracingIncludes` bundles the PGlite WASM, migrations and fixtures. Hosted PostgreSQL remains the real path. |

## Still open
- `next build` and a real Vercel deploy were not run in this pass, so the file-tracing includes are untested on Vercel.
- No durable object storage: on Vercel, `STORAGE_DIR` is `/tmp`.
- The Python CV service still needs separate hosting.
