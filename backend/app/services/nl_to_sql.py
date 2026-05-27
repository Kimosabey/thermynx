"""Natural-language → SQL service.

Operator types a question in English; an Ollama call returns a single
SELECT statement; a validator enforces a strict allow-list (read-only,
single statement, only the 6 normalized telemetry tables, hard LIMIT)
before the query touches MySQL.

The validator is the security boundary — the model is treated as
untrusted. If anything looks suspicious we refuse and surface the
reason. The LLM is never permitted to introduce DML/DDL or join
outside the allow-listed tables.
"""
from __future__ import annotations

import asyncio
import re
import time
from dataclasses import dataclass, field
from typing import Any

import httpx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.telemetry import NORMALIZED_TABLES
from app.log import get_logger

log = get_logger("services.nl_to_sql")

_DEFAULT_TEMP       = 0.0

# Timeouts and row cap are now in settings so operators can tune via env vars
# without touching code. Module-level aliases kept for readability below.
def _llm_timeout()  -> float: return settings.NL_QUERY_LLM_TIMEOUT_S
def _db_timeout()   -> float: return settings.NL_QUERY_DB_TIMEOUT_S
def _max_rows()     -> int:   return settings.NL_QUERY_MAX_ROWS

_ALLOWED_TABLES = set(NORMALIZED_TABLES.values())

# Tokens that immediately disqualify a generated statement
_FORBIDDEN_TOKEN_RE = re.compile(
    r"\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|"
    r"call|exec|execute|merge|replace|rename|lock|unlock|set|use|"
    r"load|outfile|infile|into\s+outfile|into\s+dumpfile|"
    r"information_schema|mysql\.|sys\.|performance_schema)\b",
    re.IGNORECASE,
)

# Catch comment-based smuggling
_COMMENT_RE = re.compile(r"(--|#|/\*)")


@dataclass
class NLQueryResult:
    sql:        str
    rows:       list[dict[str, Any]]
    row_count:  int
    columns:    list[str]
    elapsed_ms: int
    warnings:   list[str] = field(default_factory=list)


class NLQueryError(Exception):
    """Raised when validation refuses a generated query."""


_SYSTEM_PROMPT = """You are a SQL generator for an HVAC operations database (MySQL).

You will be given a user question in plain English. Return EXACTLY one
SELECT statement that answers it. No commentary. No code fences. No
trailing semicolon.

HARD RULES (violating any of these makes your output unusable):
  * SELECT only. NEVER INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE.
  * One statement. No semicolons.
  * No comments (no -- or # or /* */).
  * Only reference these tables (exact names):
{table_list}
  * Always include a LIMIT (max 1000).
  * If filtering by recent data, use slot_time >= NOW() - INTERVAL N HOUR (or DAY).
  * Use the canonical column names: slot_time, is_running, kw, tr, kw_per_tr,
    chiller_load, evap_entering_temp, evap_leaving_temp, chw_delta_t,
    cond_entering_temp, cond_leaving_temp, ambient_temp, kwh, trh,
    cumulative_kwh, run_hours.
  * Chiller tables expose: kw, tr, kw_per_tr, chiller_load, the temps, kwh, trh, run_hours
  * Tower / pump tables expose: kw, kwh, cumulative_kwh, run_hours

Return ONLY the SQL statement — nothing else."""


def _build_prompt(question: str) -> str:
    table_list = "\n".join(f"    - {t}" for t in sorted(_ALLOWED_TABLES))
    return _SYSTEM_PROMPT.format(table_list=table_list) + f"\n\nQuestion: {question}\n\nSQL:"


def _strip_fences(s: str) -> str:
    s = s.strip()
    if s.startswith("```"):
        s = re.sub(r"^```(?:sql)?\n?", "", s, flags=re.IGNORECASE)
        s = re.sub(r"```\s*$", "", s)
    return s.strip().rstrip(";").strip()


def _validate(sql: str) -> tuple[str, list[str]]:
    """Returns (sanitized_sql, warnings) or raises NLQueryError."""
    cleaned = _strip_fences(sql)
    if not cleaned:
        raise NLQueryError("Model returned an empty query.")

    if _COMMENT_RE.search(cleaned):
        raise NLQueryError("Comments are not allowed in generated SQL.")

    if ";" in cleaned:
        raise NLQueryError("Multiple statements are not allowed.")

    if not re.match(r"^\s*select\b", cleaned, re.IGNORECASE):
        raise NLQueryError("Only SELECT statements are permitted.")

    if _FORBIDDEN_TOKEN_RE.search(cleaned):
        raise NLQueryError("Generated SQL contained a forbidden keyword.")

    # Must reference at least one allowed table; must NOT reference any other table.
    # Extract bare table identifiers (best-effort heuristic — matched against allow-list).
    referenced = set(re.findall(r"\b([a-z][a-z0-9_]*_normalized)\b", cleaned, re.IGNORECASE))
    referenced_lower = {t.lower() for t in referenced}
    if not referenced_lower:
        raise NLQueryError("Query must reference one of the telemetry tables.")
    illegal = referenced_lower - _ALLOWED_TABLES
    if illegal:
        raise NLQueryError(f"Query references disallowed table(s): {sorted(illegal)}")

    warnings: list[str] = []
    if not re.search(r"\blimit\b", cleaned, re.IGNORECASE):
        cleaned = f"{cleaned} LIMIT {_max_rows()}"
        warnings.append(f"Added implicit LIMIT {_max_rows()}.")
    else:
        # Cap explicit LIMITs above _max_rows()
        m = re.search(r"\blimit\s+(\d+)\b", cleaned, re.IGNORECASE)
        if m and int(m.group(1)) > _max_rows():
            cleaned = re.sub(r"\blimit\s+\d+\b", f"LIMIT {_max_rows()}", cleaned, flags=re.IGNORECASE)
            warnings.append(f"Capped LIMIT to {_max_rows()}.")

    return cleaned, warnings


async def _ollama_generate_sql(question: str, model: str) -> str:
    url = f"{settings.OLLAMA_HOST.rstrip('/')}/api/generate"
    body = {
        "model":   model,
        "prompt":  _build_prompt(question),
        "stream":  False,
        "options": {"temperature": _DEFAULT_TEMP},
    }
    async with httpx.AsyncClient(timeout=_llm_timeout()) as client:
        r = await client.post(url, json=body)
        r.raise_for_status()
        data = r.json()
        return (data.get("response") or "").strip()


async def run_nl_query(
    question: str,
    db: AsyncSession,
    *,
    model: str | None = None,
) -> NLQueryResult:
    if not question or not question.strip():
        raise NLQueryError("Question is empty.")

    used_model = model or settings.OLLAMA_DEFAULT_MODEL

    # 1) Generate
    try:
        raw_sql = await asyncio.wait_for(
            _ollama_generate_sql(question.strip(), used_model),
            timeout=_llm_timeout(),
        )
    except asyncio.TimeoutError as exc:
        raise NLQueryError("LLM timed out generating SQL.") from exc
    except httpx.HTTPError as exc:
        raise NLQueryError(f"LLM error: {exc}") from exc

    # 2) Validate (security boundary)
    sql, warnings = _validate(raw_sql)

    # 3) Execute (read-only, hard timeout)
    started = time.monotonic()
    try:
        result = await asyncio.wait_for(
            db.execute(text(sql)),
            timeout=_db_timeout(),
        )
    except asyncio.TimeoutError as exc:
        raise NLQueryError(f"Query exceeded {_db_timeout():.0f}s timeout.") from exc
    except Exception as exc:
        log.error(f"SQL execution failed: {exc} | Query: {sql}")
        raise NLQueryError(f"Database error executing query: {str(exc)}") from exc

    rows_mapping = result.mappings().all()
    elapsed_ms   = int((time.monotonic() - started) * 1000)

    rows: list[dict[str, Any]] = [dict(r) for r in rows_mapping][:_max_rows()]
    columns = list(rows[0].keys()) if rows else []

    return NLQueryResult(
        sql=sql,
        rows=rows,
        row_count=len(rows),
        columns=columns,
        elapsed_ms=elapsed_ms,
        warnings=warnings,
    )
