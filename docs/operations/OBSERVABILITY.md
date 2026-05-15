# Graylinx — Observability Stack

> Reference docs: [RUNBOOK.md](./RUNBOOK.md) · [ENV_REFERENCE.md](../reference/ENV_REFERENCE.md) · [FLAWS_AND_IMPROVEMENT_PLAN.md](../planning/FLAWS_AND_IMPROVEMENT_PLAN.md)

---

## Table of Contents

1. [Overview](#1-overview)
2. [What Is Already Wired (Always-On)](#2-what-is-already-wired-always-on)
3. [Optional Observability Stack — `obs` Profile](#3-optional-observability-stack--obs-profile)
4. [Starting the Stack](#4-starting-the-stack)
5. [Service URLs](#5-service-urls)
6. [Prometheus — Metrics](#6-prometheus--metrics)
7. [Loki + Promtail — Logs](#7-loki--promtail--logs)
8. [Grafana — Dashboards](#8-grafana--dashboards)
9. [Config Files Reference](#9-config-files-reference)
10. [Enabling Structured Logs (JSON)](#10-enabling-structured-logs-json)
11. [What Is Still Missing (Open Work)](#11-what-is-still-missing-open-work)

---

## 1. Overview

The observability stack gives you three signals:

| Signal | Tool | What you see |
|--------|------|-------------|
| **Metrics** | Prometheus + Grafana | Request rates, latencies, error rates, active requests per endpoint |
| **Logs** | Loki + Promtail + Grafana | Structured log lines from all Docker containers, queryable by label |
| **Dashboards** | Grafana | Visual panels combining both signals |

The stack is **optional** — it does not need to run for the platform to function. Core services (Postgres, Redis) always start. The observability stack starts only when you add the `obs` profile flag.

---

## 2. What Is Already Wired (Always-On)

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

**Test it right now (no `obs` stack needed):**

```bash
curl http://localhost:8000/metrics
```

You should see raw Prometheus text exposition format, e.g.:
```
# HELP http_requests_total Total number of requests by method, handler and status.
# TYPE http_requests_total counter
http_requests_total{handler="/api/v1/equipment/summary",method="GET",status="2xx"} 14.0
...
```

---

## 3. Optional Observability Stack — `obs` Profile

The full stack runs four containers under the Docker Compose `obs` profile:

```
docker-compose.yml
  profiles: [obs]
    ├── prometheus   — scrapes /metrics from the backend
    ├── loki         — receives and stores log streams
    ├── promtail     — ships Docker container logs into Loki
    └── grafana      — dashboards UI, reads from both Prometheus and Loki
```

Config files live in:

```
monitoring/
  prometheus.yml             — scrape job config
  loki.yml                   — Loki storage config
  promtail.yml               — log shipping config
  grafana/
    provisioning/
      datasources/
        datasources.yml      — auto-provisions Prometheus + Loki as datasources
```

---

## 4. Starting the Stack

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

All four `obs` containers should show `Up`:

```
NAME                         IMAGE                        STATUS
graylinx-grafana-1           grafana/grafana:10.0.0       Up
graylinx-prometheus-1        prom/prometheus:v2.47.0      Up
graylinx-loki-1              grafana/loki:2.9.0           Up
graylinx-promtail-1          grafana/promtail:2.9.0       Up
```

---

## 5. Service URLs

| Service | URL | Credentials |
|---------|-----|-------------|
| **Grafana** | [http://localhost:3000](http://localhost:3000) | No login required (anonymous admin) |
| **Prometheus** | [http://localhost:9090](http://localhost:9090) | No auth |
| **Loki** | [http://localhost:3100](http://localhost:3100) | Internal; query via Grafana |
| **Promtail status** | [http://localhost:9080](http://localhost:9080) | Scrape status page |

> Grafana has `GF_AUTH_ANONYMOUS_ENABLED=true` and `GF_AUTH_ANONYMOUS_ORG_ROLE=Admin` — no login form. This is intentional for this internal facility tool.

---

## 6. Prometheus — Metrics

### Scrape config

**File:** [monitoring/prometheus.yml](../../monitoring/prometheus.yml)

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: thermynx-api
    static_configs:
      - targets: ['host.docker.internal:8000']   # backend on host machine
    metrics_path: /metrics
    scrape_interval: 10s
```

- Prometheus scrapes the FastAPI `/metrics` endpoint every **10 seconds**.
- Uses `host.docker.internal` to reach the backend running on the host (not in Docker).
- `extra_hosts: - "host.docker.internal:host-gateway"` in `docker-compose.yml` enables this bridge on Linux.

### Query examples in Prometheus UI

Open [http://localhost:9090](http://localhost:9090) → use the **Graph** tab.

**Request rate (last 5 min):**
```promql
rate(http_requests_total[5m])
```

**Error rate (5xx only):**
```promql
rate(http_requests_total{status="5xx"}[5m])
```

**p99 latency per endpoint:**
```promql
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))
```

**Active requests right now:**
```promql
http_requests_in_progress
```

**Analyze endpoint specifically:**
```promql
rate(http_requests_total{handler="/api/v1/analyze"}[5m])
```

---

## 7. Loki + Promtail — Logs

### How logs flow

```
Backend (uvicorn) → stdout
Docker container logs → /var/run/docker.sock
                         ↓
                     Promtail (reads Docker socket)
                         ↓
                     Loki (stores streams)
                         ↓
                     Grafana (query + display)
```

### Promtail config

**File:** [monitoring/promtail.yml](../../monitoring/promtail.yml)

Promtail watches the Docker socket and auto-labels each log stream with:

| Label | Source | Example value |
|-------|--------|---------------|
| `container` | Docker container name | `graylinx-postgres-1` |
| `logstream` | stdout / stderr | `stdout` |
| `service` | Docker Compose service name | `redis`, `postgres` |

> **Note:** Promtail only ships logs from **Docker containers**. The backend running locally via `uvicorn --reload` is **not in Docker**, so its logs are not automatically shipped. To get backend logs into Loki, run the backend inside Docker (`docker compose up api`) or pipe stdout manually.

### Querying logs in Grafana

1. Open [http://localhost:3000](http://localhost:3000)
2. Go to **Explore** → select datasource **Loki**
3. Use LogQL:

**All Postgres logs:**
```logql
{service="postgres"}
```

**All Redis logs:**
```logql
{service="redis"}
```

**Error lines from any container:**
```logql
{container=~".+"} |= "error"
```

**Backend logs (if running in Docker):**
```logql
{service="api"}
```

**Backend JSON logs — filter by level:**
```logql
{service="api"} | json | level = "error"
```

### Enabling structured JSON logs

Set in `backend/.env`:

```bash
LOG_JSON=true
```

With JSON logs, each line is parseable by Loki's `| json` pipeline. This unlocks filtering by `level`, `event`, `equipment_id`, `request_id`, etc.

Example query:
```logql
{service="api"} | json | level="error" | line_format "{{.event}} — {{.request_id}}"
```

---

## 8. Grafana — Dashboards

### Auto-provisioned datasources

**File:** [monitoring/grafana/provisioning/datasources/datasources.yml](../../monitoring/grafana/provisioning/datasources/datasources.yml)

On startup Grafana auto-creates two datasources — no manual setup needed:

| Name | Type | UID | URL |
|------|------|-----|-----|
| Prometheus | prometheus | `prometheus` | http://prometheus:9090 |
| Loki | loki | `loki` | http://loki:3100 |

### Creating dashboards

No dashboards are pre-provisioned — you build them manually in the UI. Suggested panels for this platform:

**Request overview panel:**
- Visualization: Time series
- Query: `rate(http_requests_total[1m])`

**Error rate alert panel:**
- Visualization: Stat
- Query: `sum(rate(http_requests_total{status=~"5.."}[5m]))`
- Threshold: red when > 0.1

**p99 latency per endpoint:**
- Visualization: Time series
- Query: `histogram_quantile(0.99, sum by (handler, le) (rate(http_request_duration_seconds_bucket[5m])))`

**Anomaly count over time:**
- Datasource: Loki
- Query: `count_over_time({service="api"} |= "anomaly_scan_complete" [5m])`

**Active agent runs:**
- Visualization: Stat
- Query: `http_requests_in_progress{handler="/api/v1/agent/run"}`

### Persisting dashboards

Dashboard JSON is stored in the `grafana_data` Docker volume. To export a dashboard to version control:

1. In Grafana UI: Dashboard → Settings → JSON Model
2. Copy JSON
3. Save to `monitoring/grafana/provisioning/dashboards/graylinx.json`
4. Add to `datasources.yml`'s sibling `dashboards.yml` to auto-provision on next start

---

## 9. Config Files Reference

| File | Purpose | Key settings |
|------|---------|-------------|
| [monitoring/prometheus.yml](../../monitoring/prometheus.yml) | Scrape targets | `job_name: thermynx-api`, target `host.docker.internal:8000`, interval 10s |
| [monitoring/loki.yml](../../monitoring/loki.yml) | Loki storage | Filesystem storage at `/tmp/loki`, HTTP port 3100, gRPC port 9096 |
| [monitoring/promtail.yml](../../monitoring/promtail.yml) | Log shipping | Docker socket discovery, pushes to `http://loki:3100/loki/api/v1/push` |
| [monitoring/grafana/provisioning/datasources/datasources.yml](../../monitoring/grafana/provisioning/datasources/datasources.yml) | Grafana datasources | Auto-provisions Prometheus (default) + Loki |

---

## 10. Enabling Structured Logs (JSON)

The backend supports two log formats controlled by `LOG_JSON` in `backend/.env`.

| `LOG_JSON` | Format | Best for |
|------------|--------|---------|
| `false` (default) | Human-readable text | Local development |
| `true` | Structured JSON, one object per line | Production, Loki ingestion |

Example structured log line (with `LOG_JSON=true`):

```json
{"event": "analysis_complete", "level": "info", "equipment_id": "chiller_1", "model": "qwen2.5:14b", "total_ms": 4231, "request_id": "a3f9...", "timestamp": "2026-05-15T10:22:31Z"}
```

Change it:

```bash
# backend/.env
LOG_JSON=true
LOG_LEVEL=INFO       # DEBUG for verbose
LOG_ACCESS=true      # HTTP access log per request
LOG_SQL_ECHO=false   # SQLAlchemy query echo — only for DB debugging
```

Restart backend after changing.

---

## 11. What Is Still Missing (Open Work)

The observability stack is **partially complete**. These items remain open:

| Item | Priority | Effort | Detail |
|------|----------|--------|--------|
| **Grafana dashboard definitions committed to repo** | P2 | 2h | Export JSON → `monitoring/grafana/provisioning/dashboards/`. Without this, dashboards are lost if the volume is wiped. |
| **Alertmanager deployment + alert rules** | P2 | 1 day | `loki.yml` references `alertmanager_url: http://localhost:9093` but Alertmanager is not in `docker-compose.yml`. Rules needed: anomaly rate > 5/hour, p99 > 5s, Ollama errors > 3/min. |
| **Backend logs into Loki when running locally** | P2 | 2h | Promtail only ships Docker container logs. When backend runs via `uvicorn --reload` on the host, logs are not shipped. Fix: add a file-based scrape config in `promtail.yml` pointing at a log file, or run the backend in Docker. |
| **OpenTelemetry distributed tracing** | P3 | 1 day | Trace IDs are not propagated from the backend through to Ollama HTTP calls. Add `opentelemetry-sdk` + `opentelemetry-instrumentation-httpx` to trace the full request path including LLM latency. |
| **Data freshness warning** (P2-6) | P2 | 3h | When `TELEMETRY_TIME_ANCHOR=wall_clock` and MySQL data is stale by 30+ min, responses should include `data_freshness_warning`. See [FLAWS_AND_IMPROVEMENT_PLAN.md § P2-6](../planning/FLAWS_AND_IMPROVEMENT_PLAN.md#p2-6--no-telemetry-freshness-validation-in-wall_clock-mode). |
| **Broader AppError adoption** | P1 | 1 day | MySQL/Redis/Ollama failures still surface as generic 500s in some routes. See [AI_ROADMAP_AND_BACKLOG.md § 2.1](../planning/AI_ROADMAP_AND_BACKLOG.md#21-reliability-and-parity). |

---

*Document created: 2026-05-15. Update after each sprint that touches monitoring config.*
