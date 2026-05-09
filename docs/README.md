# THERMYNX — Documentation Index

Everything written about the THERMYNX platform lives here. The plan itself is one level up at [`../BUILD_PLAN.md`](../BUILD_PLAN.md).

## Documents

| Doc | What it covers |
|-----|----------------|
| [`../BUILD_PLAN.md`](../BUILD_PLAN.md) | The end-to-end plan: vision, architecture, phases, requirements, deployment, security, observability |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | **Visual reference** — 8 rendered diagrams (system, flows, ERD, deployment, data flow) |
| [`GETTING_STARTED.md`](./GETTING_STARTED.md) | Run the POC stack on your laptop in under 10 minutes |
| [`RUNBOOK.md`](./RUNBOOK.md) | Common ops tasks: start, stop, debug, reset, tag, troubleshoot |
| [`PROMPTS.md`](./PROMPTS.md) | Versioned LLM prompt catalogue with rationale and changelog |
| [`DATA_DICTIONARY.md`](./DATA_DICTIONARY.md) | What lives in `unicharm` MySQL — normalized tables and key columns |
| [`diagrams/README.md`](./diagrams/README.md) | How to re-render diagrams to HD images |

## Quick links

- 🆕 **First time?** → [`GETTING_STARTED.md`](./GETTING_STARTED.md)
- 📋 **Reading the plan?** → [`../BUILD_PLAN.md` §1A](../BUILD_PLAN.md) (POC scope) then §6 (roadmap)
- 🐛 **Debugging?** → [`RUNBOOK.md`](./RUNBOOK.md)
- 🧠 **Tweaking an LLM prompt?** → [`PROMPTS.md`](./PROMPTS.md) — bump the version, never edit in place
- 🗃️ **Querying telemetry?** → [`DATA_DICTIONARY.md`](./DATA_DICTIONARY.md)
- 🖼️ **Need a diagram for slides?** → [`diagrams/README.md`](./diagrams/README.md) for HD export

## Contributing to docs

- Each doc is the source of truth for *its area* — don't duplicate content; link instead
- Use relative links between docs (so they work on GitHub + locally + in VSCode)
- Diagrams live as `.mmd` source files; never commit a rendered PNG without its source
- When the architecture changes, update `diagrams/*.mmd` first, then regenerate inline blocks in `ARCHITECTURE.md`
