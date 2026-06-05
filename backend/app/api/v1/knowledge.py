"""Past Fixes (tribal knowledge) API.

  GET  /knowledge/incidents  — recent captured fixes (default page view)
  POST /knowledge/search     — semantic search over past fixes
  POST /knowledge/capture    — manually record a fix (seed / capture outside a WO)

Past fixes are `incident` rows in the same embeddings table as the manuals, so
they also flow automatically into the agent's search_knowledge_base tool.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai import knowledge
from app.db.session import get_pg
from app.limiter import limiter

router = APIRouter()


class IncidentSearch(BaseModel):
    query:        str = Field(min_length=3, max_length=2000)
    equipment_id: str | None = None
    top_k:        int = Field(default=5, ge=1, le=20)


class IncidentCapture(BaseModel):
    content:      str = Field(min_length=3, max_length=8000)
    title:        str = Field(min_length=3, max_length=120)
    equipment_id: str | None = None


@router.get("/knowledge/incidents")
@limiter.limit("60/minute")
async def list_incidents(
    request: Request,
    limit:        int = Query(default=25, ge=1, le=100),
    equipment_id: str | None = Query(default=None),
    pg: AsyncSession = Depends(get_pg),
):
    rows = await knowledge.list_incidents(pg, limit=limit, equipment_id=equipment_id)
    return {"incidents": rows, "total": len(rows)}


@router.post("/knowledge/search")
@limiter.limit("30/minute")
async def search_incidents(
    request: Request,
    body: IncidentSearch,
    pg: AsyncSession = Depends(get_pg),
):
    rows = await knowledge.search_incidents(
        pg, body.query, top_k=body.top_k, equipment_id=body.equipment_id
    )
    return {"results": rows, "total": len(rows)}


@router.post("/knowledge/capture")
@limiter.limit("30/minute")
async def capture_incident(
    request: Request,
    body: IncidentCapture,
    pg: AsyncSession = Depends(get_pg),
):
    ok = await knowledge.capture_incident(
        pg,
        content=body.content,
        source_id=f"Manual · {body.title}",
        equipment_id=body.equipment_id,
    )
    if not ok:
        raise HTTPException(status_code=503, detail="Could not embed the fix (embedding model unavailable).")
    return {"captured": True}
