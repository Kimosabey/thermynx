from fastapi import APIRouter
from app.api.v1 import health, equipment, timeseries, analyzer, efficiency, anomalies, agent, forecast, compare

router = APIRouter()
router.include_router(health.router,     tags=["Health"])
router.include_router(equipment.router,  tags=["Equipment"])
router.include_router(timeseries.router, tags=["Timeseries"])
router.include_router(analyzer.router,   tags=["AI Analyzer"])
router.include_router(efficiency.router, tags=["Efficiency"])
router.include_router(anomalies.router,  tags=["Anomalies"])
router.include_router(agent.router,      tags=["AI Agents"])
router.include_router(forecast.router,   tags=["Forecast"])
router.include_router(compare.router,    tags=["Compare"])
