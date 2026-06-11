# GPU / Ollama VRAM Contention — Incident & Resolution

**Date:** 2026-06-11
**Status:** ✅ Resolved (common path); ⏳ hardware upgrade (48 GB) recommended for heavy multi-model jobs.

## Summary

THERMYNX was showing **"⚠ Skipped: LLM timeout"** (especially on anomaly cards) and slow analyze/agent
responses. Root cause: the **sibling platform OMNYX shared the same 20 GB Ollama GPU box** and kept loading
`gpt-oss:20b` + `mxbai-embed-large`, which **evicted THERMYNX's `phi4`** from VRAM and forced constant
cold-loads. Fixed by stopping OMNYX, correcting the anomaly-explanation model routing, and pinning phi4.
The 20 GB GPU remains the standing constraint for THERMYNX's own heavy models (48 GB box recommended).

## Environment

| Thing | Value |
|-------|-------|
| Ollama GPU server | `100.125.103.28` (Tailscale) · NVIDIA RTX 4000 Ada · **20 GB VRAM** · Ollama 0.30.7 |
| THERMYNX backend + dev laptop | `100.88.22.7` (Tailscale) |
| THERMYNX models | phi4 (text/RAG/anomaly), codestral (SQL), devstral (agent), gemma4:12b (planner), nomic-embed-text (embeddings) |
| Tuned Ollama env | flash-attn on, q8 KV cache, `KEEP_ALIVE=30m`, `MAX_LOADED_MODELS` 2–3, `NUM_PARALLEL=1` |

## Symptoms

- Anomaly cards returned **"⚠ Skipped: LLM timeout"**.
- Slow `/analyze`, `/agent`; the VRAM monitor showed `gpt-oss:20b` and `mxbai-embed-large` repeatedly
  loading and unloading **alongside/against** `phi4` (blank gaps = mid-swap).

## Root cause

1. **20 GB holds ~one large model at a time.** THERMYNX alone uses 5 models; any two big ones exceed 20 GB,
   so cross-model requests **cold-load (8–22 s each)**.
2. **The recurring "intruder" was OMNYX** — the `omnyx-agentic-ai` Docker container on the laptop, with:
   ```
   LLM_BASE_URL  = http://100.125.103.28:11434/v1   ← same Ollama box as THERMYNX
   PLANNER_MODEL = gpt-oss:20b                       ← the gpt-oss seen in VRAM
   EMBED_MODEL   = mxbai-embed-large                 ← the mxbai seen in VRAM
   ```
   OMNYX's models kept evicting THERMYNX's `phi4`.

## What we changed

**Code (committed):**
- `backend/app/services/causal.py` (anomaly explanation) — was `OLLAMA_DEFAULT_MODEL`
  (mistral-small3.2, a *cold* model); now `OLLAMA_MODEL_TEXT` (**phi4**, the warm one) + timeout **20 → 45 s**
  + `keep_alive` so it survives a cold-load. Commit `49a5239`.

**Ops (on the boxes):**
- **Stopped OMNYX** (`docker stop` all `omnyx-*`) → freed gpt-oss/mxbai off the shared GPU.
- **Removed a firewall rule** that mistakenly blocked the laptop (`100.88.22.7`) from Ollama — it had also
  cut off THERMYNX's own backend (the laptop is the backend host).
- **Warmed + pinned phi4** (`keep_alive=-1`).

**Monitoring tooling (committed in `scripts/`):**
- `ollama_all.bat` — one file: restart Ollama tuned + warm hot models + open monitors.
- `ollama_kick.bat` — one click: unload gpt-oss/mxbai + re-warm phi4.
- `ollama_ps.ps1`, `ollama_monitor.bat` (live + logs to `ollama_vram.log`), `ollama_who.ps1`, `ollama_dashboard.bat`.

## Resolution / current state

- VRAM on the server: **only `phi4` (~8.7 GB)** loaded — **no gpt-oss, no mxbai**.
- THERMYNX common path (**analyze / anomaly / RAG**) is instant on warm phi4.

## Key learnings

- **`/api/tags` ≠ `/api/ps`.** `/api/tags` = models *installed on disk* (0 VRAM until used); `/api/ps` =
  models *loaded in VRAM* (what actually uses the GPU). `gpt-oss` still appears in `/api/tags` — that's fine;
  it's a dormant file, not on the GPU.
- **Don't firewall-block an IP that is also your backend host.** We briefly blocked `100.88.22.7` and cut off
  THERMYNX itself; removing the rule restored it. The correct fix was stopping the OMNYX *app*, not the IP.

## How to keep it solved

- **Don't run OMNYX's AI against the shared Ollama box.** Repoint OMNYX `LLM_BASE_URL` off `100.125.103.28`
  (e.g. the laptop's local Ollama or its own GPU), or run only one platform's AI at a time on this GPU.
- `keep_alive=-1` pins phi4 **until the Ollama server restarts** — re-warm after any restart
  (`ollama_all.bat` does this automatically).
- Watch VRAM with `scripts/ollama_dashboard.bat` (or `ollama_ps.ps1`); if gpt-oss/mxbai reappear, run
  `scripts/ollama_kick.bat`.

## Remaining (hardware — not a code bug)

Even with OMNYX gone, THERMYNX's own 24B specialists (codestral ~13 GB, devstral ~14 GB) cannot co-reside
with phi4 in 20 GB, so **SQL / agent / orchestrate still cold-load (~10–20 s) on first use**. A **48 GB GPU**
co-resides all five models → no cold-loads → no timeouts. This is an optimization for the heavy paths; the
common path already runs fast on the 20 GB box.
