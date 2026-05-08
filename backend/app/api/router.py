from fastapi import APIRouter
from app.api.endpoints import health, analyzer

router = APIRouter()

router.include_router(health.router, tags=["Health"])
router.include_router(analyzer.router, tags=["AI Analyzer"])
