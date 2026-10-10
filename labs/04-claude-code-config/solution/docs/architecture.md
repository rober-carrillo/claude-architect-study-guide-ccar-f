# Architecture (imported into CLAUDE.md)

- `src/api/`     HTTP handlers. Thin: validate input, call `src/billing`, shape the response.
- `src/billing/` Pure business logic. No I/O, no framework imports.
- `terraform/`   Infrastructure. Changes go through plan review; never `apply` from a laptop.
- `tests/`       pytest. Mirrors `src/` layout.
