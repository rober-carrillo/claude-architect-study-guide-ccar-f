# Lab 06 — Claude Code in CI: structured, multi-pass, deduplicated PR review

**Goal:** run Claude Code non-interactively as a PR reviewer two ways: the official GitHub Action
(`anthropics/claude-code-action@v1`), and your own script around `claude -p --output-format json
--json-schema`. Split the review into per-file passes plus an integration pass, use explicit
criteria to cut false positives, and don't re-post findings that are still open from an earlier
commit.

**Time:** 60–90 min · **Cost:** a review of the sample PR is 4 `claude -p` runs (3 files + 1
integration pass).

## Exam task statements exercised

| Task | Where |
|---|---|
| 3.6 Claude Code in CI | `claude -p`, `--output-format json`, `--json-schema`, `CLAUDE.md` as review context, the Action |
| 4.1 Explicit criteria | `CRITERIA`: report/skip categories, severity definitions, examples |
| 4.4 `detected_pattern` | in the schema, used for dedup and for dismissal analysis |
| 4.6 Multi-pass and independent review | per-file passes + integration pass, each a fresh session |
| 1.6 Prompt chaining | fixed pipeline: per-file → integration |
| 3.6 Prior findings | `--prior` / hidden comment markers: report only new or still-unaddressed issues |

## Files

```
06-ci-review/
  findings.schema.json            file, line, severity, category, detected_pattern, message, fix, confidence
  make_sample_repo.sh             creates a git repo with a base commit and a PR branch with planted bugs
  review.py                       STARTER  TODO 1-4  (script variant)
  .github/workflows/claude-review.yml   STARTER  TODO 5-7 (both variants)
  smoke_test.py                   no-API: whole pipeline with a fake `claude`, envelope parsing, dedup
  solution/                       working review.py, smoke_test.py and workflow
```

## Planted issues in the sample PR

| Where | Issue | Which pass should catch it |
|---|---|---|
| `src/db.py` | SQL built with an f-string | per-file (security) |
| `src/billing.py` | `amount_cents * 0.95` makes money a float | per-file (bug, high) |
| `src/api.py` (**not in the diff**) | still calls `charge(amount, customer)` after the PR swapped the parameter order | **integration only** |
| `tests/test_billing.py` | the new discount branch has no test | per-file (test_gap) |
| everything | no docstrings on some functions, long lines | should **not** be reported |

## Setup

```bash
cd labs && source .venv/bin/activate && cd 06-ci-review
REPO=$(./make_sample_repo.sh)              # prints the repo path
python smoke_test.py                       # starter: fails at dedup
claude --version                           # the CLI must be on PATH for review.py
```

## Steps

1. **Look at the prompts first:** `python review.py --repo "$REPO" --base main --dry-run`.
2. **TODO 1: explicit criteria.** Replace "be conservative / high-confidence only" with REPORT and
   DO NOT REPORT categories, one example of each, and severity definitions. Run
   `python review.py --repo "$REPO" --base main` before and after, and count the findings about
   style or docstrings.
3. **TODO 4: integration pass.** Without it, the `src/api.py` breakage is never reported: no
   per-file reviewer sees that file. Add the pass and rerun.
4. **TODO 2–3: prior findings and dedup.** Save the first run (`cp review.json review.prev.json`).
   In `$REPO`, fix *only* the SQL bug and commit:
   ```bash
   cd "$REPO" && sed -i.bak "s/f\"SELECT id, name FROM customers WHERE email = '{email}'\"/\"SELECT id, name FROM customers WHERE email = ?\", (email,)/" src/db.py \
     && rm src/db.py.bak && git commit -qam "parameterise query" && cd -
   python review.py --repo "$REPO" --base main --prior review.prev.json
   ```
   Expected: `sql-fstring` is gone, `float-money` is in **still_open** (not re-posted), and
   nothing is rephrased as "new". `python smoke_test.py` passes.
5. **Workflow (TODO 5–7).** Read `.github/workflows/claude-review.yml`. `action-review` lets the
   Action post inline comments itself, through its `mcp__github_inline_comment__create_inline_comment`
   tool. `script-review` runs your `review.py`, posts only `new` findings, and puts a hidden
   `<!-- claude-finding {...} -->` marker in each comment, so the next run can rebuild `prior.json`
   from the PR's own comments.
6. **Optional, in a throwaway GitHub repo you own:** push the sample repo, add the
   `ANTHROPIC_API_KEY` secret, copy the workflow (adjust the `review.py` path), and open a PR from
   `feature/loyalty-discount`. (Or run `/install-github-app` in Claude Code to set the Action up.)

## What to observe

- **The JSON envelope.** `claude -p --output-format json` prints one object with `type: "result"`,
  `is_error`, `result`, `session_id`, `total_cost_usd`, and, with `--json-schema`,
  `structured_output`. `parse_envelope()` reads it and fails loudly on `is_error`.
- **`-p` never waits for input.** A tool that isn't in `--allowedTools` is denied, not prompted.
- **Attention dilution.** Compare one big "review the whole diff" prompt with per-file passes on a
  10-file PR. The per-file version finds more local bugs, and the integration pass finds what
  per-file passes can't see.
- **Independent reviewer.** Every pass is a new session that never saw the code being written.
  The same session that generated a change is a weak reviewer of it.
- **`detected_pattern`** lets you count which patterns developers dismiss most. That's how you
  find the noisy category to fix or switch off.

## Exam connection

- `-p` / `--print` for non-interactive CI runs. `--output-format json` + `--json-schema` for
  machine-parseable findings you can post as inline comments.
- `CLAUDE.md` gives CI-invoked Claude Code its project context (review standards, test conventions).
- Explicit report/skip criteria beat "be conservative" or "only high-confidence". High
  false-positive categories cost trust in the accurate ones; disable them while you fix the prompt.
- Multi-pass: per-file local passes + a cross-file integration pass. Use an independent instance
  for review, not self-review in the generating session.
- On re-runs after new commits, include prior findings and ask for only new or still-unaddressed
  issues.
- Pre-merge checks are blocking, so use the synchronous API, not the Batch API.

## Stretch exercises

1. **Severity calibration.** Add two code examples per severity level to `CRITERIA` and check
   whether repeated runs classify `float-money` consistently.
2. **Dismissal analytics.** Write `dismissals.csv` (`detected_pattern,dismissed`) by hand for 10
   findings, compute the dismissal rate per pattern, and drop the worst pattern from `CRITERIA`.
3. **Test generation pass.** Add a pass that proposes tests for `test_gap` findings. Put the
   existing test file in context so it doesn't suggest scenarios already covered.
4. **Confidence routing.** Post findings with `confidence < 0.7` as one collapsed summary comment
   instead of inline.
5. **Nightly audit with Batches.** Re-implement a *non-blocking* weekly full-repo audit with the
   Message Batches API (see Lab 03). Why is that fine there but wrong for this PR check?
