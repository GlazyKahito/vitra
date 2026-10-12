"""Strip localisation: find the bright plastic strip on the dark enclosure
background, rectify it to a horizontal crop and orient it handle-left."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional, Tuple

import cv2
import numpy as np


@dataclass
class StripLocalisation:
    found: bool
    polygon: List[List[int]] = field(default_factory=list)  # original px, 4 points
    bbox: dict = field(default_factory=lambda: {"x": 0, "y": 0, "w": 0, "h": 0})
    angle_deg: float = 0.0  # tilt of long axis vs nearest image axis (deg)
    rotated_90: bool = False
    flipped: bool = False
    rectified: Optional[np.ndarray] = None  # RGB uint8, pads left->right
    handle_side: str = "left"
    handle_len: int = 0  # px in rectified coordinates (left end)
    saliency: Optional[np.ndarray] = None  # per-column LAB distance profile
    baseline_lab: Optional[np.ndarray] = None
    aspect: float = 0.0
    area_fraction: float = 0.0
    mask: Optional[np.ndarray] = None  # binary mask (original px) of the strip
    message: str = ""


def _order_quad(pts: np.ndarray) -> np.ndarray:
    """Order 4 points as top-left, top-right, bottom-right, bottom-left."""
    s = pts.sum(axis=1)
    d = np.diff(pts, axis=1).ravel()
    tl = pts[np.argmin(s)]
    br = pts[np.argmax(s)]
    tr = pts[np.argmin(d)]
    bl = pts[np.argmax(d)]
    return np.array([tl, tr, br, bl], dtype=np.float32)


def _candidate_from_mask(mask: np.ndarray, img_area: float):
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    best = None
    for c in contours:
        area = cv2.contourArea(c)
        if area < 0.01 * img_area:
            continue
        rect = cv2.minAreaRect(c)
        (cx, cy), (w, h), ang = rect
        if min(w, h) < 4:
            continue
        aspect = max(w, h) / max(1.0, min(w, h))
        if aspect < 3.0 or aspect > 40:
            continue
        if w * h > 0.75 * img_area:  # whole-frame blob (background), not a strip
            continue
        fill = area / max(1.0, w * h)  # rectangularity
        if fill < 0.6:
            continue
        score = area * min(aspect, 15) * fill
        if best is None or score > best[0]:
            best = (score, rect, c, aspect, area / img_area)
    return best, mask


def rgb_to_lab_image(rgb: np.ndarray) -> np.ndarray:
    return cv2.cvtColor((rgb.astype(np.float32) / 255.0), cv2.COLOR_RGB2LAB)


def saliency_profile(rect_rgb: np.ndarray, baseline: Optional[np.ndarray] = None):
    """Per-column mean LAB distance from the plastic baseline colour.

    The baseline is the median LAB of the low-chroma, bright pixels (the plastic).
    """
    lab = rgb_to_lab_image(rect_rgb)
    H = lab.shape[0]
    r0, r1 = int(H * 0.15), max(int(H * 0.85), int(H * 0.15) + 1)
    core = lab[r0:r1]
    if baseline is None:
        chroma = np.sqrt(core[..., 1] ** 2 + core[..., 2] ** 2)
        L = core[..., 0]
        thr_c = np.percentile(chroma, 40)
        thr_l = np.percentile(L, 50)
        sel = (chroma <= thr_c) & (L >= thr_l)
        if sel.sum() < 50:
            sel = chroma <= thr_c
        baseline = np.median(core[sel].reshape(-1, 3), axis=0)
    dist = np.linalg.norm(core - baseline[None, None, :], axis=2)
    prof = dist.mean(axis=0)
    return prof.astype(np.float32), baseline.astype(np.float32), lab


def _handle_runs(prof: np.ndarray, H: int) -> Tuple[int, int, float]:
    """Return (left_run, right_run, threshold): length of the pad-free uniform
    run at each end of the rectified strip."""
    k = max(3, int(H * 0.08) | 1)
    sm = cv2.GaussianBlur(prof.reshape(1, -1), (k, 1), 0).ravel()
    # Ignore a small margin at both ends: the warped edge columns may contain
    # background/blur and would otherwise break the "uniform run" at index 0.
    margin = max(2, int(len(sm) * 0.03))
    inner = sm[margin : len(sm) - margin]
    thr = max(6.0, 0.3 * float(inner.max()))
    below = inner < thr
    left = 0
    while left < len(below) and below[left]:
        left += 1
    right = 0
    while right < len(below) and below[len(below) - 1 - right]:
        right += 1
    return left + margin, right + margin, thr


def localize_strip(rgb: np.ndarray, handle_side: str = "auto") -> StripLocalisation:
    h, w = rgb.shape[:2]
    img_area = float(h * w)
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    _, bright = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
    dark = cv2.bitwise_not(bright)

    cands = []
    for pol, m in (("bright", bright), ("dark", dark)):
        best, mm = _candidate_from_mask(m, img_area)
        if best is not None:
            cands.append((best, mm, pol))
    if not cands:
        return StripLocalisation(found=False, message="no strip-like contour found")
    # Prefer the bright polarity when scores are comparable (plastic strip on dark enclosure).
    cands.sort(key=lambda c: c[0][0] * (1.15 if c[2] == "bright" else 1.0), reverse=True)
    (score, rect, contour, aspect, area_frac), mask, pol = cands[0]

    box = cv2.boxPoints(rect).astype(np.float32)
    quad = _order_quad(box)
    (cx, cy), (rw, rh), ang = rect
    # Long-axis direction from the ordered quad: top edge vs left edge.
    top_len = float(np.linalg.norm(quad[1] - quad[0]))
    left_len = float(np.linalg.norm(quad[3] - quad[0]))
    rotated_90 = left_len > top_len
    if rotated_90:
        # Re-order so the long axis maps to the rectified width: rotate the quad by one.
        quad = np.array([quad[3], quad[0], quad[1], quad[2]], dtype=np.float32)
        long_len, short_len = left_len, top_len
    else:
        long_len, short_len = top_len, left_len
    W = int(round(long_len))
    Hh = int(round(short_len))
    W, Hh = max(W, 16), max(Hh, 8)
    dst = np.array([[0, 0], [W - 1, 0], [W - 1, Hh - 1], [0, Hh - 1]], dtype=np.float32)
    M = cv2.getPerspectiveTransform(quad, dst)
    rectified = cv2.warpPerspective(rgb, M, (W, Hh), flags=cv2.INTER_LINEAR)

    # Tilt of the long axis relative to the nearest image axis.
    v = quad[1] - quad[0]
    raw = float(np.degrees(np.arctan2(v[1], v[0])))
    tilt = ((raw + 90) % 180) - 90  # -90..90 relative to horizontal
    if rotated_90:
        tilt = tilt - 90 if tilt > 0 else tilt + 90
    angle_deg = float(tilt)

    prof, baseline, _ = saliency_profile(rectified)
    left_run, right_run, _ = _handle_runs(prof, Hh)
    if handle_side == "auto":
        side = "left" if left_run >= right_run else "right"
    else:
        side = handle_side
    flipped = False
    if side == "right":
        rectified = np.ascontiguousarray(rectified[:, ::-1])
        prof = prof[::-1].copy()
        flipped = True
        handle_len = right_run
    else:
        handle_len = left_run

    xs, ys = quad[:, 0], quad[:, 1]
    bbox = {
        "x": int(max(0, np.floor(xs.min()))),
        "y": int(max(0, np.floor(ys.min()))),
        "w": int(min(w, np.ceil(xs.max())) - max(0, np.floor(xs.min()))),
        "h": int(min(h, np.ceil(ys.max())) - max(0, np.floor(ys.min()))),
    }
    return StripLocalisation(
        found=True,
        polygon=[[int(round(float(p[0]))), int(round(float(p[1])))] for p in quad],
        bbox=bbox,
        angle_deg=round(angle_deg, 2),
        rotated_90=rotated_90,
        flipped=flipped,
        rectified=rectified,
        handle_side=side,
        handle_len=int(handle_len),
        saliency=prof,
        baseline_lab=baseline,
        aspect=float(aspect),
        area_fraction=float(area_frac),
        mask=mask,
        message=f"strip found ({pol} polarity, aspect {aspect:.1f})",
    )
