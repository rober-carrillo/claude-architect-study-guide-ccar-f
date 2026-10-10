#!/usr/bin/env python3
"""PreToolUse hook for Bash. Claude Code pipes the pending tool call to stdin as JSON:

    {"session_id": ..., "hook_event_name": "PreToolUse", "tool_name": "Bash",
     "tool_input": {"command": "...", "description": "..."}, "cwd": ..., ...}

Exit codes:
    0  allow (normal permission rules still apply)
    2  BLOCK. Whatever we print to stderr is sent back to Claude as the reason, so it can
       change course instead of retrying blindly.
    other  non-blocking error, shown to the user; the call proceeds
"""

import json
import re
import sys

RULES = [
    (r"\brm\s+-[a-z]*r[a-z]*f|\brm\s+-[a-z]*f[a-z]*r", "Recursive force-delete is blocked. Delete specific files instead."),
    (r"\bgit\s+push\b.*--force|\bgit\s+push\b.*\s-f\b", "Force-push is blocked by project policy."),
    (r"\bterraform\s+apply\b", "terraform apply only runs in CI after plan review. Run `terraform plan` and summarise it."),
    (r"\b(DROP|TRUNCATE)\s+TABLE\b", "Destructive SQL is blocked. Write a migration instead."),
    (r"(^|\s)(cat|less|head|tail)\s+\S*\.env\b", "Reading .env files is not allowed. Ask the user for the value you need."),
]


def main() -> int:
    event = json.load(sys.stdin)
    command = event.get("tool_input", {}).get("command", "")
    for pattern, reason in RULES:
        if re.search(pattern, command, re.IGNORECASE):
            print(f"Blocked by .claude/hooks/block_dangerous.py: {reason}", file=sys.stderr)
            return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
