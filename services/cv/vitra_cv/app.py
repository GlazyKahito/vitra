"""Starlette HTTP layer implementing docs/cv-service-contract.md.

(fastapi is intentionally not used: see BUILD-CONTEXT.md.)
"""
from __future__ import annotations

import json
import os
from typing import Any, Dict, List, Optional

import cv2
from pydantic import BaseModel, Field, ValidationError
from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.routing import Route

from . import PIPELINE_VERSION, VERSION
from .calibration import CalibrationError, infer, list_models, train, validate_dataset
from .config import ConfigError, parse_config
from .pipeline import MAX_BYTES, PipelineError, analyze
from .synthetic import render_strip

STATUS_BY_CODE = {
    "unsupported_format": 415,
    "decode_failed": 422,
    "file_too_large": 413,
    "invalid_config": 400,
    "invalid_dataset": 422,
    "insufficient_data": 422,
    "model_not_found": 404,
    "feature_mismatch": 422,
    "unauthorized": 401,
}


def error(code: str, message: str, status: Optional[int] = None) -> JSONResponse:
    return JSONResponse({"error": {"code": code, "message": message}}, status_code=status or STATUS_BY_CODE.get(code, 400))


class TokenMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        token = os.environ.get("CV_SERVICE_TOKEN", "")
        if token and request.url.path != "/health":
            if request.headers.get("x-vitra-service-token", "") != token:
                return error("unauthorized", "missing or invalid X-Vitra-Service-Token")
        return await call_next(request)


async def _json_body(request: Request) -> Dict[str, Any]:
    try:
        body = await request.json()
    except Exception:
        raise PipelineError("invalid_config", "request body must be JSON", 400)
    if not isinstance(body, dict):
        raise PipelineError("invalid_config", "request body must be a JSON object", 400)
    return body


async def health(request: Request) -> JSONResponse:
    try:
        n_models = len(list_models())
    except Exception:
        n_models = 0
    return JSONResponse({
        "status": "ok",
        "service": "vitra-cv",
        "version": VERSION,
        "pipeline_version": PIPELINE_VERSION,
        "opencv_version": cv2.__version__,
        "models_loaded": n_models,
    })


async def analyze_route(request: Request) -> Response:
    content_length = request.headers.get("content-length")
    if content_length and content_length.isdigit() and int(content_length) > MAX_BYTES + 64 * 1024:
        return error("file_too_large", f"request exceeds {MAX_BYTES} bytes")
    try:
        form = await request.form()
    except Exception:
        return error("unsupported_format", "expected multipart/form-data with a `file` field")
    upload = form.get("file")
    if upload is None or not hasattr(upload, "read"):
        return error("unsupported_format", "missing `file` field")
    data = await upload.read()
    try:
        await upload.close()
    except Exception:
        pass
    if len(data) > MAX_BYTES:
        return error("file_too_large", f"file exceeds {MAX_BYTES} bytes")
    raw_cfg = form.get("config")
    try:
        cfg = parse_config(raw_cfg if isinstance(raw_cfg, str) else None)
    except ConfigError as e:
        return error("invalid_config", str(e))
    try:
        result = analyze(data, cfg)
    except PipelineError as e:
        return error(e.code, e.message, e.status)
    return JSONResponse(result)


class ValidateRequest(BaseModel):
    csv_text: str
    pad_count: int = Field(default=10, ge=1, le=32)


class TrainRequest(BaseModel):
    csv_text: str
    analyte: str
    unit: Optional[str] = None
    model_type: str = "poly2_ridge"
    feature_set: str = "rgb30"
    pad_index: Optional[int] = None
    test_fraction: float = Field(default=0.25, gt=0.0, lt=0.9)
    seed: int = 42
    model_version: Optional[str] = None


class InferRequest(BaseModel):
    model_id: str
    rgb_30: Optional[List[float]] = None
    lab_30: Optional[List[float]] = None


class SyntheticRequest(BaseModel):
    seed: int = 7
    levels: Dict[str, float] = Field(default_factory=dict)
    width: int = Field(default=1600, ge=64, le=6000)
    height: int = Field(default=600, ge=64, le=6000)
    rotation_deg: float = 0.0
    blur: float = Field(default=0.0, ge=0.0, le=50.0)
    exposure: float = Field(default=1.0, gt=0.0, le=5.0)


def _parse(model, body):
    try:
        return model.model_validate(body)
    except ValidationError as e:
        raise PipelineError("invalid_config", e.errors()[0].get("msg", "invalid request") + f" ({e.errors()[0].get('loc')})", 400)


async def validate_route(request: Request) -> Response:
    try:
        req = _parse(ValidateRequest, await _json_body(request))
        return JSONResponse(validate_dataset(req.csv_text, req.pad_count))
    except (PipelineError, CalibrationError) as e:
        return error(e.code, e.message, e.status)


async def train_route(request: Request) -> Response:
    try:
        req = _parse(TrainRequest, await _json_body(request))
        return JSONResponse(train(req.csv_text, req.analyte, req.unit, req.model_type, req.feature_set,
                                  req.pad_index, req.test_fraction, req.seed, req.model_version))
    except (PipelineError, CalibrationError) as e:
        return error(e.code, e.message, e.status)


async def infer_route(request: Request) -> Response:
    try:
        req = _parse(InferRequest, await _json_body(request))
        return JSONResponse(infer(req.model_id, req.rgb_30, req.lab_30))
    except (PipelineError, CalibrationError) as e:
        return error(e.code, e.message, e.status)


async def synthetic_route(request: Request) -> Response:
    try:
        req = _parse(SyntheticRequest, await _json_body(request))
    except PipelineError as e:
        return error(e.code, e.message, e.status)
    png = render_strip(req.seed, req.levels, req.width, req.height, req.rotation_deg, req.blur, req.exposure)
    return Response(png, media_type="image/png", headers={"X-Vitra-Synthetic": "true"})


def create_app() -> Starlette:
    routes = [
        Route("/health", health, methods=["GET"]),
        Route("/v1/analyze", analyze_route, methods=["POST"]),
        Route("/v1/calibration/validate", validate_route, methods=["POST"]),
        Route("/v1/calibration/train", train_route, methods=["POST"]),
        Route("/v1/infer", infer_route, methods=["POST"]),
        Route("/v1/synthetic/strip", synthetic_route, methods=["POST"]),
    ]
    return Starlette(routes=routes, middleware=[Middleware(TokenMiddleware)])


app = create_app()
