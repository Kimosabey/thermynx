"""Use pgvector type for embeddings.embedding

Revision ID: 0002
Revises: 0001

Fixes legacy TEXT column so IVFFlat and <=> queries work.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(sa.text("CREATE EXTENSION IF NOT EXISTS vector"))
    conn = op.get_bind()

    has = conn.execute(
        sa.text("""
            SELECT EXISTS (
              SELECT FROM information_schema.tables
              WHERE table_schema = 'public' AND table_name = 'embeddings'
            )
        """)
    ).scalar()

    if not has:
        return

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

    if not row or not row[0] or "vector" in str(row[0]).lower():
        return

    op.execute(sa.text("DROP INDEX IF EXISTS idx_embeddings_vec"))
    op.execute(
        sa.text("""
            ALTER TABLE embeddings
            ALTER COLUMN embedding TYPE vector(768)
            USING CASE
              WHEN embedding IS NULL OR trim(both from embedding::text) = '' THEN NULL::vector(768)
              ELSE trim(both from embedding::text)::vector(768)
            END
        """)
    )


def downgrade() -> None:
    op.execute(sa.text("DROP INDEX IF EXISTS idx_embeddings_vec"))
    op.execute(
        sa.text("""
            ALTER TABLE embeddings ALTER COLUMN embedding TYPE text USING embedding::text
        """)
    )
