"""Asset lifecycle overlay for IBMS subsystems — Phase 1A (EAM).

Revision ID: 0007
Revises: 0006

asset_meta — operator-editable lifecycle fields keyed by the unicharm IBMS
gl_subsystem id. The IBMS DB stays read-only; this Postgres overlay holds the
fields the IBMS doesn't carry (acquisition date, warranty, cost centre,
criticality, notes).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "asset_meta",
        sa.Column("gl_subsystem_id",  sa.String(36), primary_key=True),
        sa.Column("acquisition_date", sa.DateTime),
        sa.Column("warranty_end",     sa.DateTime),
        sa.Column("cost_center",      sa.String(64)),
        sa.Column("criticality",      sa.String(16)),
        sa.Column("notes",            sa.Text),
        sa.Column("updated_at",       sa.DateTime, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("asset_meta")
