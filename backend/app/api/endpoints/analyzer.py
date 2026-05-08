from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.services.db_service import fetch_all_hvac_context, compute_summary
from app.llm.ollama_client import generate
from app.prompts.hvac_prompts import build_analyze_prompt

router = APIRouter()


class AnalyzeRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=2000)
    hours: int = Field(default=24, ge=1, le=168)
    model: str | None = None


class AnalyzeResponse(BaseModel):
    answer: str
    model_used: str
    data_window_hours: int
    summary: dict


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(request: AnalyzeRequest, db: AsyncSession = Depends(get_db)):
    try:
        context = await fetch_all_hvac_context(db, hours=request.hours)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database error: {str(e)}")

    summary = await compute_summary(context)
    prompt = build_analyze_prompt(request.question, context, summary)

    try:
        answer = await generate(prompt, model=request.model)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"LLM error: {str(e)}")

    from app.db.session import settings
    return AnalyzeResponse(
        answer=answer,
        model_used=request.model or settings.OLLAMA_MODEL,
        data_window_hours=request.hours,
        summary=summary,
    )


@router.get("/tables")
async def list_tables(db: AsyncSession = Depends(get_db)):
    from sqlalchemy import text
    result = await db.execute(text("SHOW TABLES"))
    tables = [row[0] for row in result.fetchall()]
    return {"tables": tables, "count": len(tables)}


@router.get("/equipment/latest")
async def get_latest_equipment(hours: int = 24, db: AsyncSession = Depends(get_db)):
    try:
        context = await fetch_all_hvac_context(db, hours=hours)
        summary = await compute_summary(context)
        return {"summary": summary, "hours_window": hours}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database error: {str(e)}")
