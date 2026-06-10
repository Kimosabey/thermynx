"""Agentic graph package (framework rewrite, ADR-0002).

The LangGraph-based agentic runtime. Built incrementally on branch
``rewrite/agentic-framework``; wired behind the existing ``app/ai/pipeline.py``
facade at cutover (F7) so API/SSE contracts are unchanged.

Modules
-------
- ``models``  — per-task ChatOllama router (F1.1/F1.2), mirrors ``app/config.py`` routing.
- ``schemas`` — Pydantic I/O schemas (F1.3–F1.5), mirror the *current* shapes in
  ``multi_agent.py`` / ``critique.py`` / ``tools.py`` so the cutover is parity-safe.

Runtime deps (langgraph, langchain-ollama, llama-index, …) live in
``backend/requirements-agentic.txt`` and are resolved on the target box (F0.4).
Modules here lazy-import those deps so the package stays importable beforehand.
"""
