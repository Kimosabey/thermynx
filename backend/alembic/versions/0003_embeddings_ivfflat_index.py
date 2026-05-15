"""IVFFlat cosine index on embeddings.embedding

Revision ID: 0003
Revises: 0002

Creates approximate nearest-neighbour index when pgvector column exists.
Previously created ad-hoc in FastAPI lifespan; now owned by Alembic.

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    row = conn.execute(
        sa.text("""
            SELECT pg_catalog.format_type(a.atttypid, a.atttypmod)
            FROM pg_attribute a
            JOIN pg_class c ON c.oid = a.attrelid
            JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
            WHERE c.relname = 'embeddings' AND a.attname = 'embedding'
              AND a.attnum > 0 AND NOT a.attisdropped
        """)
    ).first()

    if not row or not row[0] or "vector" not in str(row[0]).lower():
        return

    op.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS idx_embeddings_vec "
            "ON embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists=50)"
        )
    )


def downgrade() -> None:
    op.execute(sa.text("DROP INDEX IF EXISTS idx_embeddings_vec"))
