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
    digest,
    knowledge,
    optimizer,
    predictive,
    threads,
    rag,
    capabilities,
    alarms,
    audit,
    nl_query,
    vision,
    causal,
    topology,
    slack,
    work_orders,
    technicians,
    assets,
    energy,
    ibms_alarms,
    vendors,
    inventory,
    purchase_orders,
)

router = APIRouter()
router.include_router(health.router,        tags=["Health"])
router.include_router(equipment.router,     tags=["Equipment"])
router.include_router(timeseries.router,    tags=["Timeseries"])
router.include_router(analyzer.router,      tags=["AI Analyzer"])
router.include_router(efficiency.router,    tags=["Efficiency"])
router.include_router(anomalies.router,     tags=["Anomalies"])
router.include_router(agent.router,         tags=["AI Agents"])
router.include_router(forecast.router,      tags=["Forecast"])
router.include_router(compare.router,       tags=["Compare"])
router.include_router(maintenance.router,   tags=["Predictive Maintenance"])
router.include_router(cost.router,          tags=["Cost Analytics"])
router.include_router(cooling_tower.router, tags=["Cooling Tower Optimizer"])
router.include_router(reports.router,       tags=["Reports"])
router.include_router(digest.router,         tags=["Daily Digest"])
router.include_router(knowledge.router,      tags=["Past Fixes"])
router.include_router(optimizer.router,      tags=["Energy Optimizer"])
router.include_router(predictive.router,     tags=["Predictive Maintenance"])
router.include_router(threads.router,       tags=["Threads"])
router.include_router(rag.router,           tags=["RAG"])
router.include_router(capabilities.router,  tags=["Capabilities"])
router.include_router(alarms.router,        tags=["Alarms"])
router.include_router(audit.router,         tags=["Audit Log"])
router.include_router(nl_query.router,      tags=["NL Query"])
router.include_router(vision.router,        tags=["Vision"])
router.include_router(causal.router,        tags=["Causal Explanations"])
router.include_router(topology.router,      tags=["Topology"])
router.include_router(slack.router,         tags=["Slack"])
router.include_router(work_orders.router,   tags=["Work Orders"])
router.include_router(technicians.router,   tags=["Technicians"])
router.include_router(assets.router,        tags=["Asset Registry"])
router.include_router(energy.router,        tags=["Energy Management"])
router.include_router(ibms_alarms.router,   tags=["IBMS Alarms"])
router.include_router(vendors.router,         tags=["Vendors"])
router.include_router(inventory.router,       tags=["Inventory"])
router.include_router(purchase_orders.router, tags=["Procurement"])

# Agentic (LangGraph) rewrite endpoints — guarded so the app still boots even if
# the rewrite deps (requirements-agentic.txt) aren't installed. Live endpoints unaffected.
try:
    from app.api.v1 import agentic
    router.include_router(agentic.router, tags=["Agentic (LangGraph)"])
except Exception as _agentic_exc:  # pragma: no cover
    from app.log import get_logger
    get_logger("api.router").warning("agentic router not loaded (rewrite deps missing?): %s", _agentic_exc)
