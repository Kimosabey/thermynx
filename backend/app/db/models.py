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
    # 768-dim nomic-embed-text vector; stored as TEXT if pgvector unavailable
    embedding: Mapped[str | None] = mapped_column(Text)    # overridden at runtime
    equipment_tags: Mapped[str | None] = mapped_column(String(256))  # "chiller_1,chiller_2"
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
