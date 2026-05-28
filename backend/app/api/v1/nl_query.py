"""POST /api/v1/nl-query — natural-language → safe SELECT → JSON rows."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.limiter import limiter
from app.log import get_logger
from app.services.nl_to_sql import NLQueryError, run_nl_query

router = APIRouter()
log = get_logger("api.nl_query")


class NLQueryRequest(BaseModel):
    question: str = Field(min_length=3, max_length=1000)
    model:    str | None = None


@router.post("/nl-query")
@limiter.limit("20/minute")
async def nl_query(
    request: Request,
    body: NLQueryRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await run_nl_query(body.question, db, model=body.model)
    except NLQueryError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except Exception as e:
        # Don't let unexpected errors fall through to the global 500 handler —
        # surface the real cause so the operator can see what actually broke.
        log.exception("nl_query_unhandled question=%r", body.question[:200])
        raise HTTPException(status_code=502, detail=f"NL-query failed: {type(e).__name__}: {e}") from e
    return {
        "sql":        result.sql,
        "rows":       result.rows,
        "row_count":  result.row_count,
        "columns":    result.columns,
        "elapsed_ms": result.elapsed_ms,
        "warnings":   result.warnings,
    }
