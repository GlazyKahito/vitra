"""SYNTHETIC strip renderer and SYNTHETIC calibration dataset generator.

Everything produced here is synthetic and must be labelled as such. The colour
ramps are the demo ramps from apps/web/lib/analytes.ts; they do not represent
any real reagent chemistry.
"""
from __future__ import annotations

from typing import Dict, Optional, Tuple

import cv2
import numpy as np
import pandas as pd

from .config import ANALYTE_KEYS, ANALYTE_SPANS, DEMO_RAMPS

PLASTIC_RGB = (0xEF, 0xEC, 0xE4)  # off-white plastic #efece4
BACKGROUND_RGB = (0x12, 0x13, 0x15)  # dark graphite enclosure

# Fraction of the strip's long axis occupied by the handle (pad-free region).
HANDLE_FRACTION = 0.22
PAD_SIDE_FRACTION = 0.62  # pad side as fraction of strip short axis
STRIP_LENGTH_FRACTION = 0.78  # of image width
STRIP_ASPECT = 10.0  # long/short


def hex_to_rgb(h: str) -> Tuple[int, int, int]:
    h = h.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def demo_color(key: str, t: float) -> np.ndarray:
    """Interpolate a demo ramp (same piecewise mix as analytes.ts demoColor). Returns RGB float array."""
    a, b, c = DEMO_RAMPS[key]
    t = float(np.clip(t, 0.0, 1.0))
    if t < 0.5:
        lo, hi, local = a, b, t * 2
    else:
        lo, hi, local = b, c, (t - 0.5) * 2
    ca = np.array(hex_to_rgb(lo), dtype=np.float64)
    cb = np.array(hex_to_rgb(hi), dtype=np.float64)
    return ca + (cb - ca) * local


def strip_layout(width: int, height: int, pad_count: int = 10):
    """Return (strip_len, strip_h, handle_len, pad_side, pad_centres_along_long_axis)."""
    strip_len = int(width * STRIP_LENGTH_FRACTION)
    strip_h = max(12, int(strip_len / STRIP_ASPECT))
    handle_len = int(strip_len * HANDLE_FRACTION)
    pad_side = int(strip_h * PAD_SIDE_FRACTION)
    region = strip_len - handle_len
    pitch = region / pad_count
    centres = [handle_len + pitch * (i + 0.5) for i in range(pad_count)]
    return strip_len, strip_h, handle_len, pad_side, centres


def render_strip(
    seed: int = 7,
    levels: Optional[Dict[str, float]] = None,
    width: int = 1600,
    height: int = 600,
    rotation_deg: float = 0.0,
    blur: float = 0.0,
    exposure: float = 1.0,
    return_array: bool = False,
):
    """Render a synthetic strip image. Returns PNG bytes (or RGB uint8 array if return_array)."""
    rng = np.random.default_rng(seed)
    levels = dict(levels or {})
    for k in ANALYTE_KEYS:
        levels.setdefault(k, float(rng.uniform(0.05, 0.95)))

    # Near-vertical rotations: lay the strip out on a landscape canvas and warp
    # into the requested (possibly portrait) output size.
    out_w, out_h = int(width), int(height)
    near_vertical = 45.0 < (abs(float(rotation_deg)) % 180.0) < 135.0
    if near_vertical:
        width, height = max(out_w, out_h), min(out_w, out_h)

    # Background: graphite with vignette and fine noise.
    yy, xx = np.mgrid[0:height, 0:width].astype(np.float32)
    cx, cy = width / 2.0, height / 2.0
    r = np.sqrt(((xx - cx) / cx) ** 2 + ((yy - cy) / cy) ** 2)
    vignette = np.clip(1.0 - 0.45 * r**2, 0.3, 1.0)
    img = np.empty((height, width, 3), dtype=np.float32)
    for c in range(3):
        img[..., c] = BACKGROUND_RGB[c] * vignette
    img += rng.normal(0, 2.0, size=img.shape).astype(np.float32)

    strip_len, strip_h, handle_len, pad_side, centres = strip_layout(width, height)
    x0 = int((width - strip_len) / 2)
    y0 = int((height - strip_h) / 2)

    # Strip plastic: off-white with low-frequency texture + grain, slight lighting gradient.
    tex_small = rng.normal(0, 1.0, size=(max(2, strip_h // 8), max(2, strip_len // 8))).astype(np.float32)
    tex = cv2.resize(tex_small, (strip_len, strip_h), interpolation=cv2.INTER_CUBIC) * 3.0
    grain = rng.normal(0, 1.6, size=(strip_h, strip_len, 3)).astype(np.float32)
    gx = np.linspace(-4, 4, strip_len, dtype=np.float32)[None, :, None]
    plastic = np.array(PLASTIC_RGB, dtype=np.float32)[None, None, :] + tex[..., None] + grain + gx
    img[y0 : y0 + strip_h, x0 : x0 + strip_len] = plastic

    # Pads.
    for i, key in enumerate(ANALYTE_KEYS):
        col = demo_color(key, levels[key])
        pcx = x0 + centres[i]
        pcy = y0 + strip_h / 2.0
        half = pad_side / 2.0
        px0, px1 = int(round(pcx - half)), int(round(pcx + half))
        py0, py1 = int(round(pcy - half)), int(round(pcy + half))
        ph, pw = py1 - py0, px1 - px0
        pad = np.tile(col.astype(np.float32)[None, None, :], (ph, pw, 1))
        pad += rng.normal(0, 2.2, size=pad.shape).astype(np.float32)
        # reagent texture: low-frequency mottling
        m_small = rng.normal(0, 1.0, size=(max(2, ph // 6), max(2, pw // 6))).astype(np.float32)
        pad += cv2.resize(m_small, (pw, ph), interpolation=cv2.INTER_CUBIC)[..., None] * 2.5
        img[py0:py1, px0:px1] = pad
        # faint edge bleed: blur a slightly larger rectangle of pad colour into the plastic
        bleed = 2
        bx0, bx1 = max(0, px0 - bleed), min(width, px1 + bleed)
        by0, by1 = max(0, py0 - bleed), min(height, py1 + bleed)
        region = img[by0:by1, bx0:bx1]
        blurred = cv2.GaussianBlur(region, (0, 0), 1.2)
        mask = np.ones_like(region[..., :1])
        mask[bleed:-bleed, bleed:-bleed] = 0.0
        img[by0:by1, bx0:bx1] = region * (1 - mask * 0.5) + blurred * (mask * 0.5)

    # Rotation about centre (fill with background colour).
    if abs(rotation_deg) > 1e-6 or (out_w, out_h) != (width, height):
        M = cv2.getRotationMatrix2D((cx, cy), rotation_deg, 1.0)
        M[0, 2] += out_w / 2.0 - cx
        M[1, 2] += out_h / 2.0 - cy
        img = cv2.warpAffine(
            img, M, (out_w, out_h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT,
            borderValue=tuple(float(v * 0.6) for v in BACKGROUND_RGB),
        )

    if blur and blur > 0:
        img = cv2.GaussianBlur(img, (0, 0), float(blur))

    img = img * float(exposure)
    img = np.clip(img, 0, 255).astype(np.uint8)
    if return_array:
        return img
    ok, buf = cv2.imencode(".png", cv2.cvtColor(img, cv2.COLOR_RGB2BGR))
    if not ok:  # pragma: no cover
        raise RuntimeError("png encode failed")
    return buf.tobytes()


# ----------------------------------------------------------------------------
# Synthetic calibration dataset
# ----------------------------------------------------------------------------

def _forward_colour(levels: np.ndarray, rng: np.random.Generator, batch_shift: np.ndarray) -> np.ndarray:
    """Nonlinear forward colour model: levels (10,) -> RGB (10,3).

    Per-analyte gamma makes the ramp nonlinear in level; neighbouring pads
    contribute a mild cross-pad interaction (simulating reagent bleed);
    batch_shift is a per-batch RGB offset; additive sensor noise on top.
    """
    gammas = np.array([0.8, 1.3, 1.0, 1.6, 0.7, 1.2, 0.9, 1.4, 1.1, 0.85])
    out = np.zeros((10, 3), dtype=np.float64)
    for i, key in enumerate(ANALYTE_KEYS):
        t = float(np.clip(levels[i], 0, 1)) ** gammas[i]
        base = demo_color(key, t)
        # cross-pad interaction: neighbour's colour bleeds ~4%
        if i > 0:
            base = base * 0.96 + demo_color(ANALYTE_KEYS[i - 1], levels[i - 1]) * 0.04
        if i < 9:
            base = base * 0.97 + demo_color(ANALYTE_KEYS[i + 1], levels[i + 1]) * 0.03
        out[i] = base + batch_shift + rng.normal(0, 2.0, size=3)
    return np.clip(out, 0, 255)


def rgb_to_lab(rgb: np.ndarray) -> np.ndarray:
    """rgb (N,3) 0..255 -> CIELAB (N,3) via OpenCV float conversion (L 0..100)."""
    arr = (np.asarray(rgb, dtype=np.float32) / 255.0).reshape(-1, 1, 3)
    lab = cv2.cvtColor(arr, cv2.COLOR_RGB2LAB).reshape(-1, 3)
    return lab.astype(np.float64)


def synthetic_dataset(n: int = 240, seed: int = 1) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    batches = ["SYN-B01", "SYN-B02", "SYN-B03"]
    batch_shifts = {b: rng.normal(0, 3.0, size=3) for b in batches}
    rows = []
    for i in range(n):
        batch = batches[i % 3]
        levels = rng.uniform(0.0, 1.0, size=10)
        rgb = _forward_colour(levels, rng, batch_shifts[batch])
        lab = rgb_to_lab(rgb)
        row = {
            "sample_id": f"SYN-{seed:02d}-{i + 1:04d}",
            "strip_product": "SYN-10P",
            "batch": batch,
            "synthetic": True,
            "split": "test" if rng.uniform() < 0.25 else "train",
        }
        for p in range(10):
            pid = f"p{p + 1:02d}"
            row[f"{pid}_r"] = round(float(rgb[p, 0]), 3)
            row[f"{pid}_g"] = round(float(rgb[p, 1]), 3)
            row[f"{pid}_b"] = round(float(rgb[p, 2]), 3)
        for p in range(10):
            pid = f"p{p + 1:02d}"
            row[f"{pid}_l"] = round(float(lab[p, 0]), 3)
            row[f"{pid}_a"] = round(float(lab[p, 1]), 3)
            row[f"{pid}_bb"] = round(float(lab[p, 2]), 3)
        for p, key in enumerate(ANALYTE_KEYS):
            lo, hi = ANALYTE_SPANS[key]
            val = lo + float(levels[p]) * (hi - lo)
            if key == "nitrite":
                val = 1.0 if levels[p] >= 0.5 else 0.0
            row[f"ref_{key}"] = round(val, 4)
        rows.append(row)
    return pd.DataFrame(rows)
