from src.billing.money import apply_discount, format_usd


def test_apply_discount_zero_percent_returns_same_amount():
    assert apply_discount(10_000, 0) == 10_000


def test_format_usd_two_decimals():
    assert format_usd(123456) == "$1,234.56"
