"""LangChain tool layer for the agentic graph (F5).

Wraps the 8 HVAC tools as idiomatic LangChain ``StructuredTool`` objects, typed by
the Pydantic arg schemas in ``schemas.TOOL_ARG_SCHEMAS``. The model is bound to
these (typed schemas → cleaner tool-calls); execution still flows through the
existing ``execute_tool`` so every guard is preserved (equipment allow-list,
payload cap, DB-level timeout). The ReAct ``tools_node`` keeps doing the
validation + DATA-wrapping (which a prebuilt ToolNode would NOT do), so security
is unchanged — these tools are also independently usable/testable.
"""
from __future__ import annotations

from typing import Any

from langchain_core.tools import StructuredTool

from app.ai.tools import TOOL_SCHEMAS, ToolContext, execute_tool
from app.ai.graph.schemas import TOOL_ARG_SCHEMAS


def _make_tool(spec: dict) -> StructuredTool:
    fn = spec["function"]
    name: str = fn["name"]
    description: str = fn["description"]
    args_schema = TOOL_ARG_SCHEMAS.get(name)

    async def _run(**kwargs: Any) -> Any:
        # Route through the existing executor → keeps allow-list / timeout / payload guards.
        return await execute_tool(name, kwargs, ctx=ToolContext())

    return StructuredTool.from_function(
        coroutine=_run,
        name=name,
        description=description,
        args_schema=args_schema,
    )


# The 8 HVAC tools as LangChain StructuredTools (same order as TOOL_SCHEMAS).
LC_TOOLS: list[StructuredTool] = [_make_tool(s) for s in TOOL_SCHEMAS]
LC_TOOLS_BY_NAME: dict[str, StructuredTool] = {t.name: t for t in LC_TOOLS}
