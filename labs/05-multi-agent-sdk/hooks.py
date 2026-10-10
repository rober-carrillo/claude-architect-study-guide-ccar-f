"""STARTER - Lab 05 hooks (TODO 4-5). Solution: solution/hooks.py.

Agent SDK hooks: deterministic rules that run in YOUR process around every tool call,
including tool calls made inside subagents.

Signature: async def hook(input_data: dict, tool_use_id: str | None, context) -> dict
Return {} for "no opinion", or a dict with hookSpecificOutput (see each hook).
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from claude_agent_sdk import HookMatcher

_HERE = Path(__file__).resolve().parent
CORPUS_DIR = next(d for d in (_HERE / "corpus", _HERE.parent / "corpus") if d.is_dir()).resolve()
ALLOWED_FETCH_DOMAINS = {"example.org", "en.wikipedia.org", "www.energy.gov"}


def _deny(reason: str) -> dict:
    return {"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",          # allow | deny | ask | defer
        "permissionDecisionReason": reason,    # Claude sees this and can change course
    }}


# --------------------------------------------------------------------------- PreToolUse
async def restrict_file_access(input_data: dict, tool_use_id: str | None, context) -> dict:
    """Read/Grep/Glob may only touch ./corpus. Enforced for the coordinator AND every subagent."""
    # TODO(4): resolve tool_input["file_path"] or tool_input["path"] against input_data["cwd"];
    #          return {} if it is inside CORPUS_DIR (or no path was given), else
    #          _deny(...) with a reason naming the agent (input_data.get("agent_type")).
    return {}


async def restrict_fetch_domains(input_data: dict, tool_use_id: str | None, context) -> dict:
    """WebFetch only to allow-listed domains (a constrained alternative to a generic fetch)."""
    url = input_data.get("tool_input", {}).get("url", "")
    host = urlparse(url).hostname or ""
    if host in ALLOWED_FETCH_DOMAINS:
        return {}
    return _deny(f"WebFetch to {host or url!r} is not allowed. Allowed: {sorted(ALLOWED_FETCH_DOMAINS)}.")


# --------------------------------------------------------------------------- PostToolUse
def _normalise_date(value) -> tuple[str | None, str]:
    """Unix ts / ISO 8601 / 'March 2025' -> ('YYYY-MM-DD' or 'YYYY-MM', precision)."""
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value, tz=timezone.utc).strftime("%Y-%m-%d"), "day"
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).strftime("%Y-%m-%d"), "day"
        except ValueError:
            pass
        try:
            return datetime.strptime(value, "%B %Y").strftime("%Y-%m"), "month"
        except ValueError:
            pass
    return None, "unknown"


def _normalise_payload_text(text: str) -> str:
    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        return text
    for r in payload.get("results", []) + payload.get("partial_results", []):
        r["published"], r["published_precision"] = _normalise_date(r.get("published"))
    return json.dumps(payload)


def _normalise_response(resp):
    """MCP tool output can reach the hook as {"content": [...]}, a bare list of blocks, or a string."""
    if isinstance(resp, str):
        return _normalise_payload_text(resp)
    if isinstance(resp, list):
        return [{**b, "text": _normalise_payload_text(b["text"])} if b.get("type") == "text" else b for b in resp]
    if isinstance(resp, dict) and "content" in resp:
        return {**resp, "content": _normalise_response(resp["content"])}
    return resp


async def normalise_search_dates(input_data: dict, tool_use_id: str | None, context) -> dict:
    """Rewrite heterogeneous date formats to ISO 8601 BEFORE the model reads the result."""
    # TODO(5): updated = _normalise_response(input_data.get("tool_response")); if it changed, return
    #          {"hookSpecificOutput": {"hookEventName": "PostToolUse", "updatedMCPToolOutput": updated}}
    return {}


HOOKS = {
    "PreToolUse": [
        HookMatcher(matcher="Read|Grep|Glob", hooks=[restrict_file_access]),
        HookMatcher(matcher="WebFetch", hooks=[restrict_fetch_domains]),
    ],
    "PostToolUse": [
        HookMatcher(matcher="mcp__research__search_web", hooks=[normalise_search_dates]),
    ],
}
