"""Overlay rendering (cyan strip polygon + pad boxes + ids) and PNG encoding."""
from __future__ import annotations

from typing import List, Optional

import cv2
import numpy as np

from .localize import StripLocalisation
from .segment import PadROI

CYAN_RGB = (95, 212, 230)


def encode_png(rgb: np.ndarray) -> bytes:
    ok, buf = cv2.imencode(".png", cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR))
    if not ok:  # pragma: no cover
        raise RuntimeError("png encode failed")
    return buf.tobytes()


def _rect_to_original(loc: StripLocalisation, x: float, y: float) -> np.ndarray:
    """Map a rectified-strip point back to original image coordinates."""
    W = loc.rectified.shape[1]
    H = loc.rectified.shape[0]
    if loc.flipped:
        x = (W - 1) - x
    quad = np.array(loc.polygon, dtype=np.float32)
    dst = np.array([[0, 0], [W - 1, 0], [W - 1, H - 1], [0, H - 1]], dtype=np.float32)
    M = cv2.getPerspectiveTransform(dst, quad)
    p = cv2.perspectiveTransform(np.array([[[x, y]]], dtype=np.float32), M)
    return p[0, 0]


def draw_overlay(rgb: np.ndarray, loc: Optional[StripLocalisation], rois: List[PadROI]) -> bytes:
    out = rgb.copy()
    h, w = out.shape[:2]
    t = max(1, int(round(min(h, w) / 300)))
    if loc is not None and loc.found:
        poly = np.array(loc.polygon, dtype=np.int32).reshape(-1, 1, 2)
        cv2.polylines(out, [poly], True, CYAN_RGB, t, cv2.LINE_AA)
        for r in rois:
            x0, y0, bw, bh = r.full_box
            corners = [(x0, y0), (x0 + bw, y0), (x0 + bw, y0 + bh), (x0, y0 + bh)]
            pts = np.array([_rect_to_original(loc, cx, cy) for cx, cy in corners], dtype=np.int32).reshape(-1, 1, 2)
            cv2.polylines(out, [pts], True, CYAN_RGB, t, cv2.LINE_AA)
            ix, iy, iw, ih = r.x, r.y, r.w, r.h
            icorners = [(ix, iy), (ix + iw, iy), (ix + iw, iy + ih), (ix, iy + ih)]
            ipts = np.array([_rect_to_original(loc, cx, cy) for cx, cy in icorners], dtype=np.int32).reshape(-1, 1, 2)
            cv2.polylines(out, [ipts], True, CYAN_RGB, max(1, t // 2), cv2.LINE_AA)
            label_pt = _rect_to_original(loc, x0 + bw / 2.0, y0 - 0.25 * bh)
            fs = max(0.35, min(h, w) / 900.0)
            (tw, th), _ = cv2.getTextSize(r.pad_id, cv2.FONT_HERSHEY_SIMPLEX, fs, t)
            cv2.putText(out, r.pad_id, (int(label_pt[0] - tw / 2), int(label_pt[1] + th / 2)),
                        cv2.FONT_HERSHEY_SIMPLEX, fs, CYAN_RGB, t, cv2.LINE_AA)
    return encode_png(out)


def draw_rectified(loc: StripLocalisation, rois: List[PadROI]) -> bytes:
    out = loc.rectified.copy()
    for r in rois:
        cv2.rectangle(out, (r.x, r.y), (r.x + r.w, r.y + r.h), CYAN_RGB, 1, cv2.LINE_AA)
    return encode_png(out)
