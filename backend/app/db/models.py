from datetime import datetime
from sqlalchemy import String, Integer, Float, Text, DateTime, func, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.db.session import Base


class AnalysisAudit(Base):
    __tablename__ = "analysis_audit"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
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
