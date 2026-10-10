"""Offline checks for the Lab 04 config (no Claude Code, no API key needed).

    python check_template.py            # checks ./solution
    python check_template.py /path/to/scratch-project

- settings.json and .mcp.json are valid JSON with the expected top-level keys
- every rule / command / skill / agent file has parseable frontmatter with the expected keys
- the PreToolUse hook blocks (exit 2) and allows (exit 0) the commands it should
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parent / "solution"
failures: list[str] = []


def check(cond: bool, msg: str) -> None:
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond:
        failures.append(msg)


def frontmatter(path: Path) -> dict:
    """Minimal YAML-frontmatter reader: `key: value` lines and `key:` + `  - item` lists."""
    text = path.read_text()
    if not text.startswith("---\n"):
        return {}
    block = text[4:text.index("\n---", 4)]
    data: dict = {}
    key = None
    for line in block.splitlines():
        if line.startswith("  - ") and key:
            data.setdefault(key, []).append(line[4:].strip().strip('"'))
        elif ":" in line and not line.startswith(" "):
            key, _, val = line.partition(":")
            key, val = key.strip(), val.strip()
            data[key] = val if val else []
    return data


def load_json(rel: str) -> dict:
    p = ROOT / rel
    if not p.exists():
        check(False, f"{rel} exists")
        return {}
    return json.loads(p.read_text())


def fm_of(rel: str) -> dict:
    p = ROOT / rel
    if not p.exists():
        check(False, f"{rel} exists")
        return {}
    return frontmatter(p)


print(f"checking {ROOT}")
settings = load_json(".claude/settings.json")
check({"allow", "ask", "deny"} <= set(settings.get("permissions", {})), "settings.json permissions has allow/ask/deny")
check({"PreToolUse", "PostToolUse"} <= set(settings.get("hooks", {})), "settings.json has PreToolUse and PostToolUse hooks")
mcp = load_json(".mcp.json")
check("${INVENTORY_API_TOKEN}" in json.dumps(mcp), ".mcp.json references a secret via ${VAR}, not a literal")

rules = sorted((ROOT / ".claude/rules").glob("*.md"))
check(len(rules) >= 3, f"{len(rules)} rule files in .claude/rules/")
for rule in rules:
    fm = frontmatter(rule)
    if rule.name == "security.md":
        check("paths" not in fm, f"rules/{rule.name} has no paths (always loaded)")
    else:
        check(isinstance(fm.get("paths"), list) and fm["paths"], f"rules/{rule.name} paths: {fm.get('paths')}")

cmd = fm_of(".claude/commands/review.md")
check("argument-hint" in cmd and "allowed-tools" in cmd, "commands/review.md has argument-hint + allowed-tools")
check(bool(cmd) and "$ARGUMENTS" in (ROOT / ".claude/commands/review.md").read_text(), "commands/review.md uses $ARGUMENTS")

skill = fm_of(".claude/skills/codebase-map/SKILL.md")
check(skill.get("context") == "fork", "skill codebase-map has context: fork")
check({"name", "description", "allowed-tools", "argument-hint"} <= set(skill), f"skill keys: {sorted(skill)}")

agent = fm_of(".claude/agents/test-writer.md")
check({"name", "description", "tools"} <= set(agent), f"agent test-writer keys: {sorted(agent)}")

claude_md = (ROOT / "CLAUDE.md").read_text()
for line in claude_md.splitlines():
    if line.startswith("@"):
        check((ROOT / line[1:]).exists(), f"CLAUDE.md import {line} exists")

hook = ROOT / ".claude/hooks/block_dangerous.py"
cases = {} if not hook.exists() else {
    "rm -rf build/": 2,
    "git push --force origin main": 2,
    "terraform apply -auto-approve": 2,
    "cat .env": 2,
    "python -m pytest -q": 0,
    "git push origin feature-x": 0,
    "rm build/old.txt": 0,
}
for command, expected in cases.items():
    event = {"hook_event_name": "PreToolUse", "tool_name": "Bash", "tool_input": {"command": command}}
    proc = subprocess.run([sys.executable, str(hook)], input=json.dumps(event), capture_output=True, text=True)
    check(proc.returncode == expected,
          f"hook exit {proc.returncode} (want {expected}) for {command!r}" + (f" -> {proc.stderr.strip()}" if proc.stderr else ""))

check(hook.exists(), ".claude/hooks/block_dangerous.py exists")
fmt = ROOT / ".claude/hooks/format_file.py"
check(fmt.exists(), ".claude/hooks/format_file.py exists")
if fmt.exists():
    proc = subprocess.run([sys.executable, str(fmt)], input=json.dumps({"tool_input": {"file_path": "x.md"}}),
                          capture_output=True, text=True)
    check(proc.returncode == 0, "format hook exits 0 for a non-code file")
check(not any(l.startswith("## Testing") for l in claude_md.splitlines()), "CLAUDE.md no longer inlines the Testing section")

print("\nALL CHECKS PASSED" if not failures else f"\n{len(failures)} FAILED")
sys.exit(1 if failures else 0)
