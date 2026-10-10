# Lab 02 — Build an MCP server and watch the protocol

**Goal:** write a small MCP server with two similar-sounding tools, a resource, a resource
template and a prompt. Then talk to it three ways: the raw JSON-RPC wire, the official Python
client, and Claude Code.

**Time:** 45–60 min · **Cost:** steps 1–6 need no API key. Step 7 uses Claude Code.

## Exam task statements exercised

| Task | What you do here |
|---|---|
| 2.1 Tool descriptions | `lookup_product` vs `lookup_inventory`: purpose, inputs, outputs, when *not* to use each |
| 2.2 Structured errors | `isError: true` + `{errorCategory, isRetryable, message}`; 0 units is a valid result, not an error |
| 2.4 MCP integration | project `.mcp.json` with `${ENV}` expansion; `--scope project` vs user; resources as a catalog |
| 2.5 / Scenario 4 | why a rich MCP description keeps the agent from falling back to Grep |

## Files

```
02-mcp-server/
  server.py         STARTER server - TODO 1-6
  test_client.py    official MCP Python client over stdio; prints every result as JSON
  raw_jsonrpc.py    the same conversation with no SDK: newline-delimited JSON-RPC on stdin/stdout
  .mcp.json         project-scoped config with ${VAR} and ${VAR:-default} expansion
  solution/         finished server.py (+ copies of the two clients pointed at it)
```

> **SDK version note.** `mcp` 2.x renamed `FastMCP` to `MCPServer`
> (`from mcp.server.mcpserver import MCPServer`). `from mcp.server.fastmcp import FastMCP` now
> raises `ModuleNotFoundError` with a pointer to the migration guide. `server.py` imports
> whichever exists, and the decorators used here (`@mcp.tool()`, `@mcp.resource()`,
> `@mcp.prompt()`, `mcp.run()`) work the same in both. The solution was run end to end on
> `mcp` 2.3.0 and 1.30.0.

## Setup

```bash
cd labs && source .venv/bin/activate
cd 02-mcp-server
```

## Steps

1. **Look at the wire first.** `python raw_jsonrpc.py` (it targets `server.py`; run
   `python solution/raw_jsonrpc.py` to see the finished server). Read the five exchanges:
   `initialize` → `notifications/initialized` (no `id`, no reply) → `tools/list` → `tools/call` →
   an unknown method. The last one comes back as a JSON-RPC `error`. A tool that *ran and failed*
   comes back as a `result` with `isError: true`. Those are two different failure channels.
2. **Run the official client against the starter.** `python test_client.py`. Note three problems:
   - a `Failed to parse JSONRPC message ... 'catalog server starting'` error. The starter `print()`s
     to **stdout**, which is the protocol channel (TODO 6). Remove it.
   - `Unknown resource` / `Unknown prompt` (TODO 3–5 not done yet).
   - errors come back as `"Operation failed"` with `isError: false` (TODO 2).
3. **TODO 2: structured errors.** Make `tool_error()` return the JSON body and `isError=True`.
   Rerun and compare the `SKU-9` (validation) and `WH-SOUTH` (transient, retryable) calls.
4. **TODO 1: descriptions.** Rewrite both docstrings (the docstring becomes the tool description).
   Check `tools/list` output: the description and the `inputSchema` generated from the type hints
   are everything a model gets.
5. **TODO 3–5: resource, template, prompt.** Add `catalog://products`, `catalog://products/{sku}`
   and `restock_report`. Rerun `test_client.py`: `resources/list` shows the static resource, and
   `resources/templates/list` shows the template.
6. **Diff against the solution.** `diff server.py solution/server.py`.
7. **Connect it to Claude Code** (use a scratch copy or this folder, not your home config):
   ```bash
   cd labs/02-mcp-server
   export INVENTORY_API_TOKEN=demo-token
   export LABS_PYTHON="$(cd .. && pwd)/.venv/bin/python"   # the venv that has `mcp`
   claude                       # .mcp.json here is picked up as a PROJECT-scoped server
   ```
   Claude Code asks you to approve the project server the first time. Then:
   - `/mcp`: `catalog` is connected, with 2 tools, plus resources and the prompt.
   - Ask: *"Is the merino base layer in stock, and what does it cost?"* Watch it read the catalog
     (or call tools) and call **both** tools, each for its own half of the question.
   - Type `@` to see `catalog://products` offered as a resource you can attach.
   - The prompt appears as a slash command: `/mcp__catalog__restock_report WH-WEST`.
   - Unset `INVENTORY_API_TOKEN`, restart, and ask about stock: you get a `permission` error the
     model can explain, not a crash.

   Equivalent CLI registration (writes `.mcp.json` in the current directory):
   ```bash
   claude mcp add catalog --scope project \
     -e INVENTORY_API_TOKEN='${INVENTORY_API_TOKEN}' \
     -- "$LABS_PYTHON" solution/server.py
   ```
   Single quotes keep the shell from expanding `${INVENTORY_API_TOKEN}`, so the *reference* goes
   into the file, not the secret. Open `.mcp.json` afterwards to check. `--scope user` would write
   to `~/.claude.json` instead (personal, all projects, not shared). The default, `--scope local`,
   is also stored in `~/.claude.json`, but only for this project.

## What to observe

- `tools/list` is all the model knows about a tool: `name`, `description`, `inputSchema`,
  `annotations`. Nothing from your code's internals leaks through.
- A **transient** error carries `isRetryable: true` plus what was attempted. A **validation**
  error says what to fix. `lookup_inventory("SKU-1003")` returns `total: 0` with
  `isError: false`: an empty result, not a failure.
- Raising an exception inside a tool (or failing argument validation, as in the last call)
  also produces `isError: true`, but the text is whatever the exception said. Returning a
  structured body gives you control over what the model reads.
- Resources are read by the **client/host** (or attached by the user with `@`); they don't
  need a model-driven tool call.

## Exam connection

- Tool descriptions are the main input to tool selection. Overlapping descriptions cause
  misrouting. Fix it by differentiating the descriptions, or by renaming or splitting the tools.
- `isError` + `errorCategory` (transient / validation / business / permission) + `isRetryable`
  lets an agent retry the right failures and explain the rest. Generic errors hide that context.
- Distinguish access failures from valid empty results.
- `.mcp.json` (project scope, committed) is for shared team servers, with `${VAR}` expansion so
  secrets stay out of git. `~/.claude.json` (user scope) is for personal or experimental servers.
  Tools from every configured server are discovered at connect time and are available together.
- Resources expose catalogs (schemas, docs trees, issue lists) so the agent can see what exists
  without exploratory calls.
- Prefer an existing community MCP server for standard systems (Jira, GitHub). Write a custom
  one only for team-specific workflows.

## Stretch exercises

1. **Misrouting experiment.** Change both descriptions to *"Get product data for a SKU."* Ask
   Claude Code five stock/price questions and count wrong-tool calls. Restore and repeat.
2. **Split a generic tool.** Add `analyze_product(sku, mode)` that does both jobs, then refactor
   it into purpose-specific tools. Which version is easier for the model?
3. **User vs project scope.** Register a second copy as a personal server
   (`claude mcp add catalog-dev --scope user -- ...`) and check in `/mcp` that both are
   available at once. Remove it afterwards with `claude mcp remove catalog-dev --scope user`.
4. **Grep vs MCP.** Put a `products.csv` in the folder and ask a stock question. Does Claude grep
   the CSV or call `lookup_inventory`? Strengthen the description ("live counts; files on disk are
   stale snapshots") and retry.
5. **Agent SDK hookup.** In Lab 05, pass this server to `ClaudeAgentOptions(mcp_servers={"catalog":
   {"command": ..., "args": [...], "env": {...}}})` and allow `mcp__catalog__lookup_inventory`.
