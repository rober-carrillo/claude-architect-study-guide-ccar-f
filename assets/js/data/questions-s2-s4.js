window.QBANK = (window.QBANK || []).concat([
  // ===================== Scenario 2: Code Generation with Claude Code =====================
  {
    id: "s2-01",
    scenario: 2,
    domain: 3,
    task: "3.1",
    type: "single",
    pick: 1,
    stem: "Your monorepo has <code>packages/billing</code>, <code>packages/web</code> and <code>packages/ml</code>, and shared standards files in <code>docs/standards/</code> (<code>security.md</code>, <code>react.md</code>, <code>python-style.md</code>, <code>pci.md</code>). The billing maintainers say only <code>security.md</code> and <code>pci.md</code> matter for their package; the web team needs <code>react.md</code> and <code>security.md</code>. How should each package's Claude Code configuration pull in the right standards?",
    options: [
      "Paste the full text of every standards file into the root CLAUDE.md so that every package always sees the complete set.",
      "In each package's CLAUDE.md, add <code>@import</code>-style references (e.g. <code>@docs/standards/pci.md</code>) to only the files its maintainers chose.",
      "Turn each standards file into a skill in <code>.claude/skills/</code> and ask developers to invoke the relevant ones at the start of each session.",
      "Add a <code>standards</code> array to <code>.claude/settings.json</code> that maps each package directory to the files it should load."
    ],
    answer: [1],
    rationale: [
      "Wrong: every package then carries standards that don't apply to it, wasting context, and the pasted copies drift from the source files in <code>docs/standards/</code>.",
      "Correct: <code>@import</code> keeps CLAUDE.md modular and lets each package's maintainers include exactly the standards files relevant to their domain, with one source of truth for each file.",
      "Wrong: skills load on demand, so standards would only apply when someone remembers to invoke them. Standards that should always apply in a package belong in its memory files.",
      "Wrong: Claude Code has no <code>standards</code> key in settings.json. This is a made-up mechanism."
    ],
    takeaway: "Use @import in each package's CLAUDE.md to pull in just the standards files that package needs."
  },
  {
    id: "s2-02",
    scenario: 2,
    domain: 3,
    task: "3.1",
    type: "single",
    pick: 1,
    stem: "The project's root CLAUDE.md has grown to about 1,100 lines covering testing conventions, API conventions, deployment steps and code style. Engineers complain that they can't find anything in it and that edits to it cause frequent merge conflicts. What's the most maintainable restructuring?",
    options: [
      "Move the content into each developer's <code>~/.claude/CLAUDE.md</code> so their edits no longer collide in one shared file.",
      "Trim the file to its first 200 lines and rely on Claude to infer the remaining conventions from existing code.",
      "Convert each section into a slash command in <code>.claude/commands/</code> so a topic loads only when someone types it.",
      "Split it into focused topic files such as <code>testing.md</code>, <code>api-conventions.md</code> and <code>deployment.md</code> in <code>.claude/rules/</code>."
    ],
    answer: [3],
    rationale: [
      "Wrong: user-level CLAUDE.md is not version-controlled or shared, so the team would lose a single source of truth and new members would get nothing.",
      "Wrong: deleting documented conventions and hoping Claude infers them trades a maintenance problem for inconsistent behaviour.",
      "Wrong: slash commands are user-triggered prompts. Conventions that should always shape Claude's output would stop applying unless someone runs the command.",
      "Correct: <code>.claude/rules/</code> is the intended alternative to a monolithic CLAUDE.md. Topic files are easier to find and own, and edits to one topic don't conflict with another."
    ],
    takeaway: "A bloated CLAUDE.md gets split into topic files under .claude/rules/, not moved to personal config or commands."
  },
  {
    id: "s2-03",
    scenario: 2,
    domain: 3,
    task: "3.1",
    type: "single",
    pick: 1,
    stem: "A developer reports that Claude follows the team rule 'never edit generated files under <code>src/gen/</code>' in some sessions but ignores it in others, and it seems to depend on which directory they start Claude Code from. Before changing any configuration, what is the most useful first step?",
    options: [
      "Run <code>/memory</code> in a session that ignores the rule to see which memory files were actually loaded.",
      "Restate the rule in capital letters at the top of every CLAUDE.md file so it is more prominent everywhere.",
      "Set <code>CLAUDE_MEMORY_DEBUG=1</code> and read the loader trace that Claude Code writes to the project log.",
      "Delete every subdirectory CLAUDE.md so that only the root file can be loaded, whatever the start directory."
    ],
    answer: [0],
    rationale: [
      "Correct: <code>/memory</code> shows which memory files are in effect for that session, which is exactly what you need to diagnose behaviour that varies by session or start location.",
      "Wrong: this changes configuration before you know the cause, and duplicates the rule across files. If the file holding the rule isn't loaded, emphasis won't help.",
      "Wrong: there is no such environment variable or loader trace. This is a made-up debugging mechanism.",
      "Wrong: a destructive change made without diagnosis. Subdirectory CLAUDE.md files may hold legitimate module rules, and the real cause may be elsewhere."
    ],
    takeaway: "When instructions apply inconsistently, run /memory to see which memory files are actually loaded before editing anything."
  },
  {
    id: "s2-04",
    scenario: 2,
    domain: 1,
    task: "1.7",
    type: "single",
    pick: 1,
    stem: "Last week you ran a long Claude Code investigation named <code>payments-audit</code> in which Claude read about 60 files. Since then the team has merged a large refactor that renamed modules and moved roughly half of those files. You now need to continue the audit. What is the most reliable way to proceed?",
    options: [
      "Run <code>--resume payments-audit</code> and continue, since the session already contains the analysis of every relevant file.",
      "Resume <code>payments-audit</code> and ask Claude to re-read all 60 files before answering any further questions about them.",
      "Start a new session and give it a structured summary of the audit's conclusions plus a note describing the refactor.",
      "Resume <code>payments-audit</code> and run <code>/compact</code> first so the outdated tool results are compressed before you continue."
    ],
    answer: [2],
    rationale: [
      "Wrong: the prior tool results describe files and paths that no longer exist. Claude would reason from stale content as if it were current.",
      "Wrong: the stale results stay in context alongside the new ones, so Claude holds two contradictory versions of the same code, and many of the old paths have moved anyway.",
      "Correct: when prior tool results are largely stale, a fresh session seeded with a structured summary of what still matters is more reliable than resuming.",
      "Wrong: compacting summarises stale information rather than removing it. The summary would still describe the pre-refactor code."
    ],
    takeaway: "Resume when prior context is mostly valid; start fresh with a structured summary when the tool results have gone stale."
  },
  {
    id: "s2-05",
    scenario: 2,
    domain: 3,
    task: "3.2",
    type: "single",
    pick: 1,
    stem: "Your team has a <code>/map-dependencies</code> skill that walks the codebase and produces a long dependency report. After running it, developers find the main conversation cluttered with the analysis, and Claude loses track of the task they were working on. What change best addresses this?",
    options: [
      "Add <code>allowed-tools: Read, Grep</code> to the skill's frontmatter so it can only read files while it runs.",
      "Add <code>context: fork</code> to the skill's frontmatter so it runs in an isolated sub-agent context.",
      "Move the skill's instructions into CLAUDE.md so they are always loaded and never need to be re-injected.",
      "Ask developers to run <code>/clear</code> after each use so the report is removed before they carry on."
    ],
    answer: [1],
    rationale: [
      "Wrong: <code>allowed-tools</code> limits what the skill may do, not how much output lands in the main conversation. The report would be just as verbose.",
      "Correct: <code>context: fork</code> runs the skill in an isolated sub-agent, so its verbose exploration stays out of the main session.",
      "Wrong: this makes things worse. The instructions would load in every session, and the report would still be produced in the main conversation.",
      "Wrong: <code>/clear</code> also wipes the task context the developer was relying on, which is the very thing they lost track of."
    ],
    takeaway: "Skills that produce verbose or exploratory output should use context: fork to keep it out of the main session."
  },
  {
    id: "s2-06",
    scenario: 2,
    domain: 3,
    task: "3.2",
    type: "single",
    pick: 1,
    stem: "A project skill, <code>/new-migration</code>, generates a database migration file from a short description. In review, a teammate worries that while it runs the skill could also execute shell commands, such as dropping a local database. How should you constrain it?",
    options: [
      "Add a sentence to SKILL.md asking Claude not to run shell commands while it generates the migration.",
      "Add <code>context: fork</code> so any shell commands the skill runs happen in a separate sub-agent context.",
      "Move the skill to <code>~/.claude/skills/</code> so that only its author can trigger it, limiting exposure.",
      "Set <code>allowed-tools</code> in the skill's frontmatter to only the file read and write tools it needs."
    ],
    answer: [3],
    rationale: [
      "Wrong: a prose request is guidance the model may not follow every time. It doesn't restrict which tools are available.",
      "Wrong: forking isolates context, not capability. A command run in a sub-agent still affects the same machine and database.",
      "Wrong: it removes the skill from the team without restricting what it can do for the person who still runs it.",
      "Correct: <code>allowed-tools</code> in skill frontmatter restricts tool access during skill execution, so the skill can write the migration file but can't reach destructive commands."
    ],
    takeaway: "Use allowed-tools in skill frontmatter to restrict what a skill can do while it runs."
  },
  {
    id: "s2-07",
    scenario: 2,
    domain: 3,
    task: "3.2",
    type: "single",
    pick: 1,
    stem: "Developers often type <code>/scaffold-endpoint</code> with no arguments. Claude then guesses a resource name and HTTP method and generates files nobody wanted. What is the most direct fix in the skill's configuration?",
    options: [
      "Add <code>context: fork</code> so any guessed scaffolding stays in a sub-agent and never reaches the main session.",
      "Add a CLAUDE.md rule telling Claude never to scaffold an endpoint unless a resource name has been supplied.",
      "Add an <code>argument-hint</code> such as <code>[resource] [method]</code> to the frontmatter to prompt for the parameters.",
      "Rename the skill to <code>/scaffold-endpoint-with-args</code> so that developers remember to pass parameters."
    ],
    answer: [2],
    rationale: [
      "Wrong: the files would still be generated from a guess. Forking changes where the work happens, not whether the inputs are right.",
      "Wrong: this adds an always-loaded rule for a problem that belongs to one skill, and it fixes nothing at the moment of invocation.",
      "Correct: <code>argument-hint</code> exists to prompt developers for required parameters when they invoke a skill without them.",
      "Wrong: a longer name relies on memory and doesn't change behaviour when arguments are missing."
    ],
    takeaway: "argument-hint in skill frontmatter prompts for required parameters when a skill is invoked without them."
  },
  {
    id: "s2-08",
    scenario: 2,
    domain: 3,
    task: "3.2",
    type: "single",
    pick: 1,
    stem: "The team's <code>/release-notes</code> skill writes formal, customer-facing release notes. You want a version just for yourself that produces terse internal bullet points, without changing what your teammates get. What should you do?",
    options: [
      "Create a personal skill with a different name, such as <code>release-notes-terse</code>, in <code>~/.claude/skills/</code>.",
      "Edit <code>.claude/skills/release-notes/SKILL.md</code> in your own checkout and simply avoid committing the change.",
      "Create <code>~/.claude/skills/release-notes/</code> with the same name so your personal copy shadows the team's.",
      "Add a personal override section to the project CLAUDE.md that applies only when you run the skill yourself."
    ],
    answer: [0],
    rationale: [
      "Correct: a personal variant under a different name in <code>~/.claude/skills/</code> gives you your own behaviour while the team skill stays untouched.",
      "Wrong: an uncommitted edit is fragile. It gets lost or conflicts on every pull, and it is easy to commit by accident and change the skill for everyone.",
      "Wrong: reusing the team skill's name makes it ambiguous which one runs. The recommended pattern is a personal variant with a different name.",
      "Wrong: the project CLAUDE.md is shared with the whole team, and it has no per-user override mechanism."
    ],
    takeaway: "Customise a team skill for yourself with a differently named personal variant in ~/.claude/skills/."
  },
  {
    id: "s2-09",
    scenario: 2,
    domain: 3,
    task: "3.2",
    type: "single",
    pick: 1,
    stem: "Your team put the rule 'use the shared logger from <code>lib/log</code>; never call <code>console.log</code>' inside a skill named <code>/conventions</code>. Reviewers keep finding <code>console.log</code> calls in code Claude wrote during sessions where nobody invoked the skill. Where should this rule live?",
    options: [
      "In a new slash command in <code>.claude/commands/</code> that developers run before each coding session.",
      "In the project CLAUDE.md, because it is a universal standard that should be loaded in every session.",
      "In the skill's description field, worded more forcefully so that Claude auto-invokes the skill more often.",
      "In each developer's <code>~/.claude/CLAUDE.md</code>, so that every person on the team has it loaded locally."
    ],
    answer: [1],
    rationale: [
      "Wrong: a command is still on-demand. The rule would be missed whenever someone forgets to run it, which is the same failure as now.",
      "Correct: skills are for on-demand, task-specific workflows; CLAUDE.md is for always-loaded universal standards. A project-wide logging rule is a universal standard.",
      "Wrong: this still depends on Claude choosing to load the skill, so it remains probabilistic for a rule that should always apply.",
      "Wrong: user-level files aren't version-controlled, so copies drift and new team members don't get the rule."
    ],
    takeaway: "Universal, always-on standards belong in the project CLAUDE.md; skills are for on-demand workflows."
  },
  {
    id: "s2-10",
    scenario: 2,
    domain: 3,
    task: "3.3",
    type: "single",
    pick: 1,
    stem: "Terraform files live in <code>infra/</code>, in <code>services/*/deploy/</code> and in a few <code>tools/</code> folders. You want Claude to apply the team's tagging and module conventions whenever it edits any <code>.tf</code> file, without loading those conventions while it works on application code. What is the best setup?",
    options: [
      "Put a CLAUDE.md holding the conventions in every directory that currently contains Terraform files.",
      "Put the conventions in the root CLAUDE.md under a 'Terraform' heading so Claude can find them there.",
      "Create a <code>/terraform</code> skill holding the conventions and ask engineers to invoke it before infra work.",
      "Create <code>.claude/rules/terraform.md</code> with <code>paths: [\"**/*.tf\"]</code> frontmatter holding the conventions."
    ],
    answer: [3],
    rationale: [
      "Wrong: directory CLAUDE.md files are bound to their directory, so the conventions get duplicated in many places and any new Terraform folder is missed.",
      "Wrong: root CLAUDE.md is always loaded, so the conventions consume context during application work too, and Claude must infer when they apply.",
      "Wrong: skills depend on someone invoking them, so the conventions won't apply automatically when Claude edits a .tf file.",
      "Correct: a path-scoped rule with a glob loads only when Claude edits matching files, wherever they live, which keeps it out of unrelated work."
    ],
    takeaway: "Conventions for a file type spread across many directories go in a .claude/rules/ file with a paths glob."
  },
  {
    id: "s2-11",
    scenario: 2,
    domain: 3,
    task: "3.3",
    type: "multi",
    pick: 2,
    stem: "A teammate adds <code>.claude/rules/api.md</code> with the frontmatter <code>paths: [\"src/**/handlers/**/*.ts\"]</code> and the team's handler conventions below it. Which TWO statements about this file are accurate? Select TWO.",
    options: [
      "It only takes effect after a developer runs <code>/api</code> to invoke it, like a project slash command.",
      "It must be placed inside <code>src/</code>, next to the handlers, because rule files are bound to their directory.",
      "Its conventions load when Claude works on files matching the glob, and stay out of context otherwise.",
      "It replaces the root CLAUDE.md for matching files, so project-wide instructions stop applying there.",
      "It applies to matching handler files in any service under <code>src/</code>, not only in a single directory."
    ],
    answer: [2, 4],
    rationale: [
      "Wrong: rule files aren't invoked by name. Path-scoped rules activate automatically when matching files are edited.",
      "Wrong: rule files live in <code>.claude/rules/</code>; the <code>paths</code> glob, not the file's location, decides where they apply. Being directory-bound is the limitation of subdirectory CLAUDE.md files.",
      "Correct: path-scoped rules load only when editing matching files, which reduces irrelevant context and token usage.",
      "Wrong: a path-scoped rule adds conventions for matching files; the project CLAUDE.md still loads and applies.",
      "Correct: the <code>**</code> segments match handlers at any depth in any service, which is the advantage of glob rules over directory-level CLAUDE.md."
    ],
    takeaway: "Path-scoped rules load automatically and only for files matching their glob, wherever those files sit."
  },
  {
    id: "s2-12",
    scenario: 2,
    domain: 3,
    task: "3.4",
    type: "single",
    pick: 1,
    stem: "A bug report includes a stack trace pointing to <code>parseInvoiceDate()</code> in a single file: it throws when the date string is empty. The agreed fix is a guard clause that returns <code>null</code> for empty input. How should you approach this in Claude Code?",
    options: [
      "Use direct execution: describe the bug and ask Claude to add the guard clause and a test for the empty case.",
      "Enter plan mode so Claude can explore the invoicing module and propose several alternative designs first.",
      "Launch the Explore subagent to map every caller of the parser before allowing any file to be changed.",
      "Write a design document first and have Claude review it in plan mode before it makes the change itself."
    ],
    answer: [0],
    rationale: [
      "Correct: a single-file fix with a clear stack trace and an agreed solution is a well-scoped change, which is what direct execution is for.",
      "Wrong: plan mode is for large changes, architectural decisions or multiple valid approaches. Here the approach is already agreed, so planning adds overhead.",
      "Wrong: the Explore subagent is for verbose discovery phases. The location and the fix are already known.",
      "Wrong: a design document for a one-line guard clause is disproportionate process for a simple change."
    ],
    takeaway: "Clear, single-file, well-understood fixes go straight to direct execution."
  },
  {
    id: "s2-13",
    scenario: 2,
    domain: 3,
    task: "3.4",
    type: "single",
    pick: 1,
    stem: "You must migrate from an in-house HTTP client to the platform's standard client. A quick search finds about 50 call sites across four services, and some of them rely on different retry and timeout behaviour. Which workflow fits best?",
    options: [
      "Direct execution: ask Claude to replace every call site in one pass, then fix whatever the tests break.",
      "Plan mode throughout: keep Claude in plan mode for the whole migration so no file changes until it's done.",
      "Plan mode to investigate the call sites and agree an approach, then direct execution to carry out the plan.",
      "Direct execution one service at a time, switching to plan mode only if a service turns out to be tricky."
    ],
    answer: [2],
    rationale: [
      "Wrong: the differing retry and timeout semantics mean a one-pass replacement risks subtle behaviour changes and costly rework that tests may not catch.",
      "Wrong: plan mode doesn't edit files, so the migration itself never happens. Planning is the first phase, not the whole job.",
      "Correct: combining plan mode for investigation with direct execution for implementation fits a multi-file migration with decisions to make.",
      "Wrong: the complexity is already known up front (50 sites, varying semantics), so waiting for it to surface mid-implementation invites rework."
    ],
    takeaway: "For large migrations, plan in plan mode, then implement the agreed plan with direct execution."
  },
  {
    id: "s2-14",
    scenario: 2,
    domain: 3,
    task: "3.4",
    type: "single",
    pick: 1,
    stem: "You asked Claude Code to find every place the app reads feature flags and then refactor them to a new flag client. On the first attempt the discovery phase poured hundreds of search hits and file reads into the conversation, and by the refactor phase Claude was losing track of decisions made earlier. What should you change?",
    options: [
      "Ask Claude to print shorter search results, and keep running the whole task in the same main conversation.",
      "Run discovery and the refactor in two unrelated terminal sessions so that each gets a full context window.",
      "Read every file that mentions flags into the session up front so the refactor phase has nothing to look up.",
      "Delegate discovery to the Explore subagent, so only a summary of its findings returns to the session."
    ],
    answer: [3],
    rationale: [
      "Wrong: shorter output helps a little, but the verbose discovery still accumulates in the main context across a multi-phase task.",
      "Wrong: the refactor session would start with none of the discovery findings, so the work would be redone or done blind.",
      "Wrong: loading everything up front makes context exhaustion happen sooner, not later.",
      "Correct: the Explore subagent isolates verbose discovery and returns a summary, preserving the main context for the implementation phase."
    ],
    takeaway: "Use the Explore subagent for verbose discovery so the main conversation keeps room for the actual work."
  },
  {
    id: "s2-15",
    scenario: 2,
    domain: 3,
    task: "3.5",
    type: "single",
    pick: 1,
    stem: "You asked Claude to 'turn our commit messages into changelog entries'. Across runs it sometimes keeps ticket IDs and sometimes drops them, and it capitalises inconsistently. Two rewrites of the prose instruction haven't helped. What is the most effective next step?",
    options: [
      "Give two or three concrete examples, each pairing a raw commit message with the exact entry you expect.",
      "Rewrite the instruction a third time with stronger wording such as 'consistent', 'clean' and 'precise'.",
      "Ask Claude to rate its confidence in each entry and redo any entry that it scores below seven out of ten.",
      "Ask Claude to explain its reasoning before every entry so its decisions become visible and repeatable."
    ],
    answer: [0],
    rationale: [
      "Correct: when prose descriptions are interpreted inconsistently, 2-3 concrete input/output examples are the most effective way to show the expected transformation.",
      "Wrong: two prose rewrites have already failed. More adjectives don't specify what to do with ticket IDs or capitalisation.",
      "Wrong: self-rated confidence isn't calibrated and doesn't tell Claude what the correct format is.",
      "Wrong: visible reasoning doesn't fix an ambiguous specification. Claude can reason clearly towards the wrong format."
    ],
    takeaway: "When prose specs produce inconsistent transformations, show 2-3 concrete input/output examples."
  },
  {
    id: "s2-16",
    scenario: 2,
    domain: 3,
    task: "3.5",
    type: "single",
    pick: 1,
    stem: "You need to add a caching layer in front of a pricing service, an area you have never worked in, and you aren't sure what could go wrong. Before Claude writes any code, which technique best surfaces design considerations you might not have anticipated?",
    options: [
      "Ask Claude to implement a first version straight away, then review the diff to see what it decided.",
      "Ask Claude to interview you first, with questions on invalidation, staleness and failure behaviour.",
      "Paste a generic caching tutorial into the conversation so that Claude follows widely accepted practice.",
      "Switch to plan mode and ask for the shortest possible plan so that you can approve it as fast as possible."
    ],
    answer: [1],
    rationale: [
      "Wrong: implementation-first bakes in decisions you didn't know you were making, and in an unfamiliar domain you may not spot them in a diff.",
      "Correct: the interview pattern has Claude ask questions that surface considerations such as cache invalidation and failure modes before anything is built.",
      "Wrong: generic guidance doesn't reflect the specifics of this pricing service, and Claude already knows general caching practice.",
      "Wrong: asking for the shortest plan suppresses the exploration of trade-offs you need in an unfamiliar area."
    ],
    takeaway: "In an unfamiliar domain, use the interview pattern so Claude surfaces design questions before implementing."
  },
  {
    id: "s2-17",
    scenario: 2,
    domain: 3,
    task: "3.5",
    type: "single",
    pick: 1,
    stem: "After a refactor, Claude's new <code>scheduleReminder()</code> has two bugs: it converts times to UTC twice, and its daylight-saving adjustment assumes local time. Fixing either bug changes what the other fix needs to do. How should you give Claude this feedback?",
    options: [
      "Report the double conversion first, wait for that fix, then report the daylight-saving issue afterwards.",
      "Open two separate sessions, one per bug, so each fix is made with an uncluttered context window.",
      "Describe both bugs together in one detailed message, explain how they interact, and give expected outputs.",
      "Ask Claude to rewrite the function from scratch without naming either bug, to avoid biasing its approach."
    ],
    answer: [2],
    rationale: [
      "Wrong: sequential feedback suits independent issues. Here the first fix would be made without knowing how it must fit the second, likely causing churn.",
      "Wrong: two sessions would each fix one bug in isolation, producing fixes that conflict when combined.",
      "Correct: when issues interact, address them in a single detailed message so the fixes are designed together.",
      "Wrong: withholding known bugs throws away information, and a rewrite can easily reproduce the same mistakes."
    ],
    takeaway: "Interacting issues go in one detailed message; independent issues can be fixed one at a time."
  },
  {
    id: "s2-18",
    scenario: 2,
    domain: 3,
    task: "3.5",
    type: "single",
    pick: 1,
    stem: "Claude is writing a script that migrates customer records to a new schema. Your earlier feedback ('handle missing data properly') produced fixes that broke other cases, and records with a null phone number or an empty address array still fail. What is the most effective approach now?",
    options: [
      "Ask Claude to wrap every field mapping in try/catch so that bad records are skipped instead of failing.",
      "Repeat the feedback more firmly and ask Claude to think carefully about every possible missing-data case.",
      "Ask Claude to log each failing record to the console so you can read through them in the next session.",
      "Write tests with example inputs (null phone, empty addresses) and expected outputs, then share failures."
    ],
    answer: [3],
    rationale: [
      "Wrong: skipping records silently loses customer data and hides the edge cases rather than handling them.",
      "Wrong: vague feedback is what caused the regressions. Restating it doesn't say what the correct output is.",
      "Wrong: logging gathers evidence but gives Claude no definition of correct behaviour to iterate against.",
      "Correct: specific test cases with example input and expected output pin down the edge cases, and sharing test failures drives progressive improvement without regressions."
    ],
    takeaway: "Pin edge cases down with tests (example input and expected output), then iterate by sharing failures."
  },
  {
    id: "s2-19",
    scenario: 2,
    domain: 5,
    task: "5.4",
    type: "multi",
    pick: 2,
    stem: "Three hours into exploring a large codebase in one Claude Code session, Claude starts saying things like 'services here typically use a repository pattern' instead of naming the <code>OrderRepository</code> and <code>LedgerGateway</code> classes it found earlier, and some answers contradict earlier ones. Which TWO actions best address this? Select TWO.",
    options: [
      "Ask Claude to re-read the entire codebase so that all the earlier details are back in its context.",
      "Have Claude keep a scratchpad file of key findings (class names, flows) and consult it for later questions.",
      "Tell Claude to stop generalising and answer only from its memory of the specific classes it found.",
      "Run <code>/compact</code> to reduce the context taken up by verbose discovery output, then continue.",
      "Switch to a model with a larger context window so that the session never needs to be reduced."
    ],
    answer: [1, 3],
    rationale: [
      "Wrong: re-reading everything floods the context again and accelerates the very degradation you're seeing.",
      "Correct: scratchpad files persist key findings across context boundaries, and referring back to them counters context degradation.",
      "Wrong: the details have degraded in context. An instruction can't restore information the model is no longer tracking reliably.",
      "Correct: <code>/compact</code> reduces context usage when an extended exploration session has filled up with verbose discovery output.",
      "Wrong: a bigger window delays the problem but doesn't fix attention over a long, noisy history. Degradation is a context-management problem, not just a size limit."
    ],
    takeaway: "Context degradation ('typical patterns' instead of specifics) calls for scratchpad files and /compact, not more reading."
  },
  {
    id: "s2-20",
    scenario: 2,
    domain: 1,
    task: "1.7",
    type: "single",
    pick: 1,
    stem: "Yesterday you named a Claude Code session <code>rate-limiter</code> while Claude analysed your middleware. This morning you edited only <code>middleware/limiter.ts</code> and <code>config/limits.yaml</code>; everything else is unchanged, and the earlier analysis is still largely valid. How should you continue?",
    options: [
      "Start a fresh session and have Claude explore the whole middleware directory again from the beginning.",
      "Run <code>--resume rate-limiter</code> and tell Claude exactly which two files changed so it re-analyses them.",
      "Run <code>--resume rate-limiter</code> and carry on; Claude will notice the edited files the next time it looks.",
      "Run <code>--resume rate-limiter</code> and paste in the full git log since yesterday so it can work out the rest."
    ],
    answer: [1],
    rationale: [
      "Wrong: the prior context is mostly valid, so discarding it and re-exploring everything wastes the work already done.",
      "Correct: resume the named session and inform it of the specific file changes, so it does targeted re-analysis rather than a full re-exploration.",
      "Wrong: Claude will keep reasoning from its earlier reads of those two files, which are now stale, unless told they changed.",
      "Wrong: a whole git log is noisy and indirect; you already know exactly which two files changed and can say so."
    ],
    takeaway: "Resuming a named session after edits: tell Claude which specific files changed so it re-analyses just those."
  },

  // ===================== Scenario 4: Developer Productivity with Claude =====================
  {
    id: "s4-01",
    scenario: 4,
    domain: 2,
    task: "2.5",
    type: "single",
    pick: 1,
    stem: "An engineer asks your productivity agent, 'Where is <code>applyLateFee()</code> called?', in a TypeScript repository the agent has never seen. Which built-in tool should the agent use first?",
    options: [
      "Grep, searching file contents for the pattern <code>applyLateFee(</code> across the repository.",
      "Glob, matching the pattern <code>**/*applyLateFee*</code> to find files related to the function.",
      "Read, opening each file under <code>src/</code> in turn and checking it for calls to the function.",
      "Bash, running the test suite and reading stack traces to find which files invoke the function."
    ],
    answer: [0],
    rationale: [
      "Correct: finding callers means searching file contents for a pattern, which is exactly what Grep is for.",
      "Wrong: Glob matches file paths, not contents. Callers rarely have the function's name in their file names.",
      "Wrong: reading every file is slow, burns context, and is what Grep exists to avoid.",
      "Wrong: tests only exercise some call paths, and stack traces don't list all callers. It's indirect and incomplete."
    ],
    takeaway: "Finding callers, error strings or imports is a content search: use Grep."
  },
  {
    id: "s4-02",
    scenario: 4,
    domain: 2,
    task: "2.5",
    type: "single",
    pick: 1,
    stem: "Before generating boilerplate for a new Storybook story, the agent needs a list of every existing story file (named like <code>Button.stories.tsx</code>), wherever it sits in the repository. Which tool call fits best?",
    options: [
      "Grep for the text <code>stories</code> across all files and collect every file path that it returns.",
      "Read the root <code>package.json</code> and follow its Storybook configuration to each story folder.",
      "Glob with the pattern <code>**/*.stories.tsx</code> to list matching file paths across the repo.",
      "Bash running <code>cat</code> on every .tsx file and filtering the output for Storybook exports."
    ],
    answer: [2],
    rationale: [
      "Wrong: a content search for 'stories' matches imports, comments and config files too, and it is the wrong tool for a file-name pattern.",
      "Wrong: indirect and fragile; configuration may not enumerate every story location, and it costs several reads to get a list Glob returns directly.",
      "Correct: finding files by naming pattern is what Glob does, and <code>**</code> covers every directory.",
      "Wrong: dumping every file's content to find files by name wastes context and time."
    ],
    takeaway: "Finding files by name or extension pattern (e.g. **/*.stories.tsx) is a job for Glob."
  },
  {
    id: "s4-03",
    scenario: 4,
    domain: 2,
    task: "2.5",
    type: "single",
    pick: 1,
    stem: "The agent must change the timeout in only the third of five identical <code>retry:</code> blocks in a generated YAML file. Its Edit call fails because the anchor text it supplied matches several locations, and the blocks have no distinguishing text. What is the reliable way to complete the change?",
    options: [
      "Re-run Edit with <code>replace_all</code> enabled so the ambiguous match no longer blocks the change.",
      "Read the full file, change the intended block in that content, and Write the complete file back.",
      "Use Grep with a replacement pattern so that only the third occurrence of the text gets rewritten.",
      "Write a new file containing only the corrected block, so the change is isolated from the other four."
    ],
    answer: [1],
    rationale: [
      "Wrong: <code>replace_all</code> changes all five blocks, which is not what was asked.",
      "Correct: when Edit can't find unique anchor text, Read followed by Write is the reliable fallback for a targeted modification.",
      "Wrong: Grep searches content; it doesn't modify files.",
      "Wrong: Write replaces the whole file, so writing only one block would delete the rest of the file."
    ],
    takeaway: "Edit needs a unique anchor; when there isn't one, fall back to Read + Write."
  },
  {
    id: "s4-04",
    scenario: 4,
    domain: 2,
    task: "2.5",
    type: "single",
    pick: 1,
    stem: "A new engineer asks the agent to explain how an HTTP request flows through a 1,200-file legacy Java service. The current prompt tells the agent to Read every file under <code>src/</code> before answering, and it runs out of context long before it reaches the request handlers. What is the better strategy?",
    options: [
      "Keep reading every file, but have the agent summarise each one in a sentence and keep only the summaries.",
      "Glob all the .java files and Read them in alphabetical order until the context is about half full.",
      "Move to a model with a larger context window so the whole service fits in a single conversation.",
      "Grep for entry points such as route annotations, then Read along their imports to trace the flow."
    ],
    answer: [3],
    rationale: [
      "Wrong: it still reads 1,200 files, most irrelevant to the question, and one-line summaries lose the details needed to trace a flow.",
      "Wrong: alphabetical order has nothing to do with the request path, so the context fills with unrelated files.",
      "Wrong: a bigger window postpones the failure but still front-loads irrelevant content and dilutes attention.",
      "Correct: build understanding incrementally: Grep finds the entry points, then Read follows imports to trace the flow, instead of reading everything upfront."
    ],
    takeaway: "Explore incrementally: Grep for entry points, then Read along imports. Never read the whole codebase upfront."
  },
  {
    id: "s4-05",
    scenario: 4,
    domain: 2,
    task: "2.5",
    type: "single",
    pick: 1,
    stem: "The agent is asked to find every use of the legacy <code>db.query()</code> before it is removed. Grep finds only 6 direct calls, but the team knows usage is much wider. It turns out <code>lib/dbx.ts</code> wraps it and exports helpers named <code>q</code>, <code>queryOne</code> and <code>runTx</code>. What should the agent do next?",
    options: [
      "List every name that <code>lib/dbx.ts</code> exports, then Grep the codebase for each exported name.",
      "Report the 6 direct calls as the complete list, since the wrapper is just one more caller among them.",
      "Glob for files whose names contain <code>db</code> and Read each one, looking for database access.",
      "Grep for the bare string <code>query</code> across the repo and treat every match as a db.query() use."
    ],
    answer: [0],
    rationale: [
      "Correct: tracing usage through a wrapper means identifying all its exported names first, then searching for each across the codebase.",
      "Wrong: every caller of <code>q</code>, <code>queryOne</code> and <code>runTx</code> indirectly depends on <code>db.query()</code>, so the 6 calls badly understate the impact.",
      "Wrong: file names don't reveal who imports the wrapper's helpers, so this misses most call sites.",
      "Wrong: too broad (matches unrelated words, variables and comments) yet still misses <code>q</code> and <code>runTx</code>."
    ],
    takeaway: "To trace usage through a wrapper module, find all its exported names, then Grep for each one."
  },
  {
    id: "s4-06",
    scenario: 4,
    domain: 2,
    task: "2.4",
    type: "single",
    pick: 1,
    stem: "Your team wants every engineer's Claude Code sessions to use the same GitHub MCP server. The server needs a personal access token, and the configuration will be committed to the repository. How should it be configured?",
    options: [
      "Add it to each engineer's <code>~/.claude.json</code>, with each person's own token written into the file.",
      "Add it to <code>.mcp.json</code> with a token pasted in, and restrict who can read the repository.",
      "Add it to <code>.mcp.json</code> and reference the token as <code>${GITHUB_TOKEN}</code> from each person's environment.",
      "Add it to <code>.mcp.json</code> and set <code>CLAUDE_MCP_SECRETS</code> to point at an encrypted token file."
    ],
    answer: [2],
    rationale: [
      "Wrong: user-level config isn't shared, so each person must set the server up by hand and the copies drift. Shared tooling belongs in project scope.",
      "Wrong: committing a secret exposes it in git history to anyone with repository access, now or later.",
      "Correct: project-scoped <code>.mcp.json</code> shares the server with the team, and environment variable expansion keeps the token out of version control.",
      "Wrong: there is no such variable; this is a made-up secret mechanism."
    ],
    takeaway: "Shared MCP servers go in .mcp.json, with credentials supplied through ${ENV_VAR} expansion."
  },
  {
    id: "s4-07",
    scenario: 4,
    domain: 2,
    task: "2.4",
    type: "single",
    pick: 1,
    stem: "You want to try a community MCP server that queries your personal notes app. Nobody else on the team will use it, and you may remove it next week. Where should you configure it?",
    options: [
      "In the project's <code>.mcp.json</code>, with a note in the README saying it is experimental and personal.",
      "In your user-level <code>~/.claude.json</code>, so it is available to you without touching shared config.",
      "In the project CLAUDE.md, describing the server's start command so that Claude can launch it on demand.",
      "In a new <code>.claude/mcp-personal.json</code> file in the repo that you add to <code>.gitignore</code>."
    ],
    answer: [1],
    rationale: [
      "Wrong: project scope is for shared team tooling. Teammates would be offered a server that depends on your personal app.",
      "Correct: user-scoped <code>~/.claude.json</code> is the place for personal or experimental servers.",
      "Wrong: CLAUDE.md holds instructions, not MCP server configuration, so Claude Code won't connect to a server described there.",
      "Wrong: Claude Code doesn't read a file by that name; it's a made-up configuration location."
    ],
    takeaway: "Personal or experimental MCP servers go in ~/.claude.json; shared ones go in .mcp.json."
  },
  {
    id: "s4-08",
    scenario: 4,
    domain: 2,
    task: "2.4",
    type: "single",
    pick: 1,
    stem: "You added an internal MCP tool, <code>code_search</code>, backed by an index that understands symbols, call graphs and cross-repository references. Its description reads 'Searches code.' Logs show the agent still uses Grep for nearly every lookup and misses callers in other repositories. What is the most effective first fix?",
    options: [
      "Remove Grep from the agent's tools so that it has no choice except to call <code>code_search</code> instead.",
      "Add a system prompt line: 'Prefer MCP tools over built-in tools whenever both of them could apply.'",
      "Rename the tool <code>grep_plus</code> so the agent associates it with the built-in search it already uses.",
      "Expand its description to explain the symbol, call-graph and cross-repo search and what it returns."
    ],
    answer: [3],
    rationale: [
      "Wrong: Grep is still the right tool for plain text such as error messages and config values, so removing it trades one blind spot for another.",
      "Wrong: a blanket preference rule doesn't tell the agent what the tool can do, and it would push MCP tools even where Grep is the better fit.",
      "Wrong: a name implying 'like Grep' says nothing about call graphs or cross-repo results, and may blur the boundary further.",
      "Correct: tool descriptions drive selection. Detailing the capabilities and outputs is what stops the agent preferring built-in Grep over the more capable MCP tool."
    ],
    takeaway: "If the agent ignores a more capable MCP tool in favour of Grep, improve that tool's description first."
  },
  {
    id: "s4-09",
    scenario: 4,
    domain: 2,
    task: "2.4",
    type: "single",
    pick: 1,
    stem: "Your agent needs to read and update Jira issues, and also trigger your team's bespoke deploy-approval workflow, which lives in an internal service. How should you source these MCP integrations?",
    options: [
      "Use an existing community Jira MCP server, and build a custom server only for the deploy-approval workflow.",
      "Build custom MCP servers for both, so that every integration shares one codebase and one description style.",
      "Use the Jira server for both by modelling deploy approvals as custom Jira fields and workflow states.",
      "Skip MCP and give the agent Bash with curl so it can call the Jira and deploy-approval APIs directly."
    ],
    answer: [0],
    rationale: [
      "Correct: prefer existing community servers for standard integrations like Jira, and reserve custom servers for team-specific workflows.",
      "Wrong: rebuilding a standard integration costs effort to build and maintain for no gain over an existing server.",
      "Wrong: it bends the workflow to fit the tool, and the approval logic in your internal service still has no integration.",
      "Wrong: raw curl through Bash gives the agent no tool descriptions or contracts, and spreads credentials and API details into prompts."
    ],
    takeaway: "Use community MCP servers for standard integrations; build custom ones only for team-specific workflows."
  },
  {
    id: "s4-10",
    scenario: 4,
    domain: 2,
    task: "2.4",
    type: "single",
    pick: 1,
    stem: "Engineers ask the agent questions such as 'which table stores invoice adjustments?'. Logs show it makes 15-20 exploratory calls (<code>list_schemas</code>, then <code>describe_table</code> on guesses) before finding the answer. The schema catalog changes rarely. What is the best improvement to your MCP server?",
    options: [
      "Raise the agent's tool-call limit so that it can keep exploring until it reaches the right table.",
      "Add a single tool that runs <code>SELECT *</code> on every table and returns all the results at once.",
      "Expose the schema catalog as an MCP resource so the agent can see what exists without probing.",
      "Hard-code a list of which table holds which data into the system prompt as few-shot examples."
    ],
    answer: [2],
    rationale: [
      "Wrong: it allows more wasted exploration instead of removing the need for it.",
      "Wrong: dumps huge amounts of row data into context and may expose sensitive data, when only the catalog is needed.",
      "Correct: MCP resources expose content catalogs such as database schemas, giving the agent visibility into what exists without exploratory tool calls.",
      "Wrong: a hand-maintained list in the prompt goes stale, isn't tied to the source of truth, and costs tokens on every request."
    ],
    takeaway: "When an agent keeps probing to learn what exists, expose the catalog as an MCP resource."
  },
  {
    id: "s4-11",
    scenario: 4,
    domain: 2,
    task: "2.4",
    type: "multi",
    pick: 2,
    stem: "Your repository's <code>.mcp.json</code> defines a <code>jira</code> server with the header <code>\"Authorization\": \"Bearer ${JIRA_TOKEN}\"</code>, and you have added a personal <code>postgres</code> server in <code>~/.claude.json</code>. Which TWO statements are accurate? Select TWO.",
    options: [
      "You must restart Claude Code with a flag to switch between the jira tools and the postgres tools.",
      "Tools from both servers are discovered at connection time and are available to the agent at once.",
      "The user-scoped postgres server hides the project's jira server, because user scope takes priority.",
      "Each developer supplies <code>JIRA_TOKEN</code> from their own environment, so the token is never committed.",
      "Teammates who pull the repository also get your postgres server, because the two files are merged."
    ],
    answer: [1, 3],
    rationale: [
      "Wrong: there is no switching; servers from every configured scope connect together.",
      "Correct: tools from all configured MCP servers are discovered at connection time and available simultaneously.",
      "Wrong: scopes add servers rather than hiding others; with different names, both servers are active.",
      "Correct: environment variable expansion in <code>.mcp.json</code> lets credentials come from each person's environment instead of the committed file.",
      "Wrong: <code>~/.claude.json</code> lives in your home directory and isn't in the repository, so teammates never receive it."
    ],
    takeaway: "Project and user MCP servers are all available at once; ${VAR} expansion keeps secrets out of .mcp.json."
  },
  {
    id: "s4-12",
    scenario: 4,
    domain: 2,
    task: "2.1",
    type: "single",
    pick: 1,
    stem: "Your MCP server exposes a single tool, <code>analyze_repo(path, mode)</code>, where <code>mode</code> is a free-text string that switches between listing entry points, tracing dependencies and summarising a module. The agent often passes the wrong mode or invents new ones. What is the best redesign?",
    options: [
      "Keep the tool, and add a long paragraph to the system prompt that lists every valid mode string.",
      "Split it into purpose-specific tools: <code>list_entry_points</code>, <code>trace_dependencies</code>, <code>summarize_module</code>.",
      "Keep the tool, and accept any mode string by mapping unknown values to the closest mode on the server.",
      "Merge it with the built-in Grep tool so that one tool can answer every kind of codebase question."
    ],
    answer: [1],
    rationale: [
      "Wrong: it leaves the overloaded interface in place and relies on the prompt to compensate for an unclear tool contract.",
      "Correct: splitting a generic tool into purpose-specific tools, each with a defined input/output contract and clear description, removes the mode-guessing entirely.",
      "Wrong: silently guessing hides the agent's mistakes and returns results it didn't actually ask for.",
      "Wrong: you can't merge an MCP tool into a built-in, and a single catch-all tool makes the selection problem worse."
    ],
    takeaway: "Split generic, mode-switching tools into purpose-specific tools with clear contracts."
  },
  {
    id: "s4-13",
    scenario: 4,
    domain: 2,
    task: "2.1",
    type: "single",
    pick: 1,
    stem: "Your agent has a well-described MCP tool, <code>find_owner</code>, that returns the owning team for any file path. Yet when engineers ask 'who owns the billing search code?', the agent runs Grep and guesses from comments. The system prompt contains: 'When the user mentions search or finding code, start with Grep.' What is the most likely cause, and the fix?",
    options: [
      "find_owner's description is still too short; extend it with more example queries and sample outputs.",
      "The agent has too many tools; remove find_owner and let Grep answer the ownership questions instead.",
      "The model lacks examples; add a dozen few-shot ownership questions and answers to the system prompt.",
      "The keyword rule in the prompt overrides the tool description; reword it to cover text search only."
    ],
    answer: [3],
    rationale: [
      "Wrong: the description is already good. The prompt's keyword rule fires on 'search' and wins regardless of description quality.",
      "Wrong: it removes the one tool that answers the question correctly.",
      "Wrong: adds tokens to work around a conflicting instruction instead of removing the conflict.",
      "Correct: keyword-sensitive system prompt wording can create unintended tool associations that override well-written tool descriptions, so review and fix the prompt."
    ],
    takeaway: "Check the system prompt for keyword rules (e.g. 'search' means Grep) that override good tool descriptions."
  },
  {
    id: "s4-14",
    scenario: 4,
    domain: 1,
    task: "1.6",
    type: "single",
    pick: 1,
    stem: "An engineer asks the agent to 'add comprehensive tests to our legacy billing monolith': about 300 modules at 4% coverage. Which decomposition strategy is most effective?",
    options: [
      "Map the structure, find high-impact areas, then follow a prioritised plan that adapts as you learn more.",
      "Generate tests for every module in alphabetical order, so that coverage rises evenly across the codebase.",
      "Fix a pipeline up front with one subagent per module, each writing tests independently and in parallel.",
      "Start with the smallest modules, because they are the quickest to test and lift the coverage number fastest."
    ],
    answer: [0],
    rationale: [
      "Correct: open-ended tasks like this are decomposed by mapping structure, identifying high-impact areas, and creating a prioritised plan that adapts as dependencies are discovered.",
      "Wrong: alphabetical order ignores risk and impact, so effort goes to trivial modules while critical paths stay untested.",
      "Wrong: a fixed per-module split can't adapt to shared dependencies and fixtures discovered along the way, and ignores priority.",
      "Wrong: optimises the coverage metric rather than risk reduction; the small modules are rarely where legacy bugs hide."
    ],
    takeaway: "Open-ended work: map the structure, find high-impact areas, then follow a prioritised plan that adapts."
  },
  {
    id: "s4-15",
    scenario: 4,
    domain: 1,
    task: "1.6",
    type: "single",
    pick: 1,
    stem: "The agent has two jobs: (1) for each of 40 new API endpoints, generate a handler, a validator and a test from the team template; (2) find out why a nightly legacy reconciliation job silently drops some records. Which decomposition fits each job?",
    options: [
      "Adaptive decomposition for both, since each one involves many files and some degree of uncertainty.",
      "A fixed sequential pipeline for both, so that every run is predictable and easy to audit afterwards.",
      "Fixed prompt chaining for the endpoints, and adaptive investigation for the reconciliation bug.",
      "Adaptive decomposition for the endpoints, and a fixed pipeline for the reconciliation investigation."
    ],
    answer: [2],
    rationale: [
      "Wrong: the endpoint work is predictable and repetitive; adaptive planning adds overhead and variability where a fixed sequence works.",
      "Wrong: a root-cause investigation can't be scripted in advance; each finding determines the next step.",
      "Correct: prompt chaining suits predictable, repeatable multi-step work, while open-ended investigation needs subtasks generated from what each step uncovers.",
      "Wrong: this is exactly backwards, pairing each job with the pattern suited to the other."
    ],
    takeaway: "Predictable repeated work: fixed prompt chaining. Open-ended investigation: adaptive decomposition."
  },
  {
    id: "s4-16",
    scenario: 4,
    domain: 5,
    task: "5.4",
    type: "single",
    pick: 1,
    stem: "Your productivity agent answers architecture questions about a large monorepo. In long sessions its context fills with raw file contents from sub-questions such as 'find all test files' and 'trace the refund flow's dependencies', and the quality of its high-level answers declines. What design best fixes this?",
    options: [
      "Let the main agent keep doing all the exploration itself, but cap each Read at 200 lines to save tokens.",
      "Have the main agent spawn subagents for those specific questions and receive only their findings.",
      "Clear the main agent's history after every question so that each answer starts from an empty context.",
      "Give the main agent a larger <code>max_tokens</code> value so it can write fuller answers despite the context."
    ],
    answer: [1],
    rationale: [
      "Wrong: truncated reads can hide the very lines needed, and the exploration still accumulates in the coordinating context.",
      "Correct: delegating specific investigations to subagents isolates verbose exploration, while the main agent keeps the high-level understanding.",
      "Wrong: it also throws away the high-level understanding the agent has built, so every answer starts from nothing.",
      "Wrong: <code>max_tokens</code> limits output length; it does nothing about the input context filling with raw exploration."
    ],
    takeaway: "Delegate verbose sub-investigations to subagents; the main agent keeps the high-level picture."
  },
  {
    id: "s4-17",
    scenario: 4,
    domain: 5,
    task: "5.4",
    type: "single",
    pick: 1,
    stem: "Your agent runs a multi-hour audit of a legacy codebase with a coordinator and four subagents. When the process crashed in hour three, the restart began from zero, because all progress lived only in conversation context. How should you design for recovery?",
    options: [
      "Resume only the coordinator's session, since subagents inherit its history and will pick up where they were.",
      "Increase the host's timeout and memory limits so that long audits become much less likely to crash.",
      "Have the coordinator re-run every subagent from scratch, but in parallel, so that restarts are faster.",
      "Have each agent export its state to a known location, and the coordinator load a manifest on resume."
    ],
    answer: [3],
    rationale: [
      "Wrong: subagents don't inherit the coordinator's history; their progress would still be lost.",
      "Wrong: makes crashes rarer but does nothing to recover when one still happens.",
      "Wrong: still discards all completed work; it only makes the redo faster.",
      "Correct: structured state persistence, with each agent exporting state to a known location and the coordinator loading a manifest and injecting it into prompts, enables crash recovery."
    ],
    takeaway: "For crash recovery, agents export state to a known location and the coordinator resumes from a manifest."
  },
  {
    id: "s4-18",
    scenario: 4,
    domain: 1,
    task: "1.7",
    type: "single",
    pick: 1,
    stem: "After the agent has spent an hour analysing a legacy payments module, the team wants to compare two testing strategies: characterisation tests around current behaviour, versus refactoring first and unit-testing the new seams. Both should start from the same analysis. What is the best approach?",
    options: [
      "Try both strategies one after the other in the same session, so the second can learn from the first.",
      "Start two new sessions and have each one repeat the hour-long analysis before trying its strategy.",
      "Use <code>fork_session</code> to branch two independent sessions from the shared analysis, one per strategy.",
      "Run <code>/compact</code> on the analysis session, then alternate between both strategies inside it."
    ],
    answer: [2],
    rationale: [
      "Wrong: the second attempt is contaminated by the first one's edits and reasoning, so the comparison isn't independent.",
      "Wrong: wastes the hour of analysis twice, and the two analyses may diverge, which undermines the comparison.",
      "Correct: <code>fork_session</code> creates independent branches from a shared analysis baseline, for exploring divergent approaches.",
      "Wrong: compaction reduces context but doesn't separate the two strategies; they would still interfere in one session."
    ],
    takeaway: "To compare two approaches from the same analysis, fork the session rather than redoing or interleaving."
  },
  {
    id: "s4-19",
    scenario: 4,
    domain: 5,
    task: "5.4",
    type: "single",
    pick: 1,
    stem: "In phase 1 of a legacy migration, subagents inventoried every module that uses the old ORM. In phase 2 the coordinator will spawn new subagents to rewrite those modules. What should the coordinator give the phase-2 subagents?",
    options: [
      "A concise summary of the key phase-1 findings, such as the module list and gotchas, in each initial prompt.",
      "Nothing extra, because phase-2 subagents automatically inherit the coordinator's context and phase-1 results.",
      "The full raw transcripts of every phase-1 subagent, so that no detail of the inventory can possibly be lost.",
      "Only the task instruction, so that each phase-2 subagent re-runs the inventory to confirm it is still correct."
    ],
    answer: [0],
    rationale: [
      "Correct: summarise key findings from one phase before spawning the next phase's subagents, and inject the summary into their initial context.",
      "Wrong: subagents don't inherit the coordinator's context automatically; anything they need must be passed explicitly.",
      "Wrong: raw transcripts flood each subagent's context with verbose exploration it doesn't need.",
      "Wrong: repeats completed work in every subagent and risks inconsistent inventories."
    ],
    takeaway: "Between phases, summarise key findings and inject them into the next subagents' initial prompts."
  },
  {
    id: "s4-20",
    scenario: 4,
    domain: 2,
    task: "2.3",
    type: "multi",
    pick: 2,
    stem: "The boilerplate-generation subagent was given every tool in the system: Read, Write, Edit, Bash, Grep, Glob, plus 14 Jira tools and 6 CI tools. It sometimes comments on Jira tickets or re-runs CI jobs instead of writing code, and its tool choices are generally less reliable. Which TWO changes best address this? Select TWO.",
    options: [
      "Add a system prompt paragraph asking it to avoid the Jira and CI tools unless clearly necessary.",
      "Restrict its tools to those its role needs, such as Read, Write, Edit, Glob and Grep.",
      "Give it the remaining tools from the other agents too, so it never lacks a tool it might need later.",
      "Set <code>tool_choice: \"any\"</code> so that the model must call one of its tools on every turn.",
      "Replace raw Bash with a constrained <code>run_generator</code> tool that only runs approved scaffolding scripts."
    ],
    answer: [1, 4],
    rationale: [
      "Wrong: prompt guidance is probabilistic and leaves 26 tools competing for selection, so the reliability problem remains.",
      "Correct: scoping each agent's tools to its role prevents cross-specialisation misuse and improves selection reliability; too many tools degrade it.",
      "Wrong: more tools increase decision complexity and make misselection more likely.",
      "Wrong: forcing a tool call doesn't change which tools are available, so it may push it to use a Jira or CI tool.",
      "Correct: replacing a generic tool with a constrained alternative keeps the capability the role needs while removing the room for misuse."
    ],
    takeaway: "Give each agent only the tools its role needs, and swap generic tools for constrained ones."
  }
]);
