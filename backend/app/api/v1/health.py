from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.db.session import get_db
from app.config import settings
from app.llm.ollama import check_ollama_health
from app.log import get_logger

router = APIRouter()
log = get_logger("api.health")


@router.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    db_ok = False
    try:
        await db.execute(text("SELECT 1"))
        db_ok = True
    except Exception as e:
        log.warning("mysql_ping_failed host=%s port=%s err=%s", settings.DB_HOST, settings.DB_PORT, e)

    ollama_ok, models = await check_ollama_health()

    return {
        "status": "ok" if (db_ok and ollama_ok) else "degraded",
        "db": {"connected": db_ok, "host": settings.DB_HOST, "port": settings.DB_PORT},
        "ollama": {
            "connected": ollama_ok,
            "host": settings.OLLAMA_HOST,
            "default_model": settings.OLLAMA_DEFAULT_MODEL,
            "available_models": models,
        },
    }
