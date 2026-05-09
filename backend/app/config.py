from typing import Literal

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Unicharm MySQL (read-only telemetry source)
    DB_HOST: str = "localhost"
    DB_PORT: int = 3307
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
    OLLAMA_HOST: str = "http://100.125.103.28:11434"
    OLLAMA_DEFAULT_MODEL: str = "qwen2.5:14b"

    BACKEND_PORT: int = 8000

    # Phase 3 cost analytics — flat blended tariff (₹/kWh), POC default
    TARIFF_INR_PER_KWH: float = 8.5

    # Logging — DEBUG | INFO | WARNING | ERROR
    LOG_LEVEL: str = "INFO"
    LOG_JSON: bool = False
    LOG_ACCESS: bool = True
    LOG_SQL_ECHO: bool = False

    class Config:
        env_file = ".env"


settings = Settings()
