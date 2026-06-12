from typing import Literal

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Unicharm MySQL (read-only telemetry source)
    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_USER: str = "root"
    DB_PASSWORD: str = "changeme"
    DB_NAME: str = "unicharm"

    # Telemetry window end: ``latest_in_db`` uses MAX(slot_time) across plant tables —
    # right for months-old dumps; ``wall_clock`` uses UTC now — right for live feeds.
    TELEMETRY_TIME_ANCHOR: Literal["wall_clock", "latest_in_db"] = "latest_in_db"

    # Postgres thermynx_app (application data)
    POSTGRES_URL: str = "postgresql+asyncpg://thermynx:dev@localhost:5432/thermynx_app"

    # Redis (cache + queue)
    REDIS_URL: str = "redis://localhost:6379/0"

    # Ollama (Tailscale server)
    # Non-Chinese-origin policy: no qwen / deepseek / qwq in production. The
    # global default/fallback. NOTE: phi4 (14B) CRASHES the Ollama 0.30.6 runner
    # (0xc0000409 stack overrun) — so the default is mistral-small3.2 until that's fixed.
    OLLAMA_HOST: str = "http://100.125.103.28:11434"
    OLLAMA_DEFAULT_MODEL: str = "mistral-small3.2:latest"

    # CORS — comma-separated list of allowed origins.
    # Dev default: Vite + CRA local ports. Production: set to the deployed domain.
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    # Optional API key gate — comma-separated valid keys (empty disables auth).
    # Send header: X-API-Key: <key>. Exemptions: GET /healthz, /metrics, /docs*, /openapi.json, /api/v1/health
    API_KEYS: str = ""

    BACKEND_PORT: int = 8000

    # Phase 3 cost analytics — flat blended tariff (₹/kWh), POC default
    TARIFF_INR_PER_KWH: float = 8.5

    # Morning digest cron — time of day (UTC) the daily plant-health digest is
    # built + pushed to Slack. Default 00:30 UTC = 06:00 IST (facility-local
    # morning; tariff is in ₹). Override via env for a different timezone.
    DIGEST_CRON_HOUR_UTC:   int = 0
    DIGEST_CRON_MINUTE_UTC: int = 30

    # Forecast backend — "ml" uses Holt-Winters triple-exp smoothing from
    # statsmodels (real ML, captures trend + 24h seasonality). "heuristic"
    # uses the simple hour-of-day mean ± 1σ projection. ML falls back to
    # heuristic when there's not enough history to fit.
    FORECAST_BACKEND: Literal["heuristic", "ml"] = "ml"

    # Slack integration (Phase 9A) — empty disables outbound + inbound Slack paths.
    # SLACK_BOT_TOKEN starts with "xoxb-..."; SLACK_SIGNING_SECRET is the Slack
    # app's signing secret used to verify inbound slash-command / event requests.
    SLACK_BOT_TOKEN:        str = ""
    SLACK_SIGNING_SECRET:   str = ""
    # Channel for outbound critical alarms (e.g. "#hvac-ops"). Empty disables.
    SLACK_ALARM_CHANNEL:    str = ""
    # Minimum severity that should be posted to Slack (info / warning / critical).
    SLACK_ALARM_MIN_SEVERITY: Literal["info", "warning", "critical"] = "critical"

    # AI tuning — agent loop, NL query, vision timeouts
    # These used to be hardcoded module-level constants; moving them here lets
    # operators tune without touching code or restarting the container.
    AGENT_MAX_STEPS:        int   = 8      # max ReAct iterations before forced stop
    NL_QUERY_LLM_TIMEOUT_S: float = 40.0  # Ollama SQL generation timeout (bumped 25->40:
                                          # SQL moved to mistral-small3.2 (24B) which is slower
                                          # than the old llama3.1:8b, esp. with model-swapping on
                                          # the 20GB box; complex queries were crossing 25s)
    NL_QUERY_DB_TIMEOUT_S:  float = 10.0  # MySQL execution timeout
    NL_QUERY_MAX_ROWS:      int   = 1000  # hard row cap (LIMIT)
    VISION_TIMEOUT_S:       float = 90.0  # Ollama vision call timeout

    # Analyzer response cache (Redis) — 60s TTL keeps answers fresh while
    # eliminating repeated identical questions. Set to 0 to disable.
    ANALYZER_CACHE_TTL_S: int = 60

    # Ollama HTTP timeouts for the agent/analyzer chat paths
    OLLAMA_CHAT_TIMEOUT_S:   float = 60.0   # non-streaming /api/chat (tool calls)
    OLLAMA_STREAM_TIMEOUT_S: float = 120.0  # streaming /api/chat and /api/generate

    # Keep graph models resident between calls so single-model paths (analyze/agent)
    # don't pay a cold-load on each request. "30m" = stay warm 30 min after last use
    # ("-1" pins forever). NOTE: this can't beat the VRAM ceiling — the orchestrator's
    # gemma4->devstral->phi4 swaps still cold-load on the 20 GB box (48 GB fixes that).
    OLLAMA_KEEP_ALIVE: str = "30m"

    # Ollama vision model (separate from default text model)
    OLLAMA_VISION_MODEL: str = "llama3.2-vision"

    # Model digest pins — optional SHA256 digests for the models in use.
    # When set, the health endpoint verifies the running model matches the pin
    # and logs a WARNING if it doesn't. This catches silent behavior changes
    # when someone runs `ollama pull` and the model is updated under our feet.
    # Leave empty to skip verification (the default for POC / dev).
    OLLAMA_DIGEST_DEFAULT_MODEL: str = ""   # e.g. "sha256:7cdf5a01..."
    OLLAMA_DIGEST_TOOL_MODEL:    str = ""   # llama3.1:8b digest
    OLLAMA_DIGEST_VISION_MODEL:  str = ""   # llama3.2-vision digest

    # ── Model right-sizing per task (eval verdict 2026-06 · Claude-Opus-4.8 judge · non-Chinese) ──
    # Each task can use a different model. Empty string = fall back to OLLAMA_DEFAULT_MODEL.
    # Assignments = Claude-judged winners that ALSO pass the in-app golden check. Full report:
    # model-eval/reports/MODEL_EVAL_FINAL_REPORT.md.
    #   - TEXT:     narration / answer streaming  → mistral-small3.2 (phi4 is eval winner but crashes 0.30.6)
    #   - TOOL:     agent ReAct executor          → devstral (Mistral/FR; best tool-caller 4.5; tools, 128K)
    #   - SQL:      NL→SQL generation             → codestral (Mistral/FR; best deployable SQL; beat sqlcoder) + nl_to_sql guards
    #   - PLANNER:  multi-agent planner JSON       → gemma4:12b (Google; best plans 3.3-4.0; THINKING model, JSON path only)
    #   - AUDITOR:  self-critique / validator      → mistral-small3.2 (validator 5.0, ties phi4)
    #   - RAG:      RAG-grounded analyzer answer    → "" = TEXT model (mistral-small3.2)
    # ⚠ phi4 (14B) is the eval winner for TEXT/AUDITOR/RAG (5.0) but the Ollama 0.30.6 runner
    #   CRASHES loading it (0xc0000409 stack overrun); 0.30.6 is required for gemma4 (Planner), so
    #   the two can't share one Ollama version. Until Ollama fixes phi4-14B, mistral-small3.2 is the
    #   substitute (validator 5.0 / narration 4.5 / RAG 4.4 — near-identical, runs on 0.30.6).
    # PLANNER is a thinking model (gemma4): works in JSON-mode (thinks AND emits JSON), goes BLANK
    #   in a tight plain-text cap — keep planner on JSON-mode + generous budget (~25s/plan).
    # qwen/deepseek/qwq excluded (Chinese). Production set: gemma4, devstral, codestral,
    # mistral-small3.2, llama3.2-vision, nomic-embed-text — all non-Chinese. (phi4 = revisit when fixed.)
    # Override any one via env var; set to "" to force the OLLAMA_DEFAULT_MODEL fallback.
    OLLAMA_MODEL_TEXT:     str = "mistral-small3.2:latest"  # narration & analyzer (phi4 winner but crashes 0.30.6)
    OLLAMA_MODEL_TOOL:     str = "devstral:latest"       # agent ReAct executor — best tool-caller (4.5)
    OLLAMA_MODEL_SQL:      str = "codestral:latest"      # NL→SQL — code specialist; nl_to_sql validator/deny-list still guards
    OLLAMA_MODEL_PLANNER:  str = "gemma4:12b"            # multi-agent planner JSON — best plans (thinking model, JSON path)
    OLLAMA_AUDITOR_MODEL:  str = "mistral-small3.2:latest"  # validator — 5.0 (ties phi4); phi4 crashes 0.30.6
    OLLAMA_MODEL_RAG:      str = ""                      # RAG-grounded answer → TEXT model (mistral-small3.2)

    # ── Agentic graph cutover (F7) ──────────────────────────────────────────
    # Route a live endpoint onto the LangGraph rewrite (app/ai/graph/). The old
    # inline pipeline stays as the instantly-reversible fallback — set the flag
    # =false in backend/.env + restart to revert. Persistence (audit/run rows,
    # thread messages) is preserved in both modes.
    #
    # CUTOVER 2026-06-11 (on-prem, internal facility tool): analyze + agent now
    # default ON. Soak via the Prometheus alerts + audit flags; decommission the
    # old inline code only AFTER a clean soak. ORCHESTRATE stays OFF until the
    # 48 GB box — multi-agent (gemma4→devstral→phi4) thrashes the 20 GB GPU.
    USE_GRAPH_ANALYZER:    bool = True
    USE_GRAPH_AGENT:       bool = True
    USE_GRAPH_ORCHESTRATE: bool = False

    # ── Response length caps (Performance A2) ───────────────────────────────
    # Hard ceiling on tokens generated per response. The prompt also asks for
    # concise output but `num_predict` is the safety net. Cuts ~30% off
    # /analyze latency by ending generation earlier.
    OLLAMA_MAX_TOKENS_ANALYZE: int = 400   # analyzer final answer
    OLLAMA_MAX_TOKENS_AGENT:   int = 300   # agent final summary
    OLLAMA_MAX_TOKENS_SYNTH:   int = 400   # multi-agent synthesizer
    OLLAMA_MAX_TOKENS_REPORT:  int = 350   # daily report

    # Nyx assistant intent router (app/ai/router_classify.py)
    ASSISTANT_ROUTE_TIMEOUT_S:        float = 3.0   # LLM arbiter timeout; falls back to heuristics
    ASSISTANT_ROUTE_SKIP_LLM_ON_KEYWORD: bool = True  # short + high-precision keyword match → skip LLM
    ASSISTANT_ROUTE_HISTORY_TAIL:     int   = 6     # prior messages fed to the router

    # Langfuse self-hosted span tracing (optional, MIT license)
    # Leave LANGFUSE_HOST empty to disable tracing entirely (default).
    # NOTE: the Langfuse server is currently DISABLED in docker-compose.yml — the
    # v3 server needs ClickHouse+Redis+S3 (deferred to the 48 GB box). The v4 SDK
    # + graph CallbackHandler trace automatically once a server is stood up and
    # these are set; graph_callbacks() no-ops while LANGFUSE_HOST is empty.
    LANGFUSE_HOST:       str = ""   # e.g. "http://localhost:3200"
    LANGFUSE_PUBLIC_KEY: str = ""   # pk-lf-...
    LANGFUSE_SECRET_KEY: str = ""   # sk-lf-...

    # Logging — DEBUG | INFO | WARNING | ERROR
    LOG_LEVEL: str = "INFO"
    LOG_JSON: bool = False
    LOG_ACCESS: bool = True
    LOG_SQL_ECHO: bool = False

    # Optional log file (always JSON regardless of LOG_JSON). Promtail tails this
    # path to ship logs into Loki when the backend runs outside Docker. Leave
    # empty to disable file logging (stdout only).
    LOG_FILE: str = ""
    LOG_FILE_MAX_BYTES: int = 10 * 1024 * 1024   # 10 MB per file
    LOG_FILE_BACKUP_COUNT: int = 5               # keep last 5 rotated files

    class Config:
        env_file = ".env"


settings = Settings()
