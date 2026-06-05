"""Chiller staging optimizer — pure deterministic logic (no I/O, no LLM).

Given recent per-chiller telemetry, build an empirical efficiency-at-load
profile for each chiller, then for a target plant cooling demand (TR) evaluate
candidate staging configurations and recommend the one with the lowest total
predicted kW. The optimization is plain arithmetic — auditable and bounded —
so the LLM only narrates the result, it never decides it.

Safe-operating bounds (min load per running chiller, capacity ceiling) are
enforced here in code, not trusted to the model.
"""
from __future__ import annotations

from dataclasses import dataclass, field

_MIN_VALID_TR = 10.0   # a running chiller below this is sensor noise (matches efficiency.py)
# Load-percent buckets for the empirical kW/TR-vs-load curve.
_LOAD_BINS: list[tuple[int, int]] = [(0, 50), (50, 60), (60, 70), (70, 80), (80, 90), (90, 101)]


@dataclass
class ChillerProfile:
    equipment_id:      str
    name:              str
    capacity_tr:       float | None        # ~design max cooling output (95th pct observed)
    overall_kw_per_tr: float | None
    bins:              dict[str, float] = field(default_factory=dict)  # "70-80" -> avg kw/TR
    currently_running: bool = False
    latest_tr:         float | None = None
    latest_kw:         float | None = None
    samples:           int = 0


@dataclass
class StagingOption:
    label:        str                 # human label e.g. "Chiller 1 only"
    chillers:     list[str]           # equipment_ids that run
    per_chiller_tr:  dict[str, float] # tr each runs at
    est_kw:       float
    feasible:     bool
    note:         str = ""


@dataclass
class StagingResult:
    target_tr:        float
    target_source:    str             # "observed" | "user"
    tariff_inr_per_kwh: float
    profiles:         list[dict]
    current_chillers: list[str]
    current_est_kw:   float | None
    recommended:      StagingOption | None
    options:          list[StagingOption]
    savings_kw:       float | None
    savings_pct:      float | None
    savings_inr_per_hr: float | None
    rationale:        list[str] = field(default_factory=list)


def _bin_key(lo: int, hi: int) -> str:
    return f"{lo}-{hi}"


def _percentile(sorted_vals: list[float], pct: float) -> float | None:
    if not sorted_vals:
        return None
    if len(sorted_vals) == 1:
        return sorted_vals[0]
    idx = min(len(sorted_vals) - 1, int(round(pct / 100 * (len(sorted_vals) - 1))))
    return sorted_vals[idx]


def _clean_running(rows: list[dict]) -> list[dict]:
    out = []
    for r in rows:
        if not r.get("is_running"):
            continue
        tr = r.get("tr")
        if tr is None or r.get("kw_per_tr") is None:
            continue
        try:
            if float(tr) >= _MIN_VALID_TR:
                out.append(r)
        except (TypeError, ValueError):
            continue
    return out


def build_profile(equipment_id: str, name: str, rows: list[dict]) -> ChillerProfile:
    """Empirical efficiency-at-load profile from recent rows.

    `rows` are newest-first (as returned by fetch_chiller_data)."""
    clean = _clean_running(rows)
    latest = rows[0] if rows else {}
    currently_running = bool(latest.get("is_running"))
    latest_tr = _f(latest.get("tr"))
    latest_kw = _f(latest.get("kw"))

    if not clean:
        return ChillerProfile(equipment_id, name, None, None,
                              currently_running=currently_running,
                              latest_tr=latest_tr, latest_kw=latest_kw, samples=0)

    trs = sorted(_f(r["tr"]) for r in clean)
    capacity_tr = _percentile(trs, 95.0)

    kpts = [_f(r["kw_per_tr"]) for r in clean]
    overall = round(sum(kpts) / len(kpts), 4)

    # Bin kW/TR by load% (= tr / capacity * 100) so prediction uses the same metric.
    buckets: dict[str, list[float]] = {_bin_key(lo, hi): [] for lo, hi in _LOAD_BINS}
    for r in clean:
        tr = _f(r["tr"])
        if not capacity_tr:
            break
        load_pct = tr / capacity_tr * 100
        for lo, hi in _LOAD_BINS:
            if lo <= load_pct < hi:
                buckets[_bin_key(lo, hi)].append(_f(r["kw_per_tr"]))
                break
    bins = {k: round(sum(v) / len(v), 4) for k, v in buckets.items() if v}

    return ChillerProfile(
        equipment_id=equipment_id, name=name,
        capacity_tr=round(capacity_tr, 1) if capacity_tr else None,
        overall_kw_per_tr=overall, bins=bins,
        currently_running=currently_running,
        latest_tr=latest_tr, latest_kw=latest_kw, samples=len(clean),
    )


def _f(v) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def _kw_per_tr_at_load(p: ChillerProfile, load_pct: float) -> float | None:
    """Look up empirical kW/TR for a load%, falling back to nearest bin then overall."""
    if not p.bins:
        return p.overall_kw_per_tr
    for lo, hi in _LOAD_BINS:
        if lo <= load_pct < hi and _bin_key(lo, hi) in p.bins:
            return p.bins[_bin_key(lo, hi)]
    # nearest populated bin by midpoint distance
    mids = {(lo + hi) / 2: p.bins[_bin_key(lo, hi)] for lo, hi in _LOAD_BINS if _bin_key(lo, hi) in p.bins}
    if mids:
        nearest = min(mids, key=lambda m: abs(m - load_pct))
        return mids[nearest]
    return p.overall_kw_per_tr


def _predict_kw(p: ChillerProfile, tr: float) -> float | None:
    if tr <= 0:
        return 0.0
    if not p.capacity_tr or p.overall_kw_per_tr is None:
        return None
    load_pct = tr / p.capacity_tr * 100
    kpt = _kw_per_tr_at_load(p, load_pct)
    if kpt is None:
        return None
    return round(tr * kpt, 1)


def _evaluate_config(profiles: dict[str, ChillerProfile], run_ids: list[str], target_tr: float) -> StagingOption:
    """Split target_tr across run_ids proportional to capacity; predict total kW."""
    running = [profiles[i] for i in run_ids if i in profiles]
    label = " + ".join(profiles[i].name for i in run_ids) if run_ids else "All off"
    if not running:
        return StagingOption(label, run_ids, {}, 0.0, feasible=(target_tr <= 0), note="no chillers")

    total_cap = sum(p.capacity_tr or 0 for p in running)
    if total_cap <= 0:
        return StagingOption(label, run_ids, {}, 0.0, False, "no capacity data")

    per_tr: dict[str, float] = {}
    total_kw = 0.0
    feasible = True
    note = ""
    for p in running:
        share = (p.capacity_tr or 0) / total_cap
        tr_i = target_tr * share
        per_tr[p.equipment_id] = round(tr_i, 1)
        if tr_i > (p.capacity_tr or 0) + 1e-6:
            feasible = False
            note = "exceeds capacity"
        if 0 < tr_i < _MIN_VALID_TR:
            feasible = False
            note = "a chiller would run below minimum load"
        kw = _predict_kw(p, tr_i)
        if kw is None:
            feasible = False
            note = "insufficient profile data"
        else:
            total_kw += kw
    return StagingOption(label, run_ids, per_tr, round(total_kw, 1), feasible, note)


def optimize_staging(
    profiles_list: list[ChillerProfile],
    *,
    target_tr: float | None,
    tariff_inr_per_kwh: float,
) -> StagingResult:
    profiles = {p.equipment_id: p for p in profiles_list}
    ids = list(profiles.keys())

    # Default target = typical simultaneous output = sum of each chiller's avg clean TR.
    target_source = "user"
    if target_tr is None or target_tr <= 0:
        target_source = "observed"
        target_tr = round(sum(
            (p.latest_tr or 0) if p.currently_running else 0 for p in profiles_list
        ), 1)
        if target_tr < _MIN_VALID_TR:  # nothing running now — fall back to mid-capacity
            target_tr = round(sum((p.capacity_tr or 0) for p in profiles_list) * 0.5, 1)

    # Candidate configs: each single chiller, and all-on (proportional split).
    candidates: list[list[str]] = [[i] for i in ids]
    if len(ids) > 1:
        candidates.append(ids)

    options = [_evaluate_config(profiles, c, target_tr) for c in candidates]
    feasible_opts = [o for o in options if o.feasible]
    recommended = min(feasible_opts, key=lambda o: o.est_kw) if feasible_opts else None

    current_ids = [p.equipment_id for p in profiles_list if p.currently_running]
    current_opt = _evaluate_config(profiles, current_ids, target_tr) if current_ids else None
    current_est_kw = current_opt.est_kw if (current_opt and current_opt.feasible) else None

    savings_kw = savings_pct = savings_inr = None
    rationale: list[str] = []
    if recommended and current_est_kw is not None:
        savings_kw = round(current_est_kw - recommended.est_kw, 1)
        if current_est_kw > 0:
            savings_pct = round(savings_kw / current_est_kw * 100, 1)
        savings_inr = round(savings_kw * tariff_inr_per_kwh, 2)
        if set(recommended.chillers) == set(current_ids):
            rationale.append("Current staging is already the lowest-energy option for this demand.")
        else:
            rationale.append(
                f"Switching to “{recommended.label}” is predicted to draw "
                f"{recommended.est_kw} kW vs {current_est_kw} kW now "
                f"({savings_kw} kW, ~₹{savings_inr}/h saved)."
            )
    elif recommended and not current_ids:
        rationale.append(f"No chiller is running; “{recommended.label}” is the lowest-energy way to meet {target_tr} TR.")

    return StagingResult(
        target_tr=target_tr,
        target_source=target_source,
        tariff_inr_per_kwh=tariff_inr_per_kwh,
        profiles=[_profile_dict(p) for p in profiles_list],
        current_chillers=current_ids,
        current_est_kw=current_est_kw,
        recommended=recommended,
        options=options,
        savings_kw=savings_kw,
        savings_pct=savings_pct,
        savings_inr_per_hr=savings_inr,
        rationale=rationale,
    )


def _profile_dict(p: ChillerProfile) -> dict:
    return {
        "equipment_id": p.equipment_id,
        "name": p.name,
        "capacity_tr": p.capacity_tr,
        "overall_kw_per_tr": p.overall_kw_per_tr,
        "currently_running": p.currently_running,
        "latest_tr": p.latest_tr,
        "latest_kw": p.latest_kw,
        "samples": p.samples,
    }
