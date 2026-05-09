"""
Phase 4 RAG — Document ingestion script.

Reads PDF / TXT / MD files from docs/manuals/, chunks them, generates
768-dim embeddings via nomic-embed-text (Ollama), and stores in Postgres.

Usage:
    cd backend
    python scripts/ingest_docs.py [--dir ../docs/manuals] [--clear]

Requirements:
    - Postgres running (docker compose up -d)
    - Ollama reachable with nomic-embed-text pulled
    - pgvector extension enabled (main.py lifespan handles this)
"""
import asyncio
import json
import os
import sys
import uuid
import argparse
from pathlib import Path

# ── Add backend root to PYTHONPATH ─────────────────────────────────────────
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx
from sqlalchemy import text

from app.config import settings
from app.db.session import pg_engine, PGSession


EMBED_MODEL   = "nomic-embed-text"
EMBED_DIM     = 768
CHUNK_SIZE    = 400   # tokens (~500 chars)
CHUNK_OVERLAP = 80    # tokens overlap between chunks


# ── Text extraction ─────────────────────────────────────────────────────────

def extract_text_from_file(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix == ".txt" or suffix == ".md":
        return path.read_text(encoding="utf-8", errors="replace")
    if suffix == ".pdf":
        try:
            import pypdf
            reader = pypdf.PdfReader(str(path))
            return "\n".join(page.extract_text() or "" for page in reader.pages)
        except ImportError:
            print(f"  [warn] pypdf not installed — skipping {path.name}")
            print("         pip install pypdf  to enable PDF support")
            return ""
    print(f"  [skip] unsupported format: {path.name}")
    return ""


# ── Chunking ────────────────────────────────────────────────────────────────

def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    words  = text.split()
    chunks = []
    i = 0
    while i < len(words):
        chunk = " ".join(words[i: i + chunk_size])
        if chunk.strip():
            chunks.append(chunk)
        i += chunk_size - overlap
    return chunks


# ── Embedding via Ollama ────────────────────────────────────────────────────

async def embed_texts(texts: list[str]) -> list[list[float]]:
    """Call Ollama /api/embeddings for each text; returns list of vectors."""
    vectors = []
    timeout = httpx.Timeout(60.0, connect=10.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        for t in texts:
            resp = await client.post(
                f"{settings.OLLAMA_HOST}/api/embeddings",
                json={"model": EMBED_MODEL, "prompt": t},
            )
            resp.raise_for_status()
            vectors.append(resp.json()["embedding"])
    return vectors


# ── Postgres helpers ─────────────────────────────────────────────────────────

async def ensure_vector_extension():
    async with pg_engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS embeddings (
                id            VARCHAR(36) PRIMARY KEY,
                source_type   VARCHAR(32),
                source_id     VARCHAR(128),
                chunk_idx     INTEGER,
                content       TEXT,
                embedding     vector(768),
                equipment_tags VARCHAR(256),
                created_at    TIMESTAMP DEFAULT NOW()
            )
        """))


async def clear_source(source_id: str):
    async with PGSession() as pg:
        await pg.execute(text("DELETE FROM embeddings WHERE source_id = :sid"), {"sid": source_id})
        await pg.commit()
    print(f"  [clear] removed existing chunks for {source_id}")


async def insert_chunks(
    source_type: str,
    source_id: str,
    chunks: list[str],
    vectors: list[list[float]],
    equipment_tags: str = "",
):
    async with PGSession() as pg:
        for idx, (chunk, vec) in enumerate(zip(chunks, vectors)):
            vec_str = "[" + ",".join(f"{v:.6f}" for v in vec) + "]"
            await pg.execute(
                text("""
                    INSERT INTO embeddings (id, source_type, source_id, chunk_idx, content, embedding, equipment_tags)
                    VALUES (:id, :st, :sid, :ci, :content, :vec::vector, :tags)
                    ON CONFLICT (id) DO NOTHING
                """),
                {
                    "id":      str(uuid.uuid4()),
                    "st":      source_type,
                    "sid":     source_id,
                    "ci":      idx,
                    "content": chunk,
                    "vec":     vec_str,
                    "tags":    equipment_tags,
                },
            )
        await pg.commit()


# ── Main ─────────────────────────────────────────────────────────────────────

async def ingest(docs_dir: Path, clear: bool):
    print(f"\nTHERMYNX Document Ingestion — nomic-embed-text ({EMBED_DIM}d)")
    print(f"Source: {docs_dir}")
    print(f"Target: {settings.POSTGRES_URL.split('@')[-1]}\n")

    await ensure_vector_extension()

    files = sorted([
        f for f in docs_dir.iterdir()
        if f.is_file() and f.suffix.lower() in {".pdf", ".txt", ".md"}
    ])

    if not files:
        print("No .pdf / .txt / .md files found in", docs_dir)
        return

    total_chunks = 0
    for path in files:
        print(f"Processing: {path.name}")
        text_content = extract_text_from_file(path)
        if not text_content.strip():
            print(f"  [skip] no extractable text")
            continue

        chunks = chunk_text(text_content)
        print(f"  chunks: {len(chunks)} × ~{CHUNK_SIZE} words")

        if clear:
            await clear_source(path.name)

        print(f"  embedding via {EMBED_MODEL}...", end="", flush=True)
        try:
            vectors = await embed_texts(chunks)
        except Exception as e:
            print(f"\n  [error] embedding failed: {e}")
            continue

        # Infer equipment tags from filename
        tags = ""
        name_lower = path.name.lower()
        tag_list = []
        for eq in ["chiller_1", "chiller_2", "cooling_tower", "condenser_pump"]:
            if eq.replace("_", " ") in name_lower or eq in name_lower:
                tag_list.append(eq)
        tags = ",".join(tag_list)

        await insert_chunks("manual", path.name, chunks, vectors, tags)
        total_chunks += len(chunks)
        print(f" done ({len(vectors)} vectors stored)")

    print(f"\nIngestion complete — {total_chunks} chunks across {len(files)} file(s)\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dir", default="../docs/manuals", help="Directory with PDF/TXT/MD files")
    parser.add_argument("--clear", action="store_true", help="Delete existing chunks before reinserting")
    args = parser.parse_args()

    docs_dir = Path(args.dir).resolve()
    if not docs_dir.exists():
        print(f"Directory not found: {docs_dir}")
        sys.exit(1)

    asyncio.run(ingest(docs_dir, args.clear))
