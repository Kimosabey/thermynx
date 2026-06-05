from datetime import datetime
from sqlalchemy import String, Integer, Float, Text, DateTime, func, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.db.session import Base

# pgvector — imported lazily so the app still boots if the PG extension isn't
# enabled yet. The Embedding model won't be created until CREATE EXTENSION vector
# succeeds (handled in main.py lifespan).
try:
    from pgvector.sqlalchemy import Vector as _Vector
    _VECTOR_DIM = _Vector(768)
except ImportError:
    _Vector = None  # type: ignore
    _VECTOR_DIM = None  # type: ignore


class AnalysisAudit(Base):
    __tablename__ = "analysis_audit"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)  # 36 = uuid4 with dashes
    equipment_id: Mapped[str | None] = mapped_column(String(64))
    time_range_hours: Mapped[int | None] = mapped_column(Integer)
    question: Mapped[str] = mapped_column(Text)
    prompt_hash: Mapped[str | None] = mapped_column(String(64))
    response_hash: Mapped[str | None] = mapped_column(String(64))
    model: Mapped[str] = mapped_column(String(64))
    tokens_estimated: Mapped[int | None] = mapped_column(Integer)
    total_ms: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), default="streaming")
    request_id: Mapped[str | None] = mapped_column(String(64))
    # Operator feedback — set via POST /api/v1/audit/{id}/verdict
    operator_verdict: Mapped[str | None] = mapped_column(String(16))  # "positive" | "negative"
    operator_note: Mapped[str | None] = mapped_column(Text)           # optional free-text reason
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Anomaly(Base):
    __tablename__ = "anomalies"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    equipment_id: Mapped[str] = mapped_column(String(64), index=True)
    metric: Mapped[str] = mapped_column(String(64))
    started_at: Mapped[str] = mapped_column(String(32))
    value: Mapped[float | None] = mapped_column(Float)
    baseline_mean: Mapped[float | None] = mapped_column(Float)
    baseline_std: Mapped[float | None] = mapped_column(Float)
    z_score: Mapped[float | None] = mapped_column(Float)
    severity: Mapped[str] = mapped_column(String(20), default="warning")
    description: Mapped[str | None] = mapped_column(Text)
    narrative: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class AgentRun(Base):
    __tablename__ = "agent_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    mode: Mapped[str] = mapped_column(String(32))
    goal: Mapped[str] = mapped_column(Text)
    context_json: Mapped[str | None] = mapped_column(Text)
    steps_taken: Mapped[int | None] = mapped_column(Integer)
    model: Mapped[str | None] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(20), default="running")
    final_output: Mapped[str | None] = mapped_column(Text)
    total_ms: Mapped[int | None] = mapped_column(Integer)
    request_id: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Thread(Base):
    __tablename__ = "threads"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    title: Mapped[str | None] = mapped_column(String(512))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    thread_id: Mapped[str] = mapped_column(String(36), ForeignKey("threads.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(16))
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Embedding(Base):
    """
    Stores document chunks + their vector embeddings for RAG (Phase 4).
    Requires pgvector extension in thermynx_app Postgres.
    Populated by: backend/scripts/ingest_docs.py
    """
    __tablename__ = "embeddings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    source_type: Mapped[str] = mapped_column(String(32))   # manual | ashrae | incident
    source_id: Mapped[str] = mapped_column(String(128))    # filename
    chunk_idx: Mapped[int] = mapped_column(Integer)
    content: Mapped[str] = mapped_column(Text)

    if _VECTOR_DIM is not None:
        embedding: Mapped[list[float] | None] = mapped_column(_VECTOR_DIM, nullable=True)
    else:
        embedding: Mapped[str | None] = mapped_column(Text, nullable=True)

    equipment_tags: Mapped[str | None] = mapped_column(String(256))  # "chiller_1,chiller_2"
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


# ── Work Orders (Phase WO) ────────────────────────────────────────────────────

class WorkOrder(Base):
    """Operator-actionable work item. Created manually, by the agent during
    investigation, automatically from a high-severity anomaly, or by the
    preventive-maintenance scheduler. Lifecycle is enforced in code:
    open → assigned → in_progress → resolved → closed (with cancel allowed
    from any non-terminal state)."""
    __tablename__ = "work_orders"

    id:           Mapped[str] = mapped_column(String(36), primary_key=True)
    equipment_id: Mapped[str | None] = mapped_column(String(64), index=True)
    title:        Mapped[str] = mapped_column(String(256))
    description:  Mapped[str | None] = mapped_column(Text)
    priority:     Mapped[str] = mapped_column(String(16), default="normal")  # low / normal / high / critical
    state:        Mapped[str] = mapped_column(String(16), default="open", index=True)
    # Provenance — where did this WO come from?
    source:       Mapped[str] = mapped_column(String(32), default="manual")   # manual / agent / anomaly / pm
    source_ref:   Mapped[str | None] = mapped_column(String(64))              # agent_run_id / anomaly_id / pm_template_id
    # Assignment
    created_by:   Mapped[str | None] = mapped_column(String(64))
    assigned_to:  Mapped[str | None] = mapped_column(String(64), ForeignKey("technicians.id", ondelete="SET NULL"), index=True)
    # Recommended-action payload (LLM diagnosis, recommended parts, etc.)
    diagnosis:    Mapped[str | None] = mapped_column(Text)
    recommended_actions: Mapped[str | None] = mapped_column(Text)  # newline-separated
    # Timestamps
    due_at:       Mapped[datetime | None] = mapped_column(DateTime)
    resolved_at:  Mapped[datetime | None] = mapped_column(DateTime)
    closed_at:    Mapped[datetime | None] = mapped_column(DateTime)
    created_at:   Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), index=True)
    updated_at:   Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class WorkOrderEvent(Base):
    """Append-only audit trail of every WO state change + comment. The
    `work_orders` table holds the *current* state; this table holds the *history*."""
    __tablename__ = "work_order_events"

    id:          Mapped[str] = mapped_column(String(36), primary_key=True)
    wo_id:       Mapped[str] = mapped_column(String(36), ForeignKey("work_orders.id", ondelete="CASCADE"), index=True)
    kind:        Mapped[str] = mapped_column(String(24))   # transition / comment / assignment / system
    from_state:  Mapped[str | None] = mapped_column(String(16))
    to_state:    Mapped[str | None] = mapped_column(String(16))
    actor:       Mapped[str | None] = mapped_column(String(64))
    notes:       Mapped[str | None] = mapped_column(Text)
    created_at:  Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), index=True)


class Technician(Base):
    __tablename__ = "technicians"

    id:               Mapped[str] = mapped_column(String(36), primary_key=True)
    name:             Mapped[str] = mapped_column(String(128))
    email:            Mapped[str | None] = mapped_column(String(128))
    skills:           Mapped[str | None] = mapped_column(Text)  # comma-separated tags
    location:         Mapped[str | None] = mapped_column(String(64))
    active:           Mapped[int] = mapped_column(Integer, default=1)
    success_rate:     Mapped[float | None] = mapped_column(Float)  # 0..1 (filled from analytics)
    open_assignments: Mapped[int] = mapped_column(Integer, default=0)
    notes:            Mapped[str | None] = mapped_column(Text)
    created_at:       Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class DailyDigest(Base):
    """A persisted morning plant-health digest. Generated once daily by the
    arq cron (`jobs/digest_job.py`), pushed to Slack, and shown on the Digest
    page. Stores the *computed* numbers separately from the LLM narrative so the
    UI renders real figures (never hallucinated ones) — the model only writes
    `headline` + `recommendation`."""
    __tablename__ = "daily_digest"

    id:              Mapped[str] = mapped_column(String(36), primary_key=True)
    period_from:     Mapped[str] = mapped_column(String(32))
    period_to:       Mapped[str] = mapped_column(String(32))
    hours:           Mapped[int] = mapped_column(Integer, default=24)
    # Computed KPIs (deterministic — not from the LLM)
    total_kwh:       Mapped[float | None] = mapped_column(Float)
    total_cost_inr:  Mapped[float | None] = mapped_column(Float)
    anomaly_count:   Mapped[int] = mapped_column(Integer, default=0)
    critical_count:  Mapped[int] = mapped_column(Integer, default=0)
    worst_equipment: Mapped[str | None] = mapped_column(String(64))
    worst_kw_per_tr: Mapped[float | None] = mapped_column(Float)
    # LLM narrative (grounded in the KPIs above)
    headline:        Mapped[str | None] = mapped_column(Text)
    recommendation:  Mapped[str | None] = mapped_column(Text)
    markdown:        Mapped[str | None] = mapped_column(Text)
    status:          Mapped[str] = mapped_column(String(16), default="ok")  # ok | degraded
    created_at:      Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), index=True)


class PMTemplate(Base):
    """Recurring preventive-maintenance template. The scheduler reads these
    once a day and creates work orders for each (equipment, template) pair
    whose `interval_days` has elapsed since the last completion."""
    __tablename__ = "pm_templates"

    id:               Mapped[str] = mapped_column(String(36), primary_key=True)
    name:             Mapped[str] = mapped_column(String(128))
    equipment_type:   Mapped[str] = mapped_column(String(32))  # chiller / cooling_tower / pump / all
    interval_days:    Mapped[int] = mapped_column(Integer)
    priority:         Mapped[str] = mapped_column(String(16), default="normal")
    description:      Mapped[str | None] = mapped_column(Text)
    active:           Mapped[int] = mapped_column(Integer, default=1)
    last_run_at:      Mapped[datetime | None] = mapped_column(DateTime)
    created_at:       Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
