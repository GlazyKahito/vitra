"""Image quality checks. Each check -> {id,label,status,value,threshold,message}."""
from __future__ import annotations

from typing import Dict, List, Optional

import cv2
import numpy as np

from .config import PadConfig
from .localize import StripLocalisation

SUPPORTED_FORMATS = ("jpeg", "png", "webp", "bmp", "tiff")
BLUR_THRESHOLD = 55.0  # contrast-normalised var(Laplacian) on the strip crop (see blur_score)
OVEREXPOSURE_MAX = 0.02  # fraction of pixels with luminance >= 250
UNDEREXPOSURE_MAX = 0.35  # fraction of pixels with luminance <= 12 (strip region)
MEAN_LUMINANCE_MIN = 90.0  # mean luminance of the strip region
TILT_WARN_DEG = 25.0
OBSTRUCTION_MAX = 0.08


def _check(id_, label, status, value, threshold, message):
    return {"id": id_, "label": label, "status": status, "value": value, "threshold": threshold, "message": message}


def sniff_format(data: bytes) -> Optional[str]:
    if data[:3] == b"\xff\xd8\xff":
        return "jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    if data[:2] == b"BM":
        return "bmp"
    if data[:4] in (b"II*\x00", b"MM\x00*"):
        return "tiff"
    return None


def _luminance(rgb: np.ndarray) -> np.ndarray:
    f = rgb.astype(np.float32)
    return 0.2126 * f[..., 0] + 0.7152 * f[..., 1] + 0.0722 * f[..., 2]


def blur_score(strip_rgb: np.ndarray) -> float:
    """Contrast-normalised variance of the Laplacian on the strip crop.

    The crop is resized to ~800 px on its long axis so the score does not scale
    with camera resolution, and divided by the grey-level variance so a dim or
    washed-out (low-contrast) strip is not mistaken for a blurry one.
    Score = 1000 * var(Laplacian) / var(gray).
    """
    h, w = strip_rgb.shape[:2]
    scale = 800.0 / max(w, h)
    if scale < 1.0:
        strip_rgb = cv2.resize(strip_rgb, (max(8, int(w * scale)), max(8, int(h * scale))), interpolation=cv2.INTER_AREA)
    gray = cv2.cvtColor(strip_rgb, cv2.COLOR_RGB2GRAY)
    lap = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    gvar = float(gray.astype(np.float64).var())
    return 1000.0 * lap / max(gvar, 1.0)


def run_quality_checks(
    fmt: Optional[str],
    rgb: Optional[np.ndarray],
    cfg: PadConfig,
    loc: Optional[StripLocalisation],
    pads_detected: int,
    pad_statuses: List[str],
) -> Dict:
    checks: List[Dict] = []

    # format
    if fmt in SUPPORTED_FORMATS:
        checks.append(_check("format", "File format", "pass", fmt, "|".join(SUPPORTED_FORMATS), f"{fmt} accepted"))
    else:
        checks.append(_check("format", "File format", "fail", fmt or "unknown", "|".join(SUPPORTED_FORMATS), "unsupported or undetected image format"))

    if rgb is None:
        return {"passed": False, "checks": checks}

    h, w = rgb.shape[:2]
    # Orientation-agnostic: the long side must meet min_width and the short side min_height,
    # so a portrait capture of a vertical strip is not rejected.
    res_ok = max(w, h) >= cfg.min_width and min(w, h) >= cfg.min_height
    checks.append(_check("resolution", "Resolution", "pass" if res_ok else "fail", f"{w}x{h}",
                         f">= {cfg.min_width}x{cfg.min_height}",
                         "resolution sufficient" if res_ok else "image too small for reliable pad sampling"))

    # Region used for photometric checks: strip crop if found, else whole image.
    if loc is not None and loc.found and loc.rectified is not None:
        region = loc.rectified
        region_name = "strip region"
    else:
        region = rgb
        region_name = "whole image (strip not localised)"

    bs = blur_score(region)
    if bs >= BLUR_THRESHOLD:
        st, msg = "pass", f"sharp ({region_name})"
    elif bs >= BLUR_THRESHOLD * 0.8:
        st, msg = "warn", f"slightly soft focus ({region_name})"
    else:
        st, msg = "fail", f"image is blurry ({region_name}); retake with the strip in focus"
    checks.append(_check("blur", "Focus / blur", st, round(bs, 1), f">= {BLUR_THRESHOLD} (1000*varLaplacian/varGray)", msg))

    lum = _luminance(region)
    over = float(np.mean(lum >= 250))
    if over <= OVEREXPOSURE_MAX:
        st, msg = "pass", "no significant highlight clipping"
    elif over <= OVEREXPOSURE_MAX * 4:
        st, msg = "warn", "some highlight clipping on the strip"
    else:
        st, msg = "fail", "strip is overexposed; pad colours are clipped"
    checks.append(_check("overexposure", "Overexposure", st, round(over, 4), f"<= {OVEREXPOSURE_MAX} fraction >= 250", msg))

    under = float(np.mean(lum <= 12))
    mean_lum = float(lum.mean())
    if under <= UNDEREXPOSURE_MAX and mean_lum >= MEAN_LUMINANCE_MIN:
        st, msg = "pass", "exposure adequate"
    elif under <= UNDEREXPOSURE_MAX * 1.5 and mean_lum >= MEAN_LUMINANCE_MIN * 0.6:
        st, msg = "warn", "strip is dim"
    else:
        st, msg = "fail", "strip is underexposed"
    checks.append(_check("underexposure", "Underexposure", st, {"dark_fraction": round(under, 4), "mean_luminance": round(mean_lum, 1)},
                         f"dark fraction <= {UNDEREXPOSURE_MAX}, mean >= {MEAN_LUMINANCE_MIN}", msg))

    # strip visible
    if loc is not None and loc.found:
        plausible = 3.0 <= loc.aspect <= 40.0 and loc.area_fraction >= 0.01
        st = "pass" if plausible else "warn"
        checks.append(_check("strip_visible", "Strip visible", st,
                             {"aspect": round(loc.aspect, 2), "area_fraction": round(loc.area_fraction, 4)},
                             "aspect 3..40, area >= 1%", loc.message))
    else:
        checks.append(_check("strip_visible", "Strip visible", "fail", None, "strip contour found",
                             (loc.message if loc is not None else "strip not localised")))

    # orientation
    if loc is not None and loc.found:
        tilt = abs(loc.angle_deg)
        st = "pass" if tilt <= TILT_WARN_DEG else "warn"
        extra = " (long axis vertical; rectified by 90°)" if loc.rotated_90 else ""
        checks.append(_check("orientation", "Orientation", st, round(loc.angle_deg, 2), f"|tilt| <= {TILT_WARN_DEG}°",
                             ("tilt within tolerance" if st == "pass" else "strip is strongly tilted; results may be less reliable") + extra))
    else:
        checks.append(_check("orientation", "Orientation", "fail", None, f"|tilt| <= {TILT_WARN_DEG}°", "cannot assess without strip"))

    # obstruction: large foreign blobs inside the strip polygon (dark/odd regions of the plastic between pads)
    if loc is not None and loc.found and loc.rectified is not None:
        rect = loc.rectified
        H, W = rect.shape[:2]
        rl = _luminance(rect)
        # "dark" relative to the plastic (median strip luminance), so an underexposed
        # strip with dark pads is not read as obstructed.
        dark_thr = min(60.0, 0.22 * float(np.median(rl)))
        dark = (rl < dark_thr).astype(np.uint8)
        dark = cv2.morphologyEx(dark, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
        n, _, stats, _ = cv2.connectedComponentsWithStats(dark, connectivity=8)
        big = 0
        for i in range(1, n):
            a = stats[i, cv2.CC_STAT_AREA]
            if a >= 0.02 * H * W:
                big += a
        frac = float(big) / float(H * W)
        st = "pass" if frac <= OBSTRUCTION_MAX else ("warn" if frac <= OBSTRUCTION_MAX * 2 else "fail")
        checks.append(_check("obstruction", "Obstruction", st, round(frac, 4), f"<= {OBSTRUCTION_MAX} of strip area",
                             "no large foreign objects on the strip" if st == "pass" else "large dark blob(s) inside the strip outline"))
    else:
        checks.append(_check("obstruction", "Obstruction", "fail", None, f"<= {OBSTRUCTION_MAX}", "cannot assess without strip"))

    # pads visible
    n_fail = sum(1 for s in pad_statuses if s == "fail")
    if pads_detected == cfg.pad_count and n_fail == 0:
        st, msg = "pass", f"{pads_detected}/{cfg.pad_count} pads sampled"
    elif pads_detected == cfg.pad_count and n_fail <= 2:
        st, msg = "warn", f"{n_fail} pad(s) flagged"
    else:
        st, msg = "fail", f"{pads_detected}/{cfg.pad_count} pads usable ({n_fail} failed)"
    checks.append(_check("pads_visible", "Pads visible", st, pads_detected, f"== {cfg.pad_count}", msg))

    passed = all(c["status"] != "fail" for c in checks)
    return {"passed": passed, "checks": checks}
