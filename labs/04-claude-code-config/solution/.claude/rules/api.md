---
paths:
  - "src/api/**/*"
---
# API conventions (loaded only when working under src/api/)

- Every handler validates input with a Pydantic model and returns `{"data": ...}` or
  `{"error": {"code": ..., "message": ...}}`. Never a bare string.
- Errors use the codes in `src/api/errors.py`; add new codes there, not inline.
- Amounts in requests and responses are integer cents, field names end in `_cents`.
