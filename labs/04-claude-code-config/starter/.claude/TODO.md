# What to create in .claude/ (compare with ../solution/.claude/ when done)

TODO(5) commands/review.md   - project slash command `/review <path-or-range>`; frontmatter
                               `description`, `argument-hint`, `allowed-tools`; body uses $ARGUMENTS;
                               explicit report/skip criteria and severity definitions.
TODO(6) skills/codebase-map/SKILL.md - `context: fork` (+ `agent: Explore`), `allowed-tools: Read, Grep, Glob`,
                               `argument-hint`; returns only a short summary.
TODO(7) agents/test-writer.md - subagent with `name`, `description` (when to delegate), `tools`, `model`.
TODO(8) settings.json        - permissions allow/ask/deny; a PreToolUse hook on Bash that exits 2 to
                               block dangerous commands; a PostToolUse hook on Edit|Write that formats.
TODO(9) hooks/block_dangerous.py and hooks/format_file.py (read the event JSON from stdin).
TODO(10) ../.mcp.json        - the Lab 02 server with ${INVENTORY_API_TOKEN} expansion.

Check progress any time, from labs/04-claude-code-config/:   python check_template.py starter
