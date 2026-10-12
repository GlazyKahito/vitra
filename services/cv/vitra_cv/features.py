"""Per-ROI colour features and pad quality metrics."""
from __future__ import annotations

from typing import Dict, List, Tuple

import cv2
import numpy as np

from .localize import rgb_to_lab_image
from .segment import PadROI


def _r(v, nd=3):
    return [round(float(x), nd) for x in v]


def pad_features(rect: np.ndarray, roi: PadROI, baseline_lab=None) -> Tuple[Dict, Dict]:
    H, W = rect.shape[:2]
    x0, y0 = max(0, roi.x), max(0, roi.y)
    x1, y1 = min(W, roi.x + roi.w), min(H, roi.y + roi.h)
    patch = rect[y0:y1, x0:x1]
    if patch.size == 0:
        patch = np.zeros((1, 1, 3), dtype=np.uint8)
    px = patch.reshape(-1, 3).astype(np.float32)
    coverage = float(patch.shape[0] * patch.shape[1]) / float(max(1, roi.w * roi.h))

    lab = rgb_to_lab_image(patch).reshape(-1, 3)
    hsv = cv2.cvtColor(patch, cv2.COLOR_RGB2HSV).reshape(-1, 3).astype(np.float32)
    hsv_mean = hsv.mean(axis=0)
    hsv_mean[0] *= 2.0  # OpenCV 8-bit hue is 0..179 -> degrees

    rgb_mean = px.mean(axis=0)
    rgb_std = px.std(axis=0)
    lab_mean = lab.mean(axis=0)
    lab_std = lab.std(axis=0)

    # Quality
    lum = 0.2126 * px[:, 0] + 0.7152 * px[:, 1] + 0.0722 * px[:, 2]
    specular = float(np.mean(lum >= 250))
    clipped = float(np.mean((px >= 254).any(axis=1) | (px <= 1).all(axis=1)))
    # uniformity: 1 - normalised LAB spread (std of LAB distance to its mean)
    d = np.linalg.norm(lab - lab_mean[None, :], axis=1)
    uniformity = float(np.clip(1.0 - (d.mean() / 12.0), 0.0, 1.0))
    # edge contrast: LAB distance between pad mean and the plastic baseline, normalised
    if baseline_lab is not None:
        contrast = float(np.linalg.norm(lab_mean - baseline_lab))
        edge_contrast = float(np.clip(contrast / 60.0, 0.0, 1.0))
    else:
        edge_contrast = 0.0
    # occlusion: fraction of pixels far from the pad's median colour (foreign blob)
    med = np.median(lab, axis=0)
    occluded = float(np.mean(np.linalg.norm(lab - med[None, :], axis=1) > 25.0))

    flags: List[str] = []
    if uniformity < 0.6:
        flags.append("low_uniformity")
    if specular > 0.05:
        flags.append("specular")
    if edge_contrast < 0.08:
        flags.append("low_contrast")
    if clipped > 0.2:
        flags.append("clipped")
    if occluded > 0.15:
        flags.append("occluded")
    status = "ok"
    if flags:
        status = "warn"
    if uniformity < 0.35 or specular > 0.3 or occluded > 0.4 or coverage < 0.5:
        status = "fail"

    features = {
        "rgb_mean": _r(rgb_mean, 2),
        "rgb_median": _r(np.median(px, axis=0), 2),
        "rgb_std": _r(rgb_std, 2),
        "lab_mean": _r(lab_mean, 3),
        "lab_std": _r(lab_std, 3),
        "hsv_mean": _r(hsv_mean, 2),
        "pixel_count": int(px.shape[0]),
    }
    quality = {
        "status": status,
        "uniformity": round(uniformity, 3),
        "specular_fraction": round(specular, 4),
        "coverage": round(coverage, 3),
        "edge_contrast": round(edge_contrast, 3),
        "flags": flags,
    }
    return features, quality


def feature_vectors(pads: List[Dict]) -> Dict[str, List[float]]:
    rgb_30: List[float] = []
    lab_30: List[float] = []
    for p in pads:
        rgb_30.extend(p["features"]["rgb_mean"])
        lab_30.extend(p["features"]["lab_mean"])
    return {"rgb_30": rgb_30, "lab_30": lab_30}
