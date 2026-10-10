"""No-API smoke test for lab 01. Run: python smoke_test.py

Exercises the tool layer (gate, cap, structured errors, trimming, case facts) and
drives run_agent() with a scripted fake client, so the loop logic is checked
without spending tokens.
"""

from __future__ import annotations

import json
from types import SimpleNamespace as NS

import fake_db
from tools import CaseState, dispatch


def call(name, args, state):
    content, is_error = dispatch(name, args, state)
    return json.loads(content), is_error


def test_tool_layer():
    fake_db.reset()
    s = CaseState()

    # Gate: refund before verification is blocked as a permission error.
    out, err = call("process_refund", {"order_id": "ORD-5001", "amount_usd": 89, "reason": "broken"}, s)
    assert err and out["errorCategory"] == "permission" and out["isRetryable"] is False, out
    assert not fake_db.REFUNDS, "gate must stop the executor from running"

    # Ambiguous name: two matches, none verified, a note telling the agent to ask.
    out, err = call("get_customer", {"name": "Alex Kim", "card_last4": "1881"}, s)
    assert not err and len(out["matches"]) == 2 and not any(m["verified"] for m in out["matches"]), out
    assert "note" in out

    # Empty result is a success, not an error.
    out, err = call("get_customer", {"email": "nobody@example.com"}, s)
    assert not err and out == {"matches": []}, out

    # Validation error.
    out, err = call("get_customer", {"email": "dana@example.com", "card_last4": "42"}, s)
    assert err and out["errorCategory"] == "validation"

    # Verify Dana.
    out, err = call("get_customer", {"email": "dana@example.com", "card_last4": "4242"}, s)
    assert not err and out["matches"][0]["verified"] is True
    assert s.facts["customer"]["customer_id"] == "C-1001"

    # Transient error on first lookup of ORD-5004, success on retry.
    out, err = call("lookup_order", {"order_id": "ORD-5004"}, s)
    assert err and out["errorCategory"] == "transient" and out["isRetryable"] is True, out
    out, err = call("lookup_order", {"order_id": "ORD-5004"}, s)
    assert not err and out["refund_eligible"] is False  # 56 days old

    # Trimming: the model sees 9 fields, not 21.
    out, err = call("lookup_order", {"order_id": "ORD-5001"}, s)
    assert not err and "warehouse_code" not in out and len(out) == 9, out
    assert "ORD-5001" in s.facts["orders"]

    # Cap: $1240 refund blocked, redirected to escalation, executor never ran.
    out, err = call("process_refund", {"order_id": "ORD-5002", "amount_usd": 1240, "reason": "cracked"}, s)
    assert err and out["errorCategory"] == "business" and "escalate_to_human" in out["message"], out
    assert "customerMessage" in out

    # Ownership: ORD-5003 belongs to C-1002.
    out, err = call("process_refund", {"order_id": "ORD-5003", "amount_usd": 10, "reason": "x"}, s)
    assert err and out["errorCategory"] == "permission"

    # Business rule from the backend: outside the window.
    out, err = call("process_refund", {"order_id": "ORD-5004", "amount_usd": 10, "reason": "x"}, s)
    assert err and out["errorCategory"] == "business"

    # Happy path.
    out, err = call("process_refund", {"order_id": "ORD-5001", "amount_usd": 89.0, "reason": "dead"}, s)
    assert not err and out["status"] == "issued"
    assert s.facts["refunds"][0]["order_id"] == "ORD-5001"

    # Escalation.
    out, err = call("escalate_to_human", {
        "customer_id": "C-1001", "issue_summary": "Laptop cracked", "root_cause": "DOA",
        "amount_usd": 1240, "recommended_action": "Approve full refund", "priority": "high"}, s)
    assert not err and out["ticket_id"].startswith("ESC-")
    print("tool layer: OK")


class FakeMessages:
    """Replays scripted responses and records what the loop sent."""

    def __init__(self, script):
        self.script = list(script)
        self.calls = []

    def create(self, **kwargs):
        # Snapshot the messages list as it was at call time.
        self.calls.append(json.loads(json.dumps(kwargs["messages"], default=lambda o: o.__dict__)))
        return self.script.pop(0)


def tool_use(id_, name, input_):
    return NS(type="tool_use", id=id_, name=name, input=input_)


def text(t):
    return NS(type="text", text=t)


def test_loop_with_fake_client():
    import agent

    fake_db.reset()
    script = [
        # Turn 1: two parallel tool calls in one response.
        NS(stop_reason="tool_use", content=[
            text("Let me check."),
            tool_use("tu_1", "get_customer", {"email": "dana@example.com", "card_last4": "4242"}),
            tool_use("tu_2", "lookup_order", {"order_id": "ORD-5001"}),
        ]),
        # Turn 2: refund.
        NS(stop_reason="tool_use", content=[
            tool_use("tu_3", "process_refund", {"order_id": "ORD-5001", "amount_usd": 89, "reason": "dead"}),
        ]),
        # Turn 3: done.
        NS(stop_reason="end_turn", content=[text("Refund RF-9001 issued.")]),
    ]
    fake = FakeMessages(script)
    client = NS(messages=fake)
    state = CaseState()
    messages = [agent.user_turn("refund ORD-5001 please", [], state)]
    reply = agent.run_agent(client, messages, state, log=lambda *_: None)

    assert reply == "Refund RF-9001 issued.", reply
    assert len(fake.calls) == 3
    # After turn 1, both tool_results are in ONE user message, matched by id, before the text.
    second_request = fake.calls[1]
    last_user = second_request[-1]
    assert last_user["role"] == "user"
    kinds = [b["type"] for b in last_user["content"]]
    assert kinds == ["tool_result", "tool_result", "text"], kinds
    assert {b["tool_use_id"] for b in last_user["content"][:2]} == {"tu_1", "tu_2"}
    assert "<case_facts>" in last_user["content"][-1]["text"]
    # History is append-only: request 3 starts with exactly request 2's messages.
    assert fake.calls[2][: len(second_request)] == second_request
    print("agent loop (fake client): OK")


if __name__ == "__main__":
    test_tool_layer()
    test_loop_with_fake_client()
    print("all smoke tests passed")
