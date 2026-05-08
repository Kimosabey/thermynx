import httpx
import json
from app.config import settings

class OllamaClient:
    @staticmethod
    async def generate_completion(prompt: str, model: str = None) -> str:
        target_model = model or settings.OLLAMA_MODEL
        url = f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/generate"
        
        payload = {
            "model": target_model,
            "prompt": prompt,
            "stream": False
        }

        # Long timeout because LLM generation can take a while
        async with httpx.AsyncClient(timeout=120.0) as client:
            try:
                response = await client.post(url, json=payload)
                response.raise_for_status()
                data = response.json()
                return data.get("response", "Error: No response generated.")
            except Exception as e:
                return f"Error connecting to Ollama: {str(e)}"
