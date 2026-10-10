"""In-memory fake backend for the support agent lab.

Nothing here calls Claude. It stands in for the CRM, order system, payments
service and ticketing queue that a real support agent would reach through MCP
tools. It deliberately includes the awkward cases the exam likes to ask about:

* two customers with the same name        -> the agent must ask for another identifier
* an order whose lookup times out once     -> a *transient*, retryable error
* an order above the $500 refund cap       -> a *business* rule, not retryable
* an order that belongs to someone else    -> a *permission* error
* raw order records with ~20 fields        -> trim before they pile up in context
"""

from __future__ import annotations

import copy
import itertools
from datetime import date

CUSTOMERS: dict[str, dict] = {
    "C-1001": {
        "customer_id": "C-1001",
        "name": "Dana Whitfield",
        "email": "dana@example.com",
        "card_last4": "4242",
        "tier": "gold",
        "account_status": "active",
    },
    "C-1002": {
        "customer_id": "C-1002",
        "name": "Alex Kim",
        "email": "alex.kim@example.com",
        "card_last4": "1881",
        "tier": "standard",
        "account_status": "active",
    },
    "C-1003": {
        "customer_id": "C-1003",
        "name": "Alex Kim",  # same name as C-1002 on purpose
        "email": "akim.design@example.org",
        "card_last4": "5550",
        "tier": "standard",
        "account_status": "active",
    },
}


def _order(order_id, customer_id, item, total, status, purchased, **extra):
    """Build a deliberately verbose order record (like a real OMS row)."""
    record = {
        "order_id": order_id,
        "customer_id": customer_id,
        "item": item,
        "total_usd": total,
        "status": status,
        "purchase_date": purchased,
        "currency": "USD",
        "warehouse_code": "WH-EAST-02",
        "carrier": "UPS",
        "tracking_number": f"1Z999{order_id[-4:]}0000",
        "sku": f"SKU-{sum(map(ord, item)) % 99999:05d}",
        "tax_usd": round(total * 0.0825, 2),
        "shipping_usd": 0.0,
        "gift_wrap": False,
        "coupon_code": None,
        "fraud_score": 0.02,
        "fulfillment_center_shift": "B",
        "internal_notes": "",
        "created_by_service": "checkout-v7",
        "schema_version": 14,
        "refunded_usd": 0.0,
    }
    record.update(extra)
    return record


ORDERS: dict[str, dict] = {
    "ORD-5001": _order("ORD-5001", "C-1001", "Wireless earbuds", 89.00, "delivered", "2026-09-20"),
    "ORD-5002": _order("ORD-5002", "C-1001", "Laptop 14in", 1240.00, "delivered", "2026-09-28"),
    "ORD-5003": _order("ORD-5003", "C-1002", "Desk lamp", 45.50, "in_transit", "2026-10-05"),
    "ORD-5004": _order("ORD-5004", "C-1001", "Coffee grinder", 129.99, "delivered", "2026-08-15"),
    "ORD-5005": _order("ORD-5005", "C-1003", "Monitor arm", 74.00, "delivered", "2026-09-30"),
}

# ORD-5004's first lookup simulates a warehouse-service timeout.
_FLAKY_ORDERS = {"ORD-5004": itertools.count()}

REFUNDS: list[dict] = []
ESCALATIONS: list[dict] = []

RETURN_WINDOW_DAYS = 30
TODAY = date(2026, 10, 10)


class BackendTimeout(Exception):
    """Raised by the fake backend to simulate a transient outage."""


def reset() -> None:
    """Restore the DB to its initial state (used by tests)."""
    REFUNDS.clear()
    ESCALATIONS.clear()
    for oid in ORDERS:
        ORDERS[oid]["refunded_usd"] = 0.0
    _FLAKY_ORDERS["ORD-5004"] = itertools.count()


def find_customers(*, email: str | None = None, name: str | None = None) -> list[dict]:
    if email:
        return [copy.deepcopy(c) for c in CUSTOMERS.values() if c["email"].lower() == email.lower()]
    if name:
        return [copy.deepcopy(c) for c in CUSTOMERS.values() if c["name"].lower() == name.lower()]
    return []


def get_order(order_id: str) -> dict | None:
    if order_id in _FLAKY_ORDERS and next(_FLAKY_ORDERS[order_id]) == 0:
        raise BackendTimeout("order-service did not answer within 3s")
    order = ORDERS.get(order_id)
    return copy.deepcopy(order) if order else None


def days_since_purchase(order: dict) -> int:
    return (TODAY - date.fromisoformat(order["purchase_date"])).days


def record_refund(order_id: str, amount: float, reason: str) -> dict:
    refund = {
        "refund_id": f"RF-{len(REFUNDS) + 9001}",
        "order_id": order_id,
        "amount_usd": amount,
        "reason": reason,
        "status": "issued",
    }
    REFUNDS.append(refund)
    ORDERS[order_id]["refunded_usd"] += amount
    return refund


def record_escalation(payload: dict) -> dict:
    ticket = {"ticket_id": f"ESC-{len(ESCALATIONS) + 301}", "queue": "tier2-support", **payload}
    ESCALATIONS.append(ticket)
    return ticket
