# VITRA web tests

Research prototype. Not a medical device. Every fixture the tests use is SYNTHETIC.

## Unit tests (vitest): `tests/unit/*.test.ts`

```bash
npm test            # = npx vitest run
```

| File | Covers |
| --- | --- |
| `policy.test.ts` | `lib/inference/policy.ts`: result-state decisions (synthetic models only in demo mode, invalid image, failed pads, out of range, unavailable…). |
| `permissions.test.ts` | Role → permission matrix (`lib/auth/permissions.ts`). |
| `password.test.ts` | scrypt hashing and verification (`lib/auth/password.ts`). |
| `image-validate.test.ts` | Upload validation: magic bytes, declared type, size limit. |
| `db-config.test.ts` | PostgreSQL TLS resolution (`DATABASE_SSL` / `PGSSLMODE` / `sslmode`), the temporary Vercel demo-mode switch, the storage defaults, and the bundled fixture-image mapping. |

No database or services are needed. Last local run: 5 files, 42 tests, all passing.

## End-to-end (Playwright): `tests/e2e/*.spec.ts`

Prerequisites:

1. A migrated and seeded web app: `npm run db:migrate && npm run db:seed`.
2. A running web app. `playwright.config.ts` starts `npm run dev` itself unless `E2E_BASE_URL` is set; with a dev server already running, set `E2E_BASE_URL=http://localhost:3000`.
3. The CV service on :8001 (`cd services/cv && python run.py`). Only `analysis.spec.ts` needs it.
4. Playwright's Chromium: `npx playwright install chromium`.

```bash
npx playwright test                                         # whole suite
E2E_BASE_URL=http://localhost:3000 npx playwright test tests/e2e/smoke.spec.ts
```

| Spec | Covers | CV service |
| --- | --- | --- |
| `smoke.spec.ts` | Every primary route renders without an error page: `/`, `/methodology` and `/login`; then, signed in as admin, `/console`, `/analysis/new`, the seeded run `R-000001`, `/history`, `/samples`, `/review`, `/reports`, `/calibration`, `/model-lab`, `/devices` and `/settings`. | not needed |
| `public.spec.ts` | Landing hero and CTAs, methodology. | not needed |
| `auth-and-nav.spec.ts` | Wrong password rejected, admin lands on the console, protected routes redirect to `/login?next=…`, every nav route renders. | optional |
| `analysis.spec.ts` | Full flow: synthetic demo strip → run → result rows → history CSV → review note → PDF report. | **required** |

`_helpers.ts` holds the seeded accounts (`SEED_*_PASSWORD` env vars override the defaults), the `login()` helper and the honesty-footer matcher.

The dev server compiles each route on first visit, so the first smoke run can take several minutes. `smoke.spec.ts` allows up to 240 s for the signed-in pass. Last local run against `next dev`: 4/4 passing in 3.4 min.

## Python CV service

```bash
cd ../../services/cv
pip install -r requirements-dev.txt     # adds the HTTP client starlette's TestClient needs
python -m unittest discover -s tests    # 24 tests
```
