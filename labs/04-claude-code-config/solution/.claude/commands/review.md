---
description: Review a file or diff against this repo's standards (bugs and security only)
argument-hint: <path-or-git-range>
allowed-tools: Read, Grep, Glob, Bash(git diff:*), Bash(git log:*)
---
Review `$ARGUMENTS` against the standards in CLAUDE.md and any rules that apply to those files.

If `$ARGUMENTS` looks like a git range (contains `..`), review `git diff $ARGUMENTS`.
Otherwise review the file(s) at that path.

Report ONLY:
- bugs: wrong results, crashes, unhandled None, off-by-one, money computed in float
- security: secrets, injection, unsafe deserialisation, card data in logs

Skip: style the formatter handles, naming preferences, "consider adding a comment".

Format each finding as:
`path:line | severity (high|medium|low) | category | what is wrong | concrete fix`

severity:
- high   = wrong money amount, data loss, or a security hole
- medium = a crash or wrong result on a realistic input
- low    = a correctness problem on an unlikely edge case

If you find nothing, say "No bugs or security issues found." and stop.
