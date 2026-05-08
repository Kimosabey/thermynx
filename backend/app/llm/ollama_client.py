import httpx
from app.db.session import settings


OLLAMA_GENERATE_URL = f"{settings.OLLAMA_HOST}/api/generate"
OLLAMA_TAGS_URL = f"{settings.OLLAMA_HOST}/api/tags"
TIMEOUT = httpx.Timeout(120.0, connect=10.0)


async def list_models() -> list[str]:
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.get(OLLAMA_TAGS_URL)
        resp.raise_for_status()
        data = resp.json()
        return [m["name"] for m in data.get("models", [])]


async def generate(prompt: str, model: str | None = None) -> str:
    target_model = model or settings.OLLAMA_MODEL
    payload = {
        "model": target_model,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.3,
            "top_p": 0.9,
            "num_ctx": 8192,
        },
    }
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.post(OLLAMA_GENERATE_URL, json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data.get("response", "")


async def check_ollama_health() -> tuple[bool, list[str]]:
    try:
        models = await list_models()
        return True, models
    except Exception:
        return False, []
