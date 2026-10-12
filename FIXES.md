# VITRA — Build fixes (12 Oct 2026)

Environment: `npm install` + `tsc --noEmit` + `next build` were run for the first time.

## Result
- `npm install` — OK (477 packages)
- `tsc --noEmit` — **309 errors → 0**
- `next build` — compiles, lints and generates all routes (verified with Google Fonts stubbed, because the sandbox could not reach fonts.googleapis.com; Vercel can, so the real `next/font/google` imports are unchanged)

## Changes

| # | File | Problem | Fix |
|---|------|---------|-----|
| 1 | `apps/web/tsconfig.json` | `include: **/*.ts` pulled in the offline stub types in `types-offline/` (react, next, three, motion), which shadowed the real packages and caused hundreds of bogus errors (JSX intrinsic elements, event handler types, `next/font`, `Clock.elapsedTime`, etc.) | Added `types-offline` to `exclude` |
| 2 | `apps/web/app/actions/calibration.ts` (~L50) | TS5076: `??` mixed with `\|\|` without parentheses (compile error) | `first?.message ?? (validation.missing_required.join(", ") \|\| "validation failed")` |
| 3 | `apps/web/lib/cv/client.ts` | `DEFAULT_TIMEOUTS` is `as const`, so parameter defaults were inferred as literal types (e.g. `3000`), rejecting `cvHealth(2500)` in `app/api/health/route.ts` | Typed every `timeoutMs` parameter as `number` |
| 4 | `apps/web/components/ui/panel.tsx` | `PanelProps extends HTMLAttributes` but redefines `title` as `ReactNode` (TS2430) | `extends Omit<HTMLAttributes<HTMLElement>, "title">` |
| 5 | `apps/web/app/api/cv/synthetic-strip/route.ts` | `Uint8Array` not assignable to `BodyInit` under newer TS lib types | Wrapped as `new Uint8Array(png).buffer as ArrayBuffer` |
| 6 | `/.gitignore` (new) | No ignore file | Ignores `node_modules`, `.next`, `.vercel`, `.data`, `storage`, `.env*` (keeps `.env.example`), Python caches |

## Not changed (known, still open)
- Server-action form fields (`trainModelAction` version/padIndex, sample notes), the `listReports` user join and CV model bootstrap are not yet addressed.
- Three ESLint warnings about unused `eslint-disable` directives (non-blocking).

## Deploying to Vercel — what to expect
- Set **Root Directory** to `apps/web`.
- `/` and `/methodology` are static and work as-is.
- App screens (console, analysis, review, history, …) need a hosted PostgreSQL via `DATABASE_URL` (the embedded PGlite writes to `.data/`, which is read-only on Vercel), plus `SESSION_SECRET`, `CV_SERVICE_TOKEN`, `DEVICE_INGEST_SECRET`. Run `npm run db:migrate && npm run db:seed` against that database once.
- The Python CV service (`services/cv`) cannot run on Vercel; host it elsewhere and set `CV_SERVICE_URL`. Until then analysis shows "unavailable".
