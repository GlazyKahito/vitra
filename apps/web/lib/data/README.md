# lib/data — query modules

All database access for the web app goes through these server-only modules. Names and shapes are fixed
by `contract.ts`; screens import from here, never from Drizzle directly.

| Module | Exports |
| --- | --- |
| `runs.ts` | `listRuns`, `getRun`, `getRunByCode`, `getConsoleStats`, `getRecentActivity`, `nextRunCode`, `loadRunAttachments`, `summariseResults`, `analyteLabel`, `RUN_STATUSES` |
| `samples.ts` | `listSamples`, `getSample`, `getSampleByCode`, `createSample`, `createSampleFromDevice`, `nextSampleCode` |
| `strips.ts` | `listStripProducts`, `getStripProduct`, `updateStripProduct`, `getBatch` |
| `devices.ts` | `listDevices`, `getDevice`, `getDeviceByName`, `recordDeviceEvent`, `simulateDeviceTick`, `rotateDeviceKey`, `isCaptureEvent` |
| `calibration.ts` | `listDatasets`, `getDataset`, `createDataset`, `listModels`, `getModel`, `createModel`, `setModelStatus`, `getCalibrationStatus`, `findActiveModel`, `listReferenceMeasurements` |
| `reviews.ts` | `listReviewQueue`, `submitReview`, `criticalFlagsFor`, `countResultsByState` |
| `reports.ts` | `listReports`, `generateReport`, `getReportFile` |
| `audit.ts` | `recordAudit`, `listAudit` |
| `settings.ts` | `getSettings`, `updateSettings`, `SETTINGS_DEFAULTS` |

Conventions

- `import "server-only"` at the top of every module; never import these from client components or from
  `db/seed.ts` (tsx cannot load `server-only`).
- Explicit `select`/joins, no relational query API, so the modules work identically on PGlite and Postgres.
- Every mutation records an audit event through `recordAudit`. Actor is `SafeUser | null` (null = system/device).
- Console statistics are computed from stored rows only — nothing is randomised or estimated.
- `findActiveModel(analyte, product, mode)`: research mode only returns models trained on real reference
  data; demo mode also allows synthetic-trained models. Validated models win, then newest trained.
- `simulateDeviceTick` writes an event prefixed `[SIMULATED]` with `payload.simulated = true` and keeps the
  device status `simulated`.
- IDs come from `lib/ids.ts` (`newId(prefix)`, time-sortable); seeded rows use the `seed-` prefix so the
  seed can replace them idempotently.
