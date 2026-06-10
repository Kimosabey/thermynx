# Mac Studio M3 Ultra (96 GB) — On-Prem Inference Evaluation

> **Date:** 2026-06-10 · **Status:** evaluated alternative (not adopted) ·
> **Companion:** [ONPREM_HARDWARE_SIZING.md §A7](../../../model-eval/reports/ONPREM_HARDWARE_SIZING.md)

## Context
We are weighing a **Mac Studio M3 Ultra (32-core CPU / 80-core GPU / 96 GB unified memory / 1 TB)** as an
on-prem box to serve the THERMYNX model team, against the planned NVIDIA path. THERMYNX's profile is
**many concurrent users across multiple sites**. This note records the comparison and the decision.

## Verdict
**Keep NVIDIA + vLLM (the planned 48 GB box) as the production engine.** vLLM's continuous batching on CUDA
is purpose-built for many parallel requests. Apple Silicon serving (Ollama-Metal, or the new **text-only**
`vllm-metal`) gives strong *single-stream* speed but weak *batched* throughput — it would bottleneck under
many concurrent users across sites. **The Mac Studio is the better choice for a single-box, low-concurrency,
edge / dev / demo / fallback role**, where its 96 GB "whole-team-hot" memory advantage matters most.

## Comparison — Mac Studio 96 GB vs NVIDIA 48 GB (planned)

| Factor | Mac Studio M3 Ultra 96 GB | NVIDIA 48 GB (RTX 6000 Ada / L40S) |
|---|---|---|
| Usable model memory | ~72–86 GB unified (`iogpu.wired_limit_mb`) | 48 GB VRAM |
| Memory bandwidth | ~819 GB/s | ~860–960 GB/s |
| Serving engine | Ollama-Metal (full team) · `vllm-metal` = **text-only** | **vLLM FP8** (best batching) or Ollama |
| Whole team hot (7 roles) | ✅ all resident, **no eviction/rotation** | ⚠️ core team fits (~31–44 GB); full set tight |
| Speed, single stream (14–24B) | interactive, ≈ phi4-on-RTX-4000 (~35 tok/s) or better | comparable |
| **Concurrent batching (many users)** | ❌ weak (~20–50 tok/s, limited) | ✅ **strong — continuous batching** |
| Vision (llama3.2-vision) | ✅ Ollama-Metal | ✅ |
| Power / noise / footprint | ✅ ~100–200 W, silent, desktop | ❌ workstation/server |
| Multi-site replication | ⚠️ one Mac per site (low per-site load only) | ✅ central vLLM server or per-site GPU |
| Ops / toolchain | macOS (different) | Linux + CUDA (standard for vLLM) |
| Cost (this config) | ~$4,000 / ~₹3.5 L | RTX 6000 Ada ~$6.8k card + server chassis |

## Why concurrency is the deciding factor
- A **discrete NVIDIA GPU + vLLM** batches many in-flight requests into one efficient pass (continuous
  batching), so throughput scales with users — the right model for **multi-site, many-user** THERMYNX.
- **Apple Silicon** shares one memory pool (great for fitting large models) but its scheduler/bandwidth
  favor **one request at a time**; under concurrency, per-request latency degrades quickly.
- So the Mac wins when **memory-bound on one box**; NVIDIA wins when **throughput-bound across many users** —
  which is our case.

## Caveats
- `vllm-metal` (v0.2.0, Apr 2026) is **text-only — no vision**; on a Mac, vision must run on Ollama-Metal.
- **No CUDA path** → no FP8/vLLM production tuning, no flash-attention; macOS ops differ from a Linux server.
- Apple Metal **is** a first-class Ollama backend — this is *not* the same as the Intel NPU/iGPU rejection
  (see [ONPREM_HARDWARE_SIZING.md §A6](../../../model-eval/reports/ONPREM_HARDWARE_SIZING.md)).

## Where the Mac *does* win (keep it in reserve)
- A **per-site edge box** at a small/low-concurrency site.
- A **quiet, low-power dev / demo machine** that holds the entire team hot with zero rotation.
- A **fallback** if NVIDIA procurement is delayed.

## Validation if procured (do NOT run now — needs the hardware)
Benchmark **concurrent** throughput, not single-stream: fire **10–20 parallel `/analyze` requests** at the
Mac vs the 48 GB box and measure tokens/sec **under load** (single-stream numbers hide the batching gap),
plus one `llama3.2-vision` call via Ollama-Metal. That load test is the real decision input.
