"""STARTER - Lab 03: synchronous extraction (TODO 9-10). Solution: solution/extract.py.

Synchronous extraction with validation and retry-with-error-feedback.

    python extract.py invoices/inv_03_total_mismatch.txt
    python extract.py invoices/*.txt
    CLAUDE_MODEL=claude-haiku-4-5 python extract.py invoices/*.txt   # a model that accepts forced tool_choice

Flow per document:
    extract -> validate -> (retryable issues? retry with doc + failed extraction + errors)
                        -> (only non-retryable issues? stop, route to human; retrying won't help)
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import anthropic

from schema import INVOICE_TOOL, SYSTEM_PROMPT, TOOL_NAME, tool_choice_for, user_message
from validate import Issue, route, validate

MODEL = os.environ.get("CLAUDE_MODEL", "claude-sonnet-5-5")
MAX_ATTEMPTS = 3
_HERE = Path(__file__).resolve().parent
INVOICE_DIR = next(d for d in (_HERE / "invoices", _HERE.parent / "invoices") if d.is_dir())


def request_params(messages: list[dict], model: str = MODEL) -> dict:
    """One place that builds Messages API params, shared with batch.py."""
    return {
        "model": model,
        "max_tokens": 16000,
        "system": SYSTEM_PROMPT,
        "tools": [INVOICE_TOOL],
        "tool_choice": tool_choice_for(model),
        "messages": messages,
    }


def first_messages(document: str, model: str = MODEL) -> list[dict]:
    return [{"role": "user", "content": user_message(document, model)}]


def retry_messages(document: str, failed: dict | None, issues: list[Issue], model: str = MODEL) -> list[dict]:
    """A fresh single-turn request carrying everything needed to self-correct:
    the ORIGINAL document, the FAILED extraction, and the SPECIFIC errors.

    (Continuing the original conversation with a tool_result is_error=True works too. A fresh,
    self-contained request also works in the Batches API, which has no multi-turn tool loop.)
    """
    # TODO(9): build ONE user message containing the original document, the failed extraction
    #          (json.dumps(failed)) and the retryable issues, each in its own XML tag, and ask
    #          for a corrected record_invoice call.
    return first_messages(document, model)


def tool_input(message) -> dict | None:
    """Pull the record_invoice arguments out of a response (None if the model didn't call it)."""
    for block in message.content:
        if block.type == "tool_use" and block.name == TOOL_NAME:
            return block.input
    return None


def extract_with_retries(client: anthropic.Anthropic, document: str, *, log=print) -> dict:
    messages = first_messages(document)
    history = []
    for attempt in range(1, MAX_ATTEMPTS + 1):
        response = client.messages.create(**request_params(messages))
        extraction = tool_input(response)
        if extraction is None:
            # Only possible with tool_choice "auto" (models that reject forced tool use).
            issues = [Issue("no_tool_call", f"No {TOOL_NAME} call (stop_reason={response.stop_reason}).", True)]
            inv = None
        else:
            inv, issues = validate(extraction, document)
        history.append({"attempt": attempt, "issues": [str(i) for i in issues]})
        log(f"  attempt {attempt}: {len(issues)} issue(s)" + "".join(f"\n    {i}" for i in issues))

        # TODO(10): decide whether to retry.
        #   - no retryable issues -> stop now: return route(...) result (accept or human_review)
        #   - otherwise           -> messages = retry_messages(document, extraction, issues); loop
        #   Do NOT retry when the only issues are non-retryable.
        decision, reasons = route(inv, issues)
        return {"extraction": extraction, "decision": decision, "reasons": reasons, "attempts": history}

    decision, reasons = route(inv, issues)
    reasons.append(f"still failing after {MAX_ATTEMPTS} attempts")
    return {"extraction": extraction, "decision": "human_review", "reasons": reasons, "attempts": history}


def main(paths: list[str]) -> None:
    client = anthropic.Anthropic()
    print(f"model={MODEL} tool_choice={tool_choice_for(MODEL)}")
    summary = []
    for p in paths:
        print(f"\n## {p}")
        result = extract_with_retries(client, Path(p).read_text())
        print(json.dumps(result["extraction"], indent=2))
        print(f"  -> {result['decision']}" + "".join(f"\n     - {r}" for r in result["reasons"]))
        summary.append((Path(p).name, result["decision"], len(result["attempts"])))
    print("\nfile                              decision       attempts")
    for name, decision, n in summary:
        print(f"{name:34s}{decision:15s}{n}")


if __name__ == "__main__":
    main(sys.argv[1:] or sorted(str(p) for p in INVOICE_DIR.glob("*.txt")))
