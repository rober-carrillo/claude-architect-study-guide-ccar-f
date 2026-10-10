"""STARTER - Lab 05 (TODO 1-5). Solution: solution/coordinator.py.

A coordinator agent that delegates to three subagents with the Claude Agent SDK.

    python coordinator.py
    python coordinator.py --question "How fast is heat pump adoption growing, and what does it cost?"
    python coordinator.py --real-web                 # use the built-in WebSearch/WebFetch instead of the fake
    python coordinator.py --sequential               # ask for one delegation per turn (latency comparison)
    python coordinator.py --resume <session_id> --question "Now focus on cold climates"
    python coordinator.py --resume <session_id> --fork --question "Redo the cost section assuming no rebates"

Needs Claude Code's runtime: the claude-agent-sdk wheel bundles the `claude` CLI.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import time

from claude_agent_sdk import (
    AgentDefinition,
    AssistantMessage,
    ClaudeAgentOptions,
    ResultMessage,
    SystemMessage,
    ToolUseBlock,
    query,
)

from hooks import CORPUS_DIR, HOOKS
from research_tools import research_server

MODEL = os.environ.get("CLAUDE_MODEL", "claude-sonnet-5-5")

# Every subagent returns findings in this shape: content separated from metadata, so
# attribution survives synthesis.
FINDINGS_CONTRACT = """Return ONLY a JSON object:
{
  "findings": [
    {"claim": "...", "evidence_excerpt": "short verbatim quote",
     "source": "URL or file path + section (e.g. energy_agency_outlook_2025.md §2)",
     "publication_date": "YYYY-MM-DD or YYYY-MM or null",
     "methodology_note": "sample, measure (median/mean), what is included, or null"}
  ],
  "gaps": ["what you looked for and could not find"],
  "errors": [
    {"failure_type": "timeout|access|not_found", "attempted_query": "...",
     "partial_results": [...], "alternatives": ["..."]}
  ]
}
If a retryable error happens, retry ONCE yourself. Report it in "errors" only if it still fails.
An empty search result is not an error: put it in "gaps"."""

AGENTS = {
    "web-researcher": AgentDefinition(
        description="Searches the web for recent articles, field studies and prices. Use for anything "
                    "not covered by the local reports in ./corpus.",
        # TODO(2): require structured output: append FINDINGS_CONTRACT so every claim keeps its
        #          source, date and methodology through synthesis.
        prompt="You research one question on the web and summarise what you find.",
        tools=["mcp__research__search_web"],  # least privilege: no file access, no fetch
        model="sonnet",
    ),
    "doc-analyst": AgentDefinition(
        description="Reads the local reports in ./corpus and extracts facts with section references. "
                    "Use for statistics from the agency outlook, the homeowner survey and the contractor brief.",
        # TODO(2): same here, and tell it to report conflicting numbers side by side, not pick one.
        prompt="You analyse the documents in the current directory and summarise them.",
        tools=["Read", "Grep", "Glob"],
        model="sonnet",
    ),
    "synthesizer": AgentDefinition(
        description="Combines findings that the coordinator passes in its prompt into a cited report. "
                    "Has no search tools: give it ALL the findings it needs.",
        # (Read is allowed only to verify a quoted excerpt, not to research.)
        prompt="You receive findings as JSON in your prompt. Write a report that:\n"
               "- keeps every claim->source mapping (never drop a citation)\n"
               "- separates WELL-ESTABLISHED findings from CONTESTED ones; for contested ones, show each "
               "value with its source, date and methodology instead of choosing\n"
               "- treats differences explained by different dates as change over time, not contradiction\n"
               "- ends with a COVERAGE section listing gaps and failed searches\n"
               "- uses a table for numbers and prose for context.",
        # No search tools, so it can't go researching on its own. Read is a narrow cross-role tool
        # for checking a quoted excerpt against the corpus (the hook keeps it inside ./corpus).
        tools=["Read"],
        model="sonnet",
    ),
}

# TODO(3): this prompt is a rigid procedure. Rewrite it around GOALS and QUALITY CRITERIA
#          (attribution, conflicts shown with methodology, explicit coverage gaps), and say that
#          subagents don't see this conversation, so the Task prompt must carry everything.
#          Keep the {parallel} placeholder.
COORDINATOR_PROMPT = """You are a research coordinator.
Step 1: call web-researcher. Step 2: call doc-analyst. Step 3: call synthesizer. Step 4: print its answer.
{parallel}"""

PARALLEL = "Launch independent subagents IN THE SAME RESPONSE (several Task calls at once) so they run in parallel."
SEQUENTIAL = "Launch one subagent per response and wait for its result before starting the next."


def build_options(args) -> ClaudeAgentOptions:
    agents = dict(AGENTS)
    allowed = [
        # TODO(1): the coordinator cannot spawn subagents without one more entry here. Which?
        "Read", "Grep", "Glob",
        "mcp__research__search_web",
    ]
    if args.real_web:
        agents["web-researcher"] = AgentDefinition(
            description=AGENTS["web-researcher"].description,
            prompt=AGENTS["web-researcher"].prompt,
            tools=["WebSearch", "WebFetch"],
            model="sonnet",
        )
        allowed += ["WebSearch", "WebFetch"]

    return ClaudeAgentOptions(
        model=MODEL,
        system_prompt=COORDINATOR_PROMPT.format(parallel=SEQUENTIAL if args.sequential else PARALLEL),
        agents=agents,
        allowed_tools=allowed,
        mcp_servers={"research": research_server},
        hooks=HOOKS,
        cwd=str(CORPUS_DIR),
        setting_sources=[],          # isolation: ignore ~/.claude and project settings for this lab
        max_turns=30,                # a safety budget, not the stopping condition
        resume=args.resume,          # continue a prior session by id
        fork_session=args.fork,      # with resume: branch into a NEW session id from that point
    )


async def run(args) -> None:
    options = build_options(args)
    started = time.monotonic()
    async for message in query(prompt=args.question, options=options):
        if isinstance(message, SystemMessage) and message.subtype == "init":
            print(f"[session] {message.data.get('session_id')}")
        elif isinstance(message, AssistantMessage):
            for block in message.content:
                if isinstance(block, ToolUseBlock):
                    if block.name in ("Task", "Agent"):
                        print(f"[{time.monotonic() - started:6.1f}s] delegate -> {block.input.get('subagent_type')}: "
                              f"{str(block.input.get('description', ''))[:70]}")
                    else:
                        print(f"[{time.monotonic() - started:6.1f}s] tool {block.name} {json.dumps(block.input)[:100]}")
        elif isinstance(message, ResultMessage):
            print("\n" + "=" * 80)
            print(message.result or "(no result text)")
            print("=" * 80)
            print(f"session_id={message.session_id}  turns={message.num_turns}  "
                  f"wall={time.monotonic() - started:.1f}s  cost=${message.total_cost_usd or 0:.4f}")
            if message.permission_denials:
                print(f"denied by hooks/permissions: {json.dumps(message.permission_denials)[:400]}")
            print(f"\nresume:  python coordinator.py --resume {message.session_id} --question '...'")
            print(f"fork:    python coordinator.py --resume {message.session_id} --fork --question '...'")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--question", default=(
        "What share of single-family homes heat with a heat pump, how has that changed, and what does a "
        "retrofit cost? Include European adoption if you can find it."))
    ap.add_argument("--real-web", action="store_true")
    ap.add_argument("--sequential", action="store_true")
    ap.add_argument("--resume")
    ap.add_argument("--fork", action="store_true")
    asyncio.run(run(ap.parse_args()))


if __name__ == "__main__":
    main()
