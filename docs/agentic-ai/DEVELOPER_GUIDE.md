# Agentic AI — Developer Guide

How the LangGraph pipeline is structured and how to extend it (add a node, a tool, a specialist).
All code lives under `backend/app/ai/graph/`. Companion to
[FRAMEWORK_REWRITE_PLAN.md](./FRAMEWORK_REWRITE_PLAN.md) and
[FRAMEWORK_ARCHITECTURE.md](./FRAMEWORK_ARCHITECTURE.md).

## Module map (`backend/app/ai/graph/`)

| File | Role |
|------|------|
| `models.py` | Per-task `ChatOllama` router — `chat_model(role)`, `structured_model`, `with_retries`. **Sets `num_ctx` via `app.llm.ollama._num_ctx_for`** (critical — low num_ctx truncates prompts → empty answers). |
| `schemas.py` | Pydantic: `Plan`/`Subtask`, `CritiqueVerdict`, 8 tool-arg models + `TOOL_ARG_SCHEMAS`. |
| `validation.py` | `validate_tool_args()` — one-shot tool-arg repair on failure. |
| `tools_lc.py` | The 8 HVAC tools as LangChain `StructuredTool`s (`LC_TOOLS`, `LC_TOOLS_BY_NAME`). Execution still goes through the guarded `execute_tool` + DATA-wrap. |
| `state.py` | `AgentState` TypedDict threaded through nodes. |
| `nodes.py` | Grounded-path node fns (context/rag/prompt/llm/postcheck/critique). |
| `rerank.py` | FlashRank cross-encoder rerank, used in the `rag` node (retrieve 15 → rerank → top 5). |
| `single_agent.py` | `build_single_agent_graph()` — grounded `/analyze` graph. |
| `react_agent.py` | `build_react_agent_graph()` — ReAct tool-loop `/agent/run` graph. |
| `multi_agent_graph.py` | `build_multi_agent_graph()` — planner → specialists → synthesis. |
| `sse.py` | `astream_sse(graph, inputs, config, done_extra)` → the existing SSE frame contract; injects Langfuse callbacks. |
| `tracing.py` | `graph_callbacks()` → Langfuse `CallbackHandler` (no-op when off). |

## The three graphs (node topologies)

```
single  (/analyze):     preflight → context → rag → prompt → llm → postcheck → critique
react   (/agent/run):   preflight → init → llm ⇄ tools → answer → postcheck
multi   (/orchestrate): preflight → planner → specialists(parallel ReAct) → synthesis → postcheck → critique
```

Each compiles to a `CompiledStateGraph`. Verify they build:
```python
from app.ai.graph.single_agent import build_single_agent_graph
build_single_agent_graph().get_graph().nodes   # lists nodes
```

## Non-negotiable invariants (don't break these)

- **Guards are graph nodes, on every surface:** `preflight` (action/equipment/topic refusals),
  `postcheck` (numeric/equipment/citation audit), `critique` (LLM second opinion — never a gate).
- **DATA_START/DATA_END wrapping** of all tool/RAG content (prompt-injection defense).
- **Per-task model routing** via `models.py` (eval-backed; non-Chinese; on-prem). Always set `num_ctx`.
- **SSE frame contract** the UI depends on: `token` / `tool_call` / `tool_result` / `citations` /
  `audit` / `verification` / `done` (+ `synthesis_token`/`delegate_token` for multi-agent).
- A phase that can't preserve these doesn't ship.

## How to add a NODE (grounded graph)

1. Write the node fn in `nodes.py`: `async def my_node(state: AgentState) -> dict:` returning the
   keys it updates in `state`.
2. Add any new state keys to `AgentState` in `state.py`.
3. Wire it in `single_agent.py`: `graph.add_node("my_node", my_node)` + `add_edge(...)` (or
   `add_conditional_edges(...)` for branching, e.g. anomaly → root_cause).
4. If it emits to the UI, map its update to an SSE frame in `sse.py` (key-driven).
5. Add/extend a golden case in `backend/tests/golden/cases.py`; `make eval` stays green.

## How to add a TOOL

1. Define the Pydantic arg schema in `schemas.py` and register it in `TOOL_ARG_SCHEMAS`.
2. Add the `StructuredTool` to `LC_TOOLS` in `tools_lc.py`.
3. Keep execution behind the guarded `execute_tool` (equipment allow-list, payload cap, DB timeout,
   DATA-wrap). Never let the tool write without a guard (`propose_work_order` = cite-a-number +
   approve loop; never auto-create).
4. The ReAct graph picks it up automatically via `bind_tools(LC_TOOLS)`.
5. Add a tool unit test + a golden case.

## How to add a SPECIALIST (multi-agent)

1. Add its id to the planner's allowed set (`Subtask.specialist` enum in `schemas.py`:
   investigator / optimizer / root_cause / maintenance → add yours).
2. Give it a system-prompt/mode; specialists reuse the F3 ReAct graph (share devstral), so usually
   just a new mode + prompt, not a new graph.
3. The `planner` (gemma4, structured `Plan`) will route to it; `synthesis` (phi4) is postchecked +
   critiqued. Mark a failed specialist "do not infer" (M2) so synthesis doesn't fabricate.
4. ⚠️ On the 20 GB box cross-model specialists thrash — keep specialists on a shared model
   (devstral) so parallel fan-out doesn't evict. Co-residency is fine on the 48 GB box.

## Testing

- **Golden gate (regression):** `make eval` / `pytest tests/eval/test_golden.py` against a live
  backend; `tests/eval/run_report.py` writes folderised reports. See
  [`backend/tests/eval/README.md`](../../backend/tests/eval/README.md).
- **Direct (no backend):** `await build_single_agent_graph().ainvoke({...}, {"configurable":{"thread_id":"t"}})`
  from `backend/`, `PYTHONIOENCODING=utf-8`.
- Not to be confused with `model-eval/` (model *selection* benchmark) — different purpose.
