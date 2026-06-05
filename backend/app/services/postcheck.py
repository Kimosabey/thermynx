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

    Tolerance is adaptive:
    - Absolute values (kW, kWh, TR, °C): 5% — tight enough to catch fabrication
    - Percentages and z-scores (%, σ): 15% — looser because LLM rounds aggressively
      e.g. "82.3%" → context "82%" needs 15% tolerance to avoid false positives
    A claim is "orphan" if no number within tolerance exists in the context blob.
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

        # Adaptive tolerance: looser for ratios/z-scores, tighter for absolutes
        adaptive_tol = 15.0 if unit in ("%", "σ") else tolerance_pct
        if abs(n) < 1e-9:
            matched = any(abs(c) < 1e-9 for c in context_nums)
        else:
            tol = abs(n) * (adaptive_tol / 100.0)
            matched = any(abs(c - n) <= tol for c in context_nums)

        if not matched:
            orphans.append({
                "claim": m.group(0).strip(),
                "value": n,
                "unit": unit,
                "reason": f"no value within ±{adaptive_tol:.0f}% found in context",
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
) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    """Return (false_citation_flags, uncited_chunk_flags).

    false_citation_flags: citations in the answer that don't match retrieved chunks.
    uncited_chunk_flags:  retrieved chunks that were never cited in the answer.
    Both tell operators about RAG grounding quality.
    """
    if not answer or not retrieved_chunks:
        return [], []

    valid = {(str(c.get("source_id")), str(c.get("chunk_idx"))) for c in retrieved_chunks}

    false_flags: list[dict[str, str]] = []
    cited_keys: set[tuple[str, str]] = set()
    seen_mentions: set[tuple[str, str]] = set()

    for m in _CITATION_RE.finditer(answer):
        src = m.group("source")
        idx = m.group("idx")
        key = (src, idx)
        cited_keys.add(key)
        if key in valid or key in seen_mentions:
            continue
        seen_mentions.add(key)
        false_flags.append({
            "mention": m.group(0),
            "source":  src,
            "chunk":   idx,
            "reason":  "citation does not match any retrieved chunk",
        })

    # Chunks that were retrieved but never cited
    uncited_flags: list[dict[str, str]] = []
    for c in retrieved_chunks:
        key = (str(c.get("source_id")), str(c.get("chunk_idx")))
        if key not in cited_keys:
            uncited_flags.append({
                "source_id":  c.get("source_id", "?"),
                "chunk_idx":  c.get("chunk_idx", "?"),
                "score":      str(c.get("score", "")),
                "reason":     "retrieved chunk was not cited in the answer",
            })

    return false_flags, uncited_flags


def audit_language(answer: str, *, max_non_latin_pct: float = 8.0) -> list[dict[str, Any]]:
    """Flag if the answer is more than ~8% non-Latin (Thai, Chinese, Hindi, etc.).

    The English-only rule is in the prompt, but multilingual base models
    (qwen2.5, llama3.1) sometimes drift into other languages. This is the
    safety net — if the model slips, we flag the answer so the UI can warn
    and (eventually) trigger a retry-in-English.
    """
    if not answer or not answer.strip():
        return []
    total_letters = 0
    non_latin = 0
    for ch in answer:
        if ch.isalpha():
            total_letters += 1
            # Basic Latin block (ASCII letters) + Latin-1 supplement is 0x00-0x024F
            if ord(ch) > 0x024F:
                non_latin += 1
    if total_letters == 0:
        return []
    pct = (non_latin / total_letters) * 100
    if pct > max_non_latin_pct:
        # Capture a sample of the non-Latin run for diagnostics
        sample = []
        run = ""
        for ch in answer:
            if ch.isalpha() and ord(ch) > 0x024F:
                run += ch
            elif run:
                if len(run) >= 3:
                    sample.append(run[:20])
                run = ""
                if len(sample) >= 3:
                    break
        if run and len(run) >= 3:
            sample.append(run[:20])
        return [{
            "reason":   f"response is {pct:.1f}% non-Latin script — English-only rule violated",
            "samples":  sample,
            "total_letters": total_letters,
            "non_latin_letters": non_latin,
        }]
    return []


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

    num_flags  = audit_numeric_claims(answer, context or {}, summary or {}) if (context or summary) else []
    eq_flags   = audit_equipment_mentions(answer, catalog_ids) if catalog_ids else []
    cit_flags, uncited_flags = audit_citations(answer, retrieved_chunks)
    lang_flags = audit_language(answer)

    total = len(num_flags) + len(eq_flags) + len(cit_flags) + len(lang_flags)

    # Increment per-type metrics
    if num_flags:
        hallucination_flags_total.labels(type="number").inc(len(num_flags))
    if eq_flags:
        hallucination_flags_total.labels(type="equipment").inc(len(eq_flags))
    if cit_flags:
        hallucination_flags_total.labels(type="citation").inc(len(cit_flags))
    if lang_flags:
        hallucination_flags_total.labels(type="language").inc(len(lang_flags))

    result = "dirty" if total > 0 else "clean"
    hallucination_audit_runs_total.labels(result=result).inc()

    return {
        "status":          "ok",
        "result":          result,
        "flag_count":      total,
        "numeric_flags":   num_flags,
        "equipment_flags": eq_flags,
        "citation_flags":  cit_flags,
        "uncited_chunks":  uncited_flags,   # retrieved but not cited — informational
        "language_flags":  lang_flags,
    }
