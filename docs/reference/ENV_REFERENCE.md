# Graylinx — Environment Variables Reference

Copy `.env.example` to `backend/.env` and fill in required values before starting.

---

## Quick Reference

| Variable | Required | Default | Category |
|----------|----------|---------|----------|
| `DB_HOST` | yes | — | MySQL |
| `DB_PORT` | no | `3307` | MySQL |
| `DB_USER` | yes | — | MySQL |
| `DB_PASSWORD` | yes | — | MySQL |
| `DB_NAME` | no | `unicharm` | MySQL |
| `POSTGRES_URL` | yes | — | PostgreSQL |
| `REDIS_URL` | no | `redis://localhost:6379` | Redis |
| `OLLAMA_HOST` | yes | — | Ollama |
| `OLLAMA_DEFAULT_MODEL` | no | `qwen2.5:14b` | Ollama |
| `TARIFF_INR_PER_KWH` | no | `8.5` | Analytics |
| `TELEMETRY_TIME_ANCHOR` | no | `latest_in_db` | Analytics |
| `LOG_LEVEL` | no | `INFO` | Logging |
| `LOG_JSON` | no | `false` | Logging |
| `LOG_ACCESS` | no | `true` | Logging |
| `LOG_SQL_ECHO` | no | `false` | Logging |

---

## MySQL (Unicharm telemetry — read-only)

### `DB_HOST`
**Required.** Tailscale IP or hostname of the Unicharm MySQL server.

```
DB_HOST=100.x.x.x
```

---

### `DB_PORT`
Port for the MySQL connection.

```
DB_PORT=3307
```
Default: `3307`. The Unicharm server uses a non-standard port.

---

### `DB_USER`
**Required.** MySQL username. Must have `SELECT` only — no write grants.

```
DB_USER=ro_user
```

---

### `DB_PASSWORD`
**Required.** MySQL password. Never commit this value.

```
DB_PASSWORD=secret
```

---

### `DB_NAME`
MySQL database (schema) name.

```
DB_NAME=unicharm
```
Default: `unicharm`.

---

## PostgreSQL (App state — read/write)

### `POSTGRES_URL`
**Required.** Full async connection string for the app PostgreSQL database.

```
POSTGRES_URL=postgresql+asyncpg://thermynx:secret@localhost:5432/thermynx_app
```

When using docker-compose, the host is `postgres` (service name):
```
POSTGRES_URL=postgresql+asyncpg://thermynx:secret@postgres:5432/thermynx_app
```

The password here must match `POSTGRES_PASSWORD` in `docker-compose.yml`.

---

## Redis

### `REDIS_URL`
Redis connection string. Used for job queue and (future) caching.

```
REDIS_URL=redis://localhost:6379
```
Default: `redis://localhost:6379`.

When using docker-compose: `redis://redis:6379`

---

## Ollama (LLM host)

### `OLLAMA_HOST`
**Required.** Base URL of the Ollama server, including port. No trailing slash.

```
OLLAMA_HOST=http://100.125.103.28:11434
```

The Ollama server runs on a Dell Pro Max Tower PC accessible via Tailscale.

---

### `OLLAMA_DEFAULT_MODEL`
Ollama model tag to use for all completions and streaming.

```
OLLAMA_DEFAULT_MODEL=qwen2.5:14b
```
Default: `qwen2.5:14b`.

Other available models on the Ollama box: `phi:latest`, `nomic-embed-text:latest`

> Do not set this to `gpt-oss:120b` — that model is 65 GB and exceeds the GPU VRAM + system RAM available.

---

## Analytics

### `TARIFF_INR_PER_KWH`
Electricity tariff used by the cost analytics module, in Indian Rupees per kWh.

```
TARIFF_INR_PER_KWH=8.5
```
Default: `8.5` (blended commercial rate). Adjust to the actual Unicharm rate from the latest electricity bill.

---

### `TELEMETRY_TIME_ANCHOR`
Controls how "now" is defined when querying telemetry windows.

```
TELEMETRY_TIME_ANCHOR=latest_in_db
```

| Value | Behaviour |
|-------|-----------|
| `latest_in_db` | "now" = the most recent `slot_time` in the MySQL tables. Use this when working with a historical data dump (typical for development and demos). |
| `wall_clock` | "now" = the actual current time (`datetime.utcnow()`). Use this when connected to a live data feed. |

Default: `latest_in_db`.

---

## Logging

### `LOG_LEVEL`
Python logging level for the backend.

```
LOG_LEVEL=INFO
```
Default: `INFO`. Set to `DEBUG` for verbose output during development.

---

### `LOG_JSON`
When `true`, all log output is emitted as structured JSON (suitable for Loki / log aggregators). When `false`, logs are human-readable text.

```
LOG_JSON=false
```
Default: `false`. Set to `true` in any deployed environment.

---

### `LOG_ACCESS`
When `true`, every HTTP request is logged (method, path, status, latency).

```
LOG_ACCESS=true
```
Default: `true`. Set to `false` to suppress access log noise during development.

---

### `LOG_SQL_ECHO`
When `true`, SQLAlchemy echoes every SQL statement. Very verbose — only for debugging Postgres query issues.

```
LOG_SQL_ECHO=false
```
Default: `false`.

---

## Example `.env` (development)

```bash
# MySQL — Unicharm (read-only)
DB_HOST=100.125.x.x
DB_PORT=3307
DB_USER=ro_user
DB_PASSWORD=your_mysql_password_here
DB_NAME=unicharm

# PostgreSQL — App state
POSTGRES_URL=postgresql+asyncpg://thermynx:thermynx_dev@localhost:5432/thermynx_app

# Redis
REDIS_URL=redis://localhost:6379

# Ollama
OLLAMA_HOST=http://100.125.103.28:11434
OLLAMA_DEFAULT_MODEL=qwen2.5:14b

# Analytics
TARIFF_INR_PER_KWH=8.5
TELEMETRY_TIME_ANCHOR=latest_in_db

# Logging
LOG_LEVEL=INFO
LOG_JSON=false
LOG_ACCESS=true
LOG_SQL_ECHO=false
```
