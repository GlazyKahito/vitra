"""End-to-end analyze pipeline (see docs/cv-service-contract.md)."""
from __future__ import annotations

import base64
import hashlib
import time
from typing import Dict, List, Optional

import cv2
import numpy as np

from . import PIPELINE_VERSION
from .config import PadConfig
from .features import feature_vectors, pad_features
from .localize import localize_strip
from .overlay import draw_overlay, draw_rectified, encode_png
from .quality import run_quality_checks, sniff_format
from .segment import detect_pads

MAX_BYTES = 15 * 1024 * 1024


class PipelineError(Exception):
    def __init__(self, code: str, message: str, status: int = 400):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status


def decode_image(data: bytes) -> np.ndarray:
    arr = np.frombuffer(data, dtype=np.uint8)
    bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if bgr is None:
        raise PipelineError("decode_failed", "could not decode image", 422)
    return cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)


def analyze(image_bytes: bytes, config: Optional[PadConfig] = None) -> Dict:
    cfg = config or PadConfig()
    timings: Dict[str, float] = {}
    t_all = time.perf_counter()
    warnings: List[str] = []

    if len(image_bytes) > MAX_BYTES:
        raise PipelineError("file_too_large", f"file exceeds {MAX_BYTES} bytes", 413)
    fmt = sniff_format(image_bytes)
    if fmt is None:
        raise PipelineError("unsupported_format", "unsupported image format (jpeg/png/webp/bmp/tiff)", 415)

    t = time.perf_counter()
    rgb = decode_image(image_bytes)
    sha = hashlib.sha256(image_bytes).hexdigest()
    timings["decode"] = (time.perf_counter() - t) * 1000

    t = time.perf_counter()
    loc = localize_strip(rgb, cfg.handle_side)
    timings["localize"] = (time.perf_counter() - t) * 1000

    pads: List[Dict] = []
    rois = []
    t = time.perf_counter()
    if loc.found:
        rois, seg_warn = detect_pads(loc, cfg)
        warnings.extend(seg_warn)
    timings["segment"] = (time.perf_counter() - t) * 1000

    t = time.perf_counter()
    for r in rois:
        feats, q = pad_features(loc.rectified, r, loc.baseline_lab)
        pads.append({
            "pad_index": r.pad_index,
            "pad_id": r.pad_id,
            "analyte": r.analyte,
            "roi": {"x": r.x, "y": r.y, "w": r.w, "h": r.h},
            "roi_source": r.roi_source,
            "features": feats,
            "quality": q,
        })
    timings["features"] = (time.perf_counter() - t) * 1000

    t = time.perf_counter()
    quality = run_quality_checks(fmt, rgb, cfg, loc, len(pads), [p["quality"]["status"] for p in pads])
    timings["quality"] = (time.perf_counter() - t) * 1000

    if loc.found and loc.flipped:
        warnings.append("strip flipped so the handle is on the left")
    if loc.found and loc.rotated_90:
        warnings.append("strip long axis was vertical; rectified by 90°")
    if not loc.found:
        warnings.append("strip not localised; no pads sampled")

    overlay_png = draw_overlay(rgb, loc, rois)
    strip_png = draw_rectified(loc, rois) if loc.found else encode_png(np.zeros((8, 8, 3), dtype=np.uint8))

    h, w = rgb.shape[:2]
    timings["total"] = (time.perf_counter() - t_all) * 1000
    return {
        "pipeline_version": PIPELINE_VERSION,
        "image": {"width": int(w), "height": int(h), "format": fmt, "sha256": sha},
        "quality": quality,
        "strip": {
            "found": bool(loc.found),
            "polygon": loc.polygon if loc.found else [],
            "bbox": loc.bbox,
            "angle_deg": float(loc.angle_deg),
            "rotated_90": bool(loc.rotated_90),
            "flipped": bool(loc.flipped),
            "rectified_width": int(loc.rectified.shape[1]) if loc.found else 0,
            "rectified_height": int(loc.rectified.shape[0]) if loc.found else 0,
        },
        "pads": pads,
        "feature_vector": feature_vectors(pads) if len(pads) == cfg.pad_count else {"rgb_30": [], "lab_30": []},
        "strip_png_base64": base64.b64encode(strip_png).decode("ascii"),
        "overlay_png_base64": base64.b64encode(overlay_png).decode("ascii"),
        "timings_ms": {k: round(v, 2) for k, v in timings.items()},
        "warnings": warnings,
    }
