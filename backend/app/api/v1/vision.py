"""POST /api/v1/vision/* — on-prem vision analysis endpoints."""
from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from app.limiter import limiter
from app.services.vision import VisionError, compare_images, describe_scene

router = APIRouter()


class DescribeRequest(BaseModel):
    image: str = Field(min_length=10, description="Base64-encoded image (with or without data: prefix)")
    model: str | None = None


class CompareRequest(BaseModel):
    reference: str = Field(min_length=10)
    current:   str = Field(min_length=10)
    model:     str | None = None


@router.post("/vision/describe")
@limiter.limit("12/minute")
async def vision_describe(request: Request, body: DescribeRequest):
    try:
        result = await describe_scene(body.image, model=body.model)
    except VisionError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    payload = asdict(result)
    payload.pop("raw", None)
    return payload


@router.post("/vision/compare")
@limiter.limit("8/minute")
async def vision_compare(request: Request, body: CompareRequest):
    try:
        result = await compare_images(body.reference, body.current, model=body.model)
    except VisionError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    payload = asdict(result)
    payload.pop("raw", None)
    return payload
