"""On-prem vision analysis via Ollama (llama3.2-vision by default).

Takes a base64-encoded image and an optional reference image and returns
a structured JSON verdict describing what's in the scene and (if a
reference is provided) the most material differences. Useful for plant
photo audits, gauge reads, dirty-coil checks, and similar visual ops.

Strictly on-prem — the only outbound call is to the configured Ollama
host (typically a server in the same LAN as the platform). No SaaS
calls, no cloud APIs.
"""
from __future__ import annotations

import asyncio
import base64
import json
import re
from dataclasses import dataclass, field
from typing import Any

import httpx

from app.config import settings
from app.log import get_logger

log = get_logger("services.vision")

_VISION_TIMEOUT_S    = 90.0
_VISION_TEMPERATURE  = 0.1
_MAX_IMAGE_BYTES     = 6 * 1024 * 1024  # 6 MiB hard cap

_DEFAULT_VISION_MODEL = "llama3.2-vision"


@dataclass
class VisionResult:
    model:          str
    description:    str
    differences:    list[str] = field(default_factory=list)
    findings:       list[str] = field(default_factory=list)
    severity:       str       = "info"
    raw:            str       = ""
    elapsed_ms:     int       = 0


class VisionError(Exception):
    pass


_SCENE_PROMPT = """You are an HVAC plant inspector reviewing a single photograph.

Return a JSON object with this exact shape:
{
  "description":  "1-2 sentence operator-facing description of what is in the photo",
  "findings":     ["each notable thing you see, one item per array entry"],
  "severity":     "info" | "warning" | "critical"
}

Rules:
  * Severity is "critical" if anything looks dangerous (leak, fire risk, broken guard).
  * "warning" if it looks like a maintenance issue (corrosion, dirt build-up, frost).
  * Otherwise "info".
  * No prose outside the JSON.
"""


_COMPARE_PROMPT = """You are an HVAC plant inspector. You are shown TWO photographs of the
same equipment — image 1 is the REFERENCE (known good baseline), image 2 is the CURRENT state.

Return a JSON object with this exact shape:
{
  "description":  "1 sentence stating what the equipment is",
  "differences":  ["each material difference between the two images, one per entry"],
  "findings":     ["concrete things visible in the CURRENT image worth flagging"],
  "severity":     "info" | "warning" | "critical"
}

Rules:
  * Only flag DIFFERENCES that are visible in the photos (no speculation).
  * "critical" if the difference indicates an emerging hazard.
  * "warning" for cleanliness / wear / minor degradation.
  * "info" if no material differences exist.
  * No prose outside the JSON.
"""


def _parse_vision_json(raw: str) -> dict[str, Any] | None:
    if not raw:
        return None
    s = raw.strip()
    if s.startswith("```"):
        s = re.sub(r"^```(?:json)?\n?", "", s, flags=re.IGNORECASE)
        s = re.sub(r"```\s*$", "", s)
    start = s.find("{")
    if start < 0:
        return None
    depth = 0
    for i in range(start, len(s)):
        if s[i] == "{": depth += 1
        elif s[i] == "}":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(s[start:i + 1])
                except json.JSONDecodeError:
                    return None
    return None


def _validate_image(b64: str) -> str:
    """Strip data: prefix, validate size."""
    s = b64.strip()
    if s.startswith("data:"):
        comma = s.find(",")
        if comma >= 0:
            s = s[comma + 1:]
    try:
        raw = base64.b64decode(s, validate=False)
    except Exception as exc:
        raise VisionError("Image is not valid base64.") from exc
    if len(raw) == 0:
        raise VisionError("Image is empty.")
    if len(raw) > _MAX_IMAGE_BYTES:
        raise VisionError(f"Image exceeds {_MAX_IMAGE_BYTES // (1024 * 1024)} MiB limit.")
    return s


async def _ollama_vision_call(model: str, prompt: str, images: list[str]) -> str:
    url = f"{settings.OLLAMA_HOST.rstrip('/')}/api/generate"
    body = {
        "model":   model,
        "prompt":  prompt,
        "images":  images,
        "stream":  False,
        "format":  "json",
        "options": {"temperature": _VISION_TEMPERATURE},
    }
    async with httpx.AsyncClient(timeout=_VISION_TIMEOUT_S) as client:
        r = await client.post(url, json=body)
        r.raise_for_status()
        data = r.json()
        return data.get("response", "")


async def describe_scene(image_b64: str, *, model: str | None = None) -> VisionResult:
    img      = _validate_image(image_b64)
    used     = model or getattr(settings, "OLLAMA_VISION_MODEL", None) or _DEFAULT_VISION_MODEL
    started  = asyncio.get_event_loop().time()
    try:
        raw = await asyncio.wait_for(
            _ollama_vision_call(used, _SCENE_PROMPT, [img]),
            timeout=_VISION_TIMEOUT_S,
        )
    except asyncio.TimeoutError as exc:
        raise VisionError("Vision model timed out.") from exc
    except httpx.HTTPError as exc:
        raise VisionError(f"Vision model error: {exc}") from exc

    elapsed = int((asyncio.get_event_loop().time() - started) * 1000)
    parsed  = _parse_vision_json(raw) or {}
    return VisionResult(
        model       = used,
        description = parsed.get("description", "(no description)") or "(no description)",
        findings    = list(parsed.get("findings") or []),
        severity    = parsed.get("severity", "info") or "info",
        raw         = raw,
        elapsed_ms  = elapsed,
    )


async def compare_images(
    reference_b64: str,
    current_b64:   str,
    *,
    model: str | None = None,
) -> VisionResult:
    ref     = _validate_image(reference_b64)
    cur     = _validate_image(current_b64)
    used    = model or getattr(settings, "OLLAMA_VISION_MODEL", None) or _DEFAULT_VISION_MODEL
    started = asyncio.get_event_loop().time()
    try:
        raw = await asyncio.wait_for(
            _ollama_vision_call(used, _COMPARE_PROMPT, [ref, cur]),
            timeout=_VISION_TIMEOUT_S,
        )
    except asyncio.TimeoutError as exc:
        raise VisionError("Vision model timed out comparing images.") from exc
    except httpx.HTTPError as exc:
        raise VisionError(f"Vision model error: {exc}") from exc

    elapsed = int((asyncio.get_event_loop().time() - started) * 1000)
    parsed  = _parse_vision_json(raw) or {}
    return VisionResult(
        model       = used,
        description = parsed.get("description", "(no description)") or "(no description)",
        differences = list(parsed.get("differences") or []),
        findings    = list(parsed.get("findings") or []),
        severity    = parsed.get("severity", "info") or "info",
        raw         = raw,
        elapsed_ms  = elapsed,
    )
