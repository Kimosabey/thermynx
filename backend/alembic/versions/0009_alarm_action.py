"""Operator-action overlay for IBMS alarms — Phase 1C (Alarm -> Work Order).

Revision ID: 0009
Revises: 0008

alarm_action — operator ack + raised-work-order link for gl_alarm rows. The
IBMS alarm log (unicharm.gl_alarm) stays read-only; operator actions live here.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "alarm_action",
        sa.Column("alarm_id",        sa.Integer, primary_key=True),
        sa.Column("acknowledged_by", sa.String(64)),
        sa.Column("acked_at",        sa.DateTime),
        sa.Column("wo_id",           sa.String(36)),
        sa.Column("note",            sa.Text),
        sa.Column("updated_at",      sa.DateTime, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("alarm_action")
