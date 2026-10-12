"""Pad detection on the rectified strip (pads left->right after the handle)."""
from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional, Tuple

import cv2
import numpy as np

from .config import PadConfig
from .localize import StripLocalisation, rgb_to_lab_image, saliency_profile


@dataclass
class PadROI:
    pad_index: int
    pad_id: str
    analyte: str
    x: int
    y: int
    w: int
    h: int
    roi_source: str  # "detected" | "fixed"
    full_box: Tuple[int, int, int, int]  # un-inset pad box (x, y, w, h)


def _runs(mask: np.ndarray) -> List[Tuple[int, int]]:
    runs = []
    start = None
    for i, v in enumerate(mask):
        if v and start is None:
            start = i
        elif not v and start is not None:
            runs.append((start, i))
            start = None
    if start is not None:
        runs.append((start, len(mask)))
    return runs


def _fit_grid(runs, n, expected_pitch, handle_len, W):
    """Fit `n` equally spaced slots to detected run centres.

    Returns (centres, pitch, snapped) where snapped[i] is the (a, b) run for slot i
    or None. Returns None when fewer than 2 runs exist or no plausible pitch fits.
    """
    if len(runs) < 2:
        return None
    centres = np.array([(a + b) / 2.0 for a, b in runs], dtype=np.float64)
    diffs = np.diff(centres)
    # candidate pitch: the smallest consecutive gap that is at least half the expected pitch
    cands = [d for d in diffs if d >= 0.5 * expected_pitch]
    if not cands:
        return None
    pitch = float(np.median([d for d in cands if d <= 1.5 * min(cands)]))
    if not (0.6 * expected_pitch <= pitch <= 1.6 * expected_pitch):
        pitch = expected_pitch
    best = None
    # try anchoring the grid on each detected run as slot k
    for ci in centres:
        for k in range(n):
            start = ci - k * pitch
            slots = start + pitch * np.arange(n)
            if slots[0] < -0.5 * pitch or slots[-1] > W + 0.5 * pitch:
                continue
            snapped = []
            err = 0.0
            used = set()
            for s_ in slots:
                j = int(np.argmin(np.abs(centres - s_)))
                if abs(centres[j] - s_) <= 0.3 * pitch and j not in used:
                    snapped.append(runs[j])
                    used.add(j)
                    err += abs(centres[j] - s_)
                else:
                    snapped.append(None)
            score = (len(used), -err, -abs(slots[0] - (handle_len + pitch / 2)))
            if best is None or score > best[0]:
                best = (score, slots, snapped)
    if best is None:
        return None
    _, slots, snapped = best
    return [float(s_) for s_ in slots], pitch, snapped


def _inset(x: int, y: int, w: int, h: int, inset: float) -> Tuple[int, int, int, int]:
    dx, dy = int(round(w * inset)), int(round(h * inset))
    nw, nh = max(2, w - 2 * dx), max(2, h - 2 * dy)
    return x + dx, y + dy, nw, nh


def detect_pads(loc: StripLocalisation, cfg: PadConfig) -> Tuple[List[PadROI], List[str]]:
    rect = loc.rectified
    H, W = rect.shape[:2]
    warnings: List[str] = []
    n = cfg.pad_count
    geom = cfg.geometry
    handle_len = min(loc.handle_len, int(W * 0.6))
    pad_side = max(4, int(round(geom.pad_size * H)))
    region_len = W - handle_len
    expected_pitch = region_len / n

    boxes: Optional[List[Tuple[int, int, int, int]]] = None
    source = "fixed"

    if geom.mode == "auto":
        prof = loc.saliency if loc.saliency is not None else saliency_profile(rect)[0]
        k = max(3, int(H * 0.06) | 1)
        sm = cv2.GaussianBlur(prof.reshape(1, -1), (k, 1), 0).ravel()
        margin = max(2, int(W * 0.02))
        core = sm[margin : W - margin]
        thr = max(6.0, 0.35 * float(np.percentile(core, 97)))
        mask = sm > thr
        mask[:margin] = False
        mask[W - margin :] = False
        runs = _runs(mask)
        min_w, max_w = 0.25 * H, 1.6 * expected_pitch
        runs = [r for r in runs if min_w <= (r[1] - r[0]) <= max(max_w, min_w + 1)]
        # merge runs separated by tiny gaps (texture breaks inside a pad)
        merged: List[Tuple[int, int]] = []
        for r in runs:
            if merged and r[0] - merged[-1][1] < 0.12 * H:
                merged[-1] = (merged[-1][0], r[1])
            else:
                merged.append(r)
        runs = merged
        # split runs that are far wider than a pad (two pads touching)
        split: List[Tuple[int, int]] = []
        for a, b in runs:
            k_parts = int(round((b - a) / max(1.0, 0.9 * expected_pitch)))
            if k_parts >= 2 and (b - a) > 1.3 * pad_side:
                step = (b - a) / k_parts
                for j in range(k_parts):
                    split.append((int(a + j * step), int(a + (j + 1) * step)))
            else:
                split.append((a, b))
        runs = split
        if len(runs) > n:
            # keep the n most salient
            scored = sorted(runs, key=lambda r: -float(sm[r[0] : r[1]].mean()))[:n]
            runs = sorted(scored)

        # Fit a regular grid to the detected runs (pads are equally spaced), then
        # snap each grid slot to a detected run when one is close; slots without a
        # run (e.g. a pad whose colour matches the plastic) use the grid position.
        grid = _fit_grid(runs, n, expected_pitch, handle_len, W)
        if grid is not None:
            centres_g, pitch_g, snapped = grid
            n_snapped = sum(1 for s in snapped if s is not None)
            if n_snapped >= max(3, int(0.5 * n)):
                boxes = []
                per_pad_source = []
                lab_dist = None
                width_g = int(round(np.median([b - a for a, b in runs]))) if runs else pad_side
                width_g = int(np.clip(width_g, 0.3 * H, max(0.3 * H + 1, 0.95 * pitch_g)))
                for i in range(n):
                    if snapped[i] is not None:
                        a, b = snapped[i]
                        per_pad_source.append("detected")
                    else:
                        a = int(round(centres_g[i] - width_g / 2))
                        b = a + width_g
                        per_pad_source.append("fixed")
                    a, b = max(0, a), min(W, b)
                    if lab_dist is None:
                        lab = rgb_to_lab_image(rect)
                        base = loc.baseline_lab if loc.baseline_lab is not None else np.median(lab.reshape(-1, 3), axis=0)
                        lab_dist = np.linalg.norm(lab - base[None, None, :], axis=2)
                    rows = lab_dist[:, a:b].mean(axis=1)
                    rruns = _runs(rows > thr)
                    cy = H // 2
                    sel = [r for r in rruns if r[0] <= cy < r[1] and (r[1] - r[0]) >= 0.3 * H]
                    if sel and per_pad_source[-1] == "detected":
                        y0, y1 = sel[0]
                    else:
                        side = b - a
                        y0, y1 = max(0, cy - side // 2), min(H, cy + side // 2)
                    boxes.append((int(a), int(y0), int(b - a), int(y1 - y0)))
                source = per_pad_source
                if n_snapped < n:
                    warnings.append(f"{n - n_snapped} pad(s) not detected by colour; placed from the fitted grid")
            else:
                warnings.append(f"pad detection matched only {n_snapped}/{n} pads; using fixed geometry")
        else:
            warnings.append(f"pad detection found {len(runs)} runs for {n} pads; using fixed geometry")

    if boxes is None:
        if geom.pad_centers is not None:
            centres = [c * W for c in geom.pad_centers]
        else:
            centres = [handle_len + expected_pitch * (i + 0.5) for i in range(n)]
        half = pad_side // 2
        cy = H // 2
        boxes = []
        for c in centres:
            x0 = int(round(c - half))
            x0 = max(0, min(W - pad_side, x0))
            y0 = max(0, min(H - pad_side, cy - half))
            boxes.append((x0, y0, pad_side, pad_side))
        source = "fixed"

    rois: List[PadROI] = []
    for i, (x, y, w, h) in enumerate(boxes):
        ix, iy, iw, ih = _inset(x, y, w, h, geom.roi_inset)
        rois.append(
            PadROI(
                pad_index=i,
                pad_id=f"P{i + 1:02d}",
                analyte=cfg.pad_map[i],
                x=ix, y=iy, w=iw, h=ih,
                roi_source=source[i] if isinstance(source, list) else source,
                full_box=(x, y, w, h),
            )
        )
    return rois, warnings
