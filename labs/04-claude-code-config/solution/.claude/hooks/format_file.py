#!/usr/bin/env python3
"""PostToolUse hook for Edit|Write: format the file Claude just changed.

The tool already ran, so this hook can't block anything. It keeps formatting deterministic:
the formatter runs every time, whether or not the model remembers to. Exit 0 always. If the
formatter is missing we say so on stderr and carry on.
"""

import json
import shutil
import subprocess
import sys


def main() -> int:
    event = json.load(sys.stdin)
    path = event.get("tool_input", {}).get("file_path", "")
    if path.endswith(".py"):
        tool = shutil.which("ruff")
        cmd = [tool, "format", path] if tool else None
    elif path.endswith(".tf"):
        tool = shutil.which("terraform")
        cmd = [tool, "fmt", path] if tool else None
    else:
        return 0
    if cmd is None:
        print(f"format_file: no formatter installed for {path}; skipped", file=sys.stderr)
        return 0
    subprocess.run(cmd, check=False, capture_output=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
