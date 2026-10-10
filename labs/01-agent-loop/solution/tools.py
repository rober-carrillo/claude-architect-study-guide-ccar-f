"""Tool definitions, executors, and the deterministic guard rails around them.

Three layers, kept separate on purpose:

1. TOOLS              - what Claude sees: name, description, input_schema.
2. _run_<tool>        - what the backend does: plain Python against fake_db.
3. dispatch()         - the harness: prerequisite gate + refund cap run BEFORE
                        the executor (like a PreToolUse hook), output trimming and
                        case-fact extraction run AFTER it (like a PostToolUse hook).

The guard rails live in code, not in the system prompt. A prompt instruction
("always verify the customer first") has a non-zero failure rate; this gate has
none. That is the exam's Task 1.4 / 1.5 point in one file.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field

import fake_db

REFUND_CAP_USD = 500.00

# --------------------------------------------------------------------------
# 1. Tool definitions (what the model reads to decide which tool to call)
# --------------------------------------------------------------------------
TOOLS = [
    {
        "name": "get_customer",
        "description": (
            "Look up and verify a CUSTOMER ACCOUNT (a person), not an order. "
            "Input: the customer's email (preferred, unique) or full name (may match several people), "
            "plus the last 4 digits of the card on file to verify identity. "
            "Returns {matches:[{customer_id, name, tier, verified}]}. "
            "verified=true only when last4 matches. If more than one match comes back, ask the customer "
            "for their email; never guess between matches. An empty matches list is a valid answer "
            "meaning 'no such customer', not an error. Call this before any refund."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "email": {"type": "string", "description": "Account email, e.g. dana@example.com"},
                "name": {"type": "string", "description": "Full name, only if no email was given"},
                "card_last4": {"type": "string", "description": "Exactly 4 digits, e.g. '4242'"},
            },
            "required": [],
        },
    },
    {
        "name": "lookup_order",
        "description": (
            "Fetch ONE ORDER by its order ID (format ORD-1234). Use for questions about an order's "
            "status, amount, purchase date or refund eligibility. Does not look up people - use "
            "get_customer for that. Returns order_id, customer_id, item, total_usd, status, "
            "purchase_date, days_since_purchase, refund_eligible, refunded_usd. "
            "May fail with a transient error (isRetryable=true): retry once before giving up."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "order_id": {"type": "string", "description": "Order ID such as ORD-5001"},
            },
            "required": ["order_id"],
        },
    },
    {
        "name": "process_refund",
        "description": (
            "Issue a refund for one order to the original payment method. Only for a verified "
            "customer who owns the order, a delivered order inside the 30-day window, and an amount "
            "no larger than the order total minus prior refunds. Refunds above $500 are not allowed "
            "here: use escalate_to_human instead."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "order_id": {"type": "string"},
                "amount_usd": {"type": "number", "description": "Refund amount in dollars, e.g. 89.00"},
                "reason": {"type": "string", "description": "Short reason, e.g. 'arrived damaged'"},
            },
            "required": ["order_id", "amount_usd", "reason"],
        },
    },
    {
        "name": "escalate_to_human",
        "description": (
            "Hand the case to a human agent who will NOT see this conversation. Use when the customer "
            "asks for a human, when policy does not cover the request, when a refund exceeds $500, or "
            "when you cannot make progress. The summary must stand alone: include customer_id, the "
            "root cause, the amount involved, and the action you recommend."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "customer_id": {"type": ["string", "null"], "description": "Null if not identified"},
                "issue_summary": {"type": "string"},
                "root_cause": {"type": "string"},
                "amount_usd": {"type": ["number", "null"]},
                "recommended_action": {"type": "string"},
                "priority": {"type": "string", "enum": ["low", "normal", "high"]},
            },
            "required": ["customer_id", "issue_summary", "root_cause", "recommended_action", "priority"],
        },
    },
]


# --------------------------------------------------------------------------
# Structured errors (Task 2.2)
# --------------------------------------------------------------------------
class ToolError(Exception):
    """A failure the model should see and reason about.

    category: transient | validation | business | permission
    """

    def __init__(self, category: str, message: str, *, retryable: bool, customer_message: str | None = None):
        super().__init__(message)
        self.payload = {
            "errorCategory": category,
            "isRetryable": retryable,
            "message": message,
        }
        if customer_message:
            self.payload["customerMessage"] = customer_message


# --------------------------------------------------------------------------
# Case facts: transactional data kept OUTSIDE the conversation history (Task 5.1)
# --------------------------------------------------------------------------
@dataclass
class CaseState:
    verified_customer_ids: set[str] = field(default_factory=set)
    facts: dict = field(default_factory=lambda: {"customer": None, "orders": {}, "refunds": [], "escalations": []})

    def render(self) -> str:
        """The block the harness appends to every user turn."""
        return "<case_facts>\n" + json.dumps(self.facts, indent=2) + "\n</case_facts>"


# --------------------------------------------------------------------------
# 2. Executors (the "backend")
# --------------------------------------------------------------------------
ORDER_FIELDS_FOR_MODEL = (
    "order_id", "customer_id", "item", "total_usd", "status", "purchase_date", "refunded_usd",
)


def _trim_order(order: dict) -> dict:
    """Keep ~7 of ~21 fields. Every irrelevant field is tokens the model re-reads each turn."""
    slim = {k: order[k] for k in ORDER_FIELDS_FOR_MODEL}
    slim["days_since_purchase"] = fake_db.days_since_purchase(order)
    slim["refund_eligible"] = order["status"] == "delivered" and slim["days_since_purchase"] <= fake_db.RETURN_WINDOW_DAYS
    return slim


def _run_get_customer(args: dict, state: CaseState) -> dict:
    email, name, last4 = args.get("email"), args.get("name"), args.get("card_last4")
    if not email and not name:
        raise ToolError("validation", "Provide email or name.", retryable=False)
    if last4 is not None and not (len(last4) == 4 and last4.isdigit()):
        raise ToolError("validation", f"card_last4 must be 4 digits, got {last4!r}.", retryable=False)

    matches = fake_db.find_customers(email=email, name=name)
    out = []
    for c in matches:
        verified = last4 is not None and c["card_last4"] == last4 and len(matches) == 1
        out.append({"customer_id": c["customer_id"], "name": c["name"], "tier": c["tier"], "verified": verified})
    result: dict = {"matches": out}
    if len(out) > 1:
        result["note"] = "Multiple customers match. Ask for the account email; do not pick one."
    return result


def _run_lookup_order(args: dict, state: CaseState) -> dict:
    oid = args["order_id"].strip().upper()
    try:
        order = fake_db.get_order(oid)
    except fake_db.BackendTimeout as e:
        raise ToolError("transient", f"Order service timeout: {e}", retryable=True) from e
    if order is None:
        # Not found is a business answer about THIS id, not an outage.
        raise ToolError("validation", f"No order {oid}. Ask the customer to re-check the ID.", retryable=False)
    return _trim_order(order)


def _run_process_refund(args: dict, state: CaseState) -> dict:
    oid, amount = args["order_id"].strip().upper(), float(args["amount_usd"])
    order = fake_db.ORDERS.get(oid)
    if order is None:
        raise ToolError("validation", f"No order {oid}.", retryable=False)
    days = fake_db.days_since_purchase(order)
    if order["status"] != "delivered" or days > fake_db.RETURN_WINDOW_DAYS:
        raise ToolError(
            "business",
            f"{oid} is not refundable: status={order['status']}, {days} days since purchase "
            f"(window {fake_db.RETURN_WINDOW_DAYS}).",
            retryable=False,
            customer_message="This order is outside our refund policy. I can connect you with a specialist.",
        )
    remaining = order["total_usd"] - order["refunded_usd"]
    if amount <= 0 or amount > remaining + 1e-9:
        raise ToolError("validation", f"Amount must be between 0 and {remaining:.2f}.", retryable=False)
    return fake_db.record_refund(oid, amount, args["reason"])


def _run_escalate_to_human(args: dict, state: CaseState) -> dict:
    return fake_db.record_escalation(args)


EXECUTORS = {
    "get_customer": _run_get_customer,
    "lookup_order": _run_lookup_order,
    "process_refund": _run_process_refund,
    "escalate_to_human": _run_escalate_to_human,
}


# --------------------------------------------------------------------------
# 3. The harness: pre-call guards, execution, post-call bookkeeping
# --------------------------------------------------------------------------
def _pre_call_guards(name: str, args: dict, state: CaseState) -> None:
    """Deterministic policy. Raises ToolError to block the call before it runs."""
    if name != "process_refund":
        return

    # Prerequisite gate: refunds only for an order owned by a verified customer.
    order = fake_db.ORDERS.get(str(args.get("order_id", "")).strip().upper())
    if not state.verified_customer_ids:
        raise ToolError(
            "permission",
            "PREREQUISITE_NOT_MET: no verified customer in this session. Call get_customer with the "
            "customer's email and card_last4 first.",
            retryable=False,
        )
    if order is not None and order["customer_id"] not in state.verified_customer_ids:
        raise ToolError(
            "permission",
            f"Order {order['order_id']} does not belong to the verified customer.",
            retryable=False,
        )

    # Refund cap: block AND redirect to the escalation workflow.
    amount = float(args.get("amount_usd", 0))
    if amount > REFUND_CAP_USD:
        raise ToolError(
            "business",
            f"REFUND_CAP_EXCEEDED: ${amount:.2f} is above the ${REFUND_CAP_USD:.0f} automatic limit. "
            "Do not retry. Call escalate_to_human with customer_id, root cause, amount and your "
            "recommended action.",
            retryable=False,
            customer_message="Refunds of this size need a specialist's approval. I'm passing your case on now.",
        )


def _post_call_bookkeeping(name: str, args: dict, result: dict, state: CaseState) -> None:
    """Extract transactional facts into the case-facts block."""
    if name == "get_customer":
        verified = [m for m in result["matches"] if m["verified"]]
        if verified:
            state.verified_customer_ids.add(verified[0]["customer_id"])
            state.facts["customer"] = verified[0]
    elif name == "lookup_order":
        state.facts["orders"][result["order_id"]] = {
            k: result[k] for k in ("total_usd", "status", "purchase_date", "refund_eligible", "refunded_usd")
        }
    elif name == "process_refund":
        state.facts["refunds"].append({k: result[k] for k in ("refund_id", "order_id", "amount_usd")})
    elif name == "escalate_to_human":
        state.facts["escalations"].append(result["ticket_id"])


def dispatch(name: str, args: dict, state: CaseState) -> tuple[str, bool]:
    """Run one tool call. Returns (content_for_tool_result, is_error)."""
    if name not in EXECUTORS:
        err = ToolError("validation", f"Unknown tool {name!r}.", retryable=False)
        return json.dumps(err.payload), True
    try:
        _pre_call_guards(name, args, state)
        result = EXECUTORS[name](args, state)
    except ToolError as e:
        return json.dumps(e.payload), True
    _post_call_bookkeeping(name, args, result, state)
    return json.dumps(result), False
