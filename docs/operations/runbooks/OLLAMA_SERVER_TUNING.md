# Ollama server tuning — Windows runbook

**Audience:** Whoever runs the Ollama host (typically the Tailscale GPU machine that serves the THERMYNX backend).

**Last updated:** 2026-05-28

This runbook documents the **`scripts/ollama_restart_tuned.bat`** script and explains every tuning knob it sets.

Related docs:
- [`docs/planning/ai/PERFORMANCE_PLAN.md`](../../planning/ai/PERFORMANCE_PLAN.md) — overall AI latency strategy
- [`docs/planning/ai/RELIABILITY_PLAN.md`](../../planning/ai/RELIABILITY_PLAN.md) — Ollama failure modes
- [`RUNBOOK.md`](./RUNBOOK.md) — main ops runbook (§11 Ollama section)

---

## When to run

- **First time setup** on the Ollama host
- **After a Windows reboot** (env vars set with `set` don't persist — see [Permanent variant](#permanent-variant-setx))
- **When Ollama gets stuck** (port held by a zombie, model wedged, OOM after concurrent load)
- **After changing tuning** in the script

## What it does (8 steps)

| Step | Action | Why |
|---|---|---|
| 1 | `taskkill` ollama.exe + "Ollama App.exe" | Both the CLI server and the tray app can hold port 11434 |
| 2 | `sc stop Ollama` | Stops the Windows service variant (if installed) |
| 3 | Kill any PID holding port 11434 | Catches anything missed above |
| 4 | Re-check port + retry kill | Belt-and-braces — Windows sometimes leaves zombie TCP entries |
| 5 | **Set tuning env vars** in the parent cmd | The spawned `ollama serve` child inherits these |
| 6 | `start cmd /k "ollama serve"` | Server runs in a separate window — its log stays visible |
| 7 | `curl /api/tags` | Smoke-test the API is up |
| 8 | Print `ollama ps` + `nvidia-smi` snapshot | Operator sees loaded models + VRAM use |

If step 7 fails, the script loops back to step 1.

---

## Quick start

```bat
:: from any cmd window
cd \path\to\HVAC AI Operations Intelligence Platform
scripts\ollama_restart_tuned.bat
```

Or double-click the file from Explorer. A console window opens with colored output showing each step. When you see the green **OLLAMA RUNNING · TUNED CONFIG ACTIVE** banner you're done.

---

## Env vars set by the script

Every var is documented inline in the script and printed at runtime. Reference table:

| Variable | Value | Effect |
|---|---|---|
| `OLLAMA_HOST` | `0.0.0.0` | Listen on all interfaces so Tailscale + LAN clients can reach it |
| `OLLAMA_ORIGINS` | `*` | CORS — allow browser-based dev clients to call directly |
| **Speed** | | |
| `OLLAMA_FLASH_ATTENTION` | `1` | ~15-25% faster attention on RTX 30/40-series + Ada GPUs |
| `OLLAMA_KV_CACHE_TYPE` | `q8_0` | Quantizes KV cache → 2× more context per VRAM GB. **Requires `FLASH_ATTENTION=1`** |
| **Residency** | | |
| `OLLAMA_KEEP_ALIVE` | `30m` | Model stays in VRAM 30 min after last call (default 5 min). Removes 1.5–2s cold-start |
| `OLLAMA_MAX_LOADED_MODELS` | `2` | Up to 2 models in VRAM concurrently (qwen2.5:14b + nomic-embed-text fits in ~10 GB) |
| **Throughput** | | |
| `OLLAMA_NUM_PARALLEL` | `2` | 2 concurrent requests per loaded model |
| **Logging** | | |
| `OLLAMA_DEBUG` | `0` | Quiet logs in production |

---

## VRAM sizing — adjust before running

The defaults assume **~16 GB VRAM minimum**. Adjust before running for your hardware:

| GPU class | VRAM | Recommended overrides |
|---|---|---|
| **High-end** (RTX 4090, A5000, A6000, L40) | 24 GB+ | Keep defaults; bump `MAX_LOADED_MODELS=3` to keep vision hot too |
| **Mid** (RTX 4080, RTX 4070 Ti Super, A4000) | 16 GB | Keep defaults |
| **Budget** (RTX 4070, RTX 3060) | 12 GB | `MAX_LOADED_MODELS=1`, `NUM_PARALLEL=1`, switch default to `qwen2.5:7b` |
| **CPU-only** | — | Set `OLLAMA_NUM_GPU=0` (not in script — manual edit) |

Edit the `set OLLAMA_*` lines at step 5 to override.

### How to check what you actually have

After running, the script prints `nvidia-smi` output. Or any time:

```bat
nvidia-smi --query-gpu=name,memory.total,memory.used,utilization.gpu --format=csv
ollama ps
```

Rule of thumb:
- If `memory.used / memory.total` stays below **60%**, you have slack → raise `NUM_PARALLEL` to 4 for more concurrent throughput
- If `memory.used` is at **95%+** during normal use, you're VRAM-bound → lower `NUM_PARALLEL` or `MAX_LOADED_MODELS`, or quantize models further (Q4 → Q3 — quality drops noticeably)

---

## Verifying after restart

Three checks confirm tuning took effect:

### 1. Env vars actually loaded
The script prints them in step 5. Compare your script values to what shows on screen. If a var shows empty, the `set` command failed (typo).

### 2. Speed improvement on first call
First call after restart should still load the model (~1.5s), but **second call within 30 minutes** should not — that's `KEEP_ALIVE` working.

```bash
# from the backend host
time curl -s -X POST http://<ollama-host>:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen2.5:14b","prompt":"ok","stream":false,"options":{"num_predict":4}}'
```
First call after a fresh restart: ~2.5s. Second call within KEEP_ALIVE window: ~0.2-0.4s.

### 3. Flash attention engaged
```bash
ollama show qwen2.5:14b --modelfile | grep -i flash
```
Doesn't directly verify; the proof is in latency. With FLASH_ATTENTION=1, a 200-token generation should run ~30-40 tok/s on RTX 4080-class hardware; without it, ~22-28 tok/s.

---

## Permanent variant (`setx`)

The `set` commands only affect the current cmd session. If you want every future `ollama serve` (any cmd / Windows service / startup) to pick these up without running this script, set them permanently with **`setx`** (admin not required, machine-wide needs `/M` + admin):

```bat
:: user-scope (current account only) — no admin needed
setx OLLAMA_HOST 0.0.0.0
setx OLLAMA_FLASH_ATTENTION 1
setx OLLAMA_KV_CACHE_TYPE q8_0
setx OLLAMA_KEEP_ALIVE 30m
setx OLLAMA_MAX_LOADED_MODELS 2
setx OLLAMA_NUM_PARALLEL 2

:: OR machine-scope (all users) — needs Run as administrator
setx OLLAMA_HOST 0.0.0.0 /M
:: ...etc
```

`setx` writes to the Windows registry. **Close and reopen all cmd / PowerShell windows** to pick up new vars. The restart script will still work afterwards — it just sets the same values again in its own scope.

**Recommended:** use `setx` once on a permanent install + keep the restart script around for ad-hoc tuning experiments.

---

## Troubleshooting

### "Port still busy" loop never clears

Windows sometimes keeps `TIME_WAIT` TCP entries from dead processes. If the script can't free 11434 after two tries:

```powershell
# from PowerShell, identify what's actually listening
Get-NetTCPConnection -LocalPort 11434 -State Listen |
  ForEach-Object { Get-Process -Id $_.OwningProcess -EA SilentlyContinue }
```

If `Get-Process` returns nothing for the OwningProcess, those are **ghost listeners** — wait 2 min for `TIME_WAIT` to clear, or reboot.

### `nvidia-smi` not on PATH

The script prints a friendly skip when this happens. To enable: install NVIDIA driver + CUDA Toolkit, then add `C:\Program Files\NVIDIA Corporation\NVSMI` to PATH.

### Ollama GUI tray app keeps the port

The "Ollama App" (tray) holds 11434 even when the visible window is closed. The script kills it via `taskkill /F /IM "Ollama App.exe"`. If you don't want the tray app running ever, uninstall it and use only `ollama serve` from cmd.

### Model fails to load with "out of memory"

Either:
- You set `MAX_LOADED_MODELS > 1` but VRAM only holds one — set to 1
- You set `NUM_PARALLEL > 1` with a large model — lower to 1
- A previous model wedged VRAM — full restart (this script handles it)

Check with `nvidia-smi` — if VRAM stays high after killing ollama, the GPU driver may need reset (reboot or `nvidia-smi --gpu-reset`).

### Backend can't reach Ollama after restart

Backend caches Ollama URL once at startup. After restarting Ollama:
```powershell
# restart the backend uvicorn too
Get-CimInstance Win32_Process -Filter "Name='python.exe'" |
  Where-Object { $_.CommandLine -like '*main:app*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
# then start it again as usual
```

Backend has a 60s timeout per request so it'll retry on its own after a brief outage, but explicit restart is safer.

---

## Rolling back

If a tuning change hurt performance:

1. Edit `scripts/ollama_restart_tuned.bat`
2. Comment the suspect `set` line(s) with `REM `
3. Re-run the script

To go fully back to **stock Ollama defaults**, comment out everything in step 5 except `OLLAMA_HOST`:

```bat
set OLLAMA_HOST=0.0.0.0
REM set OLLAMA_FLASH_ATTENTION=1
REM set OLLAMA_KV_CACHE_TYPE=q8_0
REM ... etc
```

---

## Changing models

The tuning is model-agnostic. To swap the default text model (e.g. to `qwen2.5:7b` for speed):

1. On the Ollama host: `ollama pull qwen2.5:7b`
2. On the backend: edit `backend/app/config.py` → `OLLAMA_DEFAULT_MODEL = "qwen2.5:7b"`
3. Or set env var: `OLLAMA_DEFAULT_MODEL=qwen2.5:7b` in the backend's `.env`
4. Restart backend so the new default takes effect

The script doesn't need to change — `ollama serve` loads models on demand from whatever the backend asks for.

---

## Where this lives in the repo

- **Script:** [`scripts/ollama_restart_tuned.bat`](../../../scripts/ollama_restart_tuned.bat)
- **This doc:** [`docs/operations/runbooks/OLLAMA_SERVER_TUNING.md`](./OLLAMA_SERVER_TUNING.md)
- **Performance context:** [`docs/planning/ai/PERFORMANCE_PLAN.md`](../../planning/ai/PERFORMANCE_PLAN.md) §B (Run faster — Ollama)
