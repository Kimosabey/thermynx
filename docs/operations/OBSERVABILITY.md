# Graylinx — Observability Stack

> Reference docs: [RUNBOOK.md](./RUNBOOK.md) · [ENV_REFERENCE.md](../reference/ENV_REFERENCE.md) · [FLAWS_AND_IMPROVEMENT_PLAN.md](../planning/FLAWS_AND_IMPROVEMENT_PLAN.md)

> **Status 2026-05-15:** Five of six open items closed. Stack now includes Alertmanager, 5 alert rules, **two** auto-provisioned Grafana dashboards (API Overview + AI Operations), backend log shipping into Loki, **5 custom Prometheus metrics wired into real call sites**, data-freshness signal on `/health`, request-ID correlation through Ollama, and **5 Makefile shortcuts** (`make obs`, `obs-status`, `obs-reload`, `obs-curl-metrics`, `obs-test-alert`). Only full OpenTelemetry tracing (would require adding Tempo + collector) is still deferred.
>
> **New here?** Skip to [§3 First-Boot Setup](#3-first-boot-setup-5-minutes) — 5 minutes to running stack.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Tech Inventory — What's Wired, Where, Why](#2-tech-inventory--whats-wired-where-why)
3. [First-Boot Setup (5 minutes)](#3-first-boot-setup-5-minutes)
4. [What to See at Each Port (and When)](#4-what-to-see-at-each-port-and-when)
5. [What Is Already Wired (Always-On)](#5-what-is-already-wired-always-on)
6. [Optional Observability Stack — `obs` Profile](#6-optional-observability-stack--obs-profile)
7. [Starting / Stopping the Stack](#7-starting--stopping-the-stack)
8. [Service URLs](#8-service-urls)
9. [Prometheus — Metrics](#9-prometheus--metrics)
10. [Loki + Promtail — Logs](#10-loki--promtail--logs)
11. [Grafana — Dashboards](#11-grafana--dashboards)
12. [Alertmanager — Alert Rules & Routing](#12-alertmanager--alert-rules--routing)
13. [Config Files Reference](#13-config-files-reference)
14. [Enabling Structured Logs (JSON)](#14-enabling-structured-logs-json)
15. [Correlation: Request IDs Across Layers](#15-correlation-request-ids-across-layers)
16. [Custom Application Metrics](#16-custom-application-metrics)
17. [How-To: add metric / alert / dashboard panel](#17-how-to-add-metric--alert--dashboard-panel)
18. [Daily Debugging Workflows](#18-daily-debugging-workflows)
19. [Make Targets Cheat Sheet](#19-make-targets-cheat-sheet)
20. [PromQL + LogQL Cookbook](#20-promql--logql-cookbook)
21. [Troubleshooting](#21-troubleshooting)
22. [What Is Still Missing (Open Work)](#22-what-is-still-missing-open-work)

---

## 1. Overview

The observability stack gives you four signals:

| Signal | Tool | What you see |
|--------|------|-------------|
| **Metrics** | Prometheus + Grafana | Request rates, latencies, error rates, active requests, telemetry age, anomaly counts |
| **Logs** | Loki + Promtail + Grafana | Structured JSON log lines from Docker containers **and** the uvicorn-on-host backend, queryable by label |
| **Alerts** | Alertmanager | 4 alert rules firing on backend down / 5xx spike / p99 latency / stale telemetry |
| **Dashboards** | Grafana | Pre-provisioned "Graylinx — API Overview" dashboard combining metrics + logs |

The stack is **optional** — it does not need to run for the platform to function. Core services (Postgres, Redis) always start. The observability stack starts only when you add the `obs` profile flag.

---

## 2. Tech Inventory — What's Wired, Where, Why

Every piece of the stack, its version, the port it listens on, what it does, and **why you'd open it.**

| Tech | Version | Port | Role | Why look here |
|------|---------|------|------|--------------|
| **FastAPI `/metrics`** | `prometheus-fastapi-instrumentator` | `:8000/metrics` | Exposes HTTP + custom metrics in Prometheus text format | Sanity-check that the backend is publishing metrics at all (e.g. `make obs-curl-metrics`) |
| **Prometheus** | `v2.47.0` | `:9090` | Scrapes `/metrics` every 10s, stores time-series, evaluates alert rules | Run ad-hoc PromQL queries · check whether a scrape target is healthy (Status → Targets) · see current alert states (Alerts tab) |
| **Alertmanager** | `v0.27.0` | `:9093` | Receives firing alerts from Prometheus, dedupes, routes, suppresses | See currently firing alerts · silence noisy alerts during maintenance · inspect the receiver pipeline |
| **Loki** | `2.9.0` | `:3100` | Stores log streams with label-based indexing | No UI — query through Grafana. Open `:3100/ready` to verify it's up |
| **Promtail** | `2.9.0` | `:9080` | Tails Docker socket + `./logs/*.log`, parses JSON, ships to Loki | Verify which scrape jobs are active and how many lines they've shipped |
| **Grafana** | `10.0.0` | `:3000` | Dashboards + ad-hoc Explore against both Prometheus and Loki | The main day-to-day pane — dashboards, log queries, panel editing |
| **Redis Commander** | `latest` | `:8081` | Browse Redis keys / TTL / pub-sub (not formally part of obs stack) | Inspect cache state during debugging |

### Backend-side hooks (not separate services — just code)

| Hook | Where | Purpose |
|------|-------|---------|
| `Instrumentator().instrument(app).expose(app)` | [`backend/main.py:120`](../../backend/main.py#L120) | Wires auto HTTP metrics + `/metrics` endpoint |
| Custom metrics module | [`backend/app/observability/metrics.py`](../../backend/app/observability/metrics.py) | 5 Graylinx-specific metrics (data age, agent runs, analyzer requests, anomalies, freshness checks) |
| Request-ID middleware | [`backend/main.py`](../../backend/main.py) | Generates / accepts `X-Request-Id`, propagates via `contextvars` |
| Correlation context | [`backend/app/observability/context.py`](../../backend/app/observability/context.py) | `ContextVar` that the Ollama client reads to forward the ID downstream |
| `RotatingFileHandler` in JSON | [`backend/app/logging_setup.py`](../../backend/app/logging_setup.py) | Writes a JSON-per-line file Promtail can tail |
| Freshness gauge update | [`backend/app/api/v1/health.py`](../../backend/app/api/v1/health.py) | Each `/health` call updates `graylinx_telemetry_data_age_seconds` |

### What you DON'T need running for what

| If you only need… | …then run | Skip |
|--------------------|-----------|------|
| Just see if `/metrics` works | nothing extra | the whole obs profile |
| Live dashboards | `make obs` | nothing |
| Alerts firing into Slack/email | `make obs` + receiver config | nothing |
| Just tail logs locally | `make backend` in a terminal | obs profile (you have stdout) |

---

## 3. First-Boot Setup (5 minutes)

Run these once on a fresh clone. Order matters.

### 3.1 — Enable backend file logging (so Loki sees uvicorn logs)

```bash
cd backend
cp .env.example .env       # if you don't already have one
```

Open `backend/.env` and uncomment these lines (defaults are sane):

```bash
LOG_JSON=true
LOG_FILE=./logs/graylinx-api.log
LOG_FILE_MAX_BYTES=10485760
LOG_FILE_BACKUP_COUNT=5
```

> Without `LOG_FILE`, the obs stack still works for Docker containers and Prometheus metrics — but backend log lines won't reach Loki when uvicorn runs on the host.

### 3.2 — Start core services + backend

```bash
make deps                  # Postgres + Redis (terminal 1, one-time)
make backend               # uvicorn (keep open)
```

Verify `/metrics` is alive and exposes Graylinx counters:

```bash
make obs-curl-metrics
```

You should see lines starting with `graylinx_telemetry_data_age_seconds`, `graylinx_agent_runs_total`, etc.

### 3.3 — Start observability stack

```bash
make obs
```

Output prints all four URLs. Wait ~10 s for Grafana to provision dashboards, then verify:

```bash
make obs-status
```

Expected:
- 5 containers `Up`
- `"health":"up"` for the `thermynx-api` scrape target
- `(none)` for active alerts (nothing should be firing on first boot)

### 3.4 — Verify the dashboards loaded

Open [http://localhost:3000](http://localhost:3000) → click **Dashboards** in the left rail → expand **Graylinx** folder. You should see two dashboards:

- **Graylinx — API Overview**
- **Graylinx — AI Operations**

Click **API Overview**. The "Backend up" tile should be green; the request-rate panel will start filling in after a few HTTP requests hit the backend.

### 3.5 — Smoke-test the alert pipeline

```bash
make obs-test-alert
```

Then open [http://localhost:9093](http://localhost:9093) — you should see a `TestAlert` row. (The default receiver is a webhook stub — see [§12 Wiring a real receiver](#wiring-a-real-receiver) when you want real Slack/email delivery.)

You're done. Everything works.

---

## 4. What to See at Each Port (and When)

This is the "I have N tabs open — which one do I look at?" guide.

### `:3000` — Grafana

**Open when:** building intuition · investigating an incident · sharing a screenshot.

| Click here | To see |
|-----------|--------|
| Dashboards → Graylinx → **API Overview** | Request rate / latency / errors / log volume / recent errors — your home screen during a deploy |
| Dashboards → Graylinx → **AI Operations** | Agent runs by mode · analyzer p99 · anomaly counts per equipment · last 24h trends |
| Explore → datasource `Prometheus` | One-off PromQL queries while iterating |
| Explore → datasource `Loki` | Log search by request ID, logger, level, substring |
| Configuration → Data sources | Verify Prometheus + Loki are still reachable (Save & test) |

### `:9090` — Prometheus

**Open when:** building a PromQL expression · debugging "why isn't this metric showing up?" · checking alert state.

| Click here | To see |
|-----------|--------|
| **Graph** tab | Sandbox for PromQL — type an expression, see the value over time |
| **Alerts** tab ([/alerts](http://localhost:9090/alerts)) | All 5 alert rules with current state: **inactive** / **pending** / **firing** |
| **Status → Targets** | Confirm Prometheus can reach `host.docker.internal:8000` — if red, `make backend` isn't running |
| **Status → Rule Configuration** | Diff between the rules file and what's actually loaded — after `make obs-reload` |

### `:9093` — Alertmanager

**Open when:** an alert fires · need to silence noise during planned work.

| Click here | To see |
|-----------|--------|
| **Alerts** | Live firing alerts with full label set + annotations |
| **Silences** | Add a "do not page" window during a maintenance event (with required comment) |
| **Status** | Cluster info + currently-loaded `alertmanager.yml` config |

### `:3100` — Loki

**Open when:** never directly — query through Grafana. But:

| URL | What it tells you |
|-----|-------------------|
| `http://localhost:3100/ready` | Returns `ready` when Loki is healthy |
| `http://localhost:3100/metrics` | Loki's own metrics (ingestion rate, query latency) — meta-monitoring |

### `:9080` — Promtail

**Open when:** "why isn't my log showing up in Loki?"

| Click here | To see |
|-----------|--------|
| Targets section | Which sources are being scraped (Docker socket + your log file) and how many lines they've shipped |
| Service Discovery | Which containers Promtail has discovered |

### `:8000/metrics` — Backend

**Open when:** "is the metric I just added actually being exported?"

```bash
curl http://localhost:8000/metrics | grep graylinx_
```

Or via Make:

```bash
make obs-curl-metrics
```

---

## 5. What Is Already Wired (Always-On)

Even without starting the `obs` profile, the backend already exposes Prometheus metrics.

### `/metrics` endpoint

**File:** [backend/main.py](../../backend/main.py#L119)

```python
from prometheus_fastapi_instrumentator import Instrumentator
Instrumentator().instrument(app).expose(app)
```

This auto-instruments every FastAPI route and exposes standard metrics at:

```
http://localhost:8000/metrics
```

The `/metrics` path is excluded from the optional API key gate (see [backend/main.py](../../backend/main.py#L172)).

### What metrics are exposed

`prometheus-fastapi-instrumentator` provides these out of the box:

| Metric name | Type | What it measures |
|-------------|------|-----------------|
| `http_requests_total` | Counter | Total requests by method, handler, status |
| `http_request_duration_seconds` | Histogram | Latency distribution per endpoint |
| `http_requests_in_progress` | Gauge | Concurrent active requests |
| `http_request_size_bytes` | Histogram | Request body size |
| `http_response_size_bytes` | Histogram | Response body size |

Plus the **custom Graylinx metrics** registered in [`backend/app/observability/metrics.py`](../../backend/app/observability/metrics.py) (see [§13](#13-custom-application-metrics)).

**Test it right now (no `obs` stack needed):**

```bash
curl http://localhost:8000/metrics
```

You should see raw Prometheus text exposition format, e.g.:
```
# HELP http_requests_total Total number of requests by method, handler and status.
# TYPE http_requests_total counter
http_requests_total{handler="/api/v1/equipment/summary",method="GET",status="2xx"} 14.0
# HELP graylinx_telemetry_data_age_seconds Age of the newest row in the Unicharm MySQL telemetry tables, in seconds.
# TYPE graylinx_telemetry_data_age_seconds gauge
graylinx_telemetry_data_age_seconds 0.0
...
```

---

## 6. Optional Observability Stack — `obs` Profile

The full stack runs five containers under the Docker Compose `obs` profile:

```
docker-compose.yml
  profiles: [obs]
    ├── prometheus     — scrapes /metrics, evaluates alert rules
    ├── alertmanager   — receives firing alerts, routes to webhook
    ├── loki           — receives and stores log streams
    ├── promtail       — ships Docker container logs + backend file logs into Loki
    └── grafana        — dashboards UI, reads from both Prometheus and Loki
```

Config files live in:

```
monitoring/
  prometheus.yml                 — scrape job + alertmanager target + rule loader
  prometheus.alerts.yml          — 4 alert rules (backend down, error rate, latency, stale data)
  alertmanager.yml               — routing config + receiver
  loki.yml                       — Loki storage config
  promtail.yml                   — log shipping config (Docker socket + backend file)
  grafana/
    provisioning/
      datasources/datasources.yml             — auto-provisions Prometheus + Loki as datasources
      dashboards/dashboards.yml               — auto-provisions dashboards from JSON files
      dashboards/graylinx-api-overview.json   — pre-built API overview dashboard
      dashboards/graylinx-ai-operations.json  — pre-built AI / agent operations dashboard
```

---

## 7. Starting / Stopping the Stack

### Start observability stack only (leave core services running)

```bash
docker compose --profile obs up -d
```

### Start everything together (core + obs)

```bash
docker compose --profile obs up -d
# Then start backend and frontend as normal:
cd backend && ../.venv/Scripts/uvicorn main:app --reload --port 8000
cd frontend && npm run dev
```

> To get **backend logs into Loki when running on host (not in Docker)**, also set `LOG_FILE=./logs/graylinx-api.log` in `backend/.env` — see [§7](#7-loki--promtail--logs).

### Stop observability stack only

```bash
docker compose --profile obs down
```

### Stop everything

```bash
docker compose --profile obs down
```

### Check status

```bash
docker compose ps
```

All five `obs` containers should show `Up`:

```
NAME                         IMAGE                         STATUS
graylinx-prometheus-1        prom/prometheus:v2.47.0       Up
graylinx-alertmanager-1      prom/alertmanager:v0.27.0     Up
graylinx-loki-1              grafana/loki:2.9.0            Up
graylinx-promtail-1          grafana/promtail:2.9.0        Up
graylinx-grafana-1           grafana/grafana:10.0.0        Up
```

---

## 8. Service URLs

| Service | URL | Credentials | When to open |
|---------|-----|-------------|--------------|
| **Grafana** | [http://localhost:3000](http://localhost:3000) | No login required (anonymous admin) | Day-to-day dashboards · log search via Explore |
| **Prometheus** | [http://localhost:9090](http://localhost:9090) | No auth | Iterating on a PromQL expression · checking alert rule state at `/alerts` · confirming scrape targets are reachable at `/targets` |
| **Alertmanager** | [http://localhost:9093](http://localhost:9093) | No auth | When alerts fire · adding silences during planned maintenance |
| **Loki** | [http://localhost:3100](http://localhost:3100) | Internal; query via Grafana | `:3100/ready` for liveness · `:3100/metrics` for ingestion stats |
| **Promtail status** | [http://localhost:9080](http://localhost:9080) | Scrape status page | "Why isn't my log showing in Loki?" — check active targets here |
| **Backend `/metrics`** | [http://localhost:8000/metrics](http://localhost:8000/metrics) | No auth (excluded from API key gate) | "Is my new custom metric being exported?" |

> Grafana has `GF_AUTH_ANONYMOUS_ENABLED=true` and `GF_AUTH_ANONYMOUS_ORG_ROLE=Admin` — no login form. This is intentional for this internal facility tool.

See [§4 What to See at Each Port](#4-what-to-see-at-each-port-and-when) for a deeper "click here → see that" walkthrough.

---

## 9. Prometheus — Metrics

### Scrape config

**File:** [monitoring/prometheus.yml](../../monitoring/prometheus.yml)

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']

rule_files:
  - /etc/prometheus/prometheus.alerts.yml

scrape_configs:
  - job_name: thermynx-api
    static_configs:
      - targets: ['host.docker.internal:8000']
    metrics_path: /metrics
    scrape_interval: 10s
```

- Prometheus scrapes the FastAPI `/metrics` endpoint every **10 seconds**.
- Alert rules are loaded from [`prometheus.alerts.yml`](../../monitoring/prometheus.alerts.yml) and evaluated every 15s.
- Firing alerts are sent to Alertmanager on `alertmanager:9093`.

### Query examples in Prometheus UI

Open [http://localhost:9090](http://localhost:9090) → use the **Graph** tab.

**Request rate (last 5 min):**
```promql
rate(http_requests_total[5m])
```

**Error rate (5xx only):**
```promql
sum(rate(http_requests_total{status=~"5.."}[5m]))
```

**p99 latency per endpoint:**
```promql
histogram_quantile(0.99, sum by (handler, le) (rate(http_request_duration_seconds_bucket[5m])))
```

**Active requests right now:**
```promql
http_requests_in_progress
```

**Telemetry data age (only meaningful in wall_clock mode):**
```promql
graylinx_telemetry_data_age_seconds
```

---

## 10. Loki + Promtail — Logs

### How logs flow

```
┌──────────────────────────┐    ┌──────────────────────────┐
│  Docker container logs   │    │  Backend uvicorn-on-host │
│  (postgres, redis, ...)  │    │  → ./logs/*.log (JSON)   │
└────────────┬─────────────┘    └────────────┬─────────────┘
             │                                │
             ▼                                ▼
         ┌──────────────────────────────────────────┐
         │  Promtail (Docker socket + file scrape)  │
         └────────────────────┬─────────────────────┘
                              ▼
                       ┌─────────────┐
                       │    Loki     │
                       └──────┬──────┘
                              ▼
                       ┌─────────────┐
                       │   Grafana   │
                       └─────────────┘
```

### Promtail config

**File:** [monitoring/promtail.yml](../../monitoring/promtail.yml)

Two scrape jobs are configured:

| Job | Source | Labels applied |
|-----|--------|----------------|
| `docker-containers` | Docker socket | `container`, `logstream`, `service` |
| `graylinx-api-file` | Bind-mounted `./logs/*.log` (JSON one-line-per-record) | `job="graylinx-api"`, `service="api"`, `source="file"`, plus pipeline-extracted `level` and `logger` |

The backend log file pipeline:

1. Backend writes JSON via `RotatingFileHandler` to `./logs/graylinx-api.log`
2. docker-compose bind-mounts `./logs:/var/log/graylinx:ro` into the promtail container
3. Promtail tails files matching `/var/log/graylinx/*.log`
4. The `json` pipeline stage extracts `ts`, `level`, `logger`, `msg` fields and promotes `level` + `logger` to labels for fast filtering

### Enabling backend file logging

Set in `backend/.env`:

```bash
LOG_FILE=./logs/graylinx-api.log
LOG_JSON=true                  # stdout is also JSON when this is true
LOG_FILE_MAX_BYTES=10485760    # 10 MB rotation (default)
LOG_FILE_BACKUP_COUNT=5        # keep last 5 rotated files (default)
```

Restart the backend — log records now go to **both** stdout and the file. The file is always JSON regardless of `LOG_JSON` (so Promtail's JSON pipeline always works).

> **Backend in Docker:** if you run the backend inside docker-compose (not the typical dev flow), the `docker-containers` scrape job picks up its stdout automatically — no `LOG_FILE` needed.

### Querying logs in Grafana

1. Open [http://localhost:3000](http://localhost:3000)
2. Go to **Explore** → select datasource **Loki**
3. Use LogQL:

**All Postgres logs:**
```logql
{service="postgres"}
```

**Backend API logs (file source):**
```logql
{service="api", source="file"}
```

**Backend errors only:**
```logql
{service="api"} | json | level=~"ERROR|CRITICAL"
```

**Filter by logger namespace:**
```logql
{service="api", logger="thermynx.llm.ollama"}
```

**Error lines from any container:**
```logql
{container=~".+"} |= "error"
```

---

## 11. Grafana — Dashboards

### Auto-provisioned datasources + dashboards

**Files:**
- [monitoring/grafana/provisioning/datasources/datasources.yml](../../monitoring/grafana/provisioning/datasources/datasources.yml) — Prometheus + Loki
- [monitoring/grafana/provisioning/dashboards/dashboards.yml](../../monitoring/grafana/provisioning/dashboards/dashboards.yml) — dashboard provider
- [monitoring/grafana/provisioning/dashboards/graylinx-api-overview.json](../../monitoring/grafana/provisioning/dashboards/graylinx-api-overview.json) — pre-built API overview
- [monitoring/grafana/provisioning/dashboards/graylinx-ai-operations.json](../../monitoring/grafana/provisioning/dashboards/graylinx-ai-operations.json) — pre-built AI / agent operations

On startup Grafana auto-creates everything — open Grafana and find both dashboards in the **Graylinx** folder.

### Pre-built panels — API Overview dashboard

| Panel | Source | Purpose |
|-------|--------|---------|
| **Backend up** | Prometheus `up{job=...}` | Big red/green tile — is the scrape working? |
| **Active requests** | Prometheus `http_requests_in_progress` | Concurrent in-flight requests |
| **Telemetry data age** | Prometheus `graylinx_telemetry_data_age_seconds` | Newest MySQL row age (wall_clock mode) |
| **Error rate (5xx /s)** | Prometheus `rate(http_requests_total{status=~"5.."}[5m])` | Headline reliability signal |
| **Request rate by handler** | Prometheus | Per-endpoint throughput over time |
| **p99 latency by handler** | Prometheus | Per-endpoint tail latency over time |
| **Status code distribution** | Prometheus, stacked | 2xx / 4xx / 5xx mix |
| **Backend error log rate** | Loki | Error log volume — early warning |
| **Recent backend errors** | Loki | Live tail of WARN/ERROR/CRITICAL records |

### Pre-built panels — AI Operations dashboard

| Panel | Source | Purpose |
|-------|--------|---------|
| **Agent runs (1h)** | Prometheus `increase(graylinx_agent_runs_total[1h])` | Total agent activity in last hour |
| **Analyzer requests (1h)** | Prometheus `increase(graylinx_analyzer_requests_total[1h])` | Analyzer call volume |
| **Anomalies detected (24h)** | Prometheus `increase(graylinx_anomalies_detected_total[24h])` | Plant anomaly volume — yellow > 5, red > 20 |
| **Agent error rate (5m)** | Prometheus | % of agent runs ending in error |
| **Agent runs by mode** | Prometheus, stacked | Investigator / Optimizer / Brief / Root Cause / Maintenance usage mix |
| **Agent run status mix** | Prometheus, stacked bars | ok / error / aborted breakdown over time |
| **Analyzer p99 + p50 latency** | Prometheus | Tail vs typical analyzer latency |
| **Anomalies by equipment (1h)** | Prometheus | Which chillers / towers are noisiest |
| **Recent agent + analyzer events** | Loki | Filtered tail of `services.agent` / `api.analyzer` / `llm.ollama` |

### Editing / adding panels

Edit in the Grafana UI, then export to JSON: **Dashboard → Settings → JSON Model**, copy, save to `monitoring/grafana/provisioning/dashboards/<name>.json`. On next start it's auto-provisioned.

> Per `dashboards.yml`, `allowUiUpdates: true` lets you tweak in the UI for experiments — but for permanent changes, edit the JSON file in the repo so the change survives volume wipes.

---

## 12. Alertmanager — Alert Rules & Routing

### Active alert rules

**File:** [monitoring/prometheus.alerts.yml](../../monitoring/prometheus.alerts.yml)

| Alert | Severity | Fires when | For |
|-------|----------|------------|-----|
| **BackendDown** | critical | `up{job="thermynx-api"} == 0` | 1m |
| **HighErrorRate** | warning | 5xx rate > 0.1/s | 5m |
| **HighLatencyP99** | warning | p99 latency > 5s on any handler | 5m |
| **TelemetryStale** | warning | `graylinx_telemetry_data_age_seconds` > 1800 | 5m |
| **OllamaErrorRate** | warning | 5xx rate on `/analyze` or `/agent/run` > 0.05/s | 5m |

A commented-out **AnomalyRateSpike** rule is included in the file as a template for when the Loki ruler is wired up (Loki-based alerts need a separate `loki-ruler` config).

### Alertmanager routing

**File:** [monitoring/alertmanager.yml](../../monitoring/alertmanager.yml)

Default config:

- Groups alerts by `alertname` + `severity`
- Group wait: 30s · group interval: 5m · repeat: 4h
- **Receiver:** webhook stub at `http://host.docker.internal:9099/alert-sink` (placeholder — replace with a real Slack / Teams / email / PagerDuty webhook)
- **Inhibit rule:** when `BackendDown` is firing, suppresses `HighErrorRate` / `HighLatencyP99` / `TelemetryStale` to avoid alert storms

### Wiring a real receiver

Edit `monitoring/alertmanager.yml`. For **Slack**, replace the `webhook_configs` block with:

```yaml
receivers:
  - name: default
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/T0XXXX/B0YYYY/abcdef...'
        channel: '#graylinx-alerts'
        send_resolved: true
        title: '{{ .GroupLabels.alertname }} ({{ .Status }})'
        text: '{{ range .Alerts }}{{ .Annotations.summary }}\n{{ .Annotations.description }}\n{{ end }}'
```

Reload Alertmanager:

```bash
curl -X POST http://localhost:9093/-/reload
```

### Inspecting firing alerts

- Alertmanager UI: [http://localhost:9093](http://localhost:9093)
- Prometheus → **Alerts** tab: [http://localhost:9090/alerts](http://localhost:9090/alerts)

---

## 13. Config Files Reference

| File | Purpose | Key settings |
|------|---------|-------------|
| [monitoring/prometheus.yml](../../monitoring/prometheus.yml) | Scrape targets + alert wiring | Target `host.docker.internal:8000`, 10s interval, rules from `prometheus.alerts.yml`, alerts → `alertmanager:9093` |
| [monitoring/prometheus.alerts.yml](../../monitoring/prometheus.alerts.yml) | Alert rules | 5 rules (4 active + 1 commented Loki template) |
| [monitoring/alertmanager.yml](../../monitoring/alertmanager.yml) | Alert routing + receivers | Webhook stub (replace for production), inhibit rule for BackendDown |
| [monitoring/loki.yml](../../monitoring/loki.yml) | Loki storage | Filesystem at `/tmp/loki`, ports 3100/9096 |
| [monitoring/promtail.yml](../../monitoring/promtail.yml) | Log shipping | Docker socket scrape + file scrape on `/var/log/graylinx/*.log` |
| [monitoring/grafana/provisioning/datasources/datasources.yml](../../monitoring/grafana/provisioning/datasources/datasources.yml) | Grafana datasources | Auto-provisions Prometheus (default) + Loki |
| [monitoring/grafana/provisioning/dashboards/dashboards.yml](../../monitoring/grafana/provisioning/dashboards/dashboards.yml) | Grafana dashboard provider | Loads all `*.json` from the dashboards dir into "Graylinx" folder |
| [monitoring/grafana/provisioning/dashboards/graylinx-api-overview.json](../../monitoring/grafana/provisioning/dashboards/graylinx-api-overview.json) | Pre-built API overview dashboard | 9 panels, mixes Prometheus + Loki |
| [monitoring/grafana/provisioning/dashboards/graylinx-ai-operations.json](../../monitoring/grafana/provisioning/dashboards/graylinx-ai-operations.json) | Pre-built AI / agent operations dashboard | 9 panels, focuses on agent runs / analyzer / anomaly counters |
| [Makefile](../../Makefile) | `make obs`, `make obs-status`, `make obs-reload`, `make obs-test-alert`, `make obs-curl-metrics` | Operational shortcuts (see [§19](#19-make-targets-cheat-sheet)) |

---

## 14. Enabling Structured Logs (JSON)

The backend supports two log formats controlled by `LOG_JSON` in `backend/.env`.

| `LOG_JSON` | stdout format | file (when `LOG_FILE` set) |
|------------|---------------|----------------------------|
| `false` (default) | Human-readable text | Always JSON (file is always structured) |
| `true` | Structured JSON | Always JSON |

Example structured log line (whether on stdout or in the rotating file):

```json
{"ts": "2026-05-15T10:22:31.143Z", "level": "INFO", "logger": "thermynx.api.analyzer", "msg": "analysis_complete equipment_id=chiller_1 model=qwen2.5:14b total_ms=4231 request_id=a3f9..."}
```

Change it:

```bash
# backend/.env
LOG_LEVEL=INFO                 # DEBUG for verbose
LOG_JSON=true                  # structured stdout (recommended in any deployed env)
LOG_ACCESS=true                # HTTP access log per request
LOG_SQL_ECHO=false             # SQLAlchemy query echo — only for DB debugging
LOG_FILE=./logs/graylinx-api.log  # enable file logging for Promtail
LOG_FILE_MAX_BYTES=10485760    # 10 MB before rotation
LOG_FILE_BACKUP_COUNT=5        # keep last 5 rotated files
```

Restart backend after changing.

---

## 15. Correlation: Request IDs Across Layers

Every request gets a UUID, exposed on the response header `X-Request-Id` and included in every log record emitted by handler code.

**How it works:**

1. **Middleware** ([`backend/main.py`](../../backend/main.py)) accepts an incoming `X-Request-Id` header (e.g. from nginx) or generates a new UUID. Both the `request.state.request_id` attribute and a `contextvars.ContextVar` are set.
2. **ContextVar** ([`backend/app/observability/context.py`](../../backend/app/observability/context.py)) propagates the ID through `asyncio.Task` boundaries — handler code, DB queries, and the Ollama client all see the same ID without explicit plumbing.
3. **Ollama client** ([`backend/app/llm/ollama.py`](../../backend/app/llm/ollama.py)) forwards the ID as `X-Request-Id` on every outbound httpx call, so Ollama-side access logs (if ingested) can be stitched back to the originating request.

**How to use it in a debugging session:**

Browser → Network tab → copy the `x-request-id` response header value → in Grafana Loki:

```logql
{service="api"} | json | line_format "{{.msg}}" |= "<paste-id-here>"
```

That single query shows every log line — across analyzer, agent loop, tool execution, and Ollama HTTP calls — for that one request.

---

## 16. Custom Application Metrics

In addition to the auto-instrumented HTTP metrics, the backend exposes Graylinx-specific metrics defined in [`backend/app/observability/metrics.py`](../../backend/app/observability/metrics.py):

| Metric | Type | Labels | Purpose |
|--------|------|--------|---------|
| `graylinx_telemetry_data_age_seconds` | Gauge | — | Age of newest row in Unicharm MySQL (only useful in `wall_clock` mode) |
| `graylinx_telemetry_freshness_check_total` | Counter | `status` (ok / stale / no_data / skipped) | Health-check freshness check counts |
| `graylinx_agent_runs_total` | Counter | `mode`, `status` (ok / error / aborted) | Agent run volume per mode |
| `graylinx_analyzer_requests_total` | Counter | `status` | Analyzer call volume |
| `graylinx_anomalies_detected_total` | Counter | `equipment_id`, `severity` | Anomaly scan outputs |

The `telemetry_data_age_seconds` gauge is updated by `GET /api/v1/health` (see [`backend/app/api/v1/health.py`](../../backend/app/api/v1/health.py)). The counters are wired in their respective code paths.

> Add new metrics in `metrics.py` and import where you need them. Keep the `graylinx_` prefix so they don't collide with auto-instrumented HTTP metrics.

---

## 17. How-To: add metric / alert / dashboard panel

### 17.1 — Add a new metric

**Step 1** — define it in [`backend/app/observability/metrics.py`](../../backend/app/observability/metrics.py):

```python
from prometheus_client import Histogram

ollama_call_duration_seconds = Histogram(
    "graylinx_ollama_call_duration_seconds",
    "Latency of Ollama HTTP calls, partitioned by endpoint.",
    ["endpoint"],   # generate | chat | tags
    buckets=(0.1, 0.5, 1, 2, 5, 10, 30, 60, 120),
)
```

**Step 2** — observe it at the call site:

```python
from app.observability.metrics import ollama_call_duration_seconds
import time

start = time.time()
# ... existing httpx call ...
ollama_call_duration_seconds.labels(endpoint="chat").observe(time.time() - start)
```

**Step 3** — verify it appears:

```bash
make obs-curl-metrics | grep ollama
```

**Conventions:**

| Rule | Why |
|------|-----|
| Prefix with `graylinx_` | Groups under the same namespace, avoids collisions with auto HTTP metrics |
| Use seconds for time, bytes for size | Prometheus convention; Grafana auto-formats common units |
| Pick the right type | `Counter` for monotonically-increasing counts · `Gauge` for current value · `Histogram` for distributions you want percentiles on |
| Keep label cardinality low | `equipment_id` (6 values) is fine; `request_id` (unbounded) would explode the time-series DB |

### 17.2 — Add a new alert rule

Edit [`monitoring/prometheus.alerts.yml`](../../monitoring/prometheus.alerts.yml), add under `graylinx-api`:

```yaml
      - alert: AnalyzerRequestSpike
        expr: rate(graylinx_analyzer_requests_total[5m]) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Analyzer call rate > 1/s for 5m"
          description: "Sustained analyzer load. Could be a stuck UI auto-refresh or a bot."
```

Then:

```bash
make obs-reload    # no restart needed
```

Verify the rule appears as **Inactive** at [http://localhost:9090/alerts](http://localhost:9090/alerts).

**Tuning tips:**
- `expr` — test in Prometheus → Graph first to see typical values
- `for` — debounce duration. Use ≥1m to avoid flapping on transient spikes
- `severity` — `warning` or `critical`; maps to routing in `alertmanager.yml`
- `annotations.description` — keep actionable; include where to look next

### 17.3 — Add a new dashboard panel

Two options:

**A. Edit in Grafana UI, then commit:**

1. Open dashboard → **Add** → **Visualization**
2. Pick datasource (Prometheus or Loki), write query, configure visualization
3. Save → Dashboard → Settings → **JSON Model** → copy
4. Paste into the matching file under `monitoring/grafana/provisioning/dashboards/`
5. Commit. Grafana re-provisions within ~30s (`updateIntervalSeconds: 30`).

**B. Edit JSON directly:**

Add an entry to the `panels` array. Pattern for a Prometheus time-series panel:

```json
{
  "type": "timeseries",
  "title": "Cache hit rate",
  "gridPos": { "h": 8, "w": 12, "x": 0, "y": 30 },
  "datasource": { "type": "prometheus", "uid": "prometheus" },
  "targets": [
    { "expr": "rate(redis_keyspace_hits_total[5m]) / clamp_min(rate(redis_keyspace_hits_total[5m]) + rate(redis_keyspace_misses_total[5m]), 0.001)",
      "refId": "A", "legendFormat": "hit rate" }
  ],
  "fieldConfig": { "defaults": { "unit": "percentunit" } }
}
```

`gridPos` is on a 24-column grid: `h=height`, `w=width`, `x=column`, `y=row`.

### 17.4 — Wire a real Slack receiver

Replace the webhook stub in [`monitoring/alertmanager.yml`](../../monitoring/alertmanager.yml):

```yaml
receivers:
  - name: default
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/T0XXXX/B0YYYY/abcdef...'
        channel: '#graylinx-alerts'
        send_resolved: true
        title: '[{{ .Status | toUpper }}] {{ .GroupLabels.alertname }}'
        text: |-
          {{ range .Alerts }}
          *Severity:* {{ .Labels.severity }}
          *Summary:* {{ .Annotations.summary }}
          *Detail:* {{ .Annotations.description }}
          {{ end }}
```

Then `make obs-reload` and `make obs-test-alert` to verify a real message lands in `#graylinx-alerts`.

Other receiver types use the same shape with `email_configs`, `pagerduty_configs`, `webhook_configs`, or `opsgenie_configs`. Full reference: [https://prometheus.io/docs/alerting/latest/configuration/](https://prometheus.io/docs/alerting/latest/configuration/)

---

## 18. Daily Debugging Workflows

Copy-paste recipes for common situations.

### 18.1 — "The analyzer returned an error — what happened?"

1. Ask user for the `X-Request-Id` header (in browser DevTools → Network tab)
2. Grafana → Explore → Loki:
   ```logql
   {service="api"} |= "<paste-request-id>"
   ```
3. Sort ascending → middleware → route → tool calls → Ollama call → error line

### 18.2 — "Dashboard shows 5xx is high — which endpoint?"

API Overview dashboard → **Status code distribution** panel — non-zero 5xx confirms the issue. Switch to **Request rate by handler** to identify which `handler` contributes. Then:

```logql
{service="api"} | json | level=~"ERROR|CRITICAL"
```

### 18.3 — "Agent runs are slow — Ollama or the tools?"

AI Operations dashboard → **Analyzer p99 latency** panel.

- p99 > 10s and p50 high too → Ollama is slow (cold start, GPU contention, model swap)
- p99 high, p50 normal → a tool call has a long tail (probably MySQL). Check:
  ```logql
  {service="api", logger="thermynx.domain.tools"} | json
  ```

### 18.4 — "Anomaly count exploded — what changed?"

AI Operations → **Anomalies by equipment** — tallest bar is the culprit. Then:

```logql
{service="api", logger="thermynx.jobs.anomaly_scan"} | json
```

Or query the Postgres table directly:

```bash
docker compose exec postgres psql -U thermynx -d thermynx_app \
  -c "SELECT * FROM anomalies WHERE equipment_id='chiller_1' ORDER BY created_at DESC LIMIT 20;"
```

### 18.5 — "Telemetry seems stale"

If the data-age panel is yellow/red:

```bash
curl -s http://localhost:8000/api/v1/health | python -m json.tool
```

Inspect `telemetry.latest_slot_time` and `telemetry.anchor`. Staleness only fires meaningfully in `wall_clock` mode. If truly stale, the upstream MySQL feed is the problem — check Tailscale and the source ingestion pipeline.

### 18.6 — "Did the anomaly scan job actually run?"

```logql
{service="api", logger="thermynx.jobs.anomaly_scan"}
```

You should see one line every 5 minutes. Missing lines = arq worker isn't running (`make worker`).

---

## 19. Make Targets Cheat Sheet

```bash
# Observability stack
make obs                  # start obs stack (prints all URLs)
make obs-stop             # stop obs stack
make obs-status           # container health + scrape state + firing alert count
make obs-logs             # tail logs of all obs containers
make obs-reload           # reload Prometheus + Alertmanager configs without restart
make obs-curl-metrics     # show Graylinx custom metrics from /metrics
make obs-test-alert       # fire a synthetic alert to verify the AM pipeline

# Rest of dev workflow (for context)
make deps                 # Postgres + Redis
make backend              # uvicorn (foreground)
make frontend             # vite (foreground)
make worker               # arq worker (foreground)
make logs                 # tail core service logs
```

---

## 20. PromQL + LogQL Cookbook

Patterns you'll actually use, with Graylinx-specific metric names.

### PromQL

| Goal | Expression |
|------|-----------|
| Request rate (all endpoints) | `sum(rate(http_requests_total{job="thermynx-api"}[5m]))` |
| Request rate per endpoint | `sum by (handler) (rate(http_requests_total{job="thermynx-api"}[5m]))` |
| Error rate (5xx) | `sum(rate(http_requests_total{job="thermynx-api",status=~"5.."}[5m]))` |
| Error ratio | `sum(rate(http_requests_total{status=~"5.."}[5m])) / clamp_min(sum(rate(http_requests_total[5m])), 0.001)` |
| p99 latency overall | `histogram_quantile(0.99, sum by (le) (rate(http_request_duration_seconds_bucket{job="thermynx-api"}[5m])))` |
| p99 latency per endpoint | `histogram_quantile(0.99, sum by (handler, le) (rate(http_request_duration_seconds_bucket[5m])))` |
| Currently in-flight | `sum(http_requests_in_progress{job="thermynx-api"})` |
| Telemetry age (seconds) | `graylinx_telemetry_data_age_seconds` |
| Agent runs by mode | `sum by (mode) (rate(graylinx_agent_runs_total[5m]))` |
| Agent error % | `sum(rate(graylinx_agent_runs_total{status="error"}[5m])) / clamp_min(sum(rate(graylinx_agent_runs_total[5m])), 0.001)` |
| Anomalies per equipment (last hour) | `sum by (equipment_id) (increase(graylinx_anomalies_detected_total[1h]))` |
| Backend reachable? | `up{job="thermynx-api"}` |

### LogQL

| Goal | Query |
|------|-------|
| All backend logs | `{service="api"}` |
| All Postgres logs | `{service="postgres"}` |
| All Redis logs | `{service="redis"}` |
| Errors only | `{service="api"} \| json \| level=~"ERROR\|CRITICAL"` |
| One logger | `{service="api", logger="thermynx.llm.ollama"}` |
| Substring filter (cheap) | `{service="api"} \|= "anomaly_detected"` |
| Regex filter | `{service="api"} \|~ "ollama_(stream\|chat)_done"` |
| Stitch one request | `{service="api"} \|= "<request-id>"` |
| Rate of error lines | `sum(rate({service="api"} \| json \| level="ERROR" [5m]))` |
| Pretty output | `{service="api"} \| json \| line_format "{{.level}} {{.logger}}: {{.msg}}"` |

---

## 21. Troubleshooting

### "Backend up" tile is red

Open [http://localhost:9090/targets](http://localhost:9090/targets). If the `thermynx-api` target shows a connection error:

- **Linux:** `host.docker.internal` requires the `extra_hosts` line in `docker-compose.yml`. Already present — but make sure you're on Docker 20.10+.
- **Windows / Mac:** Docker Desktop supports this natively. Check `make backend` is running and `curl http://localhost:8000/metrics` works on the host.
- **Backend not running:** `make backend` and inspect the uvicorn terminal.

### Loki shows no backend logs (`{service="api"}` returns nothing)

Check in order:

1. Did you set `LOG_FILE=./logs/graylinx-api.log` in `backend/.env`?
2. Is the file actually being written? `ls -la logs/graylinx-api.log`
3. Is the bind mount working? `docker compose --profile obs exec promtail ls /var/log/graylinx`
4. Promtail logs: `docker compose --profile obs logs promtail | tail -30`

### Alerts appear in Prometheus but not in Alertmanager

`make obs-reload` first (config might be stale). If still broken:

- Prometheus → Status → Runtime & Build Info → check `alertmanagers` shows `alertmanager:9093` as resolvable
- `docker compose --profile obs logs alertmanager` for parse errors

### `make obs-test-alert` works but Slack doesn't fire

- `make obs-reload` after editing `alertmanager.yml`
- Check Alertmanager logs for `notify_slack` errors: `docker compose --profile obs logs alertmanager | grep -i slack`
- Webhook URL must include the full path + token — double-check the copy-paste
- Slack rate-limits to ~1 webhook/sec per workspace — alert storms get throttled

### Dashboard panels are blank

- **No data yet:** generate some HTTP traffic. The "Request rate by handler" panel needs ≥2 data points in the time window.
- **Wrong time range:** top-right of the dashboard. Default is last 1h — narrow to "Last 5m" right after a fresh start.
- **Datasource broken:** Configuration → Data sources → Prometheus → **Save & test**. If it fails, `make obs-stop && make obs`.

### Disk filling up from logs

The rotating handler caps backend logs at `LOG_FILE_MAX_BYTES × (LOG_FILE_BACKUP_COUNT + 1)` ≈ 60 MB by default. To wipe Loki itself:

```bash
docker compose --profile obs down
docker volume rm graylinx_loki_data    # adjust if your compose project name differs
make obs
```

---

## 22. What Is Still Missing (Open Work)

| Item | Priority | Effort | Detail |
|------|----------|--------|--------|
| **OpenTelemetry distributed tracing** | P3 | 1 day | Request ID correlation works for log-joins, but there is no formal trace span hierarchy / waterfall view. Adding `opentelemetry-sdk` + `opentelemetry-instrumentation-fastapi` + `opentelemetry-instrumentation-httpx` + a **Tempo** container would give Grafana a Traces datasource with proper span trees. Skipped for now — adds a 5th obs container and ~50MB of Python deps for relatively niche debugging value. |
| **Broader `AppError` adoption** | P1 | 1 day | Cross-cutting reliability item — listed here for cross-reference but tracked in [`AI_ROADMAP_AND_BACKLOG.md § 2.1`](../planning/AI_ROADMAP_AND_BACKLOG.md#21-reliability-and-parity). Better-typed errors propagate cleaner messages to logs and to the SSE error frames. |
| **Loki ruler for log-based alerts** | P3 | 4h | The commented `AnomalyRateSpike` rule in `prometheus.alerts.yml` would need a Loki ruler running (Prometheus can't query Loki). Optional — most useful alerts are metric-based. |
| **Real Alertmanager receiver** | P1 (when going live) | 30 min | Webhook stub at `:9099/alert-sink` is a no-op — replace with Slack webhook / Teams / email before relying on alerts in production. See [§17.4 Wire a real Slack receiver](#174--wire-a-real-slack-receiver). |

---

## 23. Closed in 2026-05-15 sprint

Tracking what was done in case you wonder why a file changed:

| Was open | What shipped |
|----------|--------------|
| Grafana dashboards committed to repo | Auto-provisioned **Graylinx — API Overview** dashboard (9 panels mixing Prometheus + Loki) via `dashboards.yml` + `graylinx-api-overview.json` |
| Alertmanager deployment + alert rules | Added `alertmanager` container under `obs` profile · 5 alert rules in `prometheus.alerts.yml` · Prometheus now loads rules + routes to AM · inhibit rule for BackendDown |
| Backend logs into Loki when running locally | Added `LOG_FILE` / `LOG_FILE_MAX_BYTES` / `LOG_FILE_BACKUP_COUNT` settings · `RotatingFileHandler` in `logging_setup.py` (always JSON) · new Promtail file scrape job · docker-compose bind-mounts `./logs` into promtail |
| Data freshness signal | New `graylinx_telemetry_data_age_seconds` Prometheus gauge updated by `/api/v1/health` · health response now includes `telemetry: { anchor, latest_slot_time, age_seconds, freshness_warning }` · TelemetryStale alert fires when age > 30 min |
| Request-ID correlation through Ollama | New `contextvars`-based `current_request_id` in `app/observability/context.py` · middleware accepts upstream `X-Request-Id` or generates one · Ollama httpx clients now send the ID as `X-Request-Id` and include it in every log line |
| Custom application metrics — defined **and incremented** | New `app/observability/metrics.py` with 5 metric definitions. Now incremented at real call sites: `agent_runs_total` in [`app/services/agent.py`](../../backend/app/services/agent.py) at every terminal path (ok / error / aborted) · `analyzer_requests_total` in [`app/api/v1/analyzer.py`](../../backend/app/api/v1/analyzer.py) at both done paths · `anomalies_detected_total` in [`app/jobs/anomaly_scan.py`](../../backend/app/jobs/anomaly_scan.py) per anomaly persisted |
| Second pre-built dashboard | [`graylinx-ai-operations.json`](../../monitoring/grafana/provisioning/dashboards/graylinx-ai-operations.json) — 9 panels focused on agent activity, analyzer latency, anomaly trends. Auto-provisions next to API Overview |
| Makefile operational shortcuts | 5 new `obs-*` targets in [`Makefile`](../../Makefile): `obs-status`, `obs-logs`, `obs-reload`, `obs-curl-metrics`, `obs-test-alert` (see [§19](#19-make-targets-cheat-sheet)) |
| `.env.example` documents log settings | [`backend/.env.example`](../../backend/.env.example) — uncomment `LOG_FILE`, `LOG_JSON`, etc. block |

---

*Document last updated: 2026-05-15. All five obs items closed; one (full OTel/Tempo) intentionally deferred. Next update: when the Alertmanager receiver moves from stub to real channel.*
