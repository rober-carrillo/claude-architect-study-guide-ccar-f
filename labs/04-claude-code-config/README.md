# Lab 04 — Configure Claude Code for a team

**Goal:** take a project with one monolithic `CLAUDE.md` and turn it into a team setup:
`@imports`, path-scoped rules, a project slash command, a forked skill, a subagent, permissions,
a blocking `PreToolUse` hook, a `PostToolUse` formatter, and a project MCP server. Then check
that each piece loads, using Claude Code's own commands.

**Time:** 60–90 min · **Cost:** normal Claude Code usage (subscription or API key)

## Exam task statements exercised

| Task | Where |
|---|---|
| 3.1 CLAUDE.md hierarchy, `@import`, `.claude/rules/` | `CLAUDE.md`, `docs/`, `src/billing/CLAUDE.md`, `/memory` |
| 3.2 Commands and skills | `.claude/commands/review.md`, `.claude/skills/codebase-map/SKILL.md` |
| 3.3 Path-specific rules | `.claude/rules/{testing,api,terraform}.md` with `paths:` globs |
| 3.4 Plan mode vs direct | step 9 |
| 2.4 MCP scoping | `.mcp.json` with `${VAR}` expansion |
| 1.5 / 3.x Hooks | `.claude/settings.json` + `.claude/hooks/*.py` |
| 4.1 Explicit criteria | `/review` reports only bugs and security issues, with defined severities |

This is Preparation Exercise 2 from the exam guide.

## Files

```
04-claude-code-config/
  starter/          monolithic CLAUDE.md (with TODO 1-4) + .claude/TODO.md (TODO 5-10) + sample code
  solution/         the finished layout:
    CLAUDE.md                         team instructions + @docs/... imports
    docs/architecture.md, docs/standards/money.md
    src/billing/CLAUDE.md             directory-level instructions
    .claude/rules/testing.md          paths: **/test_*.py, **/*_test.py, **/*.test.*
    .claude/rules/api.md              paths: src/api/**/*
    .claude/rules/terraform.md        paths: terraform/**/*
    .claude/rules/security.md         no paths: always loaded
    .claude/commands/review.md        /review <path-or-range>, uses $ARGUMENTS
    .claude/skills/codebase-map/SKILL.md   context: fork, agent: Explore, allowed-tools, argument-hint
    .claude/agents/test-writer.md     subagent: description, tools, model
    .claude/settings.json             permissions + PreToolUse (Bash) + PostToolUse (Edit|Write)
    .claude/hooks/block_dangerous.py  exit 2 = block, stderr goes back to Claude
    .claude/hooks/format_file.py      formats the edited file
    .mcp.json                         Lab 02's server, ${INVENTORY_API_TOKEN} expansion
  check_template.py offline checker: JSON, frontmatter, imports, and the hook's exit codes
```

**Nothing here touches your home directory.** You copy a folder to a scratch location and run
`claude` there. Project files only.

## Setup

```bash
SCRATCH=$(mktemp -d)/cc-lab
cp -R labs/04-claude-code-config/starter "$SCRATCH"     # or .../solution to skip to verification
cd "$SCRATCH" && git init -q && git add -A && git commit -qm init
export LABS_DIR=/path/to/claude-architect-study-guide/labs   # for .mcp.json
export LABS_PYTHON="$LABS_DIR/.venv/bin/python"
export INVENTORY_API_TOKEN=demo-token
python /path/to/labs/04-claude-code-config/check_template.py "$SCRATCH"   # all FAIL for the starter
```

## Steps

1. **Baseline.** Run `claude` in the starter copy and type `/memory`. One project `CLAUDE.md`
   is loaded, with every section, every session. `/context` shows what that costs.
2. **Split it (TODO 1–4).** Create `.claude/rules/testing.md`, `api.md` and `terraform.md` with
   `paths:` frontmatter. Replace the pasted standards with `@docs/standards/money.md` and
   `@docs/architecture.md`. Move the "Personal" section to `CLAUDE.local.md` (git-ignored). Move
   the billing note into `src/billing/CLAUDE.md`. Run `check_template.py` until those checks pass.
3. **Verify loading.** Restart `claude` and run `/memory`: project `CLAUDE.md` + its imports +
   `security.md` (no `paths:`) load at start. Then ask *"Add a test for `split_evenly`"* and run
   `/memory` (or `/context`) again: `testing.md` appears only after Claude reads or edits a file
   matching `**/test_*.py`. Ask something about `terraform/main.tf`: the terraform rule loads too.
4. **Project slash command (TODO 5).** Create `.claude/commands/review.md`, then run
   `/review src/billing/money.py`. It should report the float-money bug in `apply_discount` and
   the dropped remainder in `split_evenly` in the `path:line | severity | ...` format, and no style
   nits. Run `/review` with no argument: the `argument-hint` tells you what to pass.
5. **Forked skill (TODO 6).** Create `codebase-map`. Run `/codebase-map discount flow`. With
   `context: fork` it runs in a separate subagent (Explore), and only the summary comes back to
   your session. Compare `/context` before and after with an equivalent un-forked request
   ("explore the discount flow in detail").
6. **Subagent (TODO 7).** `/agents` lists `test-writer`. Ask: *"Use the test-writer agent to add
   tests for split_evenly."* It should list existing tests first and report the bug, not hide it.
7. **Hooks and permissions (TODO 8–9).**
   - `/hooks` shows both hooks. Ask Claude to *"clean up with rm -rf build"*: the PreToolUse hook
     exits 2, and Claude reads the stderr reason and changes course.
   - Ask to *"terraform apply"*: blocked twice over (deny rule + hook).
   - Ask to *"show me .env"*: the `Read(./.env)` deny rule.
   - Edit any `.py` file: `format_file.py` runs `ruff format` (if ruff is installed).
   - `git push` lands in `ask`: you're prompted every time.
8. **Project MCP server (TODO 10).** Add `.mcp.json`, restart, approve the project server when
   asked, and run `/mcp`. Ask *"what does SKU-1001 cost?"*: `lookup_product` is allowlisted in
   `settings.json`, so there's no permission prompt. `lookup_inventory` isn't, so you get asked.
9. **Plan mode vs direct execution.** Press **Shift+Tab** to cycle into plan mode (or start with
   `claude --permission-mode plan`). Try three tasks and note when the plan helps:
   - *Direct:* "Fix `split_evenly` so the parts sum to the total" (one function, clear fix).
   - *Plan:* "Change all discounts from float percent to integer basis points across api, billing
     and tests" (multi-file, ordering matters).
   - *Plan:* "Add idempotency keys to the discount endpoint" (several valid designs: DB table vs
     cache vs request hash, each with different infrastructure).
   Approve a plan, then let it execute: plan for the investigation, direct for the build.
10. **Run the checker on your copy:** `python check_template.py "$SCRATCH"` → `ALL CHECKS PASSED`.

## What to observe

- `/memory` is how you diagnose "Claude ignores our convention". Is the file actually loaded,
  and at which level?
- Path-scoped rules load **on demand**. Context stays small until you touch matching files.
- `context: fork` keeps a verbose exploration out of your main conversation.
- A hook that exits 2 is a hard stop the model can't talk its way past. A sentence in
  `CLAUDE.md` saying "never run terraform apply" is only guidance.
- Permissions are evaluated deny → ask → allow; a deny always wins.
- Project `.mcp.json` triggers an approval prompt the first time, because it came from the repo.

## Exam connection

- Hierarchy: user `~/.claude/CLAUDE.md` (only you) → project `CLAUDE.md` or `.claude/CLAUDE.md`
  (shared via git) → directory `CLAUDE.md`. "New teammate doesn't get the instruction" usually
  means it lives at user level.
- `@path` imports keep `CLAUDE.md` modular. `.claude/rules/*.md` splits a monolith by topic.
- `paths:` globs beat directory `CLAUDE.md` for conventions spread across the tree (all test files).
- `.claude/commands/` = project commands shared via git; `~/.claude/commands/` = personal.
- Skill frontmatter: `context: fork` (isolated subagent), `allowed-tools` (restrict tools),
  `argument-hint` (prompt for arguments). Skills are on-demand; `CLAUDE.md` is always loaded.
- Plan mode for large, multi-file, multi-approach or architectural work; direct execution for
  small, clear changes. The Explore subagent isolates verbose discovery.
- `.mcp.json` (project, shared, `${VAR}` expansion) vs `~/.claude.json` (user, personal).
- Hooks give deterministic guarantees; prompts give probabilistic ones.

## Stretch exercises

1. **Personal variant.** Copy `codebase-map` to `~/.claude/skills/codebase-map-verbose/` with a
   different name and a longer output format. Teammates are unaffected. Delete it when you're done.
2. **Personal MCP server.** `claude mcp add catalog-dev --scope user -- "$LABS_PYTHON" "$LABS_DIR/02-mcp-server/solution/server.py"`;
   check in `/mcp` that both servers are available at once; then
   `claude mcp remove catalog-dev --scope user`.
3. **Interview pattern.** Ask: *"Before implementing idempotency keys, interview me about the
   requirements."* Note which considerations it raises that you hadn't thought of.
4. **Iterative refinement with tests.** Write failing tests for `split_evenly` first, then ask
   Claude to make them pass by sharing the failures.
5. **Hook as JSON output.** Rewrite `block_dangerous.py` to print
   `{"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": "..."}}`
   and exit 0 instead of exiting 2. Same effect, structured.
6. **`/compact`.** After steps 3–6, run `/context`, then `/compact keep the review findings`, then
   `/context` again.
