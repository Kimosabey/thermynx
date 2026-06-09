# Architecture Decision Records (ADRs)

This directory records significant architecture decisions for the THERMYNX backend, in
[MADR](https://adr.github.io/madr/)-style format. Each record is immutable once Accepted; to change a
decision, add a new ADR that supersedes the old one.

| ADR | Title | Status |
|-----|-------|--------|
| [0001](./0001-no-ai-orchestration-framework.md) | No AI orchestration framework (custom lean pipeline) | Superseded by 0002 |
| [0002](./0002-adopt-agentic-framework-stack.md) | Adopt an open-source agentic framework stack (LangGraph + LlamaIndex + Langfuse + RAGAS) | Accepted |

## Conventions

- Filename: `NNNN-kebab-case-title.md` (zero-padded, monotonically increasing).
- Statuses: `Proposed` → `Accepted` → `Superseded by NNNN` / `Deprecated`.
- Keep each ADR to one decision. Link to deeper analysis in `docs/planning/` rather than inlining it.
