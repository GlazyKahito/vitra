# VITRA CV Service — HTTP Contract (v1)

The Python service (`services/cv`, FastAPI) owns image processing, feature
extraction and calibration-model training/inference. The Next.js app
(`apps/web`) owns persistence, auth, review workflow and reports. The web app
talks to this service **server-side only** via `CV_SERVICE_URL`
(default `http://127.0.0.1:8001`). All JSON is snake_case.

Every request may carry `X-Vitra-Service-Token: <CV_SERVICE_TOKEN>`; when the
env var `CV_SERVICE_TOKEN` is set on the service, requests without a matching
token get `401`.

## Errors

Non-2xx responses: `{"error": {"code": "<machine_code>", "message": "<human>"}}`.
Codes: `unsupported_format`, `decode_failed`, `file_too_large`,
`invalid_config`, `invalid_dataset`, `insufficient_data`, `model_not_found`,
`feature_mismatch`, `unauthorized`.

## GET /health

```json
{ "status": "ok", "service": "vitra-cv", "version": "0.1.0",
  "pipeline_version": "vitra-cv/0.1.0", "opencv_version": "4.x",
  "models_loaded": 3 }
```

## POST /v1/analyze  (multipart/form-data)

Fields:
- `file` — JPEG / PNG / WebP / BMP / TIFF, ≤ 15 MB.
- `config` — optional JSON string:

```json
{
  "pad_count": 10,
  "pad_map": ["glucose","protein","ph","ketones","blood","bilirubin",
              "urobilinogen","nitrite","leucocytes","specific_gravity"],
  "geometry": {
    "mode": "auto",                    // "auto" = detect pads, fall back to fixed; "fixed" = fixed geometry only
    "pad_centers": [0.12, ...],        // optional, normalised positions (0..1) of pad centres along the strip's long axis, length == pad_count
    "pad_size": 0.62,                  // pad ROI side as fraction of strip width (short axis)
    "roi_inset": 0.18                  // fraction trimmed from each ROI side before sampling (avoid edges/bleed)
  },
  "min_width": 640, "min_height": 200,
  "handle_side": "auto"                // "left" | "right" | "auto" — which end carries the plastic handle (no pad)
}
```

Response 200 (also returned when quality fails — check `quality.passed`):

```json
{
  "pipeline_version": "vitra-cv/0.1.0",
  "image": { "width": 1600, "height": 600, "format": "png", "sha256": "…" },
  "quality": {
    "passed": true,
    "checks": [
      { "id": "format", "label": "File format", "status": "pass", "value": "png", "threshold": "jpeg|png|webp|bmp|tiff", "message": "…" },
      { "id": "resolution", … }, { "id": "blur", … }, { "id": "overexposure", … },
      { "id": "underexposure", … }, { "id": "strip_visible", … },
      { "id": "orientation", … }, { "id": "obstruction", … }, { "id": "pads_visible", … }
    ]
  },
  "strip": {
    "found": true,
    "polygon": [[x,y],[x,y],[x,y],[x,y]],   // in original image pixels
    "bbox": { "x": 0, "y": 0, "w": 0, "h": 0 },
    "angle_deg": 1.8,
    "rotated_90": false, "flipped": false,
    "rectified_width": 1200, "rectified_height": 120
  },
  "pads": [
    {
      "pad_index": 0, "pad_id": "P01", "analyte": "glucose",
      "roi": { "x": 0, "y": 0, "w": 0, "h": 0 },   // in rectified-strip pixels
      "roi_source": "detected",                     // "detected" | "fixed"
      "features": {
        "rgb_mean": [r,g,b], "rgb_median": [r,g,b], "rgb_std": [r,g,b],
        "lab_mean": [L,a,b], "lab_std": [L,a,b], "hsv_mean": [h,s,v],
        "pixel_count": 1234
      },
      "quality": { "status": "ok", "uniformity": 0.93, "specular_fraction": 0.0,
                   "coverage": 1.0, "edge_contrast": 0.41, "flags": [] }
    }
  ],
  "feature_vector": { "rgb_30": [ … 30 floats … ], "lab_30": [ … 30 floats … ] },
  "strip_png_base64": "…",        // rectified strip crop (pads ordered left→right)
  "overlay_png_base64": "…",      // original image with strip polygon + pad boxes drawn
  "timings_ms": { "decode": 0, "quality": 0, "localize": 0, "segment": 0, "features": 0, "total": 0 },
  "warnings": []
}
```

Notes:
- RGB values are 0–255 floats (sRGB, as captured; no white balance applied unless a white reference is present).
- CIELAB uses OpenCV float conversion on `[0,1]`-scaled sRGB (D65): L in 0–100, a/b roughly −128…127.
- `rgb_30` is `[P01.r, P01.g, P01.b, P02.r, …]` in pad order — the 30-D vector from the KJS-HC-03 document.
- pad `quality.status` is `"ok" | "warn" | "fail"`; flags include `low_uniformity`, `specular`, `low_contrast`, `clipped`, `occluded`.

## POST /v1/calibration/validate  (JSON)

Request: `{ "csv_text": "…", "pad_count": 10 }`

Dataset CSV columns (header names, case-insensitive):
- `sample_id` (required), `strip_product`, `batch`, `synthetic` (`true`/`false`), `split` (optional `train`/`test`)
- features `p01_r, p01_g, p01_b, … p10_b` (required, 30 columns)
- optional `p01_l, p01_a, p01_bb … p10_bb` (CIELAB; `_bb` for b* to avoid clash)
- references `ref_<analyte>` e.g. `ref_glucose` (numeric, in the analyte's unit)

Response: `{ ok, rows, columns, feature_columns, reference_columns, missing_required,
missing_values: {col: n}, non_numeric: {col: n}, duplicate_rows, duplicate_sample_ids: [..],
per_analyte_counts: {glucose: n}, synthetic_rows, issues: [{level, message}] }`

## POST /v1/calibration/train  (JSON)

Request:
```json
{ "csv_text": "…", "analyte": "glucose", "unit": "mg/dL",
  "model_type": "poly2_ridge",   // "linear" | "poly2_ridge" | "poly3_ridge" | "knn" | "rf"
  "feature_set": "rgb30",        // "rgb30" | "pad_rgb" (only the analyte's own pad) | "lab30"
  "pad_index": 0,                // required for pad_rgb
  "test_fraction": 0.25, "seed": 42, "model_version": "glucose-poly2-v1" }
```

Behaviour: drops rows with missing feature/reference values; if a `split`
column is present it is honoured, otherwise a seeded random split. Grouped by
`sample_id` so the same sample never appears in both splits. Requires ≥ 20 usable
rows (else `422 insufficient_data`); returns `sample_size_warning` when test set < 30.

Response:
```json
{ "model_id": "glucose-poly2-v1", "analyte": "glucose", "unit": "mg/dL",
  "model_type": "poly2_ridge", "feature_set": "rgb30",
  "n_train": 0, "n_test": 0, "synthetic_fraction": 1.0,
  "reference_range": [0, 1000],
  "metrics": { "train": {"mae":0,"rmse":0,"bias":0,"r2":0,"n":0},
               "test":  {"mae":0,"rmse":0,"bias":0,"r2":0,"n":0},
               "cv5":   {"mae":0,"rmse":0,"r2":0} },
  "residual_quantiles": {"p05":0,"p50":0,"p95":0},
  "predictions": [{"sample_id":"…","reference":0,"predicted":0,"residual":0,"split":"test"}],
  "sample_size_warning": "…" | null,
  "created_at": "ISO-8601" }
```

The fitted model is persisted to `MODEL_STORE_DIR/<model_id>.joblib` plus a
`<model_id>.json` metadata sidecar.

## POST /v1/infer  (JSON)

Request: `{ "model_id": "glucose-poly2-v1", "rgb_30": [...], "lab_30": [...] }`

Response:
```json
{ "model_id": "…", "analyte": "glucose", "unit": "mg/dL", "value": 112.4,
  "within_reference_range": true, "reference_range": [0, 1000],
  "interval_95": [80.1, 140.7],        // empirical, from held-out test residual quantiles (null if not available)
  "synthetic_training_data": true }
```

## POST /v1/synthetic/strip  (JSON) → image/png

`{ "seed": 7, "levels": {"glucose": 0.4, …}, "width": 1600, "height": 600,
   "rotation_deg": 2.0, "blur": 0, "exposure": 1.0 }` — renders a **synthetic**
test strip image for demos and tests (levels 0–1 map along each analyte's
synthetic colour ramp). Never present these as patient samples.
