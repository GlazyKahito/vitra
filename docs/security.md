# VITRA security & data-protection posture

Research prototype. Not a medical device. Not clinically validated. **This document makes no compliance
claims.** It records what the code does today, what it does not do, and which frameworks a real deployment
would need to be assessed against.

## Implemented in code

| Area | What is in place |
| --- | --- |
| Authentication | Local accounts only. Passwords hashed with scrypt (N=16384, r=8, p=1, 16-byte salt, 64-byte key), NFKC-normalised, verified with `timingSafeEqual`. Login failures are audited; a dummy verify runs for unknown emails to flatten timing. |
| Sessions | Random 256-bit token in an `httpOnly`, `SameSite=Lax`, `Secure` (production) cookie `vitra_session`; only a SHA-256 of the token peppered with `SESSION_SECRET` is stored; 7-day expiry; logout deletes the row. |
| Authorisation | Role → permission matrix (`lib/auth/permissions.ts`), enforced server-side in every server action and route handler through `requireUser(permission)`. Model validation needs `models.validate` (admin only) **and** written evidence; synthetic-trained models can never be validated (also enforced by a DB `CHECK`). |
| Device ingestion | Per-device API key (shown once, stored as scrypt hash), device-scoped idempotency keys, strict content-type/size/magic-byte checks, unauthorised attempts audited. |
| File handling | Images limited to 15 MB and JPEG/PNG/WebP by magic bytes; storage paths are relative and traversal-checked (`safeJoin`); files served only to authenticated users; reports only via an audited endpoint with `Content-Disposition: attachment`; `nosniff` on all responses. |
| Audit trail | Append-only `audit_events` for logins, run creation/completion, reviews, report generation/download, dataset import, model training/status changes, settings and device-key changes. |
| Pseudonymisation | Samples carry `sample_code` and an optional `subject_pseudonym`; the schema has no fields for names, MRNs, dates of birth or contact data, and the sample form rejects whitespace in pseudonyms to discourage names. |
| Honesty controls | Every synthetic row is flagged `synthetic`; result states are decided by one pure policy function; numeric values are only storable for `measured` / `experimental` / `synthetic` states (DB `CHECK`); reports carry the research-prototype and synthetic banners. |
| HTTP hardening | `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, restricted `Permissions-Policy` (camera self-only) from `next.config.ts`; no `X-Powered-By`. |
| CV service | Server-to-server only, optional shared token `X-Vitra-Service-Token`, bounded timeouts, typed error mapping; the browser never reaches the service. |

## Not implemented (deployment-level or future work)

- **Encryption at rest** — not done in the application. PGlite data files and `STORAGE_DIR` are plain files;
  use full-disk / volume encryption (LUKS, cloud-managed disk encryption) and encrypted backups at the
  deployment layer. PostgreSQL TDE / pgcrypto are deployment choices.
- **TLS** — terminate at a reverse proxy; the Next.js server itself is HTTP.
- **Secrets management** — `.env` only; no vault integration. Rotate `SESSION_SECRET`, `CV_SERVICE_TOKEN`,
  `DEVICE_INGEST_SECRET` and the seeded passwords/device key before any shared deployment.
- **Rate limiting / brute-force lockout** — none beyond audit logging.
- **MFA, SSO, password policy, account recovery** — none.
- **CSRF** — relies on Next.js server-action origin checks and `SameSite=Lax`; no separate token for route handlers.
- **Virus scanning of uploads, image EXIF stripping** — not done (EXIF is not read, but is stored in the original file).
- **Backups, retention, deletion workflows** — none; no right-to-erasure tooling.
- **Formal threat model, penetration test, dependency audit in CI** — not performed.
- **Clinical data** — the prototype has only ever held synthetic data. Nothing here has been assessed for real patient data.

## Regulatory context (India) — for awareness, not compliance

- **Digital Personal Data Protection Act, 2023 (DPDP)** — if real samples were ever linked to identifiable
  persons, the operator would be a Data Fiduciary: lawful purpose, notice and consent, purpose limitation,
  security safeguards, breach notification to the Data Protection Board, and erasure obligations would apply.
  The pseudonymisation here reduces but does not remove that scope (pseudonymised data remains personal data
  if re-identification is possible via the key held elsewhere).
- **Medical Devices Rules, 2017 (CDSCO)** — software intended for diagnosis is a medical device; urine
  reagent-strip readers are in-vitro diagnostic (IVD) devices under the Rules. VITRA is **not** registered,
  classified, or licensed under MDR 2017 and must not be used for any diagnostic purpose. Any move towards
  clinical use would require risk classification, a quality management system (ISO 13485), design controls,
  analytical and clinical performance evaluation, and CDSCO licensing.
- **Ethics committee** — any study involving human samples, even pseudonymised, needs prior approval from an
  institutional ethics committee (ICMR National Ethical Guidelines, 2017; New Drugs and Clinical Trials
  Rules, 2019 for registered ECs), informed consent, and a data-handling protocol. No such approval exists for
  this prototype; all data is synthetic.
- **Standards that would be relevant later** — ISO 14971 (risk management), IEC 62304 (software lifecycle),
  IEC 62366 (usability), ISO 15189 (medical laboratories), ISO 27001 (ISMS).

## Operational recommendations before any multi-user deployment

1. Replace all seeded credentials and the `SIM-01` development key; set strong `SESSION_SECRET` and `CV_SERVICE_TOKEN`.
2. Put the app behind TLS and an authenticating reverse proxy with rate limiting.
3. Use PostgreSQL with encrypted volumes and tested backups instead of PGlite.
4. Keep `requireReviewForReports` enabled in settings and restrict `reports.generate` to clinicians/admins.
5. Keep the research-prototype footer and banners; do not remove synthetic labelling.
