---
paths:
  - "**/test_*.py"
  - "**/*_test.py"
  - "**/*.test.*"
---
# Testing conventions (loaded only when working on test files)

- Use the factories in `tests/factories.py`; never build Invoice dicts inline.
- One behaviour per test. Name tests `test_<unit>_<condition>_<expected>`.
- Never call the real payment provider. Use the `fake_gateway` fixture.
- When asked to "add tests", first list the cases already covered so you don't duplicate them.
