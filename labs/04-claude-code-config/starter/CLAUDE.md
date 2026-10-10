# Payments demo service

<!--
STARTER: everything is in one monolithic file, and every line loads into every session.
TODO(1) Move the "Testing", "API" and "Terraform" sections into .claude/rules/*.md with
        `paths:` frontmatter so each loads only when matching files are touched.
TODO(2) Replace the pasted "Money standard" and "Architecture" sections with @imports of
        docs/standards/money.md and docs/architecture.md.
TODO(3) Move the "Personal" section out: it belongs in ~/.claude/CLAUDE.md or CLAUDE.local.md,
        not in a file every teammate gets.
TODO(4) Move "billing functions are pure" into src/billing/CLAUDE.md (directory-level).
-->

## Commands
- Test: `python -m pytest -q`
- Format: `ruff format <file>`

## Universal conventions
- Money is integer cents everywhere. Never use float for currency.
- Public functions get type hints and a one-line docstring.

## Money standard
- Store and compute in integer cents (`int`). Convert to a display string only at the edge.
- Round half-even when a percentage produces fractional cents, and say so in a comment.
- Currency codes are ISO 4217 strings, upper case.

## Architecture
- `src/api/` HTTP handlers. `src/billing/` pure business logic. `terraform/` infra. `tests/` pytest.

## Testing
- Use the factories in `tests/factories.py`; never build Invoice dicts inline.
- One behaviour per test. Name tests `test_<unit>_<condition>_<expected>`.
- Never call the real payment provider.

## API
- Every handler validates input with a Pydantic model and returns `{"data": ...}` or `{"error": {...}}`.
- Amounts are integer cents, field names end in `_cents`.

## Terraform
- Every resource has `tags = local.common_tags`. Never run `terraform apply`.

## Billing
- Functions in src/billing are pure: no I/O, no logging.

## Personal
- I like answers in bullet points and I use vim keybindings.
