# Money standard (imported into CLAUDE.md)

- Store and compute in integer cents (`int`). Convert to a display string only at the edge.
- Round half-even when a percentage produces fractional cents, and say so in a comment.
- Currency codes are ISO 4217 strings, upper case.
