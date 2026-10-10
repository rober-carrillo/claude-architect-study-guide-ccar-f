"""Lab 01 solution: a raw Messages API agentic loop for a toy support agent.

Run:
    python agent.py                       # interactive chat
    python agent.py --scenario refund     # scripted scenario (see SCENARIOS)
    python agent.py --list                # list scenarios

Model: $CLAUDE_MODEL, default claude-sonnet-5-5.
"""

from __future__ import annotations

import argparse
import json
import os
import sys

import anthropic

import fake_db
from tools import TOOLS, CaseState, dispatch

MODEL = os.environ.get("CLAUDE_MODEL", "claude-sonnet-5-5")
MAX_TOKENS = 16000
# A backstop against runaway loops, NOT the stopping mechanism. The loop ends on
# stop_reason. If this ever trips, something is wrong and we want to know.
SAFETY_MAX_STEPS = 30

SYSTEM_PROMPT = """You are the support agent for Acme Electronics. You can look up customers and orders,
issue refunds, and hand cases to human agents.

How to work:
- If the customer raises several issues, list them to yourself, investigate each one (call
  independent lookups in the same turn), then answer all of them in one reply.
- Identity: before any refund the customer must be verified with get_customer (email + last 4
  digits of the card). If get_customer returns several matches, ask for the account email.
- Tool errors come back as JSON with errorCategory and isRetryable. If isRetryable is true,
  retry once. If false, do not retry; explain using customerMessage when present.
- The <case_facts> block at the end of each user turn is the authoritative record of what has
  been verified and done. Prefer it over your memory of earlier turns.

When to escalate (escalate_to_human), and when not to:
<example>
Customer: "I want to talk to a person. Now."
Action: escalate immediately with whatever you know. Do not investigate first.
Why: an explicit request for a human is honoured as soon as it is made.
</example>
<example>
Customer: "This is ridiculous, my earbuds broke after a week!" (order is refundable, under $500)
Action: acknowledge the frustration and offer the refund. Escalate only if they then repeat that
they want a human.
Why: frustration alone is not an escalation trigger when you can resolve the issue.
</example>
<example>
Customer: "Amazon has it $40 cheaper, match it."
Action: escalate. Our policy covers refunds and returns; it says nothing about competitor price
matching.
Why: policy is silent on the request, so a human decides.
</example>
<example>
Refund requested is above $500, or process_refund returns REFUND_CAP_EXCEEDED.
Action: escalate with customer_id, root cause, amount and recommended action. The human agent
cannot see this conversation, so the summary must stand on its own.
</example>
"""

SCENARIOS = {
    "refund": "Hi, I'm dana@example.com, card ends 4242. My earbuds from order ORD-5001 stopped working. Can I get my money back?",
    "no-verify": "Refund order ORD-5001 please, the earbuds are broken.",
    "over-cap": "dana@example.com here, last4 4242. The laptop in ORD-5002 has a cracked screen out of the box. Full refund please.",
    "multi": (
        "Hi, dana@example.com / 4242. Three things: (1) refund my earbuds ORD-5001, they're dead; "
        "(2) what's going on with ORD-5004, the grinder? (3) the laptop ORD-5002 is faulty and I want my $1240 back."
    ),
    "human": "Get me a human. I'm not explaining this to a bot.",
    "ambiguous": "I'm Alex Kim, card 1881. Where is my order?",
    "price-match": "dana@example.com, 4242. BestBuy sells the earbuds from ORD-5001 for $20 less. Refund the difference.",
}


def user_turn(text: str | None, tool_results: list[dict], state: CaseState) -> dict:
    """Build one user message: tool_results first, then optional text, then case facts.

    Case facts are APPENDED to each new user turn rather than written into the top-level
    system prompt. Rebuilding `system` between requests would edit the conversation prefix,
    which invalidates the prompt cache and, on current models, prior thinking blocks.
    """
    content: list[dict] = list(tool_results)
    if text:
        content.append({"type": "text", "text": text})
    content.append({"type": "text", "text": state.render()})
    return {"role": "user", "content": content}


def run_agent(client: anthropic.Anthropic, messages: list[dict], state: CaseState, *, log=print) -> str:
    """Drive the loop until Claude ends its turn. Mutates `messages` in place."""
    for _step in range(SAFETY_MAX_STEPS):
        response = client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            system=SYSTEM_PROMPT,
            tools=TOOLS,
            messages=messages,
        )
        # Append the FULL assistant content (text, thinking and tool_use blocks), never just text.
        messages.append({"role": "assistant", "content": response.content})

        if response.stop_reason == "tool_use":
            results = []
            for block in response.content:
                if block.type != "tool_use":
                    continue
                content, is_error = dispatch(block.name, block.input, state)
                log(f"  -> {block.name}({json.dumps(block.input)})")
                log(f"  <- {'ERROR ' if is_error else ''}{content[:200]}")
                result = {"type": "tool_result", "tool_use_id": block.id, "content": content}
                if is_error:
                    result["is_error"] = True
                results.append(result)
            # ALL results for this assistant turn go back in ONE user message.
            messages.append(user_turn(None, results, state))
            continue

        if response.stop_reason in ("end_turn", "stop_sequence"):
            return "".join(b.text for b in response.content if b.type == "text")

        if response.stop_reason == "pause_turn":
            # Only happens with server-side tools; re-send to let the model continue.
            continue

        if response.stop_reason == "max_tokens":
            return "[stopped: max_tokens reached - raise MAX_TOKENS or shorten the task]"

        if response.stop_reason == "refusal":
            return "[the model declined this request]"

        return f"[stopped: unexpected stop_reason={response.stop_reason!r}]"

    raise RuntimeError(f"Safety backstop: more than {SAFETY_MAX_STEPS} model calls in one turn")


def chat(first_message: str | None) -> None:
    client = anthropic.Anthropic()
    state = CaseState()
    messages: list[dict] = []
    print(f"model={MODEL}  (Ctrl-D to quit)\n")
    text = first_message
    while True:
        if text is None:
            try:
                text = input("customer> ").strip()
            except EOFError:
                break
            if not text:
                text = None
                continue
        else:
            print(f"customer> {text}")
        messages.append(user_turn(text, [], state))
        reply = run_agent(client, messages, state)
        print(f"\nagent> {reply}\n")
        if first_message is not None:
            break
        text = None

    print("--- final case facts ---")
    print(state.render())
    if fake_db.ESCALATIONS:
        print("--- escalation tickets (what the human sees) ---")
        print(json.dumps(fake_db.ESCALATIONS, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--scenario", choices=sorted(SCENARIOS))
    parser.add_argument("--list", action="store_true")
    args = parser.parse_args()
    if args.list:
        for k, v in SCENARIOS.items():
            print(f"{k:12s} {v}")
        return
    if not os.environ.get("ANTHROPIC_API_KEY") and not os.environ.get("ANTHROPIC_AUTH_TOKEN"):
        print("warning: ANTHROPIC_API_KEY is not set; the SDK will try other credential sources.", file=sys.stderr)
    chat(SCENARIOS.get(args.scenario) if args.scenario else None)


if __name__ == "__main__":
    main()
