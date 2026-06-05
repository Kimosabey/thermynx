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
    # global default/fallback is phi4 (Microsoft). Overridden by .env at runtime.
    OLLAMA_HOST: str = "http://100.125.103.28:11434"
    OLLAMA_DEFAULT_MODEL: str = "phi4"

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
    NL_QUERY_LLM_TIMEOUT_S: float = 25.0  # Ollama SQL generation timeout
    NL_QUERY_DB_TIMEOUT_S:  float = 10.0  # MySQL execution timeout
    NL_QUERY_MAX_ROWS:      int   = 1000  # hard row cap (LIMIT)
    VISION_TIMEOUT_S:       float = 90.0  # Ollama vision call timeout

    # Analyzer response cache (Redis) — 60s TTL keeps answers fresh while
    # eliminating repeated identical questions. Set to 0 to disable.
    ANALYZER_CACHE_TTL_S: int = 60

    # Ollama HTTP timeouts for the agent/analyzer chat paths
    OLLAMA_CHAT_TIMEOUT_S:   float = 60.0   # non-streaming /api/chat (tool calls)
    OLLAMA_STREAM_TIMEOUT_S: float = 120.0  # streaming /api/chat and /api/generate

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

    # ── Model right-sizing per task (eval verdict 2026-06-03 + non-Chinese policy) ──
    # Each task can use a different model. Empty string = fall back to
    # OLLAMA_DEFAULT_MODEL (now phi4). Assignments are the eval winners, with
    # Chinese-origin models (qwen/deepseek/qwq) EXCLUDED by policy — so the
    # narration winner (qwen2.5:14b) is replaced by its tying runner-up phi4,
    # and the executor by gemma3:27b (Google). See MODEL_FIT_VERDICT.md.
    #   - TEXT:     narration / answer streaming  → phi4 (4.5, ties qwen; non-Chinese)
    #   - TOOL:     agent ReAct executor          → mistral-small3.2 (Mistral/FR; best non-Chinese tool-caller)
    #   - SQL:      NL→SQL generation             → mistral-small3.2 + nl_to_sql guardrails
    #   - PLANNER:  multi-agent planner JSON       → mistral-small3.2
    #   - AUDITOR:  self-critique / validator      → phi4 (validator winner 5.0)
    #   - RAG:      RAG-grounded analyzer answer    → "" = TEXT model (phi4; RAG winner-tie 4.4)
    # IMPORTANT — why not gpt-oss / gemma3 (the raw eval winners):
    #   gpt-oss:20b is a REASONING model: it spends num_predict tokens on a hidden
    #   "thinking" channel before answering, so under the backend's token caps
    #   (analyze=400) with large RAG prompts it returns an EMPTY response. gemma3:27b
    #   scored worst on tool-calling (2.0) and broke agent runs. Both verified to fail
    #   the golden eval (2026-06-05). phi4 + mistral-small3.2 answer DIRECTLY (no
    #   thinking channel) and pass cleanly. Revisit gpt-oss only with a higher token
    #   budget + thinking-aware streaming in llm/ollama.py.
    # Production set on the Ollama host: phi4, mistral-small3.2, llama3.2-vision,
    # nomic-embed-text — all non-Chinese-origin.
    # Override any one via env var; set to "" to force the OLLAMA_DEFAULT_MODEL fallback.
    OLLAMA_MODEL_TEXT:     str = "phi4"                  # narration & analyzer answer
    OLLAMA_MODEL_TOOL:     str = "mistral-small3.2:latest"  # agent ReAct executor — best non-Chinese tool-caller
    OLLAMA_MODEL_SQL:      str = "mistral-small3.2:latest"  # NL→SQL — nl_to_sql validator/deny-list still guards
    OLLAMA_MODEL_PLANNER:  str = "mistral-small3.2:latest"  # multi-agent planner JSON
    OLLAMA_AUDITOR_MODEL:  str = "phi4"                  # self-critique / validator — eval validator winner (5.0)
    OLLAMA_MODEL_RAG:      str = ""                      # RAG-grounded answer → TEXT model (phi4); split disabled

    # ── Response length caps (Performance A2) ───────────────────────────────
    # Hard ceiling on tokens generated per response. The prompt also asks for
    # concise output but `num_predict` is the safety net. Cuts ~30% off
    # /analyze latency by ending generation earlier.
    OLLAMA_MAX_TOKENS_ANALYZE: int = 400   # analyzer final answer
    OLLAMA_MAX_TOKENS_AGENT:   int = 300   # agent final summary
    OLLAMA_MAX_TOKENS_SYNTH:   int = 400   # multi-agent synthesizer
    OLLAMA_MAX_TOKENS_REPORT:  int = 350   # daily report

    # Langfuse self-hosted span tracing (optional, MIT license)
    # Leave LANGFUSE_HOST empty to disable tracing entirely (default).
    # Start the Langfuse container: docker compose --profile obs up -d langfuse
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
