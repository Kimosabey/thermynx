"""AI subsystem — pipeline-organized facade.

The actual code still lives in `services/`, `prompts/`, `llm/`, `domain/`.
This package re-exports it in PIPELINE order so engineers can read
`from app.ai import pipeline` and see the entire AI flow as one mental model.

See `pipeline.py` for the stage-by-stage map.
See `docs/planning/ai/AI_PIPELINE_REORG.md` for the migration plan.
"""

from app.ai import pipeline   # noqa: F401  — main entry point for navigation

__all__ = ["pipeline"]
