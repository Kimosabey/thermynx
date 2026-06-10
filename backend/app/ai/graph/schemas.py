"""Pydantic I/O schemas for the agentic graph (F1.3–F1.5).

These MIRROR the *current* shapes produced/consumed by the deployed code so the
F7 cutover is parity-safe:

- ``Plan``           ← ``app/ai/multi_agent.py`` ``_plan`` output (decomposition).
- ``CritiqueVerdict``← ``app/ai/critique.py`` ``verify_answer`` output.
- tool-arg models    ← ``TOOL_SCHEMAS`` in ``app/ai/tools.py`` (the 8 HVAC tools).

Used with ``with_structured_output`` so model output is schema-valid, removing the
prose-JSON parsing in ``json_utils`` (kept as a fallback only). Model picks and the
specialist set are unchanged — this is a like-for-like port (ADR-0002).
"""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

# ─────────────────────────────────────────────────────────────────────────────
# Multi-agent planner (decomposition) — mirrors multi_agent.py
#   VALID_SPECIALISTS = ["investigator", "optimizer", "root_cause", "maintenance"]
#   _MAX_SUBTASKS = 4 · plan = {rationale, subtasks:[{specialist, goal}]}
# (Typed remediation steps {action,tool,expected_output,fallback} are a *future*
#  planner-quality option from PLANNER_IMPROVEMENT_PLAYBOOK.md — NOT this schema.)
# ─────────────────────────────────────────────────────────────────────────────
Specialist = Literal["investigator", "optimizer", "root_cause", "maintenance"]


class Subtask(BaseModel):
    specialist: Specialist
    goal: str = Field(..., min_length=1, description="What this specialist must accomplish")


class Plan(BaseModel):
    rationale: str = Field("", description="Why the question was decomposed this way")
    subtasks: list[Subtask] = Field(..., min_length=1, max_length=4)


# ─────────────────────────────────────────────────────────────────────────────
# Self-critique verdict — mirrors critique.py verify_answer()
#   {verified[], suspicious[], unverified[], overall, summary}
# ─────────────────────────────────────────────────────────────────────────────
Overall = Literal["accept", "review", "reject"]


class CritiqueVerdict(BaseModel):
    verified: list[str] = Field(default_factory=list)
    suspicious: list[str] = Field(default_factory=list)
    unverified: list[str] = Field(default_factory=list)
    overall: Overall = "review"
    summary: str = ""


# ─────────────────────────────────────────────────────────────────────────────
# Tool-call argument schemas — mirror TOOL_SCHEMAS in tools.py (the 8 tools)
# ─────────────────────────────────────────────────────────────────────────────
class GetEquipmentListArgs(BaseModel):
    """get_equipment_list — no arguments."""


class ComputeEfficiencyArgs(BaseModel):
    equipment_id: str
    hours: int = 24


class DetectAnomaliesArgs(BaseModel):
    equipment_id: str
    hours: int = 1


class GetTimeseriesSummaryArgs(BaseModel):
    equipment_id: str
    hours: int = 24


class CompareEquipmentArgs(BaseModel):
    equipment_id_a: str
    equipment_id_b: str
    hours: int = 24


class GetAnomalyHistoryArgs(BaseModel):
    equipment_id: Optional[str] = None
    limit: int = 10


class SearchKnowledgeBaseArgs(BaseModel):
    query: str
    equipment_id: Optional[str] = None
    top_k: int = 4


class ProposeWorkOrderArgs(BaseModel):
    equipment_id: str
    title: str
    diagnosis: str
    priority: Literal["low", "normal", "high", "critical"] = "normal"
    recommended_actions: Optional[str] = None


# name → arg schema (keys match TOOL_SCHEMAS function names exactly)
TOOL_ARG_SCHEMAS: dict[str, type[BaseModel]] = {
    "get_equipment_list":     GetEquipmentListArgs,
    "compute_efficiency":     ComputeEfficiencyArgs,
    "detect_anomalies":       DetectAnomaliesArgs,
    "get_timeseries_summary": GetTimeseriesSummaryArgs,
    "compare_equipment":      CompareEquipmentArgs,
    "get_anomaly_history":    GetAnomalyHistoryArgs,
    "search_knowledge_base":  SearchKnowledgeBaseArgs,
    "propose_work_order":     ProposeWorkOrderArgs,
}
