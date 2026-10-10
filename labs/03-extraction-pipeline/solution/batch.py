"""Lab 03 solution: the same extraction through the Message Batches API.

    python batch.py --dry-run                 # build the requests and print them; no API call
    python batch.py                           # submit invoices/*.txt, poll, validate, resubmit failures once
    python batch.py --batch-id msgbatch_...   # resume polling a batch you already submitted
    python batch.py --sla 30                  # also print the submission cadence for a 30h SLA

Batches: 50% cheaper, results within 24h (often much sooner), no latency guarantee, and each
request is a single turn. The API can't run your tools mid-request, so a multi-turn tool loop
doesn't fit. Single-turn extraction with tool_choice does.
"""

from __future__ import annotations

import argparse
import json
import re
import time
from pathlib import Path

import anthropic
from anthropic.types.message_create_params import MessageCreateParamsNonStreaming
from anthropic.types.messages.batch_create_params import Request

from extract import INVOICE_DIR, MODEL, first_messages, request_params, retry_messages, tool_input
from validate import route, validate

CUSTOM_ID_RE = re.compile(r"^[a-zA-Z0-9_-]{1,64}$")
STATE_FILE = Path(__file__).resolve().parent / "batch_state.json"


def load_documents() -> dict[str, str]:
    docs = {p.stem: p.read_text() for p in sorted(INVOICE_DIR.glob("*.txt"))}
    for cid in docs:
        assert CUSTOM_ID_RE.match(cid), f"custom_id {cid!r} must match {CUSTOM_ID_RE.pattern}"
    return docs


def build_requests(messages_by_id: dict[str, list[dict]]) -> list[Request]:
    """custom_id is how you match results back to inputs: results come back in ANY order."""
    return [
        Request(custom_id=cid, params=MessageCreateParamsNonStreaming(**request_params(msgs)))
        for cid, msgs in messages_by_id.items()
    ]


def submit(client: anthropic.Anthropic, requests: list[Request], label: str) -> str:
    batch = client.messages.batches.create(requests=requests)
    print(f"[{label}] submitted {batch.id}: {len(requests)} requests, status={batch.processing_status}")
    STATE_FILE.write_text(json.dumps({"batch_id": batch.id, "label": label}))
    return batch.id


def wait(client: anthropic.Anthropic, batch_id: str, interval: float) -> None:
    while True:
        batch = client.messages.batches.retrieve(batch_id)
        c = batch.request_counts
        print(f"  {batch.processing_status}: processing={c.processing} succeeded={c.succeeded} "
              f"errored={c.errored} expired={c.expired} canceled={c.canceled}")
        if batch.processing_status == "ended":
            return
        time.sleep(interval)


def collect(client: anthropic.Anthropic, batch_id: str, docs: dict[str, str]) -> dict[str, dict]:
    """Read results and classify each custom_id."""
    out: dict[str, dict] = {}
    for item in client.messages.batches.results(batch_id):
        cid, result = item.custom_id, item.result
        if result.type == "succeeded":
            extraction = tool_input(result.message)
            if extraction is None:
                out[cid] = {"state": "retry", "extraction": None, "issues": [], "why": "no tool call"}
                continue
            inv, issues = validate(extraction, docs[cid])
            if any(i.retryable for i in issues):
                out[cid] = {"state": "retry", "extraction": extraction, "issues": issues}
            else:
                decision, reasons = route(inv, issues)
                out[cid] = {"state": decision, "extraction": extraction, "issues": issues, "reasons": reasons}
        elif result.type == "errored":
            # invalid_request = our request is wrong (fix it, e.g. chunk an oversized document);
            # anything else is a server-side failure that is safe to resubmit unchanged.
            kind = result.error.error.type  # e.g. "invalid_request_error", "api_error", "overloaded_error"
            out[cid] = {"state": "fix_request" if kind == "invalid_request_error" else "resubmit",
                        "error": kind}
        else:  # "expired" or "canceled"
            out[cid] = {"state": "resubmit", "error": result.type}
    return out


def report(results: dict[str, dict]) -> None:
    for cid in sorted(results):
        r = results[cid]
        extra = r.get("reasons") or [str(i) for i in r.get("issues", [])] or [r.get("error") or r.get("why", "")]
        print(f"  {cid:30s} {r['state']:13s} {'; '.join(x for x in extra if x)[:150]}")


def max_submission_interval(sla_hours: float, batch_window_hours: float = 24, buffer_hours: float = 2) -> float:
    """A document can wait one full interval before it's submitted, then up to 24h in the batch.
    interval + window + buffer <= SLA. A 30h SLA gives submissions every 4h."""
    return sla_hours - batch_window_hours - buffer_hours


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--batch-id")
    ap.add_argument("--interval", type=float, default=30.0, help="poll interval, seconds")
    ap.add_argument("--sla", type=float)
    args = ap.parse_args()

    if args.sla:
        print(f"SLA {args.sla}h with a 24h batch window -> submit at least every "
              f"{max_submission_interval(args.sla):g}h")

    docs = load_documents()
    requests = build_requests({cid: first_messages(text) for cid, text in docs.items()})

    if args.dry_run:
        print(f"model={MODEL}; {len(requests)} requests; first one:")
        print(json.dumps(requests[0], indent=2)[:3000])
        return

    client = anthropic.Anthropic()
    batch_id = args.batch_id or submit(client, requests, "pass-1")
    wait(client, batch_id, args.interval)
    results = collect(client, batch_id, docs)
    print("\npass 1:")
    report(results)

    # Resubmit ONLY the failures, each with an appropriate modification.
    second: dict[str, list[dict]] = {}
    for cid, r in results.items():
        if r["state"] == "retry":
            second[cid] = retry_messages(docs[cid], r["extraction"], r["issues"])
        elif r["state"] == "resubmit":
            second[cid] = first_messages(docs[cid])
        # "fix_request" needs a human change to the request; "accept"/"human_review" are final.
    if not second:
        print("\nnothing to resubmit")
        return
    batch2 = submit(client, build_requests(second), "pass-2")
    wait(client, batch2, args.interval)
    results.update(collect(client, batch2, docs))
    print("\nafter resubmitting failures:")
    report(results)


if __name__ == "__main__":
    main()
