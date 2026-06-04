"""Make the HVAC backend importable from the model-eval harness.

The harness lives at <project>/model-eval/ but reuses the backend's DB/RAG/LLM
plumbing under <project>/backend/app/*. Importing this module (first) puts
backend/ on sys.path and chdirs there so pydantic-settings loads backend/.env.
Read-only: it never writes to the app's databases.
"""
import os
import sys
from pathlib import Path

# Windows consoles default to cp1252 and choke on report glyphs (≥, ·, •).
# Force UTF-8 so printing the report never crashes the run.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

BACKEND = Path(__file__).resolve().parents[1] / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))
# pydantic-settings reads env_file=".env" relative to cwd at Settings() init,
# so run from backend/ to pick up the real DB / Ollama config.
os.chdir(BACKEND)
