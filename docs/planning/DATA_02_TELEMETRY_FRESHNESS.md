# Data Grounding 02 — Telemetry freshness

**Status:** queued · **ETA:** depends on which strategy is picked

## The honest current state

`MAX(slot_time)` across the 6 normalized telemetry tables is
**2026-04-22T17:55** — about 30 days ago at the time of writing.
The backend is in `TELEMETRY_TIME_ANCHOR=latest_in_db` mode, so the
"live" views actually anchor to that 30-days-ago slot — operators see
relative timestamps that are accurate *to the dataset*, not to wall
clock. There is no freshness warning because the mode is intentional.

This is fine for a demo / POC of analytics over a frozen snapshot.
For a real production pilot operators expect "live" to mean "now".

## Three options

### Option A — Demo mode (cheapest, most honest)
Add a yellow "Demo data · last update Apr 22 2026" banner to the
header so operators understand they are looking at a frozen snapshot.
No data change required.

**Effort:** ~30 min.
**Tradeoff:** Clear but doesn't add real freshness.

### Option B — Time-shift the dataset
A one-shot Python migration that adds `(today - MAX(slot_time))` to
every row's `slot_time` so the dataset slides to "now". The plant
behaviour is exactly the same; only the timestamps move. Combined with
a daily cron that re-runs the shift, the "live" views become genuinely
live (recycling the same 30-day window forever).

**Effort:** ~2 hours.
**Tradeoff:** Synthetic — the data is repeating; not suitable for
showing "what's happening right now" if the plant operator sees the
real BMS in parallel.

### Option C — Real ingest path
Run a small worker that pulls from the actual BMS / SCADA / OPC-UA
endpoint and appends new rows into the normalized tables. This is the
proper production path.

**Effort:** ~1–2 weeks (depends on the BMS protocol; BACnet vs Modbus
vs proprietary REST is already on the queued roadmap).
**Tradeoff:** Real but requires customer-side credentials and likely
network access we don't yet have.

## Recommendation

Ship **Option A** today (a one-line banner change) so operators are
never misled. Ship **Option B** alongside if a customer demo needs
"live-looking" data over a fresh window. Defer **Option C** to the
proper BACnet/Modbus connector phase already on the roadmap.

## Tasks (Option A)

- [ ] Detect the dataset max once at app startup
- [ ] Pass it through `/health` (already exposed as `latest_slot_time`)
- [ ] Show a yellow `<DemoDataBanner />` in `Layout.jsx` when the gap
      to "now" is > 24h
- [ ] Make the banner dismissible per session (localStorage)

## Tasks (Option B — optional)

- [ ] `scripts/timeshift_telemetry.py`: compute `(now - max) // 1h * 1h`,
      apply UPDATE on each normalized table in batches
- [ ] Wrap in a transaction per table; log row count
- [ ] Add to `make` targets and document in `docs/operations/`
- [ ] Optional cron: re-shift every 24h
