"""Technicians directory + LLM-assisted assignment suggestion."""
from __future__ import annotations

import asyncio
import json
import re

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models import Technician, WorkOrder
from app.db.session import get_pg
from app.limiter import limiter
from app.log import get_logger

router = APIRouter()
log = get_logger("api.technicians")

_SUGGEST_TIMEOUT_S = 18.0


def _serialise(t: Technician) -> dict:
    return {
        "id":               t.id,
        "name":             t.name,
        "email":            t.email,
        "skills":           [s.strip() for s in (t.skills or "").split(",") if s.strip()],
        "location":         t.location,
        "active":           bool(t.active),
        "success_rate":     t.success_rate,
        "open_assignments": t.open_assignments or 0,
        "notes":            t.notes,
        "created_at":       t.created_at.isoformat() if t.created_at else None,
    }


@router.get("/technicians")
@limiter.limit("60/minute")
async def list_technicians(
    request: Request,
    only_active: bool = True,
    pg: AsyncSession = Depends(get_pg),
):
    stmt = select(Technician).order_by(Technician.name.asc())
    if only_active:
        stmt = stmt.where(Technician.active == 1)
    rows = (await pg.execute(stmt)).scalars().all()
    return {"technicians": [_serialise(t) for t in rows]}


class SuggestRequest(BaseModel):
    work_order_id: str
    top_k:         int = 3


def _parse_json(raw: str) -> list | None:
    if not raw: return None
    s = raw.strip()
    if s.startswith("```"):
        s = re.sub(r"^```(?:json)?\n?", "", s, flags=re.IGNORECASE)
        s = re.sub(r"```\s*$", "", s)
    # First [...] span
    start = s.find("[")
    if start < 0: return None
    depth = 0
    for i in range(start, len(s)):
        if s[i] == "[": depth += 1
        elif s[i] == "]":
            depth -= 1
            if depth == 0:
                try: return json.loads(s[start:i + 1])
                except Exception: return None
    return None


@router.post("/technicians/suggest")
@limiter.limit("30/minute")
async def suggest_technician(
    request: Request,
    body: SuggestRequest,
    pg: AsyncSession = Depends(get_pg),
):
    wo = await pg.get(WorkOrder, body.work_order_id)
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")

    techs = (await pg.execute(select(Technician).where(Technician.active == 1))).scalars().all()
    if not techs:
        return {"suggestions": [], "note": "No active technicians configured."}

    # Build LLM context — keep it small
    tech_block = [
        {
            "id": t.id,
            "name": t.name,
            "skills": [s.strip() for s in (t.skills or "").split(",") if s.strip()],
            "location": t.location,
            "open_assignments": t.open_assignments or 0,
            "success_rate": t.success_rate,
        }
        for t in techs
    ]

    wo_block = {
        "equipment_id":         wo.equipment_id,
        "title":                wo.title,
        "description":          wo.description,
        "diagnosis":            wo.diagnosis,
        "recommended_actions":  wo.recommended_actions,
        "priority":             wo.priority,
    }

    prompt = (
        "You are an HVAC maintenance dispatcher.\n"
        "Given a work order and a list of technicians, rank the best matches.\n"
        "Consider: skill overlap with the work order's required skills, current\n"
        "load (lower open_assignments is better), past success_rate, and\n"
        "location proximity if mentioned.\n\n"
        "Return ONLY a JSON array of objects, at most 5 entries, ordered best\n"
        "first. Each entry MUST have exactly these keys:\n"
        '  { "technician_id": "...", "score": 0.0-1.0, "reason": "one sentence" }\n\n'
        f"WORK ORDER:\n{json.dumps(wo_block, default=str)}\n\n"
        f"TECHNICIANS:\n{json.dumps(tech_block, default=str)}\n\n"
        "Return the JSON array now."
    )

    used = settings.OLLAMA_DEFAULT_MODEL
    try:
        async with httpx.AsyncClient(timeout=_SUGGEST_TIMEOUT_S) as client:
            r = await client.post(
                f"{settings.OLLAMA_HOST.rstrip('/')}/api/generate",
                json={"model": used, "prompt": prompt, "stream": False, "format": "json", "options": {"temperature": 0.0}},
            )
            r.raise_for_status()
            raw = r.json().get("response", "")
    except (httpx.HTTPError, asyncio.TimeoutError) as exc:
        log.warning("technician_suggest_llm_failed err=%s", exc)
        raw = ""

    parsed = _parse_json(raw) or []
    # Build the suggestions list, hydrating with the actual technician records.
    tech_by_id = {t.id: t for t in techs}
    suggestions = []
    for entry in parsed[:body.top_k]:
        tid = entry.get("technician_id") if isinstance(entry, dict) else None
        if not tid or tid not in tech_by_id:
            continue
        suggestions.append({
            "technician": _serialise(tech_by_id[tid]),
            "score":  float(entry.get("score", 0)) if isinstance(entry.get("score"), (int, float)) else None,
            "reason": str(entry.get("reason", ""))[:300] if entry.get("reason") else "",
        })

    # LLM fallback — if the model failed, do a deterministic skill-overlap score.
    if not suggestions:
        terms = " ".join([wo.title or "", wo.description or "", wo.diagnosis or "",
                          wo.recommended_actions or "", wo.equipment_id or ""]).lower()
        ranked = []
        for t in techs:
            skills = [s.strip().lower() for s in (t.skills or "").split(",") if s.strip()]
            overlap = sum(1 for s in skills if s and s in terms)
            load_penalty = -(t.open_assignments or 0) * 0.1
            score = round(0.6 * (overlap / max(1, len(skills))) + 0.3 * (t.success_rate or 0) + load_penalty, 3)
            ranked.append((score, t, overlap))
        ranked.sort(key=lambda r: r[0], reverse=True)
        for score, t, overlap in ranked[:body.top_k]:
            suggestions.append({
                "technician": _serialise(t),
                "score":      max(0, score),
                "reason":     f"Heuristic fallback — {overlap} matching skill(s), {t.open_assignments or 0} open assignments.",
            })

    return {
        "suggestions": suggestions,
        "model":       used,
        "fallback":    bool(not parsed),
    }
