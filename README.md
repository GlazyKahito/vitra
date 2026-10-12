# VITRA

Computer-vision platform for **KJS-HC-03 — Urine Test Strip Reader using Colorimetry as a Point-of-Care Technology** (K J Somaiya School of Engineering).

A Raspberry Pi 5 + camera in a light-controlled enclosure photographs a 10-pad reagent strip after the 120 s reaction; OpenCV isolates the pads and extracts colour features; a calibrated regression maps them to per-analyte estimates; a clinician reviews the structured report.

> Research prototype. Not a medical device. Not clinically validated. All bundled data and models are **SYNTHETIC**.

## Layout

```
apps/web/      Next.js 15 (App Router, React 19, Tailwind v4) — landing, console, analysis, review, reports, calibration, model lab
services/cv/   Python CV + calibration service (Starlette, OpenCV, scikit-learn)
docs/          CV service contract, device API, database, security
```

## Run locally

```bash
# CV service
cd services/cv
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python run.py                         # http://127.0.0.1:8001/health

# Web
cd apps/web
npm install
cp .env.example .env.local            # fill in secrets
npm run db:migrate && npm run db:seed
npm run dev                           # http://localhost:3000
```

## Deployment

Vercel project root is `apps/web`; pushes to `main` deploy automatically. The app screens need a hosted PostgreSQL (`DATABASE_URL`) and the CV service hosted separately (`CV_SERVICE_URL`). See [FIXES.md](FIXES.md) for details.
