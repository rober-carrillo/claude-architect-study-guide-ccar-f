"""HTTP-ish handlers (framework-free for the lab)."""

from src.billing.money import apply_discount


def discount_handler(payload: dict) -> dict:
    # Violates the API rule on purpose: no input model, bare string error.
    if "amount_cents" not in payload:
        return "missing amount"
    return {"data": {"amount_cents": apply_discount(payload["amount_cents"], payload.get("percent", 0))}}
