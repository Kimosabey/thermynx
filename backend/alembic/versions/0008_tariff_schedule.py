"""Energy tariff overlay — Phase 1B (Energy Management).

Revision ID: 0008
Revises: 0007

tariff_schedule — optional ₹/kWh rates (time-bounded / labelled). When empty,
energy cost falls back to the flat settings.TARIFF_INR_PER_KWH.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "tariff_schedule",
        sa.Column("id",               sa.String(36), primary_key=True),
        sa.Column("label",            sa.String(64)),
        sa.Column("rate_inr_per_kwh", sa.Float, nullable=False),
        sa.Column("effective_from",   sa.DateTime),
        sa.Column("effective_to",     sa.DateTime),
        sa.Column("active",           sa.Integer, server_default="1"),
        sa.Column("created_at",       sa.DateTime, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("tariff_schedule")
