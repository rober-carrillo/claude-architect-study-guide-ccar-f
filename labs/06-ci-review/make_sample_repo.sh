#!/usr/bin/env bash
# Create a throwaway git repo with a base commit and a "PR" commit that has planted bugs.
#   ./make_sample_repo.sh            -> prints the repo path
# Planted issues:
#   src/db.py        SQL built with an f-string (security)
#   src/billing.py   float money + charge() signature changed (customer_id moved first)
#   src/api.py       NOT changed in the PR, still calls charge(amount, customer) -> integration bug
#   tests/test_billing.py  only covers the happy path
set -euo pipefail
DIR="${1:-$(mktemp -d)/sample-pr-repo}"
mkdir -p "$DIR/src" "$DIR/tests"
cd "$DIR"
git init -q -b main
git config user.email "lab@example.com"; git config user.name "Lab"

cat > CLAUDE.md <<'MD'
# Review standards (read by Claude in CI)
- Money is integer cents. Any float arithmetic on money is a bug (severity high).
- SQL must use parameters; string-built SQL is a security issue (severity high).
- Report bugs, security issues, cross-file breakage and missing tests for new branches.
- Do NOT report: formatting, naming, import order, missing docstrings, "consider" suggestions.
- Severity: high = wrong money / security / data loss; medium = crash or wrong result on
  realistic input; low = edge case unlikely in production.
MD
cat > src/billing.py <<'PY'
def charge(amount_cents: int, customer_id: str) -> dict:
    """Charge a customer."""
    if amount_cents <= 0:
        raise ValueError("amount must be positive")
    return {"customer_id": customer_id, "amount_cents": amount_cents, "status": "charged"}
PY
cat > src/api.py <<'PY'
from src.billing import charge


def checkout(cart_total_cents: int, customer_id: str) -> dict:
    return charge(cart_total_cents, customer_id)
PY
cat > tests/test_billing.py <<'PY'
from src.billing import charge


def test_charge_ok():
    assert charge(500, "c1")["status"] == "charged"
PY
git add -A && git commit -qm "base"

cat > src/billing.py <<'PY'
def charge(customer_id: str, amount_cents: int, currency: str = "USD") -> dict:
    """Charge a customer, applying the loyalty discount."""
    if amount_cents <= 0:
        raise ValueError("amount must be positive")
    discounted = amount_cents * 0.95  # 5% loyalty discount
    return {"customer_id": customer_id, "amount_cents": discounted, "currency": currency, "status": "charged"}
PY
cat > src/db.py <<'PY'
import sqlite3


def find_customer(conn: sqlite3.Connection, email: str):
    return conn.execute(f"SELECT id, name FROM customers WHERE email = '{email}'").fetchone()
PY
cat > tests/test_billing.py <<'PY'
from src.billing import charge


def test_charge_ok():
    assert charge("c1", 500)["status"] == "charged"
PY
git checkout -q -b feature/loyalty-discount
git add -A && git commit -qm "Add loyalty discount and customer lookup"
echo "$DIR"
