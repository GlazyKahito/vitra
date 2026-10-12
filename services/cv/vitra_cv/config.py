"""Pydantic models for the analyze config (see docs/cv-service-contract.md)."""
from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field, ValidationError, model_validator

ANALYTE_KEYS: List[str] = [
    "glucose",
    "protein",
    "ph",
    "ketones",
    "blood",
    "bilirubin",
    "urobilinogen",
    "nitrite",
    "leucocytes",
    "specific_gravity",
]

# Demo colour ramps copied verbatim from apps/web/lib/analytes.ts (low -> high).
# SYNTHETIC ONLY: used for rendering fixtures and demo graphics.
DEMO_RAMPS = {
    "glucose": ("#7ec8c0", "#8fae4e", "#7a5a2c"),
    "protein": ("#e9e27a", "#b9cf72", "#5f9e8e"),
    "ph": ("#e8823c", "#c8b84a", "#2f6f8f"),
    "ketones": ("#e7c9a8", "#c9798a", "#6b2a4a"),
    "blood": ("#e7c45a", "#8fae5a", "#2e5a3a"),
    "bilirubin": ("#f1e3c4", "#dcb8a0", "#b5847e"),
    "urobilinogen": ("#f3d3b5", "#eaa58e", "#d16a6a"),
    "nitrite": ("#f5efe4", "#f0bfc8", "#d97a96"),
    "leucocytes": ("#f1ebd6", "#c9b9c9", "#7b5e8e"),
    "specific_gravity": ("#2e5f6e", "#5f8a5a", "#b9a04a"),
}

# Plausible numeric span per analyte, in its unit (from analytes.ts `span`).
ANALYTE_SPANS = {
    "glucose": (0.0, 2000.0),
    "protein": (0.0, 2000.0),
    "ph": (5.0, 9.0),
    "ketones": (0.0, 160.0),
    "blood": (0.0, 250.0),
    "bilirubin": (0.0, 6.0),
    "urobilinogen": (0.0, 12.0),
    "nitrite": (0.0, 1.0),
    "leucocytes": (0.0, 500.0),
    "specific_gravity": (1.0, 1.035),
}

ANALYTE_UNITS = {
    "glucose": "mg/dL",
    "protein": "mg/dL",
    "ph": "pH",
    "ketones": "mg/dL",
    "blood": "Ery/µL",
    "bilirubin": "mg/dL",
    "urobilinogen": "mg/dL",
    "nitrite": "qualitative",
    "leucocytes": "Leu/µL",
    "specific_gravity": "SG",
}


class Geometry(BaseModel):
    mode: Literal["auto", "fixed"] = "auto"
    pad_centers: Optional[List[float]] = None
    pad_size: float = Field(default=0.62, gt=0.05, le=1.0)
    roi_inset: float = Field(default=0.18, ge=0.0, lt=0.5)

    @model_validator(mode="after")
    def _check_centers(self) -> "Geometry":
        if self.pad_centers is not None:
            for c in self.pad_centers:
                if not (0.0 <= c <= 1.0):
                    raise ValueError("pad_centers must be normalised to 0..1")
            if sorted(self.pad_centers) != list(self.pad_centers):
                raise ValueError("pad_centers must be ascending")
        return self


class PadConfig(BaseModel):
    pad_count: int = Field(default=10, ge=1, le=32)
    pad_map: List[str] = Field(default_factory=lambda: list(ANALYTE_KEYS))
    geometry: Geometry = Field(default_factory=Geometry)
    min_width: int = Field(default=640, ge=64)
    min_height: int = Field(default=200, ge=32)
    handle_side: Literal["left", "right", "auto"] = "auto"

    @model_validator(mode="after")
    def _check_lengths(self) -> "PadConfig":
        if len(self.pad_map) != self.pad_count:
            raise ValueError(f"pad_map length {len(self.pad_map)} != pad_count {self.pad_count}")
        if self.geometry.pad_centers is not None and len(self.geometry.pad_centers) != self.pad_count:
            raise ValueError("geometry.pad_centers length must equal pad_count")
        return self


class ConfigError(ValueError):
    code = "invalid_config"


def parse_config(raw: Optional[str]) -> PadConfig:
    """Parse the optional multipart `config` JSON string. Raises ConfigError."""
    if raw is None or raw.strip() == "":
        return PadConfig()
    try:
        return PadConfig.model_validate_json(raw)
    except ValidationError as e:  # pragma: no cover - message formatting
        raise ConfigError(str(e)) from e
    except ValueError as e:
        raise ConfigError(str(e)) from e
