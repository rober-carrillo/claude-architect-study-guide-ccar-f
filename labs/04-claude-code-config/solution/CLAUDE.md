# Payments demo service

Shared, version-controlled instructions for everyone working in this repo. Personal preferences
go in `~/.claude/CLAUDE.md` (yours only) or `CLAUDE.local.md` (this repo, git-ignored).

## Commands
- Test: `python -m pytest -q` (single file: `python -m pytest -q tests/test_money.py`)
- Format: `ruff format <file>` (runs automatically after every edit via a PostToolUse hook)

## Universal conventions
- Money is integer cents everywhere. Never use float for currency.
- Public functions get type hints and a one-line docstring.
- Do not add dependencies without asking.

## Imported standards
@docs/standards/money.md
@docs/architecture.md

## Where the other rules live
Topic rules are in `.claude/rules/`. Some load only when you touch matching files
(tests, `src/api/`, `terraform/`), so they don't cost context the rest of the time.
