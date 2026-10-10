---
name: codebase-map
description: Map an unfamiliar area of this codebase (entry points, call graph, where data is validated and persisted) and return a short summary. Use when the user asks "how does X work", "where is Y handled", or before planning a change that touches several modules.
argument-hint: <area or question, e.g. "refund flow" or "src/billing">
context: fork
agent: Explore
allowed-tools: Read, Grep, Glob
---
# Codebase map

Investigate: $ARGUMENTS

1. Grep for entry points first (route decorators, public function names, CLI commands).
   Do not read every file up front.
2. Read only the files on the path you find, following imports one hop at a time.
3. Note where input is validated, where money is computed, and where anything is persisted.

Return ONLY this summary (the exploration itself stays in the forked context):

```
## <area>
Entry points: path:line - what it does
Flow: A -> B -> C (one line per hop, with path:line)
Validation: where and how
Money: where amounts are computed; int cents or float?
Open questions: anything you could not confirm
```
