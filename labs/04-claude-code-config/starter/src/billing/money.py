"""Billing helpers. Deliberately contains bugs for the /review and plan-mode exercises."""


def apply_discount(amount_cents: int, percent: float) -> int:
    """Return the discounted amount in cents."""
    # BUG (for /review to find): float math on money, and truncation instead of rounding.
    return int(amount_cents * (1 - percent / 100))


def split_evenly(total_cents: int, ways: int) -> list[int]:
    """Split a bill into `ways` parts that sum exactly to total_cents."""
    base = total_cents // ways
    # BUG: the remainder cents are dropped, so the parts don't sum to the total.
    return [base] * ways


def format_usd(amount_cents: int) -> str:
    """Format integer cents as a display string."""
    return f"${amount_cents / 100:,.2f}"
