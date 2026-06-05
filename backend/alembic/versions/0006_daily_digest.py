"""Daily digest table — auto-scheduled morning plant-health summary.

Revision ID: 0006
Revises: 0005

Backs the DailyDigest model (app/db/models.py) + the /digest API + the daily
arq cron (jobs/digest_job.py). Stores computed KPIs separately from the LLM
narrative so the UI renders real figures, never hallucinated ones.

Guarded with IF NOT EXISTS so it is safe on DBs where the table was already
created by SQLAlchemy's create_all (which runs in main.py lifespan).
"""
from typing import Sequence, Union

from alembic import op


revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS daily_digest (
            id              VARCHAR(36) PRIMARY KEY,
            period_from     VARCHAR(32),
            period_to       VARCHAR(32),
            hours           INTEGER DEFAULT 24,
            total_kwh       DOUBLE PRECISION,
            total_cost_inr  DOUBLE PRECISION,
            anomaly_count   INTEGER DEFAULT 0,
            critical_count  INTEGER DEFAULT 0,
            worst_equipment VARCHAR(64),
            worst_kw_per_tr DOUBLE PRECISION,
            headline        TEXT,
            recommendation  TEXT,
            markdown        TEXT,
            status          VARCHAR(16) DEFAULT 'ok',
            created_at      TIMESTAMP DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_daily_digest_created_at "
        "ON daily_digest (created_at)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_daily_digest_created_at")
    op.execute("DROP TABLE IF EXISTS daily_digest")
