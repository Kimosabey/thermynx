"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-05-09

Creates all thermynx_app tables with correct column widths.
Safe to run on a fresh Postgres instance or one where create_all
already ran (uses CREATE TABLE IF NOT EXISTS via checkfirst=True).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = set(inspector.get_table_names())

    # ── analysis_audit ──────────────────────────────────────────────────────
    if "analysis_audit" not in existing:
        op.create_table(
            "analysis_audit",
            sa.Column("id",               sa.String(36),  primary_key=True),
            sa.Column("equipment_id",     sa.String(64),  nullable=True),
            sa.Column("time_range_hours", sa.Integer(),   nullable=True),
            sa.Column("question",         sa.Text(),      nullable=False),
            sa.Column("prompt_hash",      sa.String(64),  nullable=True),
            sa.Column("response_hash",    sa.String(64),  nullable=True),
            sa.Column("model",            sa.String(64),  nullable=False),
            sa.Column("tokens_estimated", sa.Integer(),   nullable=True),
            sa.Column("total_ms",         sa.Integer(),   nullable=True),
            sa.Column("status",           sa.String(20),  nullable=False, server_default="streaming"),
            sa.Column("request_id",       sa.String(64),  nullable=True),
            sa.Column("created_at",       sa.DateTime(),  server_default=sa.func.now()),
        )
    else:
        # Widen columns that may be too narrow on existing installations
        with op.batch_alter_table("analysis_audit") as batch_op:
            batch_op.alter_column("id",         existing_type=sa.String(), type_=sa.String(36))
            batch_op.alter_column("request_id", existing_type=sa.String(), type_=sa.String(64))

    # ── anomalies ───────────────────────────────────────────────────────────
    if "anomalies" not in existing:
        op.create_table(
            "anomalies",
            sa.Column("id",             sa.String(36),  primary_key=True),
            sa.Column("equipment_id",   sa.String(64),  nullable=False, index=True),
            sa.Column("metric",         sa.String(64),  nullable=False),
            sa.Column("started_at",     sa.String(32),  nullable=False),
            sa.Column("value",          sa.Float(),     nullable=True),
            sa.Column("baseline_mean",  sa.Float(),     nullable=True),
            sa.Column("baseline_std",   sa.Float(),     nullable=True),
            sa.Column("z_score",        sa.Float(),     nullable=True),
            sa.Column("severity",       sa.String(20),  nullable=False, server_default="warning"),
            sa.Column("description",    sa.Text(),      nullable=True),
            sa.Column("narrative",      sa.Text(),      nullable=True),
            sa.Column("created_at",     sa.DateTime(),  server_default=sa.func.now()),
        )

    # ── agent_runs ──────────────────────────────────────────────────────────
    if "agent_runs" not in existing:
        op.create_table(
            "agent_runs",
            sa.Column("id",           sa.String(36),  primary_key=True),
            sa.Column("mode",         sa.String(32),  nullable=False),
            sa.Column("goal",         sa.Text(),      nullable=False),
            sa.Column("context_json", sa.Text(),      nullable=True),
            sa.Column("steps_taken",  sa.Integer(),   nullable=True),
            sa.Column("model",        sa.String(64),  nullable=True),
            sa.Column("status",       sa.String(20),  nullable=False, server_default="running"),
            sa.Column("final_output", sa.Text(),      nullable=True),
            sa.Column("total_ms",     sa.Integer(),   nullable=True),
            sa.Column("request_id",   sa.String(64),  nullable=True),
            sa.Column("created_at",   sa.DateTime(),  server_default=sa.func.now()),
        )

    # ── threads ─────────────────────────────────────────────────────────────
    if "threads" not in existing:
        op.create_table(
            "threads",
            sa.Column("id",         sa.String(36),  primary_key=True),
            sa.Column("title",      sa.String(512), nullable=True),
            sa.Column("created_at", sa.DateTime(),  server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(),  server_default=sa.func.now()),
        )
    else:
        with op.batch_alter_table("threads") as batch_op:
            batch_op.alter_column("id", existing_type=sa.String(), type_=sa.String(36))

    # ── messages ────────────────────────────────────────────────────────────
    if "messages" not in existing:
        op.create_table(
            "messages",
            sa.Column("id",         sa.String(36),  primary_key=True),
            sa.Column("thread_id",  sa.String(36),  sa.ForeignKey("threads.id", ondelete="CASCADE"),
                      nullable=False, index=True),
            sa.Column("role",       sa.String(16),  nullable=False),
            sa.Column("content",    sa.Text(),      nullable=False),
            sa.Column("created_at", sa.DateTime(),  server_default=sa.func.now()),
        )
    else:
        with op.batch_alter_table("messages") as batch_op:
            batch_op.alter_column("id",        existing_type=sa.String(), type_=sa.String(36))
            batch_op.alter_column("thread_id", existing_type=sa.String(), type_=sa.String(36))

    # ── embeddings ──────────────────────────────────────────────────────────
    if "embeddings" not in existing:
        op.create_table(
            "embeddings",
            sa.Column("id",              sa.String(36),   primary_key=True),
            sa.Column("source_type",     sa.String(32),   nullable=False),
            sa.Column("source_id",       sa.String(128),  nullable=False),
            sa.Column("chunk_idx",       sa.Integer(),    nullable=False),
            sa.Column("content",         sa.Text(),       nullable=False),
            sa.Column("embedding",       sa.Text(),       nullable=True),
            sa.Column("equipment_tags",  sa.String(256),  nullable=True),
            sa.Column("created_at",      sa.DateTime(),   server_default=sa.func.now()),
        )


def downgrade() -> None:
    # Drop in reverse FK order
    op.drop_table("embeddings")
    op.drop_table("messages")
    op.drop_table("threads")
    op.drop_table("agent_runs")
    op.drop_table("anomalies")
    op.drop_table("analysis_audit")
