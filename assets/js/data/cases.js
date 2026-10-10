// Worked cases: multi-step incidents, two per official exam scenario.
// Each step's `then` reveals what happened next and sets up the following decision.
window.CASES = (window.CASES || []).concat([
  // ───────────────────────── Scenario 1: Customer Support Resolution Agent ─────────────────────────
  {
    id: "case-s1-a",
    scenario: 1,
    title: "The $84 refund that should have been $840",
    tasks: ["5.1", "1.5", "1.4"],
    brief: "<p>A customer opened a chat about three problems at once: a damaged espresso machine (order <code>ORD-77120</code>, $840.00), a late accessory order, and a duplicate shipping charge. The conversation ran 41 turns. Near the end the agent told the customer: <strong>“I’ve approved a refund of $84 for the machine.”</strong></p><p>The agent runs on the Agent SDK. To stay inside the context budget, the harness replaces older turns with a rolling summary once the history passes 60k tokens. Every <code>lookup_order</code> result is appended to history as returned.</p>",
    evidence: `turn 06  tool_result lookup_order(ORD-77120)  -> 43 fields, 3,912 tokens
          {order_id, status, placed_at, carrier, carrier_svc_code, warehouse_id,
           pick_batch, sku_lines[...], tax_breakdown{...}, promo_stack[...], ...
           total: 840.00, return_window_days: 30, damage_claim_eligible: true, ...}
turn 09  tool_result lookup_order(ORD-77311)  -> 43 fields, 3,640 tokens
turn 14  tool_result lookup_order(ORD-77120)  -> 43 fields, 3,912 tokens   (re-fetched)
turn 22  [harness] history 61,840 tokens > 60,000 -> summarizing turns 1-18
         summary: "Customer has a damaged machine (high-value order) and two
                   smaller issues: a delayed accessory and a shipping fee
                   problem. Customer expects a refund."
turn 39  assistant: "...the machine was about $84 if I recall the line item..."
turn 41  assistant: "I've approved a refund of $84 for the machine."`,
    steps: [
      {
        q: "What is the root cause of the wrong refund amount?",
        options: [
          "The model misread the total field in the 43-field order record at turn 6 and carried the wrong value forward from that point.",
          "lookup_order returned inconsistent totals across the two fetches at turns 6 and 14, so the agent had to pick one of them.",
          "Summarization at turn 22 collapsed the exact amount into ‘high-value order’, and bulky tool results forced that summary early.",
          "The agent lacked a calculator tool, so it estimated the amount mentally from the line items and slipped a decimal place."
        ],
        answer: 2,
        feedback: [
          "Wrong. At turn 6 and turn 14 the record clearly says 840.00, and the agent used it correctly until the history was summarized.",
          "Wrong. Both fetches return the same 840.00 total. The re-fetch is a symptom of the agent losing track, not the cause.",
          "Correct. Progressive summarization turned a transactional fact ($840.00, ORD-77120) into vague prose. Three 43-field order dumps (≈11.5k tokens for ~5 relevant fields) pushed the history over the threshold sooner, so the summary kicked in earlier.",
          "Wrong. No arithmetic was needed; the total is a field in the record. The agent was guessing because the number had been summarized away."
        ],
        then: "<p>Replaying the transcript confirms it: after turn 22 the string <code>840</code> never appears in the context again. The agent’s later answer is a guess. Product wants a fix that holds for 40+ turn, multi-issue chats.</p>"
      },
      {
        q: "Which change most directly prevents a repeat?",
        options: [
          "Keep a persistent case-facts block of IDs, amounts, dates and statuses outside the summarized history, and trim order lookups to the relevant fields.",
          "Raise the summarization threshold from 60k to 150k tokens so the original tool results stay in context for longer conversations.",
          "Tell the summarizer in its prompt to preserve all numbers, and run summarization every 10 turns so each summary covers less text.",
          "Have the agent call lookup_order again immediately before any refund so it always re-reads the authoritative amount from the backend."
        ],
        answer: 0,
        feedback: [
          "Correct. Transactional facts live in a structured block included in every prompt, so summarization can’t erode them. Trimming the 43 fields to the ~5 return-relevant ones (total, status, return_window_days, damage_claim_eligible, placed_at) stops the bloat that triggers summarization.",
          "Wrong. A bigger budget delays the problem, keeps the 43-field noise in context and still loses facts once the threshold is hit. Lost-in-the-middle also gets worse.",
          "Partly helpful but still probabilistic. Summaries keep drifting, and the 3.9k-token tool dumps are untouched. Facts should sit outside the summarized history.",
          "Helps this one tool call but not the general problem: the agent also quotes dates, statuses and the other two issues from memory in conversation."
        ],
        then: "<p>With a case-facts block and trimmed lookups, the agent now quotes <code>$840.00</code> correctly. Next it tries to issue that refund. The system prompt says <em>“Refunds over $500 must go to a human.”</em> Over the last 30 days, logs show <strong>11 of 362</strong> refunds above $500 were issued directly by the agent anyway (3.0%).</p>"
      },
      {
        q: "How should the $500 rule be enforced, and what should happen when it fires?",
        options: [
          "Move the rule to the top of the system prompt in capitals and add three few-shot examples of the agent escalating large refunds correctly.",
          "Have the agent self-report a confidence score before each refund and route to a human whenever confidence is below 0.8 on large amounts.",
          "Lower the refund cap shown in the prompt to $400, so that a 3% overshoot still stays below the real $500 business limit in practice.",
          "Add a PreToolUse hook that denies process_refund above $500 and redirects to escalate_to_human with a structured handoff summary."
        ],
        answer: 3,
        feedback: [
          "Wrong. Prompt emphasis and examples make compliance more likely, not guaranteed. A financial limit needs a deterministic control; prompt guidance has a non-zero failure rate.",
          "Wrong. Self-reported confidence is poorly calibrated, and it doesn’t enforce anything. The agent was already confident when it broke the rule.",
          "Wrong. This still relies on probabilistic compliance and blocks legitimate $400–$500 refunds. The rule must be enforced in code.",
          "Correct. A hook that intercepts the outgoing tool call gives a guaranteed block and redirects to the escalation workflow. The human gets customer ID, order, amount, root cause and recommended action, because they can’t see the transcript."
        ],
        then: "<p>The hook is live. The next over-limit refund is blocked, and <code>escalate_to_human</code> receives <code>{customer_id: C-55102, order_id: ORD-77120, amount: 840.00, root_cause: ‘arrived with cracked boiler, photo verified’, recommended_action: ‘full refund, no return needed’}</code>. The human approves it in 90 seconds without opening the transcript.</p>"
      }
    ],
    lesson: "<ul><li>Progressive summarization erodes amounts, dates and IDs. Keep transactional facts in a persistent case-facts block outside summarized history (5.1).</li><li>Trim verbose tool output (40+ fields when 5 matter) before it accumulates in context.</li><li>Financial limits need a hook that intercepts the tool call, not stronger prompt wording (1.5).</li><li>Escalation hands a human a structured summary: customer ID, root cause, amount, recommended action (1.4).</li></ul>"
  },
  {
    id: "case-s1-b",
    scenario: 1,
    title: "Retry storm on a refund the policy forbids",
    tasks: ["2.2", "5.2"],
    brief: "<p>A customer asks for a refund on a blender bought 47 days ago. The return window is 30 days. The agent called <code>process_refund</code> six times, then told the customer: <strong>“We’re having a technical issue, please try again later.”</strong> The customer came back the next day and the same thing happened.</p><p>Elsewhere in the same week, genuine payment-gateway timeouts were also met with “technical issue”, but there the agent gave up after one attempt.</p>",
    evidence: `14:02:11 tool_use  process_refund {order_id: "ORD-61904", amount: 129.00}
14:02:12 tool_result {"isError": true, "content": "Operation failed"}
14:02:14 tool_use  process_refund {order_id: "ORD-61904", amount: 129.00}
14:02:15 tool_result {"isError": true, "content": "Operation failed"}
   ... 4 more identical attempts ...
14:02:31 assistant "We're having a technical issue, please try again later."

# refund-service internal log, same request id
14:02:12 REJECT ORD-61904 reason=RETURN_WINDOW_EXCEEDED days_since_delivery=47 limit=30

# same week, different conversation
09:41:07 tool_result {"isError": true, "content": "Operation failed"}
         # refund-service: GATEWAY_TIMEOUT upstream=payments 5004ms`,
    steps: [
      {
        q: "Why does the agent retry a policy rejection six times but give up on a real timeout after one?",
        options: [
          "The model is non-deterministic and samples a different retry count on each conversation, so the behaviour is just random variation.",
          "Every failure returns the same ‘Operation failed’ text, so the agent cannot tell a non-retryable business rule from a transient error.",
          "The system prompt has no retry limit, so the agent loops until it decides on its own that further attempts are pointless.",
          "The isError flag should not be set for business-rule rejections, so the agent wrongly reads a refusal as a crash of the service."
        ],
        answer: 1,
        feedback: [
          "Wrong. Some variation exists, but the root cause is that the agent has no information to base a decision on. Both cases look identical to it.",
          "Correct. Uniform error responses hide the category. With no errorCategory or isRetryable signal, the agent guesses: it retries a permanent policy rejection and abandons a retryable timeout.",
          "Wrong. A retry cap would stop the loop sooner but still not distinguish the cases. The agent would still tell the customer it was a technical issue.",
          "Wrong. isError: true is correct for a failed refund. The problem is what the error says, not that it was flagged."
        ],
        then: "<p>The team agrees the tool must say what kind of failure happened. The refund service already knows: <code>RETURN_WINDOW_EXCEEDED</code>, <code>GATEWAY_TIMEOUT</code>, <code>INVALID_AMOUNT</code>, <code>ACCOUNT_LOCKED</code>.</p>"
      },
      {
        q: "What should process_refund return for the 47-day blender?",
        options: [
          "{isError: true, content: ‘RETURN_WINDOW_EXCEEDED’} and leave the agent to look the code up in a table of reason codes kept in the system prompt.",
          "{isError: false, content: ‘Refund not possible’} so the agent treats it as a normal answer and does not retry the call again.",
          "{isError: true, errorCategory: ‘transient’, isRetryable: true, retryAfterSeconds: 3600} so the agent tells the customer to try later.",
          "{isError: true, errorCategory: ‘business’, isRetryable: false, message: ‘Delivered 47 days ago; refunds close at 30. Store credit is available.’}"
        ],
        answer: 3,
        feedback: [
          "Wrong. A bare code shifts interpretation onto prompt text that can drift. Structured metadata plus a human-readable explanation is the pattern.",
          "Wrong. A failed refund reported as success is suppressing the error. The agent may tell the customer the refund went through.",
          "Wrong. It isn’t transient; the order will never come back into the window. Marking it retryable recreates the retry storm.",
          "Correct. The category and isRetryable: false stop wasted retries, and the customer-friendly message (with the alternative) lets the agent explain the decision honestly. The timeout would return errorCategory ‘transient’, isRetryable: true."
        ],
        then: "<p>With structured errors, the agent now explains the 30-day policy and offers store credit. The customer replies:</p><p><em>“Fine, forget the refund. But ShopRival sells this exact blender for $99. Match their price and refund me the $30 difference.”</em></p><p>The price-adjustment policy says: <em>“If the price on our site drops within 14 days of purchase, we refund the difference.”</em> It says nothing about competitors.</p>"
      },
      {
        q: "What should the agent do with the competitor price-match request?",
        options: [
          "Escalate to a human with a structured summary, because the policy is silent on competitor prices and this needs a policy decision.",
          "Decline it, because the policy only lists own-site drops, and anything the policy does not explicitly allow should be refused.",
          "Approve the $30, because the spirit of the price-adjustment policy is to make sure customers never pay more than the market price.",
          "Ask the customer for a screenshot of the competitor listing first, then apply the 14-day own-site rule to the competitor price."
        ],
        answer: 0,
        feedback: [
          "Correct. A policy gap (the policy addresses own-site adjustments only) is an escalation trigger. The agent shouldn’t invent policy in either direction.",
          "Wrong. Treating silence as prohibition is inventing policy. A gap is exactly what humans should decide.",
          "Wrong. The agent would be making a financial policy exception on its own interpretation of intent.",
          "Wrong. Collecting evidence is fine, but applying an own-site rule to a competitor is still the agent creating policy."
        ],
        then: "<p>The escalation carries <code>{customer_id, order_id: ORD-61904, request: ‘competitor price match $30’, policy_status: ‘not covered: own-site adjustments only’, prior_outcome: ‘refund declined, outside 30-day window; store credit offered’}</code>. The policy team later adds a competitor-match clause, and the agent’s escalation criteria are updated with a few-shot example of it.</p>"
      }
    ],
    lesson: "<ul><li>Generic ‘Operation failed’ prevents recovery decisions. Return errorCategory, isRetryable and a human-readable message (2.2).</li><li>Business-rule violations are non-retryable and should carry a customer-friendly explanation the agent can relay.</li><li>Never report a failure as success. Silence and empty success hide the problem.</li><li>Policy gaps (e.g. competitor price matching when policy covers own-site only) are an escalation trigger, not something to resolve by interpretation (5.2).</li></ul>"
  },

  // ───────────────────────── Scenario 2: Code Generation with Claude Code ─────────────────────────
  {
    id: "case-s2-a",
    scenario: 2,
    title: "The new hire whose Claude ignores the house rules",
    tasks: ["3.1", "3.3"],
    brief: "<p>Priya joined the platform team on Monday. Claude Code writes Terraform for her with hard-coded regions and no <code>tags</code> block, and it writes API handlers that throw raw errors instead of returning the team’s <code>ApiError</code> envelope. Her teammate Marco gets correct output for the same prompts on the same commit.</p><p>Both cloned the same repository and run the same Claude Code version.</p>",
    evidence: `# Priya: /memory
Memory files loaded:
  ./CLAUDE.md                        (38 lines)

# Marco: /memory
Memory files loaded:
  ~/.claude/CLAUDE.md                (412 lines)
  ./CLAUDE.md                        (38 lines)

# head of Marco's ~/.claude/CLAUDE.md
## Terraform
- Never hard-code regions; use var.region
- Every resource gets tags = local.common_tags
## API handlers
- Return ApiError{code, message, details}; never throw
## My preferences
- Explain diffs tersely, I use vim keybindings`,
    steps: [
      {
        q: "Why does Priya get different output from Marco?",
        options: [
          "Priya’s Claude Code cached an older copy of the project CLAUDE.md from before the rules were added, so it needs a cache clear.",
          "The project CLAUDE.md is too short to influence generation; conventions only stick once the memory file passes a size threshold.",
          "Marco’s session also loads a subdirectory CLAUDE.md under terraform/ that Priya’s checkout is missing because of a sparse clone.",
          "The team conventions live in Marco’s user-level ~/.claude/CLAUDE.md, which applies only to him and is never shared through git."
        ],
        answer: 3,
        feedback: [
          "Wrong. /memory shows both load the same 38-line project file. There’s no cache issue.",
          "Wrong. There’s no size threshold. The difference is which files are loaded at all.",
          "Wrong. /memory lists every loaded memory file, and neither shows a terraform/ CLAUDE.md.",
          "Correct. /memory shows the extra file is Marco’s user-level CLAUDE.md. User-level instructions aren’t version-controlled, so new teammates never get them."
        ],
        then: "<p>Marco agrees the Terraform and API rules belong to the team, and his vim note stays personal. A first attempt pastes everything into the root <code>CLAUDE.md</code>, which grows to 390 lines. Now a frontend dev complains that every React session carries 140 lines of Terraform and API rules. Terraform lives in <code>infra/terraform/</code> and also in <code>services/*/deploy/terraform/</code> (17 services).</p>"
      },
      {
        q: "How should the Terraform conventions be organised?",
        options: [
          "Put a CLAUDE.md with the Terraform rules in infra/terraform/ and copy the same file into each of the 17 service deploy folders.",
          "Move them to .claude/rules/terraform.md with paths frontmatter matching **/*.tf, so they load only when Terraform files are edited.",
          "Turn the Terraform rules into a skill in .claude/skills/terraform/ so developers can invoke them whenever they are editing infra code.",
          "Keep them in the root CLAUDE.md but under a clear ‘Terraform only’ header, so Claude knows to ignore them in other contexts."
        ],
        answer: 1,
        feedback: [
          "Wrong. Directory-level CLAUDE.md files are bound to one folder. 18 copies will drift and the next service will be missed.",
          "Correct. Path-scoped rules load only when matching files are touched, wherever they live. That removes the noise from React sessions and covers all 18 Terraform locations with one file.",
          "Wrong. Skills load on demand when invoked or judged relevant. Conventions that must apply automatically by file type belong in path-scoped rules.",
          "Wrong. It still loads into every session and relies on Claude inferring relevance. That is exactly the token cost the frontend dev reported."
        ],
        then: "<p><code>.claude/rules/terraform.md</code> with <code>paths: [\"**/*.tf\", \"**/*.tfvars\"]</code> is committed and works. Next, the monorepo’s three packages (<code>payments</code>, <code>ledger</code>, <code>web</code>) each need different subsets of five shared standards docs in <code>docs/standards/</code> (money-handling, pii, error-envelope, i18n, accessibility). Each package maintainer knows which apply.</p>"
      },
      {
        q: "How should each package pull in the standards that apply to it?",
        options: [
          "Copy the full text of the relevant standards into each package’s CLAUDE.md so each package stays self-contained and readable.",
          "Add all five standards to the root CLAUDE.md so every package always has every standard loaded, whatever the maintainer thinks.",
          "In each package’s CLAUDE.md, @import only the standards files the maintainer says apply, e.g. @docs/standards/money-handling.md.",
          "Create one personal skill per standard in ~/.claude/skills/ and ask every developer to invoke the right ones before starting work."
        ],
        answer: 2,
        feedback: [
          "Wrong. Copies drift from the source docs. @import references the single source of truth.",
          "Wrong. web doesn’t need money-handling, and ledger doesn’t need accessibility. Loading all of them adds noise.",
          "Correct. @import keeps CLAUDE.md modular and lets each package include exactly the standards its maintainer selects, with one source file per standard.",
          "Wrong. Personal skills aren’t shared, and relying on manual invocation makes standards optional."
        ],
        then: "<p><code>packages/payments/CLAUDE.md</code> now imports money-handling, pii and error-envelope; <code>packages/web/CLAUDE.md</code> imports i18n and accessibility. Priya runs <code>/memory</code> while editing a payments file and sees the project file, the payments file and its three imports loaded, matching Marco’s session.</p>"
      }
    ],
    lesson: "<ul><li>~/.claude/CLAUDE.md is personal and not shared. Team rules go in the project CLAUDE.md, committed. Use /memory to see what is loaded (3.1).</li><li>Conventions for a file type spread across directories belong in .claude/rules/ with a paths glob, not copied directory CLAUDE.md files (3.3).</li><li>@import lets each package include only the standards its maintainer selects.</li><li>Skills are on-demand; CLAUDE.md and path rules are automatic.</li></ul>"
  },
  {
    id: "case-s2-b",
    scenario: 2,
    title: "Swapping a date library across 52 files",
    tasks: ["3.4", "3.5"],
    brief: "<p>The team must replace <code>moment</code> with <code>date-fns</code> in a TypeScript service. A quick count shows 52 files import moment. Two approaches are on the table: a thin adapter module that wraps date-fns behind the old call shapes, or rewriting every call site directly. Some files format dates for invoices that customers see.</p>",
    evidence: `$ grep -rl "from 'moment'" src | wc -l
52
$ grep -rho "moment([^)]*)\\.[a-zA-Z]*" src | sort | uniq -c | sort -rn | head
  118 moment().format
   64 moment(x).add
   41 moment.tz
   23 moment(x).isBefore
   17 moment.duration
    9 moment(x).locale`,
    steps: [
      {
        q: "How should the developer start this task in Claude Code?",
        options: [
          "Use plan mode to explore usage and choose between adapter and direct rewrite, then switch to direct execution to carry out the plan.",
          "Use direct execution file by file, letting the right approach emerge from how the first few converted files turn out in review.",
          "Use direct execution with a detailed prompt that specifies the adapter approach, since the grep output already shows the usage.",
          "Use plan mode for the entire migration, including every edit, so that each of the 52 files is approved before anything changes."
        ],
        answer: 0,
        feedback: [
          "Correct. Multi-file change, two valid approaches and customer-visible output: plan mode for investigation and design, then direct execution for the agreed plan.",
          "Wrong. Letting the approach emerge from edits risks rework across dozens of files when moment.tz or locale cases surface late.",
          "Wrong. The grep counts calls but doesn’t answer the design question. Committing to the adapter before exploring timezone and locale usage is premature.",
          "Wrong. Plan mode is for exploration and design. Once the plan is approved, implementation is direct execution."
        ],
        then: "<p>The plan picks direct rewrite plus a small <code>formatDate()</code> helper for the 118 <code>format</code> calls. Claude implements the helper from the prompt <em>“convert moment format tokens to date-fns equivalents”</em>. Results are inconsistent: <code>YYYY</code> becomes <code>yyyy</code> in one run but stays <code>YYYY</code> in another (which in date-fns means week-numbering year), and <code>Do</code> is handled differently each time.</p>"
      },
      {
        q: "What is the most effective way to get consistent conversions?",
        options: [
          "Rewrite the instruction in more detail, describing the token rules for years, days and ordinals in several precise paragraphs of prose.",
          "Ask Claude to explain each conversion step by step before writing code, so its reasoning about every token is visible for review.",
          "Give 2–3 concrete input/output pairs, e.g. ‘YYYY-MM-DD’ → ‘yyyy-MM-dd’ and ‘MMM Do, YYYY’ → ‘MMM do, yyyy’.",
          "Switch to a larger model for the helper, since token mapping between two libraries needs more knowledge than the default has."
        ],
        answer: 2,
        feedback: [
          "Wrong. More prose is what was already being read inconsistently. Concrete examples remove the ambiguity.",
          "Wrong. Visible reasoning may help review but doesn’t pin the expected transformation.",
          "Correct. When prose is interpreted inconsistently, 2–3 concrete input/output examples are the most effective way to communicate the transformation.",
          "Wrong. The problem is an ambiguous specification, not missing capability."
        ],
        then: "<p>The helper now converts tokens consistently. The test suite (written first, covering invoice formats) shows two remaining failures:</p><p>1. <code>formatDate(&#39;2026-03-29T01:30:00Z&#39;, &#39;Europe/Madrid&#39;)</code> is one hour off around the DST switch.<br>2. Invoice dates rendered in the customer’s locale use the server timezone instead of the customer’s.</p><p>Both are in <code>formatDate</code>’s timezone-resolution path, and a fix to one changes the input to the other.</p>"
      },
      {
        q: "How should the developer give Claude these two failures?",
        options: [
          "Send the DST failure first and the locale failure only after the first fix is merged, so each change can be reviewed on its own.",
          "Send both failures in one detailed message, with the failing tests and expected outputs, because the fixes interact in one code path.",
          "Re-run the full suite and let Claude fix whichever failure shows up first, repeating until the test run comes back green.",
          "Ask Claude to interview the developer about timezones before it touches anything, then fix both failures based on the answers."
        ],
        answer: 1,
        feedback: [
          "Wrong. Sequential iteration suits independent problems. Here fixing DST changes the input to the locale path, so one-at-a-time fixes can undo each other.",
          "Correct. Interacting issues go in a single detailed message so Claude can design one consistent fix. Sharing the specific test failures drives test-driven iteration.",
          "Wrong. Whack-a-mole on interacting failures tends to oscillate.",
          "Wrong. The interview pattern is for surfacing considerations in an unfamiliar domain before implementing. The requirements here are already pinned by tests."
        ],
        then: "<p>One message with both failing tests and expected outputs produces a single change: resolve the customer timezone first, then apply DST-aware conversion. All 214 tests pass, and the 52-file migration ships in two PRs following the approved plan.</p>"
      }
    ],
    lesson: "<ul><li>Plan mode for multi-file work with several valid approaches, then direct execution for the plan (3.4).</li><li>When prose is read inconsistently, give 2–3 concrete input/output examples (3.5).</li><li>Write tests first and iterate by sharing failures.</li><li>Interacting issues go in one detailed message; independent issues can be fixed one after another.</li></ul>"
  },

  // ───────────────────────── Scenario 3: Multi-Agent Research System ─────────────────────────
  {
    id: "case-s3-a",
    scenario: 3,
    title: "“No peer-reviewed studies exist”",
    tasks: ["5.3", "2.2", "5.6"],
    brief: "<p>The system produced a report on <em>“microplastics in municipal drinking water”</em>. Its methodology section says: <strong>“No peer-reviewed studies on this topic were found.”</strong> A reviewer knows of at least a dozen. The coordinator delegated to a web-search subagent and a document-analysis subagent that queries a journal database through an MCP tool.</p>",
    evidence: `[doc-analysis] tool_use journal_search {"q": "microplastics drinking water", "years": "2018-2026"}
[doc-analysis] journal-mcp  HTTP 403  {"error":"institutional token expired"}
[doc-analysis] tool_result  {"isError": false, "content": {"results": [], "total": 0}}
[doc-analysis] final: {"findings": [], "status": "complete"}
[coordinator]  doc-analysis returned 0 findings; web-search returned 14
[synthesis]    "No peer-reviewed studies on this topic were found."`,
    steps: [
      {
        q: "Where is the defect?",
        options: [
          "The synthesis agent over-generalised from 14 web results and should have searched the journal database itself before writing.",
          "The journal tool turned a 403 access failure into an empty successful result, so the coordinator saw ‘valid, no matches’.",
          "The coordinator decomposed the topic too narrowly and never asked the doc-analysis agent to look for peer-reviewed research.",
          "The doc-analysis query string was too specific and should have been broadened before concluding that nothing exists."
        ],
        answer: 1,
        feedback: [
          "Wrong. Synthesis reported what it was given. Giving it search tools would also break role separation.",
          "Correct. An access failure was silently suppressed as an empty success. A valid empty result means ‘searched, nothing matched’; this was ‘couldn’t search’. Every agent downstream acted reasonably on false information.",
          "Wrong. The log shows the doc-analysis agent was assigned the journal search and ran it.",
          "Wrong. The query never executed: the server returned 403."
        ],
        then: "<p>The team rewrites the journal MCP tool and the doc-analysis subagent’s error handling. They also notice that a 503 from the same server last week aborted an entire research run with an unhandled exception.</p>"
      },
      {
        q: "Which error-handling design should they adopt?",
        options: [
          "Retry transient errors locally; propagate what can’t be fixed as structured context (failure type, query tried, partial results, alternatives).",
          "Retry every failure up to five times with backoff, then return a generic ‘journal search unavailable’ status to the coordinator.",
          "Raise all tool failures as exceptions to a top-level handler so the run stops and an operator investigates before results ship.",
          "Return empty results on any failure but add a warning line to the subagent log so engineers can inspect failed queries later."
        ],
        answer: 0,
        feedback: [
          "Correct. Transient errors (503, timeout) are retried inside the subagent. A 403 is a permission error and isn’t retryable, so it goes to the coordinator with what was tried and any partial results, so the coordinator can reroute or annotate the gap.",
          "Wrong. Retrying a 403 five times is wasted effort, and a generic status hides the context the coordinator needs.",
          "Wrong. Terminating the whole workflow on one failure is an anti-pattern when partial results and alternatives exist.",
          "Wrong. That is the same silent suppression that caused this incident. A log line doesn’t reach the coordinator or the report."
        ],
        then: "<p>With the token renewed and structured errors in place, a rerun returns 23 findings. The report now carries a coverage note where a source was unreachable. A new complaint arrives: the report says <em>“Estimates of households affected are contradictory: 38% vs 61%.”</em> The subagent outputs show:</p><p><code>{claim: ‘38% of sampled households’, source: ‘EPA survey’}</code><br><code>{claim: ‘61% of sampled households’, source: ‘WHO review’}</code></p><p>The EPA survey sampled in 2019; the WHO review collected data in 2025.</p>"
      },
      {
        q: "What change prevents this misreading?",
        options: [
          "Tell synthesis to always report the most recent statistic when two sources disagree and drop the older one from the report.",
          "Average the conflicting values and report 49.5% with a footnote naming both sources so the reader still sees a single number.",
          "Have the coordinator pick the source with higher authority and pass only that value on to the synthesis subagent for the report.",
          "Require subagents to include publication and data-collection dates in each structured finding, so synthesis can read it as change over time."
        ],
        answer: 3,
        feedback: [
          "Wrong. The rule happens to help here but discards a valid data point. Synthesis needs the dates to interpret, and genuinely conflicting same-period values must still be shown with attribution.",
          "Wrong. Averaging invents a number neither source reported and hides a real temporal trend.",
          "Wrong. Arbitrarily selecting one credible value loses information. Conflicts are annotated with attribution.",
          "Correct. Without dates, a 2019 vs 2025 difference looks like a contradiction. Dates in the claim-source mapping let synthesis present it as a trend and keep real conflicts flagged with their sources."
        ],
        then: "<p>Findings now carry <code>{claim, source_url, excerpt, collected: ‘2019’, published: ‘2021-04’}</code>. The report presents the figures as a rise from 38% (2019) to 61% (2025) in a table, and reserves its ‘contested findings’ section for two 2025 studies that genuinely disagree on particle-size thresholds, each attributed.</p>"
      }
    ],
    lesson: "<ul><li>Distinguish access failures from valid empty results. Never return an empty success for a failed query (5.3, 2.2).</li><li>Retry transient errors locally; propagate the rest with failure type, attempted query, partial results and alternatives. Don’t abort the whole workflow.</li><li>Require publication and collection dates so temporal differences aren’t read as contradictions (5.6).</li><li>Genuine conflicts are kept and attributed, not averaged or arbitrarily resolved.</li></ul>"
  },
  {
    id: "case-s3-b",
    scenario: 3,
    title: "A slow pipeline that forgets everything when it crashes",
    tasks: ["1.3", "5.4", "1.2"],
    brief: "<p>A research run on <em>“grid-scale battery storage economics”</em> takes 19 minutes. The synthesis subagent’s output begins: <strong>“I don’t have any research findings to work with. Based on general knowledge…”</strong> and the report is mostly uncited.</p>",
    evidence: `[coordinator] turn 1  Task(web-search,   prompt="Search for battery storage cost data")
[coordinator] turn 2  Task(web-search,   prompt="Search for policy incentives")
[coordinator] turn 3  Task(doc-analysis, prompt="Analyze the uploaded IEA and NREL PDFs")
[coordinator] turn 4  Task(synthesis,    prompt="Synthesize the research findings above into a report")
               -> synthesis input tokens: 412
[coordinator] allowedTools: ["Task", "Read"]
timings: web-search 4m10s, web-search 3m55s, doc-analysis 5m40s, synthesis 2m30s`,
    steps: [
      {
        q: "Why did the synthesis subagent have no findings?",
        options: [
          "The coordinator’s allowedTools lacks WebSearch, so the search subagents could not actually run any of their queries.",
          "The synthesis subagent’s context window was too small to hold the three subagent outputs, so they were truncated to nothing.",
          "Subagents don’t inherit the coordinator’s history; ‘the research findings above’ refers to nothing in synthesis’s own context.",
          "Synthesis should have been invoked in the same turn as the others so it could share their memory while they were running."
        ],
        answer: 2,
        feedback: [
          "Wrong. Subagents have their own tool sets; the coordinator only needs Task to spawn them. The search agents did return results.",
          "Wrong. Synthesis received only 412 input tokens, essentially just the one-line prompt.",
          "Correct. Subagent context must be passed explicitly in the Task prompt. The findings were in the coordinator’s context, not in synthesis’s.",
          "Wrong. Subagents never share memory, whatever turn they run in. Synthesis also depends on the other outputs, so it must run after them."
        ],
        then: "<p>The coordinator now passes the complete findings into the synthesis prompt as structured data <code>{claim, source_url, doc_name, page, date}</code>, and synthesis cites properly. Runtime is still 19 minutes, and stakeholders want under 10.</p>"
      },
      {
        q: "How should the coordinator cut latency?",
        options: [
          "Merge the two web-search tasks and doc analysis into one subagent with all their tools, so that there are fewer handoffs.",
          "Lower each subagent’s max_turns so every task finishes sooner, accepting somewhat thinner coverage in the final report.",
          "Have each search subagent stream partial results to synthesis directly as it works, bypassing the coordinator to save time.",
          "Emit the two web-search tasks and doc analysis as three Task calls in one coordinator response, then call synthesis."
        ],
        answer: 3,
        feedback: [
          "Wrong. One agent with every tool degrades tool selection and loses the parallelism.",
          "Wrong. It trades quality for speed without addressing the real waste: independent tasks running one after another.",
          "Wrong. Direct subagent-to-subagent communication breaks hub-and-spoke routing, along with observability and consistent error handling.",
          "Correct. Several Task calls in a single response run in parallel. The three independent tasks finish in ≈5m40s (the slowest), and synthesis follows: ≈8 minutes in total."
        ],
        then: "<p>Runs now take about 8 minutes. During a large 30-subtopic run, the coordinator process is killed by a deploy after 26 minutes, with 21 subtopics done. The restart begins from zero, re-runs every search and costs another 35 minutes.</p>"
      },
      {
        q: "What design lets a run survive a crash?",
        options: [
          "Have each agent export its state to a known location; on resume, the coordinator loads a manifest and injects that state into prompts.",
          "Resume the coordinator’s session with --resume, which restores the subagents’ in-flight context and finishes the pending tasks.",
          "Keep all subagent outputs in the coordinator’s conversation, and rely on the SDK’s automatic compaction to keep them there.",
          "Lower the subtopic count per run to 10 so any crash loses at most 10 subtopics’ worth of work before the run is restarted."
        ],
        answer: 0,
        feedback: [
          "Correct. Structured state persistence: completed subtopics are saved with their findings, the coordinator reads the manifest on restart, skips what’s done, and injects the saved findings into prompts.",
          "Wrong. Resuming restores the coordinator’s conversation, not the subagents’ in-flight work, and won’t tell it which results were durably finished.",
          "Wrong. Conversation memory dies with the process, and compaction drops detail.",
          "Wrong. Smaller runs bound the loss but don’t recover anything."
        ],
        then: "<p>The next crash, at 18 of 30 subtopics, resumes in 40 seconds: the manifest marks 18 as complete with file paths to their findings, and only the remaining 12 are dispatched, in parallel.</p>"
      }
    ],
    lesson: "<ul><li>Subagents don’t inherit context. Put complete prior findings in the Task prompt, as structured data that keeps source metadata (1.3).</li><li>Parallelism comes from several Task calls in one coordinator response. Keep all routing through the coordinator (1.2).</li><li>Crash recovery: each agent exports state to a known location, and the coordinator loads a manifest on resume and injects it into prompts (5.4).</li></ul>"
  },

  // ───────────────────────── Scenario 4: Developer Productivity with Claude ─────────────────────────
  {
    id: "case-s4-a",
    scenario: 4,
    title: "The code-index server nobody’s agent uses",
    tasks: ["2.4", "2.1", "2.5"],
    brief: "<p>The platform team runs <code>codeindex</code>, an MCP server with a <code>find_references</code> tool that resolves symbols through re-exports and dependency injection across 140 services. The exploration agent still uses <code>Grep</code>: it returns 2,400 raw matches for <code>chargeCustomer</code> and misses callers that import it through a <code>billing/index.ts</code> wrapper under another name.</p>",
    evidence: `# tools/list from codeindex
{ "name": "find_references",
  "description": "Search code.",
  "inputSchema": {"type":"object","properties":{"q":{"type":"string"}}} }

# agent transcript
> Find every caller of chargeCustomer
tool_use Grep {"pattern": "chargeCustomer", "path": "."}
tool_result 2,412 matches in 380 files (truncated)`,
    steps: [
      {
        q: "What is the most effective first fix?",
        options: [
          "Remove Grep from the agent’s allowed tools so it has no choice but to call find_references for every code search.",
          "Add a system-prompt rule saying ‘Always use codeindex for code search; never use Grep for anything in this repository.’",
          "Add few-shot examples to the system prompt that show the agent choosing find_references for five different symbol lookups.",
          "Rewrite the description: what it resolves (re-exports, DI, aliases), input format, what it returns, and when to prefer it over Grep."
        ],
        answer: 3,
        feedback: [
          "Wrong. Grep remains the right tool for error strings and text patterns. Removing it trades one problem for another.",
          "Wrong. A blanket keyword rule creates the opposite misrouting for text searches and doesn’t explain what the tool does.",
          "Wrong. Examples add tokens without fixing the root cause: the agent can’t tell from ‘Search code.’ what the tool does better.",
          "Correct. Tool descriptions are the main selection signal. Explaining capabilities and outputs in detail stops the agent from preferring a built-in tool over a more capable MCP tool."
        ],
        then: "<p>With the new description the agent picks <code>find_references</code> for symbol questions and still uses Grep for log strings. But only Dana’s agent can reach the server. It is configured in her <code>~/.claude.json</code> with her personal token pasted in. Three other developers copied her block into their own files, one of them with her token.</p>"
      },
      {
        q: "How should codeindex be configured for the team?",
        options: [
          "Commit Dana’s ~/.claude.json to the repository so every developer gets the identical configuration on clone.",
          "Add it to project .mcp.json with the token as \${CODEINDEX_TOKEN}, and have each developer set the variable locally.",
          "Add it to project .mcp.json with a shared service token pasted in, since the repository is private and access is controlled.",
          "Keep it in each developer’s ~/.claude.json, and post the setup block on the wiki for new joiners to copy by hand."
        ],
        answer: 1,
        feedback: [
          "Wrong. ~/.claude.json is a personal, user-level file holding other settings and secrets. It doesn’t belong in a repo.",
          "Correct. Shared team tooling goes in project-scoped .mcp.json. Environment-variable expansion keeps credentials out of version control.",
          "Wrong. Committing a secret, even in a private repo, is the thing env-var expansion exists to avoid.",
          "Wrong. User scope is for personal or experimental servers. Shared tooling copied by hand drifts and spreads tokens."
        ],
        then: "<p>Everyone now has codeindex. Dana keeps an experimental <code>perf-traces</code> server in her own <code>~/.claude.json</code>, and both servers’ tools appear together in her sessions. A new pattern shows up in transcripts: before answering a question the agent calls <code>list_services</code>, then <code>describe_service</code> on 20–30 services just to learn which ones own billing, averaging <strong>27 calls and 41k tokens</strong> per question.</p>"
      },
      {
        q: "What reduces this exploratory overhead?",
        options: [
          "Add a get_all_services tool that returns the complete descriptions of all 140 services in a single, very large tool call.",
          "Cap the agent at five tool calls per question so it stops exploring and answers from what it has found by that point.",
          "Expose the service catalog (name, owner, domain, entry points) as an MCP resource the agent can read once instead of probing.",
          "Pre-load the full source of the 10 most-used services into the system prompt so the agent rarely needs to look anything up."
        ],
        answer: 2,
        feedback: [
          "Wrong. Better than 27 calls, but it pushes all 140 full descriptions into context. A compact catalog is the right shape.",
          "Wrong. An arbitrary cap starves legitimate investigation without giving the agent the map it is missing.",
          "Correct. MCP resources expose content catalogs so agents can see what data exists without exploratory tool calls.",
          "Wrong. That is a huge, mostly irrelevant token cost on every request, and it covers only 10 of the 140 services."
        ],
        then: "<p>The <code>codeindex://services</code> resource is ~3k tokens. The agent reads it, goes straight to <code>billing-core</code> and <code>invoicing</code>, and the average falls to <strong>4 calls and 9k tokens</strong> per question.</p>"
      }
    ],
    lesson: "<ul><li>A detailed MCP tool description (capabilities, inputs, outputs, when to prefer it) stops agents defaulting to Grep (2.1, 2.4).</li><li>Shared servers go in .mcp.json with \${VAR} expansion; personal or experimental ones in ~/.claude.json. All configured servers’ tools are available at once.</li><li>Expose catalogs as MCP resources to avoid exploratory tool calls.</li><li>Grep for content, Glob for paths. Plain-text Grep misses callers that import a function under another name through a wrapper (2.5).</li></ul>"
  },
  {
    id: "case-s4-b",
    scenario: 4,
    title: "Adding tests to a 12-year-old billing module",
    tasks: ["1.6", "2.5", "1.7"],
    brief: "<p>An engineer asks the productivity agent: <em>“Add comprehensive tests to <code>legacy/billing</code>.”</em> The module has 61 files, 4% line coverage, no fixtures, and several files over 2,000 lines. The agent has Read, Write, Edit, Bash, Grep and Glob.</p>",
    evidence: `$ find legacy/billing -name "*.py" | wc -l
61
$ coverage report --include="legacy/billing/*" | tail -1
TOTAL     18,204   17,476    4%
# git log --since=1.year legacy/billing --format= --name-only | sort | uniq -c | sort -rn | head -3
   47 legacy/billing/proration.py
   31 legacy/billing/tax/rules.py
   28 legacy/billing/invoice_builder.py`,
    steps: [
      {
        q: "How should the agent decompose this task?",
        options: [
          "Map the module structure first, pick high-impact areas such as the most-changed files, then follow a prioritised plan that adapts as dependencies appear.",
          "Generate tests file by file in alphabetical order using a fixed prompt chain: read the file, write tests, run them, then move on to the next.",
          "Read all 61 files into context first so the agent has the complete picture of the module before writing any of its tests.",
          "Spawn 61 parallel subagents, one per file, each told to write comprehensive tests for its file independently of the others."
        ],
        answer: 0,
        feedback: [
          "Correct. Open-ended tasks need dynamic decomposition: map, prioritise by impact (proration.py has 47 changes this year), then adapt the plan as dependencies such as shared tax rules surface.",
          "Wrong. A fixed pipeline suits predictable multi-aspect reviews, not open-ended investigation. Alphabetical order ignores impact.",
          "Wrong. Reading everything up front exhausts context. Build understanding incrementally with Grep and Read.",
          "Wrong. No prioritisation, much duplication of shared fixtures, and each agent rediscovers the same dependencies."
        ],
        then: "<p>The agent starts with <code>proration.py</code>. Grep shows it imports helpers from <code>tax/rules.py</code>, so shared fixtures are planned first. While adding a test hook, its <code>Edit</code> call fails:</p><p><code>Error: old_string found 4 times in legacy/billing/proration.py. Provide a unique match.</code></p><p>The file has four near-identical <code>if plan.interval == …:</code> blocks, and it is 2,340 lines long.</p>"
      },
      {
        q: "What should the agent do after Edit fails for a non-unique match?",
        options: [
          "Retry the same Edit a few times, since the anchor text may match uniquely once earlier edits in the session have been applied.",
          "Switch to a Bash sed one-liner that replaces the first occurrence of the anchor text, then re-run the tests to confirm.",
          "Use Read to load the full file, make the change in the correct block, and Write the whole file back.",
          "Use Glob to locate a different file with a unique anchor and put the test hook there instead of in proration.py."
        ],
        answer: 2,
        feedback: [
          "Wrong. Nothing changes between attempts; the text still appears four times.",
          "Wrong. Replacing the first occurrence may hit the wrong one of four identical blocks, and it bypasses the file tools’ safeguards.",
          "Correct. When Edit can’t find unique anchor text, the documented fallback is Read the full file and Write it back with the targeted change.",
          "Wrong. That changes the design to suit a tool limitation, and Glob finds files by name, not by content."
        ],
        then: "<p>By end of day, the named session <code>billing-tests</code> has analysed 34 files and added 112 tests. Overnight two teammates merge changes touching <code>proration.py</code> and <code>tax/rules.py</code>. Nothing else in the module changed. Next morning the engineer wants to continue.</p>"
      },
      {
        q: "How should the engineer continue?",
        options: [
          "Start a brand-new session and have it re-explore all 61 files, since any earlier analysis might now be out of date.",
          "Run --resume billing-tests and tell it that proration.py and tax/rules.py changed overnight so it re-analyses just those two.",
          "Run --resume billing-tests with no extra prompt; the agent will notice the changed files when it next reads them.",
          "Use fork_session from yesterday’s baseline to create two branches, one that has the new changes and one without them."
        ],
        answer: 1,
        feedback: [
          "Wrong. Only 2 of 34 analysed files changed. Prior context is mostly valid, so full re-exploration wastes it.",
          "Correct. Resume when prior context is mostly valid, and name the changed files for targeted re-analysis. If most results were stale, a fresh session with a structured summary would be better.",
          "Wrong. The agent holds stale tool results for those files and may reason from them without re-reading. Tell it explicitly.",
          "Wrong. fork_session is for exploring divergent approaches from a shared baseline, not for absorbing upstream changes."
        ],
        then: "<p>The resumed session re-reads the two files, updates 9 affected tests and continues with <code>invoice_builder.py</code>. Later the engineer forks the session to compare snapshot-style versus property-based tests for <code>tax/rules.py</code> from the same analysis baseline.</p>"
      }
    ],
    lesson: "<ul><li>Open-ended tasks use dynamic decomposition: map structure, prioritise high-impact areas, adapt the plan (1.6).</li><li>Edit needs a unique anchor. When it fails, fall back to Read + Write (2.5).</li><li>--resume &lt;name&gt; when prior context is mostly valid, and say which files changed; start fresh with a summary when results are stale (1.7).</li><li>fork_session is for comparing divergent approaches from one baseline.</li></ul>"
  },

  // ───────────────────────── Scenario 5: Claude Code for Continuous Integration ─────────────────────────
  {
    id: "case-s5-a",
    scenario: 5,
    title: "The review bot developers have learned to ignore",
    tasks: ["4.1", "4.4", "4.2"],
    brief: "<p>Six weeks after launch, the CI review bot’s comments are resolved without reply 64% of the time. A survey says developers <em>“skim past the bot”</em>. Last month the bot correctly flagged an SQL injection in <code>reports/export.py</code>; the comment was dismissed and the bug shipped.</p>",
    evidence: `# review prompt excerpt
"Review the diff for bugs, security problems, performance issues and
 inaccurate comments. Be conservative and only report high-confidence
 findings."

# 30-day dismissal stats by category (n = 1,180 findings)
category         findings  dismissed
security             74        9%
logic_bug           188       21%
performance         241       58%
comment_accuracy    677       87%`,
    steps: [
      {
        q: "Why didn’t ‘be conservative, only high-confidence findings’ fix the noise?",
        options: [
          "The model needs a numeric threshold (e.g. ‘confidence ≥ 0.9’) rather than words for it to filter findings reliably.",
          "General caution instructions don’t define what to report; specific categorical criteria are what improve precision.",
          "The instruction appears at the end of the prompt, where lost-in-the-middle effects cause the model to discount it.",
          "Conservative wording suppresses the security and bug findings more than the stylistic ones, which skews the mix."
        ],
        answer: 1,
        feedback: [
          "Wrong. Self-reported confidence isn’t calibrated, so a numeric threshold on it is still not a precision control.",
          "Correct. ‘Be conservative’ and ‘high-confidence only’ fail to improve precision. Explicit criteria (e.g. flag a comment only when its claimed behaviour contradicts the code) are what work.",
          "Wrong. The end of a prompt is well attended. Placement isn’t the issue.",
          "Wrong. The stats show the opposite: comment_accuracy dominates the noise."
        ],
        then: "<p>The team starts writing explicit criteria for each category. That will take a couple of weeks. Meanwhile, comment_accuracy produces 57% of all findings with an 87% dismissal rate, and developers are dismissing security findings along with them.</p>"
      },
      {
        q: "What should they do right now, while the criteria are written?",
        options: [
          "Keep all categories but add ‘[low confidence]’ labels to comment_accuracy findings so developers know to read them sceptically.",
          "Raise the bot’s overall threshold so it posts at most three findings per PR, ranked by the model’s own severity estimate.",
          "Move all bot findings into one summary comment at the bottom of the PR instead of posting them inline at each line.",
          "Temporarily disable the comment_accuracy category to restore trust, and re-enable it once its criteria are tested."
        ],
        answer: 3,
        feedback: [
          "Wrong. The noise stays, and labels based on uncalibrated confidence don’t rebuild trust.",
          "Wrong. Ranking by self-estimated severity may still drop the SQL injection while keeping noise.",
          "Wrong. Fewer, better-placed comments don’t change the 87% false-positive rate.",
          "Correct. High false-positive categories undermine trust in the accurate ones. Turning off the noisy category while its prompt is improved restores confidence in security and logic findings."
        ],
        then: "<p>Dismissals drop to 19%. The new comment_accuracy criterion is <em>“flag only when the comment’s claimed behaviour contradicts what the code does”</em>, with severity examples. In a shadow test it still has a 41% dismissal rate, and nobody can say <em>which</em> code constructs trigger the dismissed findings.</p>"
      },
      {
        q: "What change to the findings will let the team find the remaining false-positive sources?",
        options: [
          "Add a detected_pattern field to each structured finding, so dismissals can be grouped by the code construct that triggered them.",
          "Ask the bot to add a free-text explanation to each finding, so reviewers can read why it fired before they dismiss it.",
          "Run the review three times and keep only comment_accuracy findings that appear in at least two of the three runs.",
          "Have the bot self-report a confidence score for each finding and log it next to the developer’s dismissal decision."
        ],
        answer: 0,
        feedback: [
          "Correct. A detected_pattern field (e.g. ‘docstring-param-mismatch’, ‘TODO-claims-unimplemented’) turns dismissals into data you can analyse, showing which patterns to fix or add as few-shot counter-examples.",
          "Wrong. Free text is hard to aggregate across 400 findings. Structured fields enable systematic analysis.",
          "Wrong. Consensus voting suppresses intermittent true positives and doesn’t tell you why false positives happen.",
          "Wrong. Uncalibrated confidence doesn’t say which construct causes false positives."
        ],
        then: "<p>Grouping by <code>detected_pattern</code> shows 70% of the dismissed findings come from <code>docstring-type-hint-mismatch</code> in files with typed signatures, where docstrings omit types on purpose. Two few-shot examples showing that as acceptable cut the dismissal rate to 12%, and the category is re-enabled.</p>"
      }
    ],
    lesson: "<ul><li>‘Be conservative’ and ‘high-confidence only’ don’t improve precision. Use explicit report/skip criteria (4.1).</li><li>High false-positive categories erode trust in accurate ones. Disable them temporarily while their prompts improve.</li><li>A detected_pattern field makes dismissal analysis systematic (4.4).</li><li>Few-shot examples that separate acceptable patterns from real issues reduce false positives and generalise (4.2).</li></ul>"
  },
  {
    id: "case-s5-b",
    scenario: 5,
    title: "Unparseable reviews, duplicate comments and a self-reviewer",
    tasks: ["3.6", "4.6"],
    brief: "<p>A CI job runs <code>claude -p</code> on each PR, and a Python script regex-parses the markdown output to post inline comments. About 1 run in 12 posts nothing or posts garbled comments. When it works, every new push re-posts the same comments. The job also has a ‘generate missing tests’ step, followed by a step that reviews those generated tests.</p>",
    evidence: `# ci/review.sh
claude -p "Review this PR. For each issue give the file, line, severity
and a fix, formatted as a markdown list." > review.md
python post_comments.py review.md

# post_comments.py log, PR #2291
WARN no match for /^- \\*\\*(.+?):(\\d+)\\*\\* \\[(\\w+)\\]/ on 7 of 9 lines
     sample: "- **src/api/orders.ts** (line 88) — HIGH: missing await"

# PR #2304 after 3 pushes
comment "Unhandled promise rejection in fetchRates()" posted 3 times`,
    steps: [
      {
        q: "How should the job produce reliably parseable findings?",
        options: [
          "Tighten the prompt with an exact markdown template and a worked example, and add a stricter fallback regex for variants.",
          "Ask for JSON in the prompt text and run the output through a lenient JSON repair library before posting the comments.",
          "Run with --output-format json and a --json-schema defining file, line, severity and fix, then post from the parsed fields.",
          "Post the whole markdown review as a single PR comment, which avoids the need to parse individual findings at all."
        ],
        answer: 2,
        feedback: [
          "Wrong. Better, but still free text matched by a regex, so variants such as ‘(line 88)’ keep breaking it.",
          "Wrong. Prompt-only JSON plus repair is best-effort. The CLI can enforce the schema.",
          "Correct. --output-format json with --json-schema produces machine-parseable structured findings for automated inline comments.",
          "Wrong. It sidesteps the requirement for inline comments at the exact line."
        ],
        then: "<p>Parsing failures drop to zero. The duplicate problem remains: PR #2304 got the same <code>fetchRates()</code> comment on each of three pushes, even after the developer fixed two other reported issues.</p>"
      },
      {
        q: "How should re-runs avoid duplicate comments?",
        options: [
          "Include the prior findings in context and instruct Claude to report only issues that are new or still unaddressed.",
          "Only review the PR on its first push and skip the review on later commits, so no comment can be posted twice.",
          "Delete all earlier bot comments before each run, then post the full fresh set of findings from the new review.",
          "Lower the temperature so that repeated runs on similar code produce identical wording, then de-duplicate by text."
        ],
        answer: 0,
        feedback: [
          "Correct. With prior findings in context, the reviewer can skip resolved items, keep unresolved ones without repeating them, and report only new issues.",
          "Wrong. New commits can introduce new bugs, and those would never be reviewed.",
          "Wrong. Erases discussion threads on earlier comments and still reposts unchanged findings as new.",
          "Wrong. Text matching is brittle, and it doesn’t tell resolved issues from unresolved ones."
        ],
        then: "<p>Duplicates stop. One last issue: in the test-generation step, the job runs <code>claude -p --resume $GEN_SESSION \"Now review the tests you just wrote for bugs\"</code>. Over a month, that review step approved 96% of generated tests, yet human reviewers later found incorrect assertions in 1 of 6 approved tests.</p>"
      },
      {
        q: "How should the generated tests be reviewed?",
        options: [
          "Keep the resumed session but turn on extended thinking for the review step so the model reasons harder about its own tests.",
          "Add ‘be highly critical of your own work’ to the review prompt in the same resumed session to counter its approval bias.",
          "Have the generating session self-report a confidence score for each test and send any test below 0.7 to a human reviewer.",
          "Run the review in a separate, independent Claude instance without the generator’s reasoning context, reading only the code and tests."
        ],
        answer: 3,
        feedback: [
          "Wrong. Extended thinking in the same session still carries the generator’s reasoning. An independent instance does better.",
          "Wrong. Self-review instructions don’t remove the bias of a session that keeps its own generation context.",
          "Wrong. Self-reported confidence from the generator is uncalibrated and shares its blind spots.",
          "Correct. A model in the same session is less likely to question its own decisions. A fresh instance without that context catches subtle issues self-review misses."
        ],
        then: "<p>The independent reviewer flags 14% of generated tests in its first week. Sampled human checks agree with 88% of those flags. CLAUDE.md now documents the available fixtures, and the existing test files are passed into context, so generation stops proposing scenarios the suite already covers.</p>"
      }
    ],
    lesson: "<ul><li>In CI: -p for non-interactive runs, plus --output-format json with --json-schema for machine-parseable findings (3.6).</li><li>On re-runs, include prior findings and report only new or still-unaddressed issues.</li><li>Review with an independent instance, not the generating session. Self-review and extended thinking in the same context are weaker (4.6).</li><li>Put existing tests and fixture conventions in context or CLAUDE.md to avoid duplicate, low-value tests.</li></ul>"
  },

  // ───────────────────────── Scenario 6: Structured Data Extraction ─────────────────────────
  {
    id: "case-s6-a",
    scenario: 6,
    title: "Purchase-order numbers that don’t exist",
    tasks: ["4.3", "4.4"],
    brief: "<p>An accounts-payable pipeline extracts supplier invoices with a forced <code>record_invoice</code> tool. Finance reports that 6% of invoices posted to the ERP carry PO numbers that match no purchase order, such as <code>PO-000000</code> or the invoice number with ‘PO-’ prepended. Every extraction passes JSON Schema validation.</p>",
    evidence: `"input_schema": {
  "type": "object",
  "properties": {
    "vendor":       {"type": "string"},
    "invoice_no":   {"type": "string"},
    "po_number":    {"type": "string", "pattern": "^PO-\\\\d{6}$"},
    "line_items":   {"type": "array", "items": {...}},
    "total":        {"type": "number"}
  },
  "required": ["vendor", "invoice_no", "po_number", "line_items", "total"]
}

# sample of 50 bad rows: 47 source invoices have no PO number printed anywhere`,
    steps: [
      {
        q: "What causes the fabricated PO numbers?",
        options: [
          "The pattern ^PO-\\d{6}$ is too strict, so valid PO numbers in other formats get rewritten to fit the expected pattern.",
          "Forced tool_choice makes the model call the tool even when the document is not an invoice, producing a placeholder record.",
          "The model is hallucinating because the invoices are long, and a shorter excerpt containing only the header would fix it.",
          "po_number is required and non-nullable, so when the invoice has none the model invents a value to satisfy the schema."
        ],
        answer: 3,
        feedback: [
          "Wrong. 47 of 50 sources have no PO at all. The problem isn’t format conversion.",
          "Wrong. These are real invoices. They just lack a PO number.",
          "Wrong. Length isn’t the issue; the schema demands a value that doesn’t exist.",
          "Correct. A required field with no null option pushes the model to fabricate. Make it nullable when the source may not contain the information."
        ],
        then: "<p>With <code>po_number: {\"type\": [\"string\",\"null\"]}</code>, fabricated POs disappear and the ERP routes null-PO invoices to a matching queue. A new problem: 3.8% of extractions have line items that don’t add up to <code>total</code>. In one, the tax line was put into <code>line_items</code> and also counted again in <code>total</code>. All of them pass schema validation.</p>"
      },
      {
        q: "How should the pipeline catch and correct these?",
        options: [
          "Add a JSON Schema constraint that requires the sum of line_items to equal total so that strict mode rejects the bad records.",
          "Extract calculated_total alongside stated_total, flag mismatches, and retry with the document, the failed extraction and the specific error.",
          "Retry any record that fails the sum check with the same prompt up to three times, keeping the first attempt that adds up.",
          "Send every mismatched record straight to a human reviewer, since the model can’t be trusted to check its own arithmetic."
        ],
        answer: 1,
        feedback: [
          "Wrong. JSON Schema can’t express cross-field arithmetic. Strict schemas remove syntax errors, not semantic ones.",
          "Correct. A self-correction check (calculated vs stated, plus conflict_detected when the source itself disagrees) catches the semantic error, and a retry that includes the document, the failed output and the specific error lets the model correct itself.",
          "Wrong. Retrying without the error message gives the model nothing new to correct against.",
          "Wrong. Many of these are structural mistakes that a targeted retry fixes. Humans should get what retry can’t fix."
        ],
        then: "<p>Retry with error feedback resolves 81% of mismatches on the first retry. The engineers then add the same retry for a new required field, <code>vendor_tax_id</code>. After two retries, 312 invoices still come back null or wrong. Inspection shows those vendors never print a tax ID on invoices; it lives only in the vendor master file, which isn’t sent to the model.</p>"
      },
      {
        q: "What should happen to those 312 invoices?",
        options: [
          "Increase the retry limit to five with stronger wording so that the model searches the invoice harder for the tax ID.",
          "Add few-shot examples of tax IDs from other vendors so that the model learns what plausible values for the field look like.",
          "Stop retrying: the data isn’t in the document. Keep it null and fill it from the vendor master by lookup, or route it for review.",
          "Make vendor_tax_id a required non-null field again so the model is forced to return something on every single invoice."
        ],
        answer: 2,
        feedback: [
          "Wrong. Retries can’t produce information that is absent from the source.",
          "Wrong. That teaches the model to produce plausible-looking fabrications.",
          "Correct. Retries work for format and structure errors, not for information that only exists in an external document that wasn’t provided.",
          "Wrong. That brings back the fabrication problem from step 1."
        ],
        then: "<p>The tax ID is now joined from the vendor master after extraction. Retry spend falls 63%, and the remaining null-tax-ID invoices (new vendors not yet in the master) go to a short review queue.</p>"
      }
    ],
    lesson: "<ul><li>Required non-nullable fields cause fabrication when the source lacks the data. Make them nullable (4.3).</li><li>Strict schemas remove syntax errors, not semantic ones. Add calculated_total next to stated_total, and conflict_detected flags.</li><li>A retry includes the original document, the failed extraction and the specific validation error (4.4).</li><li>Retries can’t recover information that isn’t in the source.</li></ul>"
  },
  {
    id: "case-s6-b",
    scenario: 6,
    title: "Lease abstraction at scale: SLA, failures and a 97% dashboard",
    tasks: ["4.5", "5.5"],
    brief: "<p>A property-management firm abstracts commercial leases (rent, escalation, term dates, renewal options) for portfolio onboarding. Leases arrive continuously through the day. The contract promises abstracts <strong>within 30 hours of upload</strong>. Nobody waits on a lease interactively, and the team wants the 50% Message Batches discount.</p>",
    evidence: `Arrival pattern (last 30 days): 9,000-11,000 leases/day, spread across 24h
Message Batches API: processing window up to 24h, no latency SLA
Contract SLA: abstract delivered <= 30h after upload
Options proposed in planning:
  A  one batch per day at 00:00
  B  one batch every 4 hours
  C  one batch every 12 hours
  D  synchronous API for everything`,
    steps: [
      {
        q: "Which submission schedule meets the 30-hour SLA at batch prices?",
        options: [
          "B: every 4 hours. Worst case is 4h waiting plus 24h processing, 28h in total, which stays inside the 30-hour SLA.",
          "A: once daily. The batch usually finishes in a few hours in practice, so total delay rarely approaches the 30-hour limit.",
          "C: every 12 hours. 12h waiting plus 24h processing averages out across the day, which is acceptable for a daily SLA.",
          "D: the synchronous API, since the Batches API offers no latency guarantee and so can never be used against any SLA."
        ],
        answer: 0,
        feedback: [
          "Correct. A lease uploaded just after a submission waits up to one window, then can take the full 24h. 4 + 24 = 28h ≤ 30h. Any window up to 6h works; 4h leaves margin.",
          "Wrong. Worst case is 24 + 24 = 48h. ‘Usually faster’ isn’t a guarantee.",
          "Wrong. Worst case is 36h. An SLA is about the worst case, not the average.",
          "Wrong. Batches can meet a deadline when the submission frequency is sized for the 24h worst case. Sync gives up the 50% saving needlessly."
        ],
        then: "<p>Before scaling up, the team refines the prompt on a 200-lease sample to raise first-pass success. In the first full-day batch of 10,000 requests, the results file shows 9,812 succeeded and 188 errored. Of the errors, 141 are <code>request_too_large</code> (leases with 300+ pages of exhibits) and 47 are <code>overloaded</code>.</p>"
      },
      {
        q: "How should the 188 failures be handled?",
        options: [
          "Resubmit the full 10,000-request batch so that all results come from one consistent run and the output stays uniform.",
          "Move the 188 failed leases to the synchronous API, sending each oversized document in full with a larger max_tokens.",
          "Resubmit only the failed custom_ids: retry the 47 overloaded as-is, and split the 141 oversized leases into chunks first.",
          "Mark the 188 leases as needing manual abstraction, since batch failures signal documents the model can’t handle reliably."
        ],
        answer: 2,
        feedback: [
          "Wrong. Paying again for 9,812 successes is waste. custom_id exists to correlate and resubmit just the failures.",
          "Wrong. The oversized leases exceed the context limit whichever API is used, and max_tokens limits output, not input.",
          "Correct. Identify failures by custom_id and resubmit only those, with changes where needed: chunk the documents that exceeded context limits.",
          "Wrong. Both error types are fixable. Manual work for 188 leases wastes reviewer capacity."
        ],
        then: "<p>After a month, the dashboard shows <strong>97.1% field accuracy</strong> on a labelled audit set, and leadership proposes removing human review for every extraction with model confidence above 0.9. A breakdown by segment shows:</p><p><code>typed leases: 98.9%  ·  scanned leases: 95.2%  ·  handwritten addenda: 71.4%</code><br><code>field renewal_option_date: 83.0%  (all other fields ≥ 96%)</code></p>"
      },
      {
        q: "What should happen before human review is reduced?",
        options: [
          "Approve the plan: 97% overall accuracy and a 0.9 confidence cut-off together give a large enough safety margin for this work.",
          "Validate accuracy per document type and field, calibrate field-level confidence on a labelled set, and keep stratified sampling.",
          "Replace confidence routing with sentiment checks on lease language, flagging contentious leases for human review instead.",
          "Lower the cut-off to 0.8 so more extractions are automated, since the overall accuracy is already well above the 95% target."
        ],
        answer: 1,
        feedback: [
          "Wrong. The 97% aggregate hides 71% on handwritten addenda and 83% on renewal_option_date, and the 0.9 cut-off hasn’t been calibrated.",
          "Correct. Verify performance by segment before automating. Calibrate field-level confidence thresholds on labelled data. Keep stratified random sampling of high-confidence output to measure ongoing error rates and catch new error patterns.",
          "Wrong. Sentiment doesn’t predict extraction difficulty.",
          "Wrong. That automates even more on the strength of an aggregate that masks weak segments."
        ],
        then: "<p>Typed and scanned leases with calibrated confidence ≥ 0.93 on every field are auto-approved, with a 2% stratified sample still reviewed. Handwritten addenda, any renewal_option_date below its calibrated threshold, and documents with contradictory terms always go to a human. Reviewer workload falls 58%.</p>"
      }
    ],
    lesson: "<ul><li>Batch frequency comes from the worst case: window + 24h ≤ SLA (30h → submit at least every 6h, e.g. every 4h) (4.5).</li><li>Refine the prompt on a sample before bulk runs. Resubmit only failed custom_ids, chunking oversized documents.</li><li>Aggregate accuracy can hide weak document types or fields. Segment before automating (5.5).</li><li>Calibrate field-level confidence on labelled sets, keep stratified sampling, and route ambiguous or contradictory documents to humans.</li></ul>"
  }
]);
