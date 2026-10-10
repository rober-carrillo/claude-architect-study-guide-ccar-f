def invoice(amount_cents: int = 10_000, currency: str = "USD") -> dict:
    return {"amount_cents": amount_cents, "currency": currency}
