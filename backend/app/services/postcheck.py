"""Post-generation hallucination audits.

After an LLM answer is fully streamed, these *regex-based, no-LLM-call* checks
scan the response text and cross-reference it against the ground-truth context
that was fed to the model.

This is **Layer 4** of the hallucination defense stack (see
docs/planning/ai/HALLUCINATION_DEFENSES.md §4). The earlier layers prevent most
issues; this layer catches what slipped through and produces structured flags
that the UI can render + Prometheus can count.

Three audits:

  - **Numeric claim audit** (T3-A) — extract every number-with-unit from the
    response, check it appears (within tolerance) in the context.
  - **Equipment-mention audit** (T3-B) — extract equipment names from the
    response, check each is in EQUIPMENT_CATALOG.
  - **Citation audit** (T3-C) — extract every `[source: X §N]`, check it
    matches a chunk that was actually retrieved.

All three run in <50 ms total on typical answer sizes (~1 KB), purely
synchronous regex work.

The result dict is shaped to be JSON-serializable for the SSE frame the UI
consumes (see `frontend/src/features/analyzer/index.jsx` audit panel — to be
wired separately).
"""
from __future__ import annotations

import re
from typing import Any

from app.observability.metrics import (
    hallucination_audit_runs_total,
    hallucination_flags_total,
)

# ── Regexes ──────────────────────────────────────────────────────────────────

# Numbers followed by an HVAC-relevant unit. The unit is what distinguishes a
# numeric claim from a list index or table coordinate.
#   examples that match:  "0.72 kW/TR", "139.1 kW", "45.7%", "7.3 °C", "1,250 kWh"
_NUMERIC_CLAIM_RE = re.compile(
    r"(?P<num>[-+]?\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s*"
    r"(?P<unit>%|kW/TR|kW(?!h)|kWh|TRh|TR(?!h)|°C|hr|hours?|Rs|INR|MWh|σ)",
    re.IGNORECASE,
)

# Equipment mentions in the response (must match the catalog or be flagged).
_EQUIPMENT_MENTION_RE = re.compile(
    r"\b(?:condenser[\s_]*pump|chiller|cooling[\s_]*tower|tower|pump)[\s_]*"
    r"(?P<num>\d+(?:-\d+)?)\b",
    re.IGNORECASE,
)

# Citation markers in the response (must map to a retrieved chunk).
_CITATION_RE = re.compile(
    r"\[(?:source:\s*)?(?P<source>[\w.\-/]+)\s*§\s*(?P<idx>\d+)\]",
    re.IGNORECASE,
)


# ── Helpers ──────────────────────────────────────────────────────────────────

def _normalize_num(raw: str) -> float | None:
    """Parse '1,250.5' / '139.1' / '-3.2' into a float."""
    try:
        return float(raw.replace(",", ""))
    except (TypeError, ValueError):
        return None


def _canonical_equipment_id(raw_type: str, num: str) -> str:
    """Build canonical id like 'chiller_1' or 'cooling_tower_2'."""
    t = re.sub(r"[\s_]+", " ", raw_type.lower().strip())
    if t == "tower":
        t = "cooling_tower"
    elif t == "pump":
        t = "condenser_pump"
    else:
        t = t.replace(" ", "_")
    return f"{t}_{num}"


def _context_text_blob(context: dict[str, Any], summary: dict[str, Any]) -> str:
    """Flatten context + summary into a single searchable text blob."""
    parts: list[str] = []
    for v in summary.values():
        if isinstance(v, dict):
            for kk, vv in v.items():
                if vv is not None:
                    parts.append(f"{kk}={vv}")
    for v in context.values():
        if isinstance(v, list):
            for row in v[:200]:  # cap to avoid huge blobs
                if isinstance(row, dict):
                    for kk, vv in row.items():
                        if vv is not None:
                            parts.append(f"{kk}={vv}")
    return " ".join(parts)


# ── Audits ───────────────────────────────────────────────────────────────────

def audit_numeric_claims(
    answer: str,
    context: dict[str, Any],
    summary: dict[str, Any],
    *,
    tolerance_pct: float = 5.0,
    max_orphans: int = 20,
) -> list[dict[str, Any]]:
    """Flag numeric claims in the answer that don't match the context.

    Tolerance is 5% by default — accounts for LLM rounding ("0.61" cited as
    "0.6", or "139.1" cited as "139"). A claim is "orphan" if no number
    within ±tolerance_pct exists in the context blob.
    """
    if not answer:
        return []

    # Build a set of all numbers that appear in the context.
    blob = _context_text_blob(context, summary)
    context_nums: list[float] = []
    for m in re.finditer(r"[-+]?\d+(?:\.\d+)?", blob):
        n = _normalize_num(m.group(0))
        if n is not None:
            context_nums.append(n)

    orphans: list[dict[str, Any]] = []
    seen_claims: set[str] = set()  # de-dupe repeated claims

    for m in _NUMERIC_CLAIM_RE.finditer(answer):
        raw = m.group("num")
        unit = m.group("unit")
        n = _normalize_num(raw)
        if n is None:
            continue
        claim_key = f"{n}_{unit.lower()}"
        if claim_key in seen_claims:
            continue
        seen_claims.add(claim_key)

        # Tolerance match
        if abs(n) < 1e-9:
            matched = any(abs(c) < 1e-9 for c in context_nums)
        else:
            tol = abs(n) * (tolerance_pct / 100.0)
            matched = any(abs(c - n) <= tol for c in context_nums)

        if not matched:
            orphans.append({
                "claim": m.group(0).strip(),
                "value": n,
                "unit": unit,
                "reason": f"no value within ±{tolerance_pct:.0f}% found in context",
            })
            if len(orphans) >= max_orphans:
                break

    return orphans


def audit_equipment_mentions(
    answer: str,
    catalog_ids: set[str] | list[str],
) -> list[dict[str, str]]:
    """Flag equipment mentions in the answer that aren't in EQUIPMENT_CATALOG."""
    if not answer:
        return []
    catalog = set(catalog_ids) if not isinstance(catalog_ids, set) else catalog_ids

    flags: list[dict[str, str]] = []
    seen: set[str] = set()
    for m in _EQUIPMENT_MENTION_RE.finditer(answer):
        whole = m.group(0).strip()
        # Pull the raw type word — everything before the trailing number
        raw_type_match = re.match(r"^(.*?)\s*\d", whole, re.IGNORECASE)
        if not raw_type_match:
            continue
        raw_type = raw_type_match.group(1)
        num = m.group("num")
        canonical = _canonical_equipment_id(raw_type, num)
        if canonical in catalog or canonical in seen:
            continue
        seen.add(canonical)
        flags.append({
            "mention":   whole,
            "canonical": canonical,
            "reason":    "not in equipment catalog",
        })
    return flags


def audit_citations(
    answer: str,
    retrieved_chunks: list[dict[str, Any]] | None,
) -> list[dict[str, str]]:
    """Flag `[source: X §N]` citations in the answer that weren't retrieved."""
    if not answer or not retrieved_chunks:
        return []
    valid = {(str(c.get("source_id")), str(c.get("chunk_idx"))) for c in retrieved_chunks}

    flags: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for m in _CITATION_RE.finditer(answer):
        src = m.group("source")
        idx = m.group("idx")
        key = (src, idx)
        if key in valid or key in seen:
            continue
        seen.add(key)
        flags.append({
            "mention": m.group(0),
            "source":  src,
            "chunk":   idx,
            "reason":  "citation does not match any retrieved chunk",
        })
    return flags


# ── Combined entry point ─────────────────────────────────────────────────────

def run_postcheck(
    answer: str,
    *,
    context: dict[str, Any] | None = None,
    summary: dict[str, Any] | None = None,
    equipment_catalog: list[dict[str, Any]] | set[str] | None = None,
    retrieved_chunks: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Run all three audits and return a structured verdict.

    Returns:
        {
          "status":         "ok" | "clean" | "dirty" | "skipped",
          "flag_count":     int,
          "numeric_flags":  [...],
          "equipment_flags":[...],
          "citation_flags": [...],
        }
    """
    if not answer or not answer.strip():
        hallucination_audit_runs_total.labels(result="skipped").inc()
        return {"status": "skipped", "flag_count": 0, "numeric_flags": [], "equipment_flags": [], "citation_flags": []}

    catalog_ids: set[str] = set()
    if equipment_catalog:
        if isinstance(equipment_catalog, set):
            catalog_ids = equipment_catalog
        else:
            for e in equipment_catalog:
                if isinstance(e, dict) and "id" in e:
                    catalog_ids.add(e["id"])
                elif isinstance(e, str):
                    catalog_ids.add(e)

    num_flags = audit_numeric_claims(answer, context or {}, summary or {}) if (context or summary) else []
    eq_flags  = audit_equipment_mentions(answer, catalog_ids) if catalog_ids else []
    cit_flags = audit_citations(answer, retrieved_chunks)

    total = len(num_flags) + len(eq_flags) + len(cit_flags)

    # Increment per-type metrics
    if num_flags:
        hallucination_flags_total.labels(type="number").inc(len(num_flags))
    if eq_flags:
        hallucination_flags_total.labels(type="equipment").inc(len(eq_flags))
    if cit_flags:
        hallucination_flags_total.labels(type="citation").inc(len(cit_flags))

    result = "dirty" if total > 0 else "clean"
    hallucination_audit_runs_total.labels(result=result).inc()

    return {
        "status":          "ok",
        "result":          result,
        "flag_count":      total,
        "numeric_flags":   num_flags,
        "equipment_flags": eq_flags,
        "citation_flags":  cit_flags,
    }
