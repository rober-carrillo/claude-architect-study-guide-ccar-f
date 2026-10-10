// Practice questions for Scenario 5 (Claude Code for Continuous Integration)
// and Scenario 6 (Structured Data Extraction). Written for this study guide; not real exam items.
window.QBANK = (window.QBANK || []).concat([
  // ---------------------------------------------------------------- Scenario 5
  {
    id: "s5-01",
    scenario: 5,
    domain: 3,
    task: "3.6",
    type: "single",
    pick: 1,
    stem: "Your nightly test-generation job runs <code>claude \"Write unit tests for src/billing/\"</code> in a GitHub Actions step. It works when an engineer runs it in a terminal, but in CI the step prints nothing and is killed at the 6-hour job timeout. What change makes the job run correctly unattended?",
    options: [
      "Set <code>CLAUDE_NONINTERACTIVE=1</code> in the step's environment before the command runs",
      "Pipe <code>yes</code> into the command so any prompt Claude Code shows is answered automatically",
      "Invoke it as <code>claude -p \"Write unit tests for src/billing/\"</code> so it runs once, prints and exits",
      "Add <code>--headless</code> to the command so Claude Code skips its interactive session and exits when done"
    ],
    answer: [2],
    rationale: [
      "There is no <code>CLAUDE_NONINTERACTIVE</code> environment variable; setting it changes nothing, and the job still waits for input.",
      "Piping <code>yes</code> is a Unix workaround that does not switch Claude Code out of interactive mode; the session still expects a conversation rather than a single scripted run.",
      "Correct. <code>-p</code> (<code>--print</code>) is the documented non-interactive mode: it processes the prompt, writes the result to stdout and exits, which is what a CI step needs.",
      "<code>--headless</code> is not a Claude Code flag. The documented way to run without interaction is <code>-p</code>."
    ],
    takeaway: "Any unattended Claude Code run in CI uses -p / --print; invented flags and env vars don't exist."
  },
  {
    id: "s5-02",
    scenario: 5,
    domain: 3,
    task: "3.6",
    type: "single",
    pick: 1,
    stem: "Your review step runs <code>claude -p</code>, and a Python script scrapes its prose answer with regular expressions to find the file, line and message for inline PR comments. Every few days the script silently posts nothing because Claude phrased a finding differently (\"In <code>auth.ts</code>, around line 40, …\"). What is the most reliable fix?",
    options: [
      "Add a CLAUDE.md rule telling Claude to always phrase findings exactly as \"file:line - message\"",
      "Run with <code>--output-format json</code> and <code>--json-schema</code> describing the findings, and parse that",
      "Make the regular expressions more permissive and post the whole answer as one comment on failure",
      "Pipe the prose answer into a second <code>claude -p</code> call that rewrites it into the comment format"
    ],
    answer: [1],
    rationale: [
      "A phrasing rule makes the format more likely, not guaranteed. The scraper still breaks the first time Claude deviates.",
      "Correct. <code>--output-format json</code> with <code>--json-schema</code> yields machine-parseable findings that match a defined structure, which a script can turn into inline comments without scraping prose.",
      "Looser regexes trade missed comments for mis-parsed ones, and the fallback produces one unanchored comment instead of inline feedback. It treats the symptom, not the unstructured output.",
      "A second free-text call has the same problem: its output is still prose that has to be parsed, and it doubles cost and latency."
    ],
    takeaway: "For CI findings a script will post, ask the CLI for structured output: --output-format json plus --json-schema."
  },
  {
    id: "s5-03",
    scenario: 5,
    domain: 3,
    task: "3.6",
    type: "single",
    pick: 1,
    stem: "A CI job generates tests for each PR. Reviewers reject most of them: they build ad-hoc mocks instead of using the team's factory fixtures in <code>test/factories/</code>, and they assert trivial getters while ignoring the error paths the team cares about. The job's prompt is a one-line \"Write tests for the changed files.\" What is the most effective fix?",
    options: [
      "Raise the number of tests requested per file so that the useful ones are more likely to appear",
      "Switch the job to a larger model that is more likely to find the fixtures and judge test value on its own",
      "Add a post-processing step that deletes any generated test not importing from <code>test/factories/</code>",
      "Document testing standards, valuable-test criteria and the available fixtures in the project CLAUDE.md"
    ],
    answer: [3],
    rationale: [
      "More tests from the same under-specified prompt means more low-value output for reviewers to wade through, not better tests.",
      "A larger model still doesn't know your team's conventions or what you consider valuable. The missing ingredient is project context, not capability.",
      "Filtering discards bad output after paying for it and does nothing about trivial assertions or missing error-path coverage.",
      "Correct. CLAUDE.md is how CI-invoked Claude Code receives project context. Documenting testing standards, valuable-test criteria and fixtures there directly improves generated tests and cuts low-value output."
    ],
    takeaway: "Testing standards, fixtures and what counts as a valuable test belong in the project CLAUDE.md, which CI runs load."
  },
  {
    id: "s5-04",
    scenario: 5,
    domain: 3,
    task: "3.6",
    type: "single",
    pick: 1,
    stem: "To save time, your pipeline resumes the same Claude Code session that generated a fix (<code>--resume fix-session</code>) and asks it to \"review the changes you just made for bugs.\" Over a month it approved 96% of its own changes, yet human reviewers later found logic errors in many of them. What is the most likely root cause?",
    options: [
      "The reviewing session keeps the reasoning that produced the code, so it rarely questions those decisions",
      "The review prompt is too short; a longer checklist in the same session would surface the logic errors",
      "Resumed sessions drop earlier tool results, so the reviewer cannot actually see the diff it is meant to check",
      "The model needs extended thinking enabled during review to be able to detect logic errors of this kind"
    ],
    answer: [0],
    rationale: [
      "Correct. A session that generated code carries its own reasoning forward and is less likely to challenge it. An independent review instance without that context catches more.",
      "A longer checklist doesn't remove the bias that comes from reviewing your own reasoning. The problem is session context, not prompt length.",
      "Resuming restores the prior conversation, including the code it wrote. The issue is that it has too much of its own context, not too little.",
      "Extended thinking in the same session still reasons from the generator's context. Independent instances beat both self-review instructions and extended thinking."
    ],
    takeaway: "The session that wrote the code is a weak reviewer of it; review in an independent instance."
  },
  {
    id: "s5-05",
    scenario: 5,
    domain: 3,
    task: "3.6",
    type: "single",
    pick: 1,
    stem: "Your review bot runs on every push to a PR. After a developer pushes two small follow-up commits, the PR has 27 bot comments, most of them repeating the same 9 findings, including two the developer has already fixed. What is the most effective change?",
    options: [
      "Run the review only when the PR is first opened, not on later pushes, to avoid repeated comments",
      "Lower the temperature so runs phrase findings identically, then skip exact-duplicate comment text",
      "Pass the prior findings into the prompt and ask for only new or still-unaddressed issues",
      "Have the posting script delete all earlier bot comments, then post the new run's full set of findings"
    ],
    answer: [2],
    rationale: [
      "Skipping later pushes means new commits are never reviewed, so bugs introduced by follow-up changes go unflagged.",
      "Identical phrasing isn't guaranteed, and exact-text dedupe still cannot tell that two findings were fixed. It also does nothing to recognise resolved issues.",
      "Correct. Giving Claude the earlier findings lets it compare against the new code and report only what is new or still unresolved, which removes duplicates and drops fixed items.",
      "Deleting and reposting destroys any discussion threads on earlier comments and still reposts findings that were already raised."
    ],
    takeaway: "On re-runs, include the prior findings and ask for only new or still-unaddressed issues."
  },
  {
    id: "s5-06",
    scenario: 5,
    domain: 3,
    task: "3.6",
    type: "single",
    pick: 1,
    stem: "A test-generation step proposes tests for each changed module. About 40% of its suggestions duplicate scenarios already covered in the module's existing spec file, which the step never reads. The prompt already says \"Do not duplicate existing tests.\" What should you change?",
    options: [
      "Strengthen the instruction to \"NEVER duplicate existing tests\" and repeat it at the end of the prompt",
      "Include the module's existing test files in the context so that Claude can see which scenarios are covered",
      "Filter out generated tests whose names closely match tests that already exist anywhere in the repository",
      "Ask for fewer tests per run so the overlap with the existing suite becomes proportionally smaller"
    ],
    answer: [1],
    rationale: [
      "Claude cannot avoid duplicating tests it has never seen. Louder wording doesn't supply the missing information.",
      "Correct. Providing the existing test files lets Claude see what the suite already covers and propose genuinely new scenarios.",
      "Name matching misses duplicates with different names and wrongly drops new tests with similar names. It filters after the fact instead of fixing the input.",
      "Fewer tests reduces output, not the duplication rate. The step still cannot see what already exists."
    ],
    takeaway: "To stop duplicate test suggestions, put the existing tests in context; an instruction alone can't help."
  },
  {
    id: "s5-07",
    scenario: 5,
    domain: 4,
    task: "4.1",
    type: "single",
    pick: 1,
    stem: "Developers dismiss 45% of your review bot's comments, and several have started ignoring it entirely. A teammate proposes adding \"Be conservative and only report findings you are highly confident about\" to the review prompt. What should you do instead?",
    options: [
      "Adopt the proposal, and also ask for a 1–10 confidence score so low-scored findings can be hidden",
      "Adopt the proposal but phrase it more forcefully, so the model treats the restriction as mandatory",
      "Limit the bot to the five files with the most changed lines in each PR so it produces fewer comments",
      "List which issue types to report (bugs, security) and which to skip (style, local patterns)"
    ],
    answer: [3],
    rationale: [
      "Vague caution plus uncalibrated self-reported confidence doesn't improve precision. The model's notion of \"confident\" isn't tied to what your developers consider worth flagging.",
      "Stronger wording of a vague instruction is still vague. \"Conservative\" doesn't tell the model which categories are noise.",
      "Cutting coverage reduces comment volume but leaves the false-positive rate unchanged in the files still reviewed, and misses bugs in the rest.",
      "Correct. Specific categorical criteria about what to report and what to skip improve precision; general instructions like \"be conservative\" or \"high-confidence only\" do not."
    ],
    takeaway: "Fix false positives with explicit report/skip criteria, not \"be conservative\" or confidence filtering."
  },
  {
    id: "s5-08",
    scenario: 5,
    domain: 4,
    task: "4.1",
    type: "single",
    pick: 1,
    stem: "Your review bot flags five categories. Metrics show the \"naming and readability\" category has a 78% dismissal rate, and developers now dismiss the bot's security findings without reading them, even though those are 90% accurate. What is the best immediate action?",
    options: [
      "Temporarily disable the naming category to restore trust while you rework its criteria",
      "Keep all categories but prefix each comment with its category so developers can skip naming",
      "Add \"only flag naming issues you are certain about\" to the prompt and keep the category on",
      "Collapse all findings into one summary comment per PR so the noisy category is less intrusive"
    ],
    answer: [0],
    rationale: [
      "Correct. A high false-positive category undermines trust in the accurate ones. Switching it off temporarily restores trust while you improve its prompt.",
      "Labels still leave the noise in front of developers, and they have already learned to skim past the bot as a whole. Trust isn't restored.",
      "\"Only if certain\" is a confidence-based instruction that doesn't reliably improve precision, so the noise largely continues.",
      "A summary comment loses inline placement for the valuable security findings and keeps the noisy content in the same place developers ignore."
    ],
    takeaway: "Turn off a high-false-positive category for now, so it stops dragging down trust in the accurate ones."
  },
  {
    id: "s5-09",
    scenario: 5,
    domain: 4,
    task: "4.1",
    type: "single",
    pick: 1,
    stem: "Your review prompt asks Claude to rate each finding critical, major or minor. The same unchecked <code>user.profile.email</code> dereference was rated critical on one PR and minor on a near-identical PR the next day, and on-call engineers no longer trust the ratings. Which change most directly produces consistent severity?",
    options: [
      "Have Claude write a sentence justifying each rating before it assigns the severity label",
      "Run the review three times and keep the median of the three severity ratings for each finding",
      "Define each severity level with explicit criteria and give a concrete code example for each level",
      "Drop severity entirely and let developers triage the findings themselves as they read them"
    ],
    answer: [2],
    rationale: [
      "A justification can rationalise either rating. Without a shared definition of each level, the reasoning just follows whatever label the model leans toward.",
      "Taking the median triples cost and smooths noise without giving the model a stable standard, so ratings still drift between PRs.",
      "Correct. Explicit criteria per level, each anchored by a concrete code example, give the model a fixed reference, which is what makes classification consistent.",
      "Removing severity throws away useful prioritisation and moves the inconsistency onto developers instead of fixing it."
    ],
    takeaway: "Consistent severity comes from defined levels, each illustrated with a concrete code example."
  },
  {
    id: "s5-10",
    scenario: 5,
    domain: 4,
    task: "4.2",
    type: "single",
    pick: 1,
    stem: "Your review step already returns JSON with <code>location</code>, <code>issue</code>, <code>severity</code> and <code>suggested_fix</code>. The fields are always present, but their content varies: some <code>issue</code> values just restate the code, and some <code>suggested_fix</code> values say \"consider improving error handling.\" Two rounds of more detailed written instructions did not help. What should you try next?",
    options: [
      "Mark every field required with a minimum length in the JSON schema so that terse values are rejected outright",
      "Add a few examples of complete findings that show the specific, actionable content expected per field",
      "Increase <code>max_tokens</code> so the model has room to write longer and more detailed field values",
      "Move the instructions to the end of the prompt, where the model is more likely to follow them"
    ],
    answer: [1],
    rationale: [
      "The fields are already present; a length rule would just produce longer vague text. Schemas constrain shape, not whether the content is actionable.",
      "Correct. When detailed instructions still produce inconsistent output, few-shot examples are the most effective way to show exactly what a good finding looks like.",
      "The answers aren't being cut off. More output room doesn't change the quality of what the model chooses to write.",
      "Repositioning the same instructions that already failed twice is unlikely to change behaviour. The model needs to see the target, not reread the description."
    ],
    takeaway: "When instructions alone give inconsistent findings, show 2–4 example findings in the exact form you want."
  },
  {
    id: "s5-11",
    scenario: 5,
    domain: 4,
    task: "4.2",
    type: "single",
    pick: 1,
    stem: "Your codebase deliberately uses an empty <code>catch</code> inside its <code>withRetry()</code> helpers, where the retry loop handles the failure. The bot flags every one of them as a swallowed exception, yet it misses genuinely swallowed errors in new code. A teammate proposes listing every file where empty catches are allowed. What is the better approach?",
    options: [
      "Disable the exception-handling category permanently, since it cannot tell the two cases apart",
      "Add the allowlist of files, and update it each time someone writes a new <code>withRetry()</code> helper in the codebase",
      "Add the instruction \"use good judgement about intentional empty catch blocks\" to the criteria",
      "Add a few examples contrasting the retry pattern with a truly swallowed error, saying why each differs"
    ],
    answer: [3],
    rationale: [
      "Permanently disabling the category also gives up on the genuine swallowed errors you want to catch. Disabling is a temporary trust measure, not the fix.",
      "An allowlist only matches pre-listed cases and needs constant upkeep; it does not teach the model to recognise the acceptable pattern in new places.",
      "\"Use good judgement\" is a vague instruction. It gives the model no basis for distinguishing the two cases.",
      "Correct. Few-shot examples that contrast an acceptable pattern with a real issue, with the reasoning, reduce false positives and let the model generalise to cases you didn't list."
    ],
    takeaway: "Few-shot pairs of acceptable pattern vs genuine issue cut false positives and generalise, unlike allowlists."
  },
  {
    id: "s5-12",
    scenario: 5,
    domain: 4,
    task: "4.4",
    type: "single",
    pick: 1,
    stem: "Developers can dismiss review comments with one click. Last month 31% were dismissed, but you cannot tell which kinds of code trigger the dismissed findings, so you don't know which criteria to tighten. Findings are emitted as structured JSON. What should you add?",
    options: [
      "A <code>detected_pattern</code> field naming the code construct that triggered each finding",
      "A required free-text box where developers explain why they dismissed each comment",
      "A self-reported confidence score on each finding so low-confidence findings can be dropped",
      "A monthly read-through of 20 randomly chosen dismissed comments by the team lead"
    ],
    answer: [0],
    rationale: [
      "Correct. Recording the triggering construct on each finding lets you group dismissals by pattern and see systematically which constructs produce false positives.",
      "Mandatory explanations add friction, get skipped or filled with noise, and still don't tie dismissals to code constructs in an analysable way.",
      "Confidence filtering doesn't tell you which patterns are wrong, and self-reported confidence is not a reliable precision fix.",
      "Twenty comments a month is too small and ad hoc to reveal patterns across thousands of findings; it isn't systematic analysis."
    ],
    takeaway: "Add detected_pattern to findings so dismissals can be analysed by the construct that triggered them."
  },
  {
    id: "s5-13",
    scenario: 5,
    domain: 4,
    task: "4.5",
    type: "multi",
    pick: 2,
    stem: "Your team runs five Claude workloads today, all on the synchronous API. To cut cost, you want to move suitable ones to the Message Batches API. Which TWO workloads are good candidates? Select TWO.",
    options: [
      "Nightly generation of tests for low-coverage modules, which the team reviews the next morning",
      "The required pre-merge review check that keeps the merge button disabled until it reports",
      "A review flow in which Claude calls <code>run_tests</code> mid-request and revises its findings from the output",
      "A weekly whole-repository audit for deprecated API usage, published every Monday",
      "The <code>/review</code> command developers run in their terminal while they wait for feedback"
    ],
    answer: [0, 3],
    rationale: [
      "Correct. Nightly test generation is non-blocking and latency-tolerant, the kind of workload the 50% batch discount is for.",
      "Batches can take up to 24 hours with no latency SLA. A blocking pre-merge check would leave developers stuck.",
      "A batch request can't run tools mid-request and send the results back to the model, so a multi-turn tool loop doesn't fit inside one batch request.",
      "Correct. A weekly audit tolerates hours of delay, so it can run as a batch for lower cost.",
      "A developer actively waiting for feedback needs a synchronous response; batch processing has no latency guarantee."
    ],
    takeaway: "Batch for work nobody is waiting on (nightly, weekly); synchronous for blocking checks and tool loops."
  },
  {
    id: "s5-14",
    scenario: 5,
    domain: 4,
    task: "4.5",
    type: "single",
    pick: 1,
    stem: "Compliance requires every commit merged to <code>main</code> to have an AI security-audit report within 32 hours of the merge. You run the audits through the Message Batches API, which can take up to 24 hours to process a batch. How often must you submit batches to guarantee the requirement?",
    options: [
      "Once a day at midnight, since batches usually finish well within an hour",
      "At least every 8 hours, so the worst case is 8 hours waiting plus 24 processing",
      "Every 12 hours, which still leaves the 24-hour window inside the 32 hours",
      "Whenever 500 merged commits have accumulated, to keep each batch large and efficient"
    ],
    answer: [1],
    rationale: [
      "\"Usually\" isn't a guarantee. A commit merged just after midnight waits 24 hours, then up to 24 more to process: 48 hours worst case.",
      "Correct. Worst case is a commit merged right after a submission: it waits one full interval, then up to 24 hours of processing. 8 + 24 = 32, which meets the requirement.",
      "12 hours of waiting plus 24 of processing is 36 hours worst case, which breaks the 32-hour requirement.",
      "A count-based trigger has no upper bound on waiting time; in a quiet week a commit could wait days before its batch is even submitted."
    ],
    takeaway: "Batch submission interval ≤ SLA − 24 h, because the worst case is a full wait plus a full 24-hour run."
  },
  {
    id: "s5-15",
    scenario: 5,
    domain: 4,
    task: "4.6",
    type: "single",
    pick: 1,
    stem: "Your bot produces about 60 findings a day, and one tech lead can triage roughly 15. You want likely-correct findings posted straight to PRs and uncertain ones sent to the tech lead first. Which design best supports this routing?",
    options: [
      "Tell Claude to report only its high-confidence findings and post everything it reports straight to the PR",
      "Send every finding to the tech lead, who forwards the ones worth posting on to the PR author by hand",
      "Have a verification pass attach confidence to each finding, with the cutoff calibrated on past outcomes",
      "Post every finding directly and use developers' dismissals afterwards to show which ones were wrong"
    ],
    answer: [2],
    rationale: [
      "That filters findings away instead of routing them, and a vague \"high-confidence only\" instruction doesn't reliably improve precision.",
      "Four times the tech lead's capacity goes to them, so the queue grows without bound and triage becomes a bottleneck.",
      "Correct. A verification pass that reports confidence alongside each finding, with the threshold calibrated against known outcomes, lets you route findings and spend scarce reviewer time where it matters.",
      "This uses developers as the filter, which is exactly what erodes trust in the bot. Uncertain findings reach PRs unreviewed."
    ],
    takeaway: "Use per-finding confidence for routing, calibrated on known outcomes, not as a \"report only if confident\" filter."
  },
  {
    id: "s5-16",
    scenario: 5,
    domain: 4,
    task: "4.6",
    type: "single",
    pick: 1,
    stem: "Your review already runs one focused pass per changed file, and local bugs are now caught consistently. A PR renamed <code>amount</code> to <code>amount_cents</code> in <code>serializers/order.py</code>; three consumers in other files still read <code>amount</code>, and every per-file pass reported its file clean. What should you add?",
    options: [
      "A separate integration pass over cross-file data flow, using the interfaces the PR changed",
      "A return to a single pass over all the files, so the model sees every file together in one context",
      "A larger model for the per-file passes so each one can infer how other files use the changed code",
      "A stricter per-file prompt telling each pass to assume that any renamed field is used elsewhere"
    ],
    answer: [0],
    rationale: [
      "Correct. Per-file passes catch local issues; a separate integration pass examines how data flows across files, which is where a broken contract like this shows up.",
      "A single pass reintroduces the attention dilution that per-file passes fixed, so local bugs get missed again.",
      "Each per-file pass only sees its own file. No model can see callers that aren't in its context.",
      "Assuming every rename breaks something produces speculative warnings without evidence, adding false positives instead of finding the real consumers."
    ],
    takeaway: "Per-file passes for local bugs, plus a separate cross-file integration pass for contracts and data flow."
  },
  {
    id: "s5-17",
    scenario: 5,
    domain: 4,
    task: "4.6",
    type: "multi",
    pick: 2,
    stem: "To cut false positives, a teammate proposes running the review three times on each PR and posting only findings that appear in at least two of the three runs. Which TWO statements about this proposal are accurate? Select TWO.",
    options: [
      "It guarantees precision, because a finding repeated across runs cannot be a false positive",
      "It would suppress real bugs that the model detects only intermittently across runs",
      "It lowers cost, because each of the three runs can use a smaller and cheaper model",
      "It works because agreement across runs is a calibrated measure of whether a finding is correct",
      "False positives are better reduced with explicit criteria for which issue types to report and skip"
    ],
    answer: [1, 4],
    rationale: [
      "A systematic false positive, such as a pattern the criteria wrongly treat as a bug, will appear in every run. Agreement doesn't make it correct.",
      "Correct. Some genuine issues are only caught some of the time; requiring two of three discards exactly those findings.",
      "Nothing in the proposal changes the model, and three runs cost roughly three times one run.",
      "Agreement between runs of the same model on the same prompt isn't calibrated against ground truth; it measures consistency, not correctness.",
      "Correct. Precision comes from specific categorical criteria (and, where needed, few-shot examples), not from voting."
    ],
    takeaway: "Consensus voting hides intermittently detected real bugs; fix false positives with explicit criteria."
  },
  {
    id: "s5-18",
    scenario: 5,
    domain: 1,
    task: "1.6",
    type: "single",
    pick: 1,
    stem: "You are designing the review flow for a service where every PR must be checked for the same three things: correctness, security, and whether changed behaviour has tests. A colleague proposes a coordinator agent that inspects each PR and decides at runtime which investigations to spawn. Which decomposition fits this workload best?",
    options: [
      "The coordinator design, because dynamic decomposition adapts to whatever each PR happens to contain",
      "One large prompt asking for all three checks at once, so the model can weigh them against each other",
      "A coordinator that also spawns open-ended exploration agents to hunt for issues beyond the three aspects",
      "A fixed prompt chain with one focused step per aspect, since the aspects are known in advance"
    ],
    answer: [3],
    rationale: [
      "Dynamic decomposition suits open-ended investigation where subtasks emerge as you go. Here the steps are known in advance, so it adds cost and variability for nothing.",
      "Packing every aspect into one prompt dilutes attention; focused sequential steps give each aspect consistent depth.",
      "Open-ended exploration broadens scope and adds noise, which works against the goal of actionable, low-false-positive feedback.",
      "Correct. Prompt chaining fits predictable multi-aspect reviews: a fixed sequence of focused steps gives consistent, repeatable coverage."
    ],
    takeaway: "Predictable multi-aspect reviews: prompt chaining. Open-ended investigation: dynamic decomposition."
  },
  {
    id: "s5-19",
    scenario: 5,
    domain: 3,
    task: "3.6",
    type: "single",
    pick: 1,
    stem: "A platform engineer baked the team's review criteria into <code>~/.claude/CLAUDE.md</code> in the CI runner image. Developers running <code>/review</code> locally get different results from CI, and every criteria change needs an image rebuild. Where should the review criteria live?",
    options: [
      "In the step's environment as a <code>CLAUDE_REVIEW_CRITERIA</code> variable, which Claude Code reads at startup",
      "In the project's CLAUDE.md, committed to the repo, which both local sessions and CI runs load",
      "In each developer's own <code>~/.claude/CLAUDE.md</code>, copied from the runner image so they match",
      "In a <code>.claude/review.json</code> file with a <code>criteria</code> array that the CLI loads in CI"
    ],
    answer: [1],
    rationale: [
      "Claude Code has no <code>CLAUDE_REVIEW_CRITERIA</code> variable; the criteria would simply be ignored.",
      "Correct. Project-level CLAUDE.md is versioned with the code and loaded by every Claude Code run in the repo, local or CI, so criteria stay consistent and change through normal PRs.",
      "User-level CLAUDE.md is personal and not shared through version control. Copies drift apart as soon as anyone edits theirs.",
      "There is no <code>review.json</code> criteria mechanism in Claude Code; project context comes from CLAUDE.md."
    ],
    takeaway: "Review criteria go in the committed project CLAUDE.md so local and CI runs share one versioned source."
  },
  {
    id: "s5-20",
    scenario: 5,
    domain: 4,
    task: "4.6",
    type: "single",
    pick: 1,
    stem: "Your pipeline uses one Claude session to write a database migration and then check it. A teammate proposes keeping that design but enabling extended thinking with a large budget for the checking step, arguing that deeper reasoning will catch what the session missed. What is the best response?",
    options: [
      "Agree, since extended thinking lets the session re-derive the migration and spot its own mistakes",
      "Agree, but also have the session adopt the persona of a skeptical senior reviewer for the check",
      "Disagree; use a separate instance without the generator's reasoning context, which catches more issues",
      "Disagree; drop the check, because no model can meaningfully review code produced by a model"
    ],
    answer: [2],
    rationale: [
      "More reasoning in the same session still starts from the generator's own decisions, so it tends to confirm them. Independent review beats extended thinking here.",
      "A persona instruction doesn't remove the session's retained reasoning context; it is still a self-review.",
      "Correct. An independent instance, without the generator's reasoning, is more effective at catching subtle issues than self-review instructions or extended thinking.",
      "Model review is effective when the reviewer is independent. Dropping the check throws away a useful safeguard."
    ],
    takeaway: "Extended thinking doesn't fix self-review bias; a fresh, independent instance does."
  },

  // ---------------------------------------------------------------- Scenario 6
  {
    id: "s6-01",
    scenario: 6,
    domain: 4,
    task: "4.3",
    type: "single",
    pick: 1,
    stem: "Your extraction service prompts Claude with \"Return the invoice fields as JSON.\" About 3% of responses fail to parse: some are wrapped in markdown fences, some have a closing sentence after the JSON, and a few have trailing commas. What is the most reliable fix?",
    options: [
      "Strip fences and trailing text with a cleanup function, then retry the request whenever parsing still fails",
      "Set temperature to 0 so the model emits the same clean JSON layout on every request",
      "Add a full example JSON object and say \"respond with JSON only, no other text\" in the prompt",
      "Define an extraction tool whose input schema is the invoice schema, and read the <code>tool_use</code> input"
    ],
    answer: [3],
    rationale: [
      "Cleanup heuristics handle the failure modes you've seen, not new ones, and retries add cost. It patches symptoms of prompt-only JSON.",
      "Temperature 0 reduces variety but doesn't guarantee valid JSON; a document that triggers trailing prose will keep triggering it.",
      "Prompt-only JSON improves with examples but still has no guarantee, so edge cases will keep breaking the parser.",
      "Correct. Tool use with a JSON schema is the most reliable way to get schema-compliant structured output and removes JSON syntax errors."
    ],
    takeaway: "For guaranteed parseable output, extract through a tool's JSON schema, not \"respond in JSON\"."
  },
  {
    id: "s6-02",
    scenario: 6,
    domain: 4,
    task: "4.3",
    type: "single",
    pick: 1,
    stem: "Your pipeline receives invoices, receipts and purchase orders with no type label. You defined three extraction tools, one per type, with <code>tool_choice: {\"type\": \"auto\"}</code>. About 4% of responses contain only text, such as \"This looks like a receipt from a hardware store.\" What change guarantees a structured result while still letting Claude pick the right schema?",
    options: [
      "Set <code>tool_choice</code> to <code>{\"type\": \"any\"}</code> so Claude must call one of the three tools",
      "Force the invoice tool with <code>{\"type\": \"tool\", \"name\": \"extract_invoice\"}</code>, the most common type",
      "Keep <code>auto</code> and add \"You must always call a tool\" to the system prompt",
      "Merge the three tools into one schema in which every field from all three types is optional"
    ],
    answer: [0],
    rationale: [
      "Correct. <code>\"any\"</code> requires a tool call but lets Claude choose which one, which is exactly the case of several schemas and an unknown document type.",
      "Forcing one tool guarantees a call but pushes receipts and purchase orders through the invoice schema, producing wrong or fabricated fields.",
      "With <code>auto</code> the model may still answer in text; a prompt instruction raises the odds but guarantees nothing.",
      "A merged all-optional schema loses the type-specific structure and lets the model leave everything empty; it trades one problem for another."
    ],
    takeaway: "Unknown document type and several extraction tools: tool_choice \"any\"."
  },
  {
    id: "s6-03",
    scenario: 6,
    domain: 4,
    task: "4.3",
    type: "single",
    pick: 1,
    stem: "Your extraction agent has <code>extract_metadata</code> plus enrichment tools <code>lookup_vendor</code> and <code>convert_currency</code>. Enrichment depends on the metadata, but logs show Claude sometimes calls <code>lookup_vendor</code> first with a guessed vendor name. How should you configure the requests?",
    options: [
      "Set <code>tool_choice: {\"type\": \"any\"}</code> and list <code>extract_metadata</code> first in the tools array",
      "Force <code>extract_metadata</code> on the first request, then handle enrichment in follow-up turns",
      "Force <code>extract_metadata</code> through <code>tool_choice</code> on every request in the conversation",
      "Add \"Always call extract_metadata before any other tool\" to the system prompt and keep <code>auto</code>"
    ],
    answer: [1],
    rationale: [
      "<code>\"any\"</code> lets Claude pick any tool, and the order of the tools array doesn't impose an order of calls.",
      "Correct. Forced selection with <code>{\"type\": \"tool\", \"name\": \"extract_metadata\"}</code> guarantees that step runs first; the enrichment tools are then used in follow-up turns without forcing.",
      "Forcing it on every turn means Claude can never call the enrichment tools, so the workflow can't progress.",
      "A prompt instruction makes the right order more likely but doesn't guarantee it, and the logs already show it being skipped."
    ],
    takeaway: "To make one tool run first, force it on the first turn only; later steps follow in later turns."
  },
  {
    id: "s6-04",
    scenario: 6,
    domain: 4,
    task: "4.3",
    type: "single",
    pick: 1,
    stem: "Your schema marks <code>po_number</code> as a required string. An audit finds that for invoices with no purchase-order number (about 18% of them), Claude fills the field with the invoice number or a placeholder such as <code>PO-0000</code>. What is the most effective fix?",
    options: [
      "Keep the field required and add \"Never invent a PO number\" to the extraction prompt",
      "Add a regex pattern for valid PO numbers to the schema so that placeholders are rejected",
      "Make <code>po_number</code> nullable so Claude can return null when the document has none",
      "Retry any extraction whose <code>po_number</code> matches the invoice number until they differ"
    ],
    answer: [2],
    rationale: [
      "The schema still demands a value the document doesn't have; the instruction fights the schema, and fabrication continues.",
      "A pattern blocks obvious placeholders but still requires some value, so the model will produce a well-formed fake instead.",
      "Correct. When the source may lack the information, a nullable field lets the model say so instead of inventing a value to satisfy the schema.",
      "Retrying cannot produce information that isn't in the document; it just generates a different fabricated value."
    ],
    takeaway: "If a field may be missing from the source, make it nullable; required fields invite fabrication."
  },
  {
    id: "s6-05",
    scenario: 6,
    domain: 4,
    task: "4.3",
    type: "single",
    pick: 1,
    stem: "Your schema defines <code>document_type</code> as an enum of six values. Reviewers find that new document types (for example, credit notes) are forced into the nearest value, and documents that could be either of two types are classified with no sign of doubt. Which schema change best handles both problems?",
    options: [
      "Expand the enum to every document type the business has ever received, about 40 values",
      "Replace the enum with a free-text string so Claude can describe any type in its own words",
      "Make <code>document_type</code> nullable so Claude can leave it empty when no value fits well",
      "Add <code>\"other\"</code> with a <code>document_type_detail</code> string, plus <code>\"unclear\"</code> for ambiguous cases"
    ],
    answer: [3],
    rationale: [
      "A long enum still breaks on the next new type and doesn't give ambiguous documents any way to signal doubt.",
      "Free text loses the clean categories downstream systems need; you'd have to re-classify the descriptions yourself.",
      "Null conflates \"doesn't fit\", \"ambiguous\" and \"missing\", and records nothing about what the document actually is.",
      "Correct. <code>\"other\"</code> plus a detail string handles extensible categories, and <code>\"unclear\"</code> lets the model flag ambiguity instead of guessing."
    ],
    takeaway: "Enums need \"other\" + a detail field for new categories and \"unclear\" for ambiguous ones."
  },
  {
    id: "s6-06",
    scenario: 6,
    domain: 4,
    task: "4.3",
    type: "single",
    pick: 1,
    stem: "After moving extraction to <code>tool_use</code> with a strict JSON schema, parse failures dropped to zero. A teammate proposes removing the downstream validation step to simplify the pipeline. Spot checks still find line items that don't sum to the total and tax amounts placed in the <code>shipping</code> field. How should you respond?",
    options: [
      "Keep semantic validation: schemas remove syntax errors but can't catch wrong sums or misplaced values",
      "Remove it: a strict schema guarantees each value is valid, so the spot-check errors must be in the source",
      "Remove it, and add <code>minimum</code> and <code>maximum</code> constraints to the numeric schema fields instead",
      "Keep it only for documents where Claude used <code>tool_choice: auto</code> rather than a forced tool"
    ],
    answer: [0],
    rationale: [
      "Correct. Strict schemas via tool use eliminate syntax errors but not semantic ones such as totals that don't add up or values in the wrong field. Those still need validation.",
      "Schema compliance means the right shape and types, not correct values. The errors described are extraction mistakes a schema can't see.",
      "Range limits can't detect a tax amount in the shipping field or a sum mismatch; both values can be in range and still wrong.",
      "The choice of <code>tool_choice</code> affects whether a tool is called, not whether the extracted values are semantically right."
    ],
    takeaway: "Schemas fix syntax, not meaning; keep semantic validation (sums, field placement) after tool use."
  },
  {
    id: "s6-07",
    scenario: 6,
    domain: 4,
    task: "4.3",
    type: "single",
    pick: 1,
    stem: "Supplier documents write dates as <code>03/04/25</code>, <code>4 Mar 2025</code> and <code>2025-03-04</code>, and quantities as \"1.5k\", \"1,500\" and \"1 500\". Your strict schema types these as strings, and values flow downstream in whatever form the source used, breaking the ERP import. What should you add?",
    options: [
      "A regular-expression post-processor that guesses each value's format and rewrites it before import",
      "A <code>source_format</code> field for each value so the ERP team can write their own converters",
      "Format normalization rules in the prompt (e.g. ISO 8601 dates, plain integers) alongside the schema",
      "A larger model, which will infer the target formats from the field names without further instructions"
    ],
    answer: [2],
    rationale: [
      "Regexes can't resolve ambiguity such as whether <code>03/04/25</code> is March or April; the model reading the document in context is better placed to apply a rule.",
      "This pushes the normalisation problem downstream to every consumer instead of solving it once at extraction.",
      "Correct. Normalisation rules in the prompt, used together with a strict schema, handle inconsistent source formatting at the point of extraction.",
      "Field names don't specify a format convention. Without explicit rules even a larger model will copy the source form or guess."
    ],
    takeaway: "Pair a strict schema with explicit normalization rules in the prompt for messy source formats."
  },
  {
    id: "s6-08",
    scenario: 6,
    domain: 4,
    task: "4.4",
    type: "single",
    pick: 1,
    stem: "When an extraction fails validation (for example, <code>due_date</code> earlier than <code>issue_date</code>), your pipeline retries by sending the same original request again. About 60% of retries reproduce the same error. What change will most improve retry success?",
    options: [
      "Raise the retry limit from 2 to 5 so that persistent errors get more attempts to resolve themselves",
      "Send the original document, the failed extraction and the specific validation errors in the retry turn",
      "Retry with a higher temperature so that the model produces a different extraction on each attempt",
      "Send only the validation error message in the retry so that the model focuses on the problem"
    ],
    answer: [1],
    rationale: [
      "More identical retries mostly reproduce the same mistake; the model still doesn't know what was wrong.",
      "Correct. A follow-up with the document, the failed output and the specific errors gives the model what it needs to correct itself.",
      "Randomness changes the output without steering it toward the right answer, and can introduce new errors in fields that were fine.",
      "Without the original document the model can't re-read the source to find the correct dates, so it may just swap or invent values."
    ],
    takeaway: "Retry with the original document, the failed extraction and the specific errors, not a blind resend."
  },
  {
    id: "s6-09",
    scenario: 6,
    domain: 4,
    task: "4.4",
    type: "single",
    pick: 1,
    stem: "Logs show 92% of retries for <code>termination_notice_days</code> still fail. In those contracts the clause reads \"as set out in Section 12 of the Master Services Agreement\", and the MSA is not part of the input. What is the most effective change?",
    options: [
      "Allow more retries with error feedback, since the model eventually finds the value in most documents",
      "Add a few-shot example showing a 30-day notice period so the model has a sensible default to use",
      "Make the field required so that the model is forced to locate a value somewhere in the contract",
      "Stop retrying; return null flagged as an external reference, and route for review or supply the MSA"
    ],
    answer: [3],
    rationale: [
      "Retries only help with format or structural errors. The number isn't in the document, so no amount of feedback will make it appear.",
      "A default value turns missing data into fabricated data that looks legitimate downstream.",
      "Requiring a value the document doesn't contain pushes the model to fabricate one.",
      "Correct. When information exists only in an external document that wasn't provided, retries are ineffective. Record its absence and either supply the MSA or send the record to a human."
    ],
    takeaway: "Retries fix format and structure errors; they can't recover data that isn't in the provided document."
  },
  {
    id: "s6-10",
    scenario: 6,
    domain: 4,
    task: "4.4",
    type: "single",
    pick: 1,
    stem: "Finance reports that 6% of extracted invoices have line items that don't add up to the total, but they can't tell whether the extraction or the invoice itself is wrong. Your schema currently has a single <code>total</code> field. What schema change best supports catching and diagnosing these cases?",
    options: [
      "Extract <code>stated_total</code> and <code>calculated_total</code>, with <code>conflict_detected</code> set when they differ",
      "Instruct Claude to adjust the total so that it always equals the sum of the extracted line items",
      "Drop the total field and compute it downstream from the line items, which are more granular",
      "Add a JSON schema rule requiring <code>total</code> to equal the sum of the <code>line_items</code> amounts"
    ],
    answer: [0],
    rationale: [
      "Correct. Capturing what the document states alongside what the items add up to makes discrepancies visible, and a <code>conflict_detected</code> flag lets you route them for diagnosis.",
      "Silently forcing agreement hides both extraction mistakes and genuine errors on the invoice, which is the opposite of what finance needs.",
      "Throwing away the stated total removes the only signal that something disagrees; a missed line item would go unnoticed.",
      "Standard JSON Schema can't express a cross-field arithmetic rule like this, and semantic checks belong in validation code anyway."
    ],
    takeaway: "Extract stated_total and calculated_total side by side, and flag conflicts instead of reconciling silently."
  },
  {
    id: "s6-11",
    scenario: 6,
    domain: 5,
    task: "5.6",
    type: "single",
    pick: 1,
    stem: "A supplier contract states payment terms of \"Net 30\" on the cover page and \"Net 45\" in Appendix B. Your extraction always returns the first value it encounters, and the accounts-payable team has now paid two suppliers late. How should the extraction handle this?",
    options: [
      "Prefer the appendix value, since appendices are usually the more detailed, later-negotiated text",
      "Prefer whichever value is more favourable to your company, to minimise financial exposure",
      "Return both values with their locations, set <code>conflict_detected</code>, and route it for review",
      "Ask Claude to choose the most likely intended value and report a confidence score for its choice"
    ],
    answer: [2],
    rationale: [
      "A fixed preference is still an arbitrary pick; in some contracts the cover page is the amended term.",
      "Choosing the convenient value is arbitrary selection with a bias, and it is what caused the late payments in the first place.",
      "Correct. Conflicting values should be kept and annotated with their source locations, so a person (or downstream logic) can reconcile them rather than the extractor silently picking one.",
      "The model's choice plus an uncalibrated confidence score still hides the conflict from the people who need to resolve it."
    ],
    takeaway: "When the source contradicts itself, keep both values with their locations and flag the conflict."
  },
  {
    id: "s6-12",
    scenario: 6,
    domain: 4,
    task: "4.2",
    type: "single",
    pick: 1,
    stem: "You extract cited sources and sample sizes from research papers. Accuracy is high for papers with a numbered bibliography and a separate Methods section, but drops sharply for papers that use inline author–year citations or report sample size inside the Results narrative. What is the most effective improvement?",
    options: [
      "Add a paragraph to the prompt explaining that papers can use different citation and section styles",
      "Add few-shot examples showing correct extraction from each structure, such as inline citations",
      "Build a separate extraction pipeline per journal, each with a prompt tuned to that journal's layout",
      "Pre-process every paper to move citations and methods into a standard layout before extraction"
    ],
    answer: [1],
    rationale: [
      "Telling the model that variety exists doesn't show it how to handle each form; prose descriptions are the weaker technique here.",
      "Correct. Few-shot examples that demonstrate extraction from varied structures (inline citations vs bibliographies, embedded vs separate methods) are the targeted fix.",
      "Per-journal pipelines multiply maintenance and still break on authors who deviate from their journal's style.",
      "Restructuring free-form papers reliably is itself an extraction problem; this moves the difficulty rather than solving it."
    ],
    takeaway: "Varied document structures: give few-shot examples of each structure, not a description of variety."
  },
  {
    id: "s6-13",
    scenario: 6,
    domain: 4,
    task: "4.2",
    type: "single",
    pick: 1,
    stem: "Field inspectors write damage reports by hand, with phrases like \"crack roughly a hand's width\" or \"water about ankle deep\". The schema's required <code>measurement_cm</code> field comes back empty or null for most of these, even though the information is present. What is the most effective fix?",
    options: [
      "Make <code>measurement_cm</code> optional so empty values stop failing schema validation",
      "Add \"always fill measurement_cm\" to the prompt so that the model stops leaving the field empty",
      "Reject reports with informal measurements and ask inspectors to resubmit exact numbers",
      "Add few-shot examples that turn informal measurements into estimates flagged approximate"
    ],
    answer: [3],
    rationale: [
      "Making it optional hides the symptom: the information is in the report, and you'd lose it on most records.",
      "An instruction to always fill the field, without showing how, invites fabricated numbers on reports that truly lack a measurement.",
      "This pushes a model-side handling problem onto inspectors and stalls the pipeline.",
      "Correct. Few-shot examples showing correct extraction from informal formats address empty extraction of required fields and reduce hallucination."
    ],
    takeaway: "Required fields coming back empty on informal formats: add few-shot examples of correct extraction."
  },
  {
    id: "s6-14",
    scenario: 6,
    domain: 4,
    task: "4.5",
    type: "multi",
    pick: 2,
    stem: "A nightly batch of 12,000 contracts finished with 11,640 successful results and 360 errored requests; 140 of the errors say the request exceeded the model's context limit. Which TWO actions should you take? Select TWO.",
    options: [
      "Identify the failed requests by <code>custom_id</code> and resubmit only those in a new batch",
      "Resubmit the full batch of 12,000 so that all results come from one consistent run",
      "Split the 140 oversized contracts into chunks before resubmitting them",
      "Match results to inputs by their position in the results file, which follows submission order",
      "Raise <code>max_tokens</code> on the oversized requests so that they fit within the context limit"
    ],
    answer: [0, 2],
    rationale: [
      "Correct. <code>custom_id</code> correlates each result with its request, so you can resubmit only the failures.",
      "Rerunning 11,640 successful requests doubles cost and time for no benefit.",
      "Correct. Documents that exceeded the context limit will fail again unchanged; chunking them is the appropriate modification.",
      "Batch results are not guaranteed to come back in submission order; correlate with <code>custom_id</code>.",
      "<code>max_tokens</code> limits output length. Raising it doesn't shrink an oversized input, and it uses more of the context window."
    ],
    takeaway: "Batch failures: find them by custom_id, fix the cause (e.g. chunk oversized docs), resubmit only those."
  },
  {
    id: "s6-15",
    scenario: 6,
    domain: 4,
    task: "4.5",
    type: "single",
    pick: 1,
    stem: "You are about to submit 250,000 scanned leases to the Message Batches API with a newly written extraction prompt. Last quarter, the first pass of a similar job failed validation on 22% of documents and took three rounds of resubmission. What should you do first?",
    options: [
      "Run the prompt on a representative sample, fix what fails, then submit the full batch",
      "Submit everything now and plan for resubmission rounds, since batch pricing makes retries cheap",
      "Switch to the synchronous API so that failures surface immediately and can be retried one by one",
      "Split the job into ten batches of 25,000 so that each failed batch is smaller to resubmit"
    ],
    answer: [0],
    rationale: [
      "Correct. Refining the prompt on a sample before a large batch maximises first-pass success and cuts resubmission cost.",
      "Half price per request still adds up across three rounds on a quarter-million documents, and each round can take up to 24 hours.",
      "Synchronous calls lose the 50% discount and don't make the prompt any better; you'd just find the same failures faster at higher cost.",
      "Splitting changes the size of each resubmission, not the failure rate. The prompt problems remain."
    ],
    takeaway: "Tune the prompt on a sample before a large batch; first-pass success is the cheapest lever."
  },
  {
    id: "s6-16",
    scenario: 6,
    domain: 4,
    task: "4.5",
    type: "single",
    pick: 1,
    stem: "Your synchronous extraction flow lets Claude call <code>lookup_vendor_id</code>, receive the result, and then call <code>record_invoice</code>. You moved it to the Message Batches API unchanged. Most results now end with <code>stop_reason: \"tool_use\"</code> requesting <code>lookup_vendor_id</code>, and none contain a <code>record_invoice</code> call. What is the right fix?",
    options: [
      "Raise <code>max_tokens</code> so each batch request has room to complete the full tool loop",
      "Set <code>tool_choice: {\"type\": \"any\"}</code> so the model must finish by calling <code>record_invoice</code>",
      "Batch requests can't run tool loops; batch a single-turn extraction and look up vendor IDs afterwards",
      "Poll the batch more often, since requests report <code>tool_use</code> while they are still being processed by the API"
    ],
    answer: [2],
    rationale: [
      "Output length isn't the constraint. No one executes the tool and returns its result inside a batch request, so the loop can't continue.",
      "<code>\"any\"</code> still allows <code>lookup_vendor_id</code>, and even a forced call wouldn't let a lookup result come back within the same request.",
      "Correct. The Batches API doesn't support multi-turn tool calling within a request. Restructure so each batch request is a single-turn extraction, and do the vendor lookup in code or a later step.",
      "These are final results. A batch result with <code>stop_reason: \"tool_use\"</code> is finished; the request ended waiting for a tool result that never comes."
    ],
    takeaway: "No tool loops inside a batch request: batch single-turn extraction, enrich afterwards."
  },
  {
    id: "s6-17",
    scenario: 6,
    domain: 5,
    task: "5.5",
    type: "single",
    pick: 1,
    stem: "Your pipeline reports 97% field-level accuracy on a 2,000-document validation set, and leadership proposes ending human review. The set is 80% typed invoices; handwritten delivery notes make up 6%. What should you do before reducing review?",
    options: [
      "Approve the change, since 97% exceeds the 95% target and the set is large enough to be reliable",
      "Measure accuracy by document type and by field, and confirm that every segment meets the bar first",
      "Re-run the same validation set twice more to confirm that the 97% figure is stable between runs",
      "Reduce review gradually, starting with the fields the model reports the highest confidence for"
    ],
    answer: [1],
    rationale: [
      "An aggregate dominated by typed invoices can hide poor accuracy on handwritten notes or specific fields.",
      "Correct. Aggregate accuracy can mask weak segments. Validate by document type and field before automating.",
      "Repeating the same aggregate measurement confirms stability, not that every segment performs; the masking problem remains.",
      "Self-reported confidence that hasn't been calibrated per segment is no substitute for measured accuracy by type and field."
    ],
    takeaway: "97% overall can hide a failing segment; check accuracy by document type and field before cutting review."
  },
  {
    id: "s6-18",
    scenario: 6,
    domain: 5,
    task: "5.5",
    type: "single",
    pick: 1,
    stem: "You auto-approve extractions above a calibrated confidence threshold, and only low-confidence ones go to reviewers. Six months later, a new supplier template caused systematic errors in high-confidence extractions that went unnoticed for weeks. What ongoing process would have caught this?",
    options: [
      "Lowering the threshold every month so a growing share of extractions goes to human reviewers",
      "Reviewing a uniform 1% random sample drawn from all extractions across the whole pipeline",
      "Relying on downstream teams to report errors, which surfaces the problems that matter to them",
      "Stratified random sampling of auto-approved extractions across all document types and suppliers"
    ],
    answer: [3],
    rationale: [
      "Ratcheting the threshold just raises review load without systematically checking the auto-approved segment for new error patterns.",
      "A uniform sample is dominated by common types, so a new or small segment may get few or no samples.",
      "Downstream reports arrive late and incompletely, which is how the problem went unnoticed for weeks.",
      "Correct. Stratified random sampling of high-confidence extractions measures ongoing error rates per segment and surfaces novel error patterns."
    ],
    takeaway: "Keep sampling auto-approved output, stratified by segment, to measure error rates and catch new patterns."
  },
  {
    id: "s6-19",
    scenario: 6,
    domain: 5,
    task: "5.5",
    type: "multi",
    pick: 3,
    stem: "Your two reviewers can check about 300 extractions a day, but the pipeline processes 9,000. You want to send them the extractions most likely to contain errors. Which THREE routing signals should you use? Select THREE.",
    options: [
      "Extractions of the document type with the highest measured accuracy, to double-check them",
      "Fields whose confidence score falls below a threshold calibrated on a labelled validation set",
      "Records where <code>conflict_detected</code> is true because the source states contradictory values",
      "The longest documents in each day's batch, since length is the best predictor of difficulty",
      "Invoices whose <code>calculated_total</code> differs from the <code>stated_total</code>"
    ],
    answer: [1, 2, 4],
    rationale: [
      "This sends scarce reviewer time to the segment least likely to have errors.",
      "Correct. Low field-level confidence, with thresholds calibrated on labelled data, is a sound signal for routing review.",
      "Correct. Ambiguous or contradictory source documents should go to a human rather than be resolved automatically.",
      "Length is an unvalidated heuristic. Without evidence it predicts errors here, it competes with signals that do.",
      "Correct. A stated vs calculated mismatch is a concrete semantic-validation failure that warrants human review."
    ],
    takeaway: "Route review by calibrated low confidence, contradictory sources and failed semantic checks."
  },
  {
    id: "s6-20",
    scenario: 6,
    domain: 5,
    task: "5.5",
    type: "single",
    pick: 1,
    stem: "Claude outputs a confidence score per field. On a labelled validation set of 1,500 documents, fields scored 0.9 or higher were correct only 81% of the time for <code>vendor_tax_id</code>, but 99% of the time for <code>invoice_date</code>. You currently route every field scored below 0.9 to review. What should you change?",
    options: [
      "Set per-field review thresholds from the labelled set, matching each field's measured accuracy",
      "Ask Claude to be more careful when it scores its confidence for <code>vendor_tax_id</code> in particular",
      "Raise the single threshold to 0.99 for every field so that fewer extraction errors slip past review",
      "Drop the confidence scores and route every <code>vendor_tax_id</code> to human review indefinitely"
    ],
    answer: [0],
    rationale: [
      "Correct. The raw scores mean different things per field. Calibrating thresholds per field against labelled data makes the routing reflect real accuracy.",
      "Asking the model to self-assess more carefully doesn't calibrate it; you still don't know what its scores mean.",
      "A blanket 0.99 cutoff floods reviewers with <code>invoice_date</code> fields that are already 99% correct, wasting limited capacity.",
      "This discards useful signal and permanently spends reviewer time on every tax ID, including the many that are correct."
    ],
    takeaway: "Confidence is only useful once calibrated; set review thresholds per field from a labelled validation set."
  }
]);
