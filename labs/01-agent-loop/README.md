# Lab 01 — The agentic loop, by hand

**Goal:** write the loop that every agent framework hides from you. A toy support agent with four
tools (`get_customer`, `lookup_order`, `process_refund`, `escalate_to_human`) talks to an in-memory
fake backend. You add structured errors, a prerequisite gate, a refund cap that redirects to
escalation, output trimming, and a "case facts" block.

**Time:** 60–90 min · **Cost:** a few cents per scenario on Sonnet

## Exam task statements exercised

| Task | What you build here |
|---|---|
| 1.1 Agentic loops | loop on `stop_reason`, `tool_result` blocks matched by `tool_use_id`, all results in one user message |
| 1.4 Enforcement & handoff | `process_refund` blocked until `get_customer` returns a verified ID; structured escalation summary |
| 1.5 Hooks / interception | refund cap enforced in code before the tool runs, redirected to `escalate_to_human` |
| 2.1 Tool descriptions | `get_customer` vs `lookup_order`: what each takes, returns, and when *not* to use it |
| 2.2 Structured errors | `errorCategory`, `isRetryable`, `customerMessage`; empty result ≠ error |
| 5.1 Context | trim a 21-field order to 9 fields; persistent `<case_facts>` block |
| 5.2 Escalation | few-shot escalation criteria; ask, don't guess, on multiple matches |

This is Preparation Exercise 1 from the exam guide, built on the raw Messages API instead of the
Agent SDK so you can see every moving part. Lab 05 does the same kind of hook in the Agent SDK.

## Files

```
01-agent-loop/
  fake_db.py       backend (complete, no TODOs) - customers, orders, a flaky order, refund + ticket stores
  tools.py         STARTER: tool schemas, structured errors, guards, case facts      TODO 1-7
  agent.py         STARTER: the loop, system prompt, scripted scenarios              TODO 8-10
  smoke_test.py    no-API test of the tool layer + the loop driven by a fake client
  solution/        working versions of all of the above
```

## Setup

```bash
cd labs && source .venv/bin/activate          # see labs/README.md
export ANTHROPIC_API_KEY=sk-ant-...
export CLAUDE_MODEL=claude-sonnet-5-5         # optional; this is the default
cd 01-agent-loop
```

## Steps

1. **Run the smoke test against the starter.** `python smoke_test.py` fails on the first
   assertion: the starter lets `process_refund` run for an unverified caller. This test is your
   spec. Keep re-running it as you work.
2. **Structured errors (TODO 2).** In `ToolError.__init__`, build
   `{"errorCategory", "isRetryable", "message", "customerMessage"?}`. Read `_run_lookup_order`:
   a timeout is `transient`/retryable, an unknown ID is `validation`/not retryable. Read
   `_run_get_customer`: no match returns `{"matches": []}` as a *success*.
3. **Trim (TODO 3).** `_trim_order` returns the full 21-field record. Keep the fields in
   `ORDER_FIELDS_FOR_MODEL` and add `days_since_purchase` and `refund_eligible`.
4. **Prerequisite gate (TODO 4).** In `_pre_call_guards`, block `process_refund` until
   `state.verified_customer_ids` is non-empty, and block orders the verified customer doesn't own.
5. **Refund cap (TODO 5).** Block refunds over `$500` with a `business`, non-retryable error whose
   message tells the model to call `escalate_to_human`. This is the redirect.
6. **Case facts (TODO 6) and dispatch (TODO 7).** Record the verified customer, orders, refunds and
   tickets in `state.facts`; wire guards → executor → bookkeeping in `dispatch`. The tool-layer half
   of `smoke_test.py` should now pass.
7. **The loop (TODO 8–10)** in `agent.py`:
   append `response.content` as the assistant turn; on `tool_use` run every `tool_use` block and send
   all results back in **one** user message; return on `end_turn`; handle `max_tokens`,
   `pause_turn`, `refusal` explicitly. `python smoke_test.py` now passes end to end.
8. **Tool descriptions (TODO 1).** Rewrite the two thin descriptions. Then run
   `python agent.py --scenario ambiguous` with the thin and the rich versions and compare.
9. **Run the scenarios with the real API:**
   ```bash
   python agent.py --list
   python agent.py --scenario refund
   python agent.py --scenario no-verify
   python agent.py --scenario over-cap
   python agent.py --scenario multi
   python agent.py --scenario human
   python agent.py --scenario ambiguous
   python agent.py --scenario price-match
   python agent.py                     # interactive
   ```

## What to observe

- **`no-verify`:** the model usually asks for identity on its own, because the system prompt says so.
  Delete that line from `SYSTEM_PROMPT` and run again: if it calls `process_refund` anyway, the gate
  returns `PREREQUISITE_NOT_MET` and nothing is refunded. Prompt guidance is probabilistic; the gate isn't.
- **`over-cap`:** the trace shows `process_refund → ERROR REFUND_CAP_EXCEEDED`, then
  `escalate_to_human`. Print `fake_db.ESCALATIONS` at the end: could a human act on that ticket
  without the transcript?
- **`multi`:** the first response usually contains several `tool_use` blocks (parallel calls). The
  `ORD-5004` lookup fails once with `isRetryable: true` and the model retries it. The final reply
  covers all three issues.
- **`human`:** escalates without investigating first.
- **`ambiguous`:** two "Alex Kim" accounts. The agent should ask for an email, not pick one.
- **`price-match`:** policy is silent on competitor prices, so the agent escalates.
- **The `messages` list:** add `print(json.dumps(messages, default=str, indent=1))` after a run.
  Every assistant turn holds its `tool_use` blocks, and the next user turn holds the matching
  `tool_result`s, then the `<case_facts>` text block.

## Exam connection

- The loop continues on `stop_reason == "tool_use"` and stops on `"end_turn"`. Parsing the text for
  "done", stopping when text appears, or relying on an iteration cap are the distractors.
  `SAFETY_MAX_STEPS` is a backstop that raises; it is not how the loop ends.
- Every `tool_use` gets a `tool_result` with the same `tool_use_id`, all in the next user message.
  Failed tools still get a result, with `is_error: true`.
- "Identity must be verified before refunds" is a *deterministic compliance* requirement, so it
  belongs in code (gate or hook), not only in the prompt.
- Structured error metadata lets the model retry transient failures and explain business failures.
  A generic "Operation failed" doesn't.
- "No customer found" (valid empty result) is different from "customer service timed out"
  (access failure). Mixing them up causes wrong retries or wrong answers.
- Escalate on: an explicit request for a human, a policy gap, or no progress. Don't escalate on
  sentiment or the model's self-reported confidence.
- Case facts live outside the summarised history so amounts, dates and IDs survive.

> **Current-API note (not on the exam).** The exam guide talks about including case facts "in each
> prompt". This lab **appends** the block to each new user turn instead of rewriting the top-level
> `system` prompt each request. On current models (Sonnet 5.5, Opus 5.5), rewriting `system`
> mid-conversation edits the conversation prefix. That breaks the prompt cache and can make earlier
> thinking blocks invalid, which is a 400 for newer accounts. Appending gives the same result and
> keeps the history append-only.

## Stretch exercises

1. **Hook-shaped refactor.** Turn `_pre_call_guards` into a list of `pre_hooks: list[Callable]` and
   `_post_call_bookkeeping` into `post_hooks`, so policies can be added without touching `dispatch`.
   That is the Agent SDK's `PreToolUse`/`PostToolUse` model, which Lab 05 uses.
2. **Normalisation hook.** Make `fake_db` return `purchase_date` as a Unix timestamp for some orders
   and ISO strings for others; add a post-hook that normalises to ISO 8601 before the model sees it.
3. **Tool-selection test.** Add a fifth tool `lookup_order_history(customer_id)` that sounds similar
   to `lookup_order`. Write 10 ambiguous prompts and count misroutes with thin vs. rich descriptions.
4. **Compare with the Tool Runner.** Re-implement with `client.beta.messages.tool_runner` and
   `@beta_tool`. Where would the gate live now?
5. **Agent SDK version.** Port the four tools to `@tool` + `create_sdk_mcp_server` and the gate and
   cap to `HookMatcher(matcher="mcp__support__process_refund", ...)` (see Lab 05 for the shapes).
