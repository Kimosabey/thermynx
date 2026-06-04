"""Real-data test cases.

Fault windows + narration windows are pulled live from the real `unicharm` MySQL
(read-only). NL->SQL and RAG questions are curated against the real schema and the
5-doc knowledge corpus. Efficiency thresholds match the project's domain docs
(design 0.55 kW/TR; good <0.65; poor >0.85; healthy chw_delta_t 8-10; low-dT <5).
"""
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

_CHILLERS = ["chiller_1_normalized", "chiller_2_normalized"]


async def fault_windows(db: AsyncSession, n: int = 3) -> list[dict]:
    """Pick the worst real efficiency windows (highest kw_per_tr while running).

    Returns fault dicts with a Planner-ready summary built from REAL values.
    """
    cases: list[dict] = []
    for tbl in _CHILLERS:
        rows = (await db.execute(text(f"""
            SELECT slot_time, kw, tr, kw_per_tr, chw_delta_t,
                   cond_entering_temp, cond_leaving_temp, evap_leaving_temp,
                   ambient_temp, chiller_load
            FROM {tbl}
            WHERE is_running = 1 AND kw_per_tr IS NOT NULL AND tr > 10
            ORDER BY kw_per_tr DESC
            LIMIT 3
        """))).mappings().all()
        eqp = tbl.replace("_normalized", "")
        for r in rows:
            kwtr = float(r["kw_per_tr"])
            dt = float(r["chw_delta_t"]) if r["chw_delta_t"] is not None else None
            cond_in = float(r["cond_entering_temp"]) if r["cond_entering_temp"] is not None else None
            band = "poor" if kwtr > 0.85 else "acceptable" if kwtr > 0.65 else "good"
            flags = []
            if dt is not None and dt < 5:
                flags.append(f"low chilled-water delta-T ({dt:.1f}, healthy 8-10)")
            if cond_in is not None and cond_in > 30:
                flags.append(f"high condenser entering temp ({cond_in:.1f}C)")
            summary = (
                f"{eqp} efficiency check at {r['slot_time']}: kw_per_tr={kwtr:.2f} "
                f"({band}; design 0.55, poor>0.85), kw={float(r['kw']):.1f}, tr={float(r['tr']):.1f}, "
                f"load={float(r['chiller_load'] or 0):.0f}%"
                + (f", chw_delta_t={dt:.1f}C" if dt is not None else "")
                + (f", cond_entering={cond_in:.1f}C" if cond_in is not None else "")
                + (". Contributing signals: " + "; ".join(flags) if flags else "")
                + ". Decide the operations action."
            )
            cases.append({
                "equipment": eqp, "slot_time": str(r["slot_time"]),
                "kw_per_tr": kwtr, "band": band, "summary": summary,
                "metrics": {k: (float(v) if v is not None else None) for k, v in dict(r).items() if k != "slot_time"},
            })
    # worst first, dedupe by equipment so we cover both chillers, take n
    cases.sort(key=lambda c: c["kw_per_tr"], reverse=True)
    seen, picked = set(), []
    for c in cases:
        if c["equipment"] not in seen or len(picked) >= len(_CHILLERS):
            picked.append(c); seen.add(c["equipment"])
        if len(picked) >= n:
            break
    return picked[:n]


async def narration_windows(db: AsyncSession, n: int = 2) -> list[dict]:
    """Recent ~60-min running-average per chiller, as ground-truth numbers to summarize."""
    out: list[dict] = []
    for tbl in _CHILLERS[:n]:
        mx = (await db.execute(text(f"SELECT MAX(slot_time) FROM {tbl} WHERE is_running=1"))).scalar()
        if mx is None:
            continue
        agg = (await db.execute(text(f"""
            SELECT COUNT(*) AS samples,
                   ROUND(AVG(kw),1) AS avg_kw, ROUND(AVG(tr),1) AS avg_tr,
                   ROUND(AVG(kw_per_tr),3) AS avg_kw_per_tr,
                   ROUND(AVG(chw_delta_t),2) AS avg_delta_t,
                   ROUND(AVG(cond_entering_temp),1) AS avg_cond_in,
                   ROUND(AVG(chiller_load),0) AS avg_load
            FROM {tbl}
            WHERE is_running=1 AND slot_time >= :mx - INTERVAL 60 MINUTE
        """), {"mx": mx})).mappings().first()
        facts = {k: (float(v) if v is not None else None) for k, v in dict(agg).items()}
        out.append({
            "equipment": tbl.replace("_normalized", ""),
            "window_end": str(mx),
            "facts": facts,
            "facts_text": ", ".join(f"{k}={v}" for k, v in facts.items()),
        })
    return out


def nl_questions() -> list[dict]:
    """Curated NL questions over the real schema. `must_run` => SQL must execute + return rows."""
    return [
        {"q": "What is the average kw_per_tr for chiller 1 over its last day of data?"},
        {"q": "Which chiller has the higher average kw_per_tr while running?"},
        {"q": "Show the 10 highest kw_per_tr readings for chiller 2 when it was running, with their times."},
        {"q": "What is the maximum chilled-water delta T recorded on chiller 1?"},
        {"q": "How many minutes was chiller 1 running in its most recent day of data?"},
        {"q": "What is the average condenser entering temperature for chiller 1 while running?"},
        {"q": "What is the total energy (kwh) drawn by cooling tower 1?"},
        {"q": "Compare the average kw of condenser pump group 0102 versus pump 03."},
        {"q": "What is the lowest (best) kw_per_tr chiller 2 achieved while running?"},
        {"q": "What is the average chiller load percentage for chiller 1 while running?"},
        {"q": "How many readings show chiller 1 with kw_per_tr above 0.85 (poor efficiency)?"},
        {"q": "What are the average evaporator leaving temperature and delta T for chiller 2?"},
    ]


def rag_questions() -> list[dict]:
    """Questions answerable from the 5-doc HVAC knowledge corpus (chiller efficiency,
    cooling tower, condenser pump, maintenance + anomaly playbooks)."""
    return [
        {"q": "What kw/TR range counts as good versus poor chiller efficiency?", "topic": "chiller efficiency"},
        {"q": "What causes low chilled-water delta-T and why is it a problem?", "topic": "anomaly / low-dT"},
        {"q": "How does condenser entering water temperature affect chiller efficiency?", "topic": "chiller efficiency"},
        {"q": "What is cooling tower approach and what value is healthy?", "topic": "cooling tower"},
        {"q": "What maintenance tasks should be done quarterly on the plant?", "topic": "maintenance playbook"},
        {"q": "What are common signs of condenser tube fouling?", "topic": "anomaly playbook"},
        {"q": "Why might a centrifugal chiller be inefficient at very low load?", "topic": "chiller efficiency"},
        {"q": "How does a VFD help a condenser water pump?", "topic": "condenser pump"},
        {"q": "What should I check first if chiller kw/TR rises 20% in an hour?", "topic": "anomaly playbook"},
        {"q": "What is a normal cooling-tower range and how is it different from approach?", "topic": "cooling tower"},
    ]
