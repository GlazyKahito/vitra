"""Calibration dataset validation, model training and inference."""
from __future__ import annotations

import io
import json
import os
import re
from datetime import datetime, timezone
from typing import Dict, List, Optional

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression, RidgeCV
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import GroupKFold, GroupShuffleSplit
from sklearn.neighbors import KNeighborsRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import PolynomialFeatures, StandardScaler

from .config import ANALYTE_KEYS, ANALYTE_SPANS, ANALYTE_UNITS

MODEL_TYPES = ("linear", "poly2_ridge", "poly3_ridge", "knn", "rf")
FEATURE_SETS = ("rgb30", "pad_rgb", "lab30")
RGB_COLS = [f"p{i:02d}_{c}" for i in range(1, 11) for c in ("r", "g", "b")]
LAB_COLS = [f"p{i:02d}_{c}" for i in range(1, 11) for c in ("l", "a", "bb")]
MIN_ROWS = 20


class CalibrationError(Exception):
    def __init__(self, code: str, message: str, status: int = 422):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status


def model_store_dir() -> str:
    d = os.environ.get("MODEL_STORE_DIR", "./models")
    os.makedirs(d, exist_ok=True)
    return d


def _read_csv(csv_text: str) -> pd.DataFrame:
    try:
        df = pd.read_csv(io.StringIO(csv_text))
    except Exception as e:
        raise CalibrationError("invalid_dataset", f"could not parse CSV: {e}")
    df.columns = [str(c).strip().lower() for c in df.columns]
    return df


def feature_cols_for(pad_count: int) -> List[str]:
    return [f"p{i:02d}_{c}" for i in range(1, pad_count + 1) for c in ("r", "g", "b")]


def validate_dataset(csv_text: str, pad_count: int = 10) -> Dict:
    df = _read_csv(csv_text)
    feat_req = feature_cols_for(pad_count)
    required = ["sample_id"] + feat_req
    missing = [c for c in required if c not in df.columns]
    feature_columns = [c for c in df.columns if re.fullmatch(r"p\d{2}_(r|g|b|l|a|bb)", c)]
    reference_columns = [c for c in df.columns if c.startswith("ref_")]
    issues: List[Dict] = []
    if missing:
        issues.append({"level": "error", "message": f"missing required columns: {', '.join(missing)}"})
    if not reference_columns:
        issues.append({"level": "error", "message": "no ref_<analyte> reference columns found"})

    missing_values: Dict[str, int] = {}
    non_numeric: Dict[str, int] = {}
    for c in feature_columns + reference_columns:
        n_missing = int(df[c].isna().sum())
        if n_missing:
            missing_values[c] = n_missing
        coerced = pd.to_numeric(df[c], errors="coerce")
        n_nn = int((coerced.isna() & df[c].notna()).sum())
        if n_nn:
            non_numeric[c] = n_nn
    if non_numeric:
        issues.append({"level": "error", "message": f"non-numeric values in {len(non_numeric)} column(s)"})
    if missing_values:
        issues.append({"level": "warn", "message": f"missing values in {len(missing_values)} column(s); affected rows are dropped at training"})

    duplicate_rows = int(df.duplicated().sum())
    dup_ids: List[str] = []
    if "sample_id" in df.columns:
        vc = df["sample_id"].astype(str).value_counts()
        dup_ids = [str(k) for k, v in vc.items() if v > 1]
    if duplicate_rows:
        issues.append({"level": "warn", "message": f"{duplicate_rows} fully duplicated row(s)"})
    if dup_ids:
        issues.append({"level": "warn", "message": f"{len(dup_ids)} duplicated sample_id(s); treated as one group at split time"})

    per_analyte: Dict[str, int] = {}
    for c in reference_columns:
        per_analyte[c[4:]] = int(pd.to_numeric(df[c], errors="coerce").notna().sum())
    synthetic_rows = 0
    if "synthetic" in df.columns:
        synthetic_rows = int(df["synthetic"].astype(str).str.strip().str.lower().isin(["true", "1", "yes"]).sum())
    if "split" in df.columns:
        bad = ~df["split"].astype(str).str.lower().isin(["train", "test"]) & df["split"].notna()
        if bad.any():
            issues.append({"level": "warn", "message": f"{int(bad.sum())} row(s) with split not in train/test"})
    if len(df) < MIN_ROWS:
        issues.append({"level": "error", "message": f"only {len(df)} rows; at least {MIN_ROWS} required for training"})

    ok = not any(i["level"] == "error" for i in issues)
    return {
        "ok": ok,
        "rows": int(len(df)),
        "columns": list(df.columns),
        "feature_columns": feature_columns,
        "reference_columns": reference_columns,
        "missing_required": missing,
        "missing_values": missing_values,
        "non_numeric": non_numeric,
        "duplicate_rows": duplicate_rows,
        "duplicate_sample_ids": dup_ids,
        "per_analyte_counts": per_analyte,
        "synthetic_rows": synthetic_rows,
        "issues": issues,
    }


def _make_estimator(model_type: str, seed: int) -> Pipeline:
    if model_type == "linear":
        return Pipeline([("scale", StandardScaler()), ("reg", LinearRegression())])
    if model_type == "poly2_ridge":
        return Pipeline([("poly", PolynomialFeatures(2, include_bias=False)), ("scale", StandardScaler()),
                         ("reg", RidgeCV(alphas=np.logspace(-3, 3, 13)))])
    if model_type == "poly3_ridge":
        return Pipeline([("poly", PolynomialFeatures(3, include_bias=False)), ("scale", StandardScaler()),
                         ("reg", RidgeCV(alphas=np.logspace(-3, 3, 13)))])
    if model_type == "knn":
        return Pipeline([("scale", StandardScaler()), ("reg", KNeighborsRegressor(n_neighbors=5, weights="distance"))])
    if model_type == "rf":
        return Pipeline([("reg", RandomForestRegressor(n_estimators=300, random_state=seed, n_jobs=1))])
    raise CalibrationError("invalid_config", f"unknown model_type {model_type!r}; expected one of {MODEL_TYPES}", 400)


def _metrics(y_true: np.ndarray, y_pred: np.ndarray) -> Dict:
    n = int(len(y_true))
    if n == 0:
        return {"mae": None, "rmse": None, "bias": None, "r2": None, "n": 0}
    resid = y_pred - y_true
    r2 = float(r2_score(y_true, y_pred)) if n >= 2 and np.std(y_true) > 0 else None
    return {
        "mae": round(float(mean_absolute_error(y_true, y_pred)), 4),
        "rmse": round(float(np.sqrt(mean_squared_error(y_true, y_pred))), 4),
        "bias": round(float(resid.mean()), 4),
        "r2": round(r2, 4) if r2 is not None else None,
        "n": n,
    }


def _select_features(df: pd.DataFrame, feature_set: str, pad_index: Optional[int]) -> List[str]:
    if feature_set == "rgb30":
        return RGB_COLS
    if feature_set == "lab30":
        return LAB_COLS
    if feature_set == "pad_rgb":
        if pad_index is None or not (0 <= pad_index < 10):
            raise CalibrationError("invalid_config", "pad_index (0..9) is required for feature_set pad_rgb", 400)
        p = f"p{pad_index + 1:02d}"
        return [f"{p}_r", f"{p}_g", f"{p}_b"]
    raise CalibrationError("invalid_config", f"unknown feature_set {feature_set!r}; expected one of {FEATURE_SETS}", 400)


def train(
    csv_text: str,
    analyte: str,
    unit: Optional[str] = None,
    model_type: str = "poly2_ridge",
    feature_set: str = "rgb30",
    pad_index: Optional[int] = None,
    test_fraction: float = 0.25,
    seed: int = 42,
    model_version: Optional[str] = None,
) -> Dict:
    if model_type not in MODEL_TYPES:
        raise CalibrationError("invalid_config", f"unknown model_type {model_type!r}", 400)
    df = _read_csv(csv_text)
    feats = _select_features(df, feature_set, pad_index)
    ref_col = f"ref_{analyte.lower()}"
    missing = [c for c in ["sample_id", ref_col] + feats if c not in df.columns]
    if missing:
        raise CalibrationError("invalid_dataset", f"missing columns: {', '.join(missing)}")
    for c in feats + [ref_col]:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    df = df.dropna(subset=feats + [ref_col]).reset_index(drop=True)
    if len(df) < MIN_ROWS:
        raise CalibrationError("insufficient_data", f"{len(df)} usable rows; at least {MIN_ROWS} required")

    X = df[feats].to_numpy(dtype=np.float64)
    y = df[ref_col].to_numpy(dtype=np.float64)
    groups = df["sample_id"].astype(str).to_numpy()

    if "split" in df.columns and df["split"].astype(str).str.lower().isin(["train", "test"]).all():
        is_test = df["split"].astype(str).str.lower().eq("test").to_numpy()
        # Honour the column but keep groups intact: any sample_id with a test row is test.
        test_ids = set(groups[is_test])
        is_test = np.array([g in test_ids for g in groups])
    else:
        gss = GroupShuffleSplit(n_splits=1, test_size=test_fraction, random_state=seed)
        tr_idx, te_idx = next(gss.split(X, y, groups))
        is_test = np.zeros(len(df), dtype=bool)
        is_test[te_idx] = True
    tr, te = ~is_test, is_test
    if tr.sum() < 10:
        raise CalibrationError("insufficient_data", f"only {int(tr.sum())} training rows after split")

    est = _make_estimator(model_type, seed)
    est.fit(X[tr], y[tr])
    pred_tr = est.predict(X[tr])
    pred_te = est.predict(X[te]) if te.sum() > 0 else np.array([])

    # Grouped 5-fold CV on the training portion.
    n_groups = len(set(groups[tr]))
    k = min(5, n_groups)
    cv = {"mae": None, "rmse": None, "r2": None}
    if k >= 2:
        gkf = GroupKFold(n_splits=k)
        oof = np.zeros(int(tr.sum()))
        Xtr, ytr, gtr = X[tr], y[tr], groups[tr]
        for a, b in gkf.split(Xtr, ytr, gtr):
            m = _make_estimator(model_type, seed)
            m.fit(Xtr[a], ytr[a])
            oof[b] = m.predict(Xtr[b])
        cvm = _metrics(ytr, oof)
        cv = {"mae": cvm["mae"], "rmse": cvm["rmse"], "r2": cvm["r2"]}

    resid_source = (pred_te - y[te]) if te.sum() >= 5 else (pred_tr - y[tr])
    rq = {
        "p05": round(float(np.percentile(resid_source, 5)), 4),
        "p50": round(float(np.percentile(resid_source, 50)), 4),
        "p95": round(float(np.percentile(resid_source, 95)), 4),
    }
    preds = []
    for i in np.where(tr)[0]:
        pi = est.predict(X[i : i + 1])[0]
        preds.append({"sample_id": str(groups[i]), "reference": round(float(y[i]), 4), "predicted": round(float(pi), 4),
                      "residual": round(float(pi - y[i]), 4), "split": "train"})
    for j, i in enumerate(np.where(te)[0]):
        preds.append({"sample_id": str(groups[i]), "reference": round(float(y[i]), 4), "predicted": round(float(pred_te[j]), 4),
                      "residual": round(float(pred_te[j] - y[i]), 4), "split": "test"})

    synthetic_fraction = 0.0
    if "synthetic" in df.columns:
        synthetic_fraction = float(df["synthetic"].astype(str).str.strip().str.lower().isin(["true", "1", "yes"]).mean())
    lo, hi = ANALYTE_SPANS.get(analyte.lower(), (float(y.min()), float(y.max())))
    reference_range = [float(min(lo, y.min())), float(max(hi, y.max()))]
    unit = unit or ANALYTE_UNITS.get(analyte.lower(), "")
    model_id = model_version or f"{analyte}-{model_type}-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S')}"
    model_id = re.sub(r"[^A-Za-z0-9._-]", "_", model_id)
    n_test = int(te.sum())
    warning = f"test set has only {n_test} rows (< 30); metrics are unreliable" if n_test < 30 else None

    result = {
        "model_id": model_id,
        "analyte": analyte,
        "unit": unit,
        "model_type": model_type,
        "feature_set": feature_set,
        "n_train": int(tr.sum()),
        "n_test": n_test,
        "synthetic_fraction": round(synthetic_fraction, 4),
        "reference_range": reference_range,
        "metrics": {"train": _metrics(y[tr], pred_tr), "test": _metrics(y[te], pred_te), "cv5": cv},
        "residual_quantiles": rq,
        "predictions": preds,
        "sample_size_warning": warning,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    store = model_store_dir()
    joblib.dump({"estimator": est, "feature_columns": feats}, os.path.join(store, f"{model_id}.joblib"))
    meta = {k: v for k, v in result.items() if k != "predictions"}
    meta["feature_columns"] = feats
    meta["pad_index"] = pad_index
    meta["synthetic_training_data"] = synthetic_fraction > 0
    with open(os.path.join(store, f"{model_id}.json"), "w") as f:
        json.dump(meta, f, indent=2)
    return result


def list_models() -> List[str]:
    store = model_store_dir()
    return sorted(f[:-7] for f in os.listdir(store) if f.endswith(".joblib"))


def infer(model_id: str, rgb_30: Optional[List[float]] = None, lab_30: Optional[List[float]] = None) -> Dict:
    store = model_store_dir()
    safe = re.sub(r"[^A-Za-z0-9._-]", "_", model_id)
    jp, mp = os.path.join(store, f"{safe}.joblib"), os.path.join(store, f"{safe}.json")
    if not (os.path.exists(jp) and os.path.exists(mp)):
        raise CalibrationError("model_not_found", f"model {model_id!r} not found", 404)
    bundle = joblib.load(jp)
    with open(mp) as f:
        meta = json.load(f)
    feats: List[str] = bundle["feature_columns"]
    fs = meta["feature_set"]
    if fs == "lab30":
        vec = lab_30
        need = 30
    elif fs == "rgb30":
        vec = rgb_30
        need = 30
    else:
        vec = rgb_30
        need = 30
    if vec is None or len(vec) != need:
        raise CalibrationError("feature_mismatch", f"model expects {fs} ({need} values)")
    vec = np.asarray(vec, dtype=np.float64)
    if fs == "pad_rgb":
        p = meta.get("pad_index") or 0
        vec = vec[3 * p : 3 * p + 3]
    if len(vec) != len(feats) or not np.all(np.isfinite(vec)):
        raise CalibrationError("feature_mismatch", "feature vector length/values do not match the model")
    value = float(bundle["estimator"].predict(vec.reshape(1, -1))[0])
    rq = meta.get("residual_quantiles") or {}
    interval = None
    if rq.get("p05") is not None and rq.get("p95") is not None:
        interval = [round(value - rq["p95"], 4), round(value - rq["p05"], 4)]
    lo, hi = meta["reference_range"]
    return {
        "model_id": meta["model_id"],
        "analyte": meta["analyte"],
        "unit": meta["unit"],
        "value": round(value, 4),
        "within_reference_range": bool(lo <= value <= hi),
        "reference_range": [lo, hi],
        "interval_95": interval,
        "synthetic_training_data": bool(meta.get("synthetic_training_data", False)),
    }
