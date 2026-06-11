@echo off
title THERMYNX - Ollama KICK (reclaim the GPU)

REM ollama_kick.bat — one click to reclaim the GPU for THERMYNX:
REM   1) unload the intruder models (gpt-oss / mxbai) if loaded
REM   2) re-warm + pin phi4 (THERMYNX's hot model: analyze / anomaly / RAG)
REM Run this whenever the VRAM monitor shows gpt-oss or mxbai squatting on the card.
REM NOTE: this only UNLOADS them — if an external client keeps calling them they
REM       will reload. The durable fix is stopping that client at its source.

echo Stopping intruder models (gpt-oss / mxbai)...
ollama stop gpt-oss:20b 2>nul
ollama stop mxbai-embed-large 2>nul

echo Re-warming + pinning phi4...
curl -s --max-time 90 -X POST http://localhost:11434/api/generate -H "Content-Type: application/json" -d "{\"model\":\"phi4\",\"keep_alive\":-1,\"prompt\":\"ok\",\"stream\":false,\"options\":{\"num_predict\":1}}" >nul 2>&1

echo.
echo Now loaded in VRAM:
ollama ps
echo.
echo Done. phi4 pinned. If gpt-oss/mxbai return, stop the EXTERNAL client calling them.
pause
