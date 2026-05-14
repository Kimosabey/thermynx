# Graylinx — Architecture Diagrams

Diagrams-as-code in [Mermaid](https://mermaid.js.org/). Render to HD PNG/SVG at any resolution from these `.mmd` source files.

## Diagram catalogue

| File | Type | What it shows |
|------|------|---------------|
| `01-system-context.mmd` | flowchart | **C4 L1** — actors + Graylinx + external systems (MySQL · Postgres · Redis · Ollama) |
| `02-container-view.mmd` | flowchart | **C4 L2** — backend layered architecture (transport · middleware · service · domain · infra) |
| `03-sequence-uc1-analyzer.mmd` | sequence | **UC1** — analyzer flow end-to-end (browser → API → MySQL → Ollama → SSE back) |
| `04-sequence-agent.mmd` | sequence | **Agentic Investigator** — ReAct tool-loop with `compute_efficiency` → `detect_anomalies` → `compare_equipment` → final report |
| `05-sequence-anomaly-job.mmd` | sequence | **Background scan** — APScheduler / arq anomaly detection job |
| `06-erd-thermynx-app.mmd` | ER | **Database ERD** — all `thermynx_app` Postgres tables incl. `agent_runs`, pgvector `embeddings` |
| `07-deployment-poc.mmd` | flowchart | **POC topology** — laptop docker compose + Ollama box over Tailscale |
| `08-data-flow.mmd` | flowchart | **Data flow** — telemetry → normalize → rollup / anomaly → LLM (with RAG) → UI |

## How to render to HD images

### Option A — Web (zero install, fastest)

1. Open <https://mermaid.live>
2. Paste the contents of any `.mmd` file
3. **Actions → Download** → choose SVG (infinite resolution) or PNG (set the width to 3840 for 4K)

### Option B — Local CLI (best for batch / CI)

```bash
# install once
npm install -g @mermaid-js/mermaid-cli

# single file → 4K PNG, transparent background
mmdc -i 01-system-context.mmd -o 01-system-context.png \
     -w 3840 -H 2160 -b transparent

# single file → SVG (vector, infinite resolution)
mmdc -i 01-system-context.mmd -o 01-system-context.svg

# batch all diagrams → 4K PNGs
for f in *.mmd; do
  mmdc -i "$f" -o "${f%.mmd}.png" -w 3840 -H 2160 -b transparent
done
```

### Option C — VSCode (live preview while editing)

Install **Markdown Preview Mermaid Support** + **Mermaid Markdown Syntax Highlighting**. Open any `.mmd` file → preview shows it live.

### Option D — GitHub (auto-renders inline)

Mermaid renders natively inside `.md` files on GitHub. To embed any of these in `BUILD_PLAN.md`:

````markdown
```mermaid
flowchart TB
    A --> B
```
````

## Theming

All diagrams use a dark palette tuned for slide decks and presentations. Each file starts with:

```
%%{init: {'theme': 'dark', 'themeVariables': {'fontSize': '15px'}}}%%
```

Change `'dark'` to `'forest'`, `'neutral'`, `'default'`, or `'base'` for other built-in themes. Custom colours live in the `classDef` lines at the bottom of each file — edit those to re-brand.

## Updating diagrams

These files are the **source of truth** for Graylinx architecture visuals. When the architecture changes:

1. Edit the relevant `.mmd` file
2. Re-render with `mmdc` (or just commit — GitHub re-renders inline previews automatically)
3. Reference any rendered images from `BUILD_PLAN.md` if needed

Never edit a rendered PNG/SVG directly. Always go through the source.

## Recommended export for stakeholder demos

For the POC walkthrough deck:

```bash
mkdir -p exports
for f in *.mmd; do
  mmdc -i "$f" -o "exports/${f%.mmd}.png" -w 3840 -H 2160 -b "#0f172a"
done
```

The `-b "#0f172a"` matches a typical slate dark slide background. Drop the PNGs into Keynote / PowerPoint / Google Slides.
