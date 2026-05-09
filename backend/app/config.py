from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Unicharm MySQL (read-only telemetry source)
    DB_HOST: str = "localhost"
    DB_PORT: int = 3307
    DB_USER: str = "root"
    DB_PASSWORD: str = "changeme"
    DB_NAME: str = "unicharm"

    # Postgres thermynx_app (application data)
    POSTGRES_URL: str = "postgresql+asyncpg://thermynx:dev@localhost:5432/thermynx_app"

    # Redis (cache + queue)
    REDIS_URL: str = "redis://localhost:6379/0"

    # Ollama (Tailscale server)
    OLLAMA_HOST: str = "http://100.125.103.28:11434"
    OLLAMA_DEFAULT_MODEL: str = "qwen2.5:14b"

    BACKEND_PORT: int = 8000

    class Config:
        env_file = ".env"


settings = Settings()
