from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DB_HOST: str
    DB_PORT: int
    DB_USER: str
    DB_PASSWORD: str
    DB_NAME: str
    
    OLLAMA_BASE_URL: str
    OLLAMA_MODEL: str

    class Config:
        env_file = ".env"

settings = Settings()
