"""Operator feedback columns on analysis_audit — Phase post-v1 (👍/👎 loop).

Revision ID: 0005
Revises: 0004

Adds the two columns the AnalysisAudit model (app/db/models.py) and the
POST /api/v1/audit/{id}/verdict endpoint expect. These shipped in the model +
API + UI (commit ec3cff5) but the migration was missing, so any DB that was
not freshly create_all'd raised UndefinedColumnError on every /analyze and
/agent audit-row insert — silently emptying the SSE stream.

  operator_verdict  VARCHAR(16)  -- "positive" | "negative"
  operator_note     TEXT         -- optional free-text reason

Guarded with IF NOT EXISTS so it is safe on DBs where the columns were already
added by hand or via create_all.
"""
from typing import Sequence, Union

from alembic import op


revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE analysis_audit "
        "ADD COLUMN IF NOT EXISTS operator_verdict VARCHAR(16)"
    )
    op.execute(
        "ALTER TABLE analysis_audit "
        "ADD COLUMN IF NOT EXISTS operator_note TEXT"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE analysis_audit DROP COLUMN IF EXISTS operator_note")
    op.execute("ALTER TABLE analysis_audit DROP COLUMN IF EXISTS operator_verdict")
