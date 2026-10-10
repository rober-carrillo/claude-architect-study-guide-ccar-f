# Hands-on labs: Claude Certified Architect – Foundations

Six labs that turn the exam guide's Preparation Exercises (section 8) into code you run. Each lab
has a `README.md` (goal, exam task statements, steps, what to observe, exam connection, stretch
exercises), starter files with numbered `TODO`s, and a `solution/` folder with working code. Most
labs also ship a `smoke_test.py` that needs **no API key**: it fails on the starter and passes once
your TODOs are done.

| # | Lab | Time | Exam tasks | Prerequisites |
|---|---|---|---|---|
| 01 | [Agentic loop by hand](01-agent-loop/) — 4 support tools, structured errors, prerequisite gate, refund cap → escalation, case facts | 60–90 min | 1.1, 1.4, 1.5, 2.1, 2.2, 5.1, 5.2 | API key |
| 02 | [MCP server + protocol](02-mcp-server/) — two similar tools, resource, template, prompt, `isError`; raw JSON-RPC and SDK clients; `.mcp.json` | 45–60 min | 2.1, 2.2, 2.4 | none for steps 1–6; Claude Code for step 7 |
| 03 | [Extraction pipeline](03-extraction-pipeline/) — `tool_choice`, nullable schema, Pydantic + semantic validation, retry with feedback, Message Batches | 90 min | 4.2, 4.3, 4.4, 4.5, 5.5 | API key |
| 04 | [Claude Code team config](04-claude-code-config/) — `CLAUDE.md` + `@import`, path rules, command, forked skill, subagent, hooks, permissions, MCP | 60–90 min | 3.1–3.4, 2.4 | Claude Code |
| 05 | [Multi-agent research (Agent SDK)](05-multi-agent-sdk/) — coordinator + 3 `AgentDefinition`s, `Task`, hooks, provenance, error propagation, resume/fork | 90 min | 1.2, 1.3, 1.5, 1.7, 2.3, 5.3, 5.6 | API key (SDK bundles the CLI) |
| 06 | [CI review](06-ci-review/) — `claude-code-action@v1` and `claude -p --json-schema`, per-file + integration passes, prior-findings dedup | 60–90 min | 3.6, 4.1, 4.4, 4.6, 1.6 | Claude Code CLI + API key |

Suggested order: 01 → 02 → 03 → 05 → 04 → 06. Labs 04 and 06 are about Claude Code itself and
can be done in any order.

## Setup

```bash
cd labs
python3 --version                 # need 3.10+. macOS system python is 3.9: use e.g. /opt/homebrew/bin/python3.11
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export ANTHROPIC_API_KEY=sk-ant-...           # labs 01, 03, 05, 06
export CLAUDE_MODEL=claude-sonnet-5-5         # optional; this is the default in every lab
```

Check the install without spending anything:

```bash
(cd 01-agent-loop/solution && python smoke_test.py)
(cd 02-mcp-server/solution && python test_client.py | head -40)
(cd 03-extraction-pipeline/solution && python smoke_test.py)
python 04-claude-code-config/check_template.py
(cd 05-multi-agent-sdk/solution && python smoke_test.py)
(cd 06-ci-review/solution && python smoke_test.py)
```

## Cost warning

Labs 01, 03, 05 and 06 call the **real API** and bill your key (or your Claude Code plan for
04 and 06). One scenario run is usually cents, but:

- Lab 05 runs a coordinator plus up to three subagents per question, and every resume/fork is
  another full run. Keep the default fake search until your design works; `--real-web` adds web
  search and fetch usage.
- Lab 03's batch script submits every invoice, and then resubmits failures.
- Loops can run away. Lab 01 has a step backstop and Lab 05 sets `max_turns`; don't remove them
  while experimenting.

Set a spend limit in the Claude Console before you start, and run the `smoke_test.py` files
first: they check your logic without spending tokens.

## Notes on current APIs vs the exam guide

The exam tests concepts. A few APIs have moved since the guide was written, and the labs use the
current ones:

- **Forced `tool_choice`** (`{"type": "tool"}` / `"any"`) returns a 400 on Claude Sonnet 5.5, Opus 5.5
  and Fable 5.1. Lab 03 uses forced choice on models that accept it (e.g. `claude-haiku-4-5`) and
  falls back to `auto` + `strict: true` + an explicit instruction on the others.
- **MCP Python SDK 2.x** renamed `FastMCP` to `MCPServer` (`from mcp.server.mcpserver import MCPServer`).
  Lab 02 works with both.
- **The `Task` tool** is called `Agent` in current Claude Code. `"Task"` still works as an alias in
  `allowed_tools`.
- **Case facts** in Lab 01 are appended to each new user turn, not rewritten into `system`. Editing
  the system prompt mid-conversation breaks prompt caching and can make earlier thinking blocks
  invalid on current models.
