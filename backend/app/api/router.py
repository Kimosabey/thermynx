from fastapi import APIRouter
from app.api.v1 import (
    health,
    equipment,
    timeseries,
    analyzer,
    efficiency,
    anomalies,
    agent,
    forecast,
    compare,
    maintenance,
    cost,
    cooling_tower,
    reports,
    threads,
)

router = APIRouter()
router.include_router(health.router,       tags=["Health"])
router.include_router(equipment.router,    tags=["Equipment"])
router.include_router(timeseries.router,   tags=["Timeseries"])
router.include_router(analyzer.router,     tags=["AI Analyzer"])
router.include_router(efficiency.router,   tags=["Efficiency"])
router.include_router(anomalies.router,    tags=["Anomalies"])
router.include_router(agent.router,        tags=["AI Agents"])
router.include_router(forecast.router,     tags=["Forecast"])
router.include_router(compare.router,      tags=["Compare"])
router.include_router(maintenance.router,  tags=["Predictive Maintenance"])
router.include_router(cost.router,         tags=["Cost Analytics"])
router.include_router(cooling_tower.router, tags=["Cooling Tower Optimizer"])
router.include_router(reports.router,      tags=["Reports"])
router.include_router(threads.router,      tags=["Threads"])
