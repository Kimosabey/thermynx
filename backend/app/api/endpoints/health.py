from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.services.db_service import check_db_health
from app.llm.ollama_client import check_ollama_health
from app.db.session import settings

router = APIRouter()


@router.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    db_ok = await check_db_health(db)
    ollama_ok, models = await check_ollama_health()

    return {
        "status": "healthy" if (db_ok and ollama_ok) else "degraded",
        "database": {
            "connected": db_ok,
            "host": settings.DB_HOST,
            "port": settings.DB_PORT,
            "name": settings.DB_NAME,
        },
        "ollama": {
            "connected": ollama_ok,
            "host": settings.OLLAMA_HOST,
            "active_model": settings.OLLAMA_MODEL,
            "available_models": models,
        },
    }
