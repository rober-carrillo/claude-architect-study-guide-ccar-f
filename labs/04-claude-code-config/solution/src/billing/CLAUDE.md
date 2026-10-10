# src/billing (directory-level CLAUDE.md)

Loaded when Claude works on files in this directory. Use it for conventions that only apply here.
For conventions that span many directories (e.g. all test files), a path-scoped rule in
`.claude/rules/` is the better tool.

- Functions here are pure: no I/O, no logging, no imports from `src/api`.
