"""An in-process MCP server (Agent SDK `@tool` + `create_sdk_mcp_server`) with a FAKE web search.

The fake keeps the lab cheap and deterministic, and lets us simulate the failure modes the exam
asks about:
- results with dates in three formats (Unix timestamp, ISO 8601, "March 2025"); the
  PostToolUse hook in hooks.py normalises them before the model sees them
- a query containing "europe" times out: a structured, retryable error with partial results
  and alternatives (what the coordinator needs to decide what to do next)
- a query nobody has written about returns an EMPTY result, which is a success

Claude sees the tool as  mcp__research__search_web.
"""

from __future__ import annotations

import json
from typing import Any

from claude_agent_sdk import create_sdk_mcp_server, tool

INDEX = [
    {"url": "https://example.org/news/heat-pumps-outsell-furnaces", "title": "Heat pumps outsell gas furnaces again",
     "published": 1735689600,  # Unix timestamp (2025-01-01)
     "snippet": "Shipments of air-source heat pumps exceeded gas furnaces for the third straight year in 2024."},
    {"url": "https://example.org/research/cold-climate-performance", "title": "Cold-climate heat pump field study",
     "published": "2024-11-18T09:30:00Z",  # ISO 8601
     "snippet": "Field data from 80 homes shows a seasonal COP of 2.6 at design temperatures down to -15C."},
    {"url": "https://example.org/blog/install-costs", "title": "What a heat pump really costs",
     "published": "March 2025",  # human-readable
     "snippet": "Typical quotes we collected ranged from $12,000 to $22,000 depending on ductwork."},
]

ALLOWED_DOMAINS = {"example.org"}  # also enforced by the PreToolUse hook for WebFetch


def _text(payload: Any, *, is_error: bool = False) -> dict:
    result: dict = {"content": [{"type": "text", "text": json.dumps(payload)}]}
    if is_error:
        result["is_error"] = True  # the SDK turns this into MCP isError=true
    return result


@tool(
    "search_web",
    "Search the web for recent articles. Returns up to 5 results as JSON: url, title, published "
    "(a date) and snippet. Use for news, field studies and prices from the last two years. For the "
    "local reports in ./corpus use Read/Grep instead. An empty results list means nothing matched: "
    "that is an answer, not a failure. Errors carry errorCategory and isRetryable.",
    {"query": str},
)
async def search_web(args: dict) -> dict:
    query = args["query"].lower()
    if "europe" in query:
        return _text({
            "errorCategory": "transient",
            "isRetryable": True,
            "message": "search backend timed out after 10s",
            "attempted_query": args["query"],
            "partial_results": [INDEX[1]],  # one shard answered before the timeout
            "alternatives": ["retry once", "narrow the query to one country", "use the corpus reports"],
        }, is_error=True)
    terms = [t for t in query.split() if len(t) > 3]
    hits = [r for r in INDEX if any(t in (r["title"] + " " + r["snippet"]).lower() for t in terms)]
    return _text({"query": args["query"], "results": hits[:5]})


research_server = create_sdk_mcp_server(name="research", version="1.0.0", tools=[search_web])
