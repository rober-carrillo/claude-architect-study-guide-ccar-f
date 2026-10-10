# Lab 05 — Multi-agent research with the Claude Agent SDK

**Goal:** build a coordinator that delegates to three subagents (`web-researcher`,
`doc-analyst`, `synthesizer`) defined with `AgentDefinition`. Pass context explicitly, keep
claim→source mappings through synthesis, propagate a simulated timeout as structured error
context, enforce rules with `PreToolUse` hooks, normalise data with a `PostToolUse` hook, and
resume or fork the session.

**Time:** 90 min · **Cost:** one run is several model calls across 4 agents. Watch the
`cost=` line, and keep the fake search (default) until the design works.

## Exam task statements exercised

| Task | Where |
|---|---|
| 1.2 Coordinator–subagent (hub and spoke) | `COORDINATOR_PROMPT`, all routing through the coordinator |
| 1.3 Subagent config and context passing | `AgentDefinition(description, prompt, tools, model)`, `"Task"` in `allowed_tools`, findings passed in the prompt, parallel Task calls |
| 1.5 Hooks | `HookMatcher` PreToolUse (file scope, fetch domains), PostToolUse (date normalisation) |
| 1.7 Sessions | `resume=`, `fork_session=True` |
| 2.3 Tool distribution | each subagent gets only its own tools |
| 5.3 Error propagation | `search_web("...europe...")` → structured timeout with partial results |
| 5.6 Provenance and conflicts | `FINDINGS_CONTRACT`; the corpus contains a temporal difference and a methodological conflict |

This is Preparation Exercise 4 from the exam guide.

## The corpus (deliberate traps)

| Fact | Source A | Source B | What a good report does |
|---|---|---|---|
| Heat pump share | 13% (agency, data to Q4 2024) | 9% (survey, fieldwork 2023) | different **dates**: growth over time, not a contradiction |
| Retrofit cost | $14,000 **median**, rebates excluded | $18,500 **mean**, incl. ductwork and panel | **contested**: both values, with methodology |
| Europe | search times out | — | reported as a **coverage gap**, with the partial result |

## Files

```
05-multi-agent-sdk/
  corpus/              3 local reports (the doc-analyst's whole world; the hook enforces this)
  research_tools.py    in-process MCP server: @tool search_web (fake, dated results, simulated timeout)
  hooks.py             STARTER  TODO 4-5   PreToolUse + PostToolUse hooks
  coordinator.py       STARTER  TODO 1-3   options, AgentDefinitions, coordinator prompt
  smoke_test.py        no-API: tool handler, in-memory MCP client, hooks, generated CLI flags
  solution/            working versions
```

## Setup

```bash
cd labs && source .venv/bin/activate
export ANTHROPIC_API_KEY=sk-ant-...      # the SDK runs the bundled `claude` CLI with this key
cd 05-multi-agent-sdk
python smoke_test.py                     # starter: fails at the hooks
```

`claude-agent-sdk` bundles the Claude Code CLI, so you don't need a separate install.
`setting_sources=[]` keeps your personal `~/.claude` settings out of the run.

## Steps

1. **TODO 1: `allowed_tools`.** Run `python coordinator.py` with the starter. The coordinator can't
   delegate: it answers from its own tools or not at all. Add `"Task"`, the tool that spawns
   subagents. (Recent Claude Code versions call it **`Agent`** and still accept `"Task"` as an
   alias. The SDK docs say "invokable via the Agent tool". The exam says `Task`.)
2. **TODO 2: structured subagent output.** Append `FINDINGS_CONTRACT` to the researcher's and
   analyst's prompts. Each finding gets `claim`, `evidence_excerpt`, `source`,
   `publication_date`, `methodology_note`; failures go in `errors` with `failure_type`,
   `attempted_query`, `partial_results`, `alternatives`.
3. **TODO 3: coordinator prompt.** Replace the step-by-step script with goals and quality criteria,
   and tell it subagents don't inherit context. Compare a run before and after.
4. **TODO 4: PreToolUse hook.** Limit Read/Grep/Glob to `./corpus` for *every* agent. Test it by
   asking: `--question "Summarise ../solution/coordinator.py"`. The hook denies, and the reason
   shows up in `permission_denials`.
5. **TODO 5: PostToolUse hook.** Normalise `published` (Unix ts / ISO / "March 2025") to ISO dates
   via `updatedMCPToolOutput` before the model reads the result. `python smoke_test.py` now passes.
6. **Run it:** `python coordinator.py`. Read the delegation trace and the final report.
7. **Parallel vs sequential:** `python coordinator.py --sequential` and compare `wall=` times. In the
   default run the trace shows two `delegate ->` lines at almost the same timestamp: two Task calls
   in one response.
8. **Resume and fork:** copy the printed `session_id`.
   - `python coordinator.py --resume <id> --question "Add a section on cold-climate performance"`
     continues the same session.
   - `python coordinator.py --resume <id> --fork --question "Rewrite the cost section assuming no rebates"`
     branches into a **new** session id. The original is untouched, so you can explore two
     directions from one baseline.

## What to observe

- **Context isolation.** Add `print(block.input)` for Task calls. Everything a subagent knows is
  in that `prompt` string. If the coordinator doesn't paste the analyst's JSON into the
  synthesizer's prompt, the synthesizer has nothing to cite.
- **Provenance.** Does every number in the final report carry a source and date? Is the cost shown
  as two values with "median, excl. ductwork" vs "mean, incl. ductwork"?
- **Temporal vs contested.** 9% → 13% should read as growth, not as sources disagreeing.
- **Error propagation.** The Europe search fails. The researcher retries once, then reports
  `errors` with partial results. The coordinator keeps going, and the report's coverage section
  names the gap. Neither "silently empty" nor "whole run aborted".
- **Tool scoping.** The synthesizer has no search tool, so it can't wander off and research.
- **Hooks apply inside subagents.** The file-scope denial fires even when the doc-analyst, not
  the coordinator, makes the call (`agent_type` is in the hook input).

## Exam connection

- `allowed_tools` must include `"Task"` for a coordinator to spawn subagents. `AgentDefinition`
  carries `description` (when to delegate), `prompt` (system prompt), `tools` (restriction) and
  `model`.
- Subagents don't inherit the parent's conversation. Pass complete findings in the prompt, using
  structured formats that separate content from metadata.
- Parallel delegation = several Task calls in a single coordinator response.
- Give the coordinator goals and quality criteria, not rigid procedures. Let it pick which
  subagents a question needs, and give them non-overlapping scopes.
- Hooks are deterministic. `PreToolUse` blocks or redirects policy violations; `PostToolUse`
  normalises heterogeneous tool output before the model reasons over it.
- Structured error context (failure type, attempted query, partial results, alternatives) lets the
  coordinator recover. Generic "search unavailable", silent empty results, and aborting the
  whole workflow are all anti-patterns.
- `--resume <name|id>` / `resume=` continues a session; `fork_session` branches it. Start fresh with
  an injected summary when prior tool results are stale.

## Session notes (beyond the flags)

- CLI equivalents: `claude --resume <id-or-name>`, `claude --resume <id> --fork-session`, `claude -n <name>`
  to name a session.
- The SDK also has helpers that don't run a model: `list_sessions()`, `get_session_messages(id)`,
  `rename_session(id, title)`, `fork_session(id, up_to_message_id=...)` (fork at an earlier point).
- After you change files a resumed session already analysed, **tell it what changed** ("I edited
  §2 of the contractor brief; re-check only the cost numbers") rather than making it re-explore.
  If most of its earlier tool results are stale, start a new session and inject a summary instead.

## Stretch exercises

1. **Crash recovery manifest.** Have each subagent write its findings JSON to `state/<agent>.json`.
   On start, if `state/manifest.json` exists, the coordinator loads it and only re-runs missing
   agents.
2. **Iterative refinement.** Add an explicit loop: after synthesis, the coordinator lists gaps and
   re-delegates targeted queries at most twice.
3. **Fourth subagent.** Add a `report-writer` that renders the synthesis as markdown with a table
   for numbers. Should it get any tools?
4. **Structured final output.** Set `ClaudeAgentOptions(output_format={"type": "json_schema", "schema": {...}})`
   with `established`, `contested` and `coverage_gaps` arrays and read `ResultMessage.structured_output`.
5. **Real web.** `--real-web` swaps the fake search for `WebSearch`/`WebFetch`. The fetch-domain
   hook now matters: try a question that tempts it to fetch a non-allowlisted site.
6. **Refund hook from the exam.** Port Lab 01's refund cap to `HookMatcher(matcher="mcp__support__process_refund", hooks=[cap_refunds])`
   with an in-process `create_sdk_mcp_server` for the support tools.
