"""Upgrade legacy `embeddings.embedding` from TEXT to pgvector `vector(768)`."""

from sqlalchemy import text

from app.log import get_logger

log = get_logger("db.embeddings_schema")


async def ensure_embeddings_embedding_is_vector(conn) -> None:
    """If `embeddings.embedding` is not a vector column, ALTER it (and drop stale index)."""
    has_table = (await conn.execute(
        text("""
            SELECT EXISTS (
              SELECT FROM information_schema.tables
              WHERE table_schema = 'public' AND table_name = 'embeddings'
            )
        """)
    )).scalar()

    if not has_table:
        return

    ctype_row = (await conn.execute(
        text("""
            SELECT pg_catalog.format_type(a.atttypid, a.atttypmod)
            FROM pg_attribute a
            JOIN pg_class c ON c.oid = a.attrelid
            JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
            WHERE c.relname = 'embeddings' AND a.attname = 'embedding'
              AND a.attnum > 0 AND NOT a.attisdropped
        """)
    )).first()

    if not ctype_row or not ctype_row[0]:
        return

    ctype = str(ctype_row[0]).lower()
    if "vector" in ctype:
        return

    await conn.execute(text("DROP INDEX IF EXISTS idx_embeddings_vec"))
    await conn.execute(
        text("""
            ALTER TABLE embeddings
            ALTER COLUMN embedding TYPE vector(768)
            USING CASE
              WHEN embedding IS NULL OR trim(both from embedding::text) = '' THEN NULL::vector(768)
              ELSE trim(both from embedding::text)::vector(768)
            END
        """)
    )
    log.info("embeddings_embedding_upgraded_to_vector(768)")
