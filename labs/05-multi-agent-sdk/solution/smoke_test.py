"""No-API smoke test for lab 05. Run: python smoke_test.py

- calls the @tool handler directly (normal, empty, simulated timeout)
- talks to the in-process SDK MCP server through an in-memory MCP client (mcp >= 2)
- runs each hook on sample inputs
- builds the exact `claude` CLI command the SDK would launch, without launching it
"""

from __future__ import annotations

import asyncio
import json
from argparse import Namespace

import hooks
from research_tools import research_server, search_web


async def test_tool_handler():
    ok = await search_web.handler({"query": "heat pump install costs"})
    body = json.loads(ok["content"][0]["text"])
    assert not ok.get("is_error") and body["results"], body

    empty = await search_web.handler({"query": "zzzz qqqq"})
    assert not empty.get("is_error") and json.loads(empty["content"][0]["text"])["results"] == []

    err = await search_web.handler({"query": "heat pumps europe"})
    body = json.loads(err["content"][0]["text"])
    assert err["is_error"] and body["isRetryable"] and body["partial_results"] and body["attempted_query"]
    print("tool handler: OK")


async def test_in_memory_mcp():
    try:
        from mcp import Client  # mcp >= 2 can wrap a server object directly, no subprocess
    except ImportError:
        print("in-memory MCP: skipped (needs mcp >= 2)")
        return
    async with Client(research_server["instance"]) as client:
        tools = await client.list_tools()
        assert [t.name for t in tools.tools] == ["search_web"]
        res = await client.call_tool("search_web", {"query": "europe"})
        assert res.is_error is True, res
        res = await client.call_tool("search_web", {"query": "cold climate"})
        assert res.is_error is False
        print("in-memory MCP:", json.dumps(tools.tools[0].model_dump(by_alias=True, exclude_none=True))[:160], "...")
    print("in-memory MCP: OK")


async def test_hooks():
    cwd = str(hooks.CORPUS_DIR)
    allow = await hooks.restrict_file_access({"cwd": cwd, "tool_input": {"file_path": "homeowner_survey_2023.md"}}, None, None)
    assert allow == {}, allow
    deny = await hooks.restrict_file_access(
        {"cwd": cwd, "agent_type": "doc-analyst", "tool_input": {"file_path": "../solution/coordinator.py"}}, None, None)
    assert deny["hookSpecificOutput"]["permissionDecision"] == "deny"
    deny = await hooks.restrict_file_access({"cwd": cwd, "tool_input": {"path": "/etc"}}, None, None)
    assert deny["hookSpecificOutput"]["permissionDecision"] == "deny"

    assert await hooks.restrict_fetch_domains({"tool_input": {"url": "https://example.org/x"}}, None, None) == {}
    deny = await hooks.restrict_fetch_domains({"tool_input": {"url": "https://evil.test/x"}}, None, None)
    assert deny["hookSpecificOutput"]["permissionDecision"] == "deny"

    raw = await search_web.handler({"query": "heat pumps cost cold climate furnaces"})
    for shape in (raw, raw["content"], raw["content"][0]["text"]):
        out = await hooks.normalise_search_dates({"tool_response": shape}, None, None)
        updated = out["hookSpecificOutput"]["updatedMCPToolOutput"]
        text = updated if isinstance(updated, str) else (updated["content"] if isinstance(updated, dict) else updated)[0]["text"]
        dates = {r["published"] for r in json.loads(text)["results"]}
        assert dates == {"2025-01-01", "2024-11-18", "2025-03"}, dates
    print("hooks: OK")


def test_cli_command():
    import shutil

    from claude_agent_sdk._internal.transport.subprocess_cli import SubprocessCLITransport

    import coordinator

    args = Namespace(real_web=False, sequential=False, resume="abc-123", fork=True)
    opts = coordinator.build_options(args)
    t = SubprocessCLITransport(prompt="hi", options=opts)
    t._cli_path = shutil.which("claude") or "claude"  # never executed
    cmd = t._build_command()
    joined = " ".join(cmd)
    i = cmd.index("--allowedTools")
    assert "Task" in cmd[i + 1].split(","), cmd[i + 1]
    assert "--resume=abc-123" in cmd and "--fork-session" in cmd, cmd
    assert "--mcp-config" in joined
    assert set(opts.agents) == {"web-researcher", "doc-analyst", "synthesizer"}
    print("cli flags:", [c for c in cmd if c.startswith("--")])
    print("cli command: OK")


async def main():
    await test_tool_handler()
    await test_in_memory_mcp()
    await test_hooks()
    test_cli_command()
    print("all smoke tests passed")


if __name__ == "__main__":
    asyncio.run(main())
