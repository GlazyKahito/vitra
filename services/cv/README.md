# VITRA CV service

Python image-processing + calibration service for VITRA. Implements
`docs/cv-service-contract.md` (v1) with **Starlette** (not FastAPI — see
`docs/BUILD-CONTEXT.md`), OpenCV, scikit-learn and pydantic v2.

Research prototype. Not a medical device. Not clinically validated.
Every fixture and dataset in `fixtures/` is SYNTHETIC.

## Run

```bash
cd services/cv
cp .env.example .env            # optional; variables are read from the environment
python run.py                   # http://127.0.0.1:8001
curl -s http://127.0.0.1:8001/health
```

With a token:

```bash
CV_SERVICE_TOKEN=secret python run.py
curl -s -H 'X-Vitra-Service-Token: secret' -F file=@fixtures/synthetic_strip_01.png \
     -F 'config={"handle_side":"auto"}' http://127.0.0.1:8001/v1/analyze | head -c 600
```

Local install (registries blocked in the build sandbox; the deps are already
present there): `pip install -r requirements.txt`.

## Environment variables

| var | default | purpose |
|---|---|---|
| `CV_SERVICE_TOKEN` | unset | if set, required in `X-Vitra-Service-Token` on all routes except `/health` |
| `MODEL_STORE_DIR` | `./models` | persisted calibration models (`<model_id>.joblib` + `.json` sidecar) |
| `CV_HOST` / `CV_PORT` | `127.0.0.1` / `8001` | bind address for `run.py` |
| `CV_LOG_LEVEL` | `info` | uvicorn log level |

## Endpoints

`GET /health`, `POST /v1/analyze` (multipart `file` + optional `config` JSON),
`POST /v1/calibration/validate`, `POST /v1/calibration/train`, `POST /v1/infer`,
`POST /v1/synthetic/strip` (returns `image/png`, header `X-Vitra-Synthetic: true`).
Errors: `{"error": {"code", "message"}}` with the contract's codes.

## Pipeline (`vitra_cv/`)

1. `quality.py` — format sniff, resolution (long side ≥ `min_width`, short side ≥ `min_height`),
   blur (contrast-normalised variance of Laplacian on the strip crop), over/under-exposure,
   strip visibility, orientation (tilt > 25° warns; vertical strips are rectified by 90°),
   obstruction (large dark blobs inside the strip), pads visible. `passed` = no `fail`.
2. `localize.py` — Otsu threshold in both polarities, most strip-like (elongated, rectangular)
   contour, `minAreaRect` → perspective warp to a horizontal strip, handle side from the longest
   pad-free run (or `handle_side` override), flipped so pads run left→right after the handle.
3. `segment.py` — 1-D LAB-distance saliency along the long axis, runs → equally-spaced grid fit;
   slots with a detected run are `roi_source: "detected"`, slots without one (e.g. a pad whose
   colour matches the plastic) are placed from the fitted grid and marked `"fixed"`. If fewer
   than half the pads are matched (or `geometry.mode == "fixed"`), fixed geometry is used
   (`pad_centers` or even spacing over the non-handle region). ROIs are inset by `roi_inset`.
4. `features.py` — per-ROI RGB/LAB/HSV statistics, pad quality flags, `rgb_30` / `lab_30`.
5. `overlay.py` — cyan (95,212,230) strip polygon + pad boxes + ids on the original; rectified crop.

## Calibration (`vitra_cv/calibration.py`)

`validate_dataset`, `train` (sklearn Pipelines: `linear`, `poly2_ridge`, `poly3_ridge`, `knn`,
`rf`; group-aware split by `sample_id` honouring a `split` column; 5-fold `GroupKFold` CV;
residual quantiles from the held-out test set), `infer` (empirical `interval_95` from the
residual quantiles). Models trained on `synthetic=true` rows report `synthetic_training_data: true`.

## Fixtures

```bash
python tools/make_fixtures.py     # regenerates fixtures/ (ALL SYNTHETIC)
```

## Tests

```bash
python -m unittest discover -s tests -v
```
