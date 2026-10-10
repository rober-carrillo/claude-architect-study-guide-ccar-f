"""Lab 06 solution: a multi-pass PR review with `claude -p`, structured output and prior-findings dedup.

    python review.py --repo /path/to/repo --base main
    python review.py --repo ... --base main --prior review.prev.json    # 2nd run after new commits
    python review.py --repo ... --base main --dry-run                   # print the prompts, don't call claude

Passes:
  1. one PER-FILE pass for each changed file (local bugs; focused attention)
  2. one INTEGRATION pass over the whole change (cross-file breakage, callers of changed functions)
Each pass is a separate `claude -p` process: an independent reviewer with no memory of how the
code was written. The output JSON is {"new": [...], "still_open": [...], "summary": ...}.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent
SCHEMA_PATH = next(p for p in (HERE / "findings.schema.json", HERE.parent / "findings.schema.json") if p.exists())
SCHEMA = json.loads(SCHEMA_PATH.read_text())
REVIEWABLE = (".py", ".ts", ".tsx", ".js", ".go", ".sql")
LINE_WINDOW = 3

CRITERIA = """Review criteria (CLAUDE.md in the repo has the project specifics; follow it):
REPORT: bugs (wrong result, crash, unhandled None, float money), security (injection, secrets,
unsafe deserialisation), cross-file breakage, and new branches with no test.
DO NOT REPORT: style, formatting, naming, import order, docstrings, "consider" suggestions,
anything a linter would catch, or patterns that are consistent with the rest of the codebase.
Example of a finding to REPORT:   f"... WHERE email = '{email}'"  -> security, sql-fstring, high
Example of a pattern to SKIP:     a function without a docstring, or a long line
Set detected_pattern to a short stable label for the construct (e.g. sql-fstring, float-money,
caller-signature-mismatch). If you find nothing, return an empty findings list."""


def git(repo: Path, *args: str) -> str:
    return subprocess.run(["git", "-C", str(repo), *args], check=True, capture_output=True, text=True).stdout


def changed_files(repo: Path, base: str) -> list[str]:
    files = git(repo, "diff", "--name-only", "--diff-filter=AM", f"{base}...HEAD").split()
    return [f for f in files if f.endswith(REVIEWABLE)]


def prior_block(prior: list[dict], file: str | None = None) -> str:
    relevant = [p for p in prior if file is None or p["file"] == file]
    if not relevant:
        return ""
    return ("\n<prior_findings>\n" + json.dumps(relevant, indent=1) + "\n</prior_findings>\n"
            "These were reported on an earlier commit. Report a prior finding again ONLY if the code "
            "still has the problem (keep the same detected_pattern). Do not report fixed ones. "
            "Do not rephrase an existing finding as a new one.\n")


def per_file_prompt(repo: Path, base: str, file: str, prior: list[dict]) -> str:
    diff = git(repo, "diff", f"{base}...HEAD", "--", file)
    return (f"You are reviewing ONE file of a pull request: {file}\n"
            f"Read the full file for context, but report only issues in or caused by the changed lines.\n\n"
            f"{CRITERIA}\n{prior_block(prior, file)}\n<diff>\n{diff}\n</diff>")


def integration_prompt(repo: Path, base: str, files: list[str], local: list[dict], prior: list[dict]) -> str:
    stat = git(repo, "diff", "--stat", f"{base}...HEAD")
    return ("You are doing the CROSS-FILE pass of a pull request review. Per-file reviewers already "
            "covered local issues (listed below); do not repeat them.\n"
            "Look only for problems that span files: changed function signatures or return types whose "
            "callers were not updated (use Grep to find callers, including in files NOT in the diff), "
            "contracts between modules, data flowing from one changed file into another.\n"
            f"Use category 'integration'.\n\n{CRITERIA}\n{prior_block(prior)}\n"
            f"<changed_files>\n{stat}\n</changed_files>\n"
            f"<per_file_findings>\n{json.dumps(local, indent=1)}\n</per_file_findings>")


def run_claude(repo: Path, prompt: str, max_turns: int = 8) -> dict:
    """One independent, non-interactive Claude Code run that must return SCHEMA-shaped JSON."""
    cmd = [
        "claude", "-p", prompt,               # -p: no interactive prompts, so CI can't hang
        "--output-format", "json",            # one JSON envelope on stdout
        "--json-schema", json.dumps(SCHEMA),  # validated structured output in envelope["structured_output"]
        "--allowedTools", "Read,Grep,Glob",   # read-only reviewer
        "--max-turns", str(max_turns),
    ]
    proc = subprocess.run(cmd, cwd=repo, capture_output=True, text=True, timeout=900)
    return parse_envelope(proc.stdout, proc.stderr)


def parse_envelope(stdout: str, stderr: str = "") -> dict:
    try:
        env = json.loads(stdout)
    except json.JSONDecodeError:
        raise RuntimeError(f"claude did not return JSON. stderr: {stderr[-500:]}")
    if env.get("is_error"):
        raise RuntimeError(f"claude run failed: {env.get('result')!r} (terminal_reason={env.get('terminal_reason')})")
    out = env.get("structured_output")
    if out is None:  # fall back to the text result if structured output is absent
        out = json.loads(env["result"])
    return out


def _same(a: dict, b: dict) -> bool:
    return (a["file"] == b["file"] and a["detected_pattern"] == b["detected_pattern"]
            and abs(int(a["line"]) - int(b["line"])) <= LINE_WINDOW)


def dedup(current: list[dict], prior: list[dict]) -> tuple[list[dict], list[dict]]:
    """Split this run's findings into NEW (post them) and STILL_OPEN (already posted; don't repeat).

    The prompt already asks Claude not to repeat prior findings; this deterministic filter makes
    sure, since a duplicate comment costs reviewer trust either way.
    """
    new, still_open, seen = [], [], []
    for f in current:
        if any(_same(f, s) for s in seen):
            continue  # duplicate across passes (per-file + integration)
        seen.append(f)
        (still_open if any(_same(f, p) for p in prior) else new).append(f)
    return new, still_open


def review(repo: Path, base: str, prior: list[dict], *, jobs: int = 4, runner=run_claude, log=print) -> dict:
    files = changed_files(repo, base)
    log(f"per-file pass over {len(files)} file(s): {files}")
    with ThreadPoolExecutor(max_workers=jobs) as pool:
        results = list(pool.map(lambda f: runner(repo, per_file_prompt(repo, base, f, prior)), files))
    local = [f for r in results for f in r["findings"]]
    log(f"  {len(local)} local finding(s)")

    log("integration pass")
    integ = runner(repo, integration_prompt(repo, base, files, local, prior), 12)
    log(f"  {len(integ['findings'])} cross-file finding(s)")

    new, still_open = dedup(local + integ["findings"], prior)
    return {"new": new, "still_open": still_open, "summary": integ.get("summary", "")}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", type=Path, required=True)
    ap.add_argument("--base", default="main")
    ap.add_argument("--prior", type=Path, help="JSON list of findings from an earlier run")
    ap.add_argument("--out", type=Path, default=Path("review.json"))
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    repo = args.repo.resolve()
    prior = json.loads(args.prior.read_text()) if args.prior else []
    if isinstance(prior, dict):  # accept a previous review.json directly
        prior = prior.get("new", []) + prior.get("still_open", [])

    if args.dry_run:
        files = changed_files(repo, args.base)
        print(per_file_prompt(repo, args.base, files[0], prior) if files else "(no reviewable files)")
        print("\n" + "-" * 80 + "\n")
        print(integration_prompt(repo, args.base, files, [], prior))
        return

    result = review(repo, args.base, prior)
    args.out.write_text(json.dumps(result, indent=2))
    print(f"\n{len(result['new'])} new, {len(result['still_open'])} still open -> {args.out}")
    for f in result["new"]:
        print(f"  {f['file']}:{f['line']} [{f['severity']}/{f['category']}] {f['detected_pattern']}: {f['message']}")
    # exit 2 = high-severity findings (fail the check); a crash exits 1 on its own
    sys.exit(2 if any(f["severity"] == "high" for f in result["new"] + result["still_open"]) else 0)


if __name__ == "__main__":
    main()
