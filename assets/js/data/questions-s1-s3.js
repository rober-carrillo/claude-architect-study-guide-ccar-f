// Practice questions for Scenario 1 (Customer Support Resolution Agent) and
// Scenario 3 (Multi-Agent Research System). Written for this study guide, not real exam items.
window.QBANK = (window.QBANK || []).concat([
  // ---------------- Scenario 1: Customer Support Resolution Agent ----------------
  {
    id: "s1-01",
    scenario: 1,
    domain: 1,
    task: "1.1",
    type: "single",
    pick: 1,
    stem: "Your support agent runs on a hand-written agentic loop. A reviewer notices that when a customer asks about a return, Claude's response often contains a short text block ('Let me pull up that order for you.') followed by a tool_use block for <code>lookup_order</code>. The loop treats any response that contains text as the final answer and sends it to the customer, so the lookup never runs. What is the correct fix?",
    options: [
      "Strip conversational text from each response with a regex so only tool_use blocks remain, and keep looping while no text is present.",
      "Add a system prompt instruction telling Claude never to write text before a tool call, so text only appears in final answers.",
      "Drive the loop from <code>stop_reason</code>: run tools and continue on 'tool_use', and finish on 'end_turn'.",
      "Cap the loop at three iterations and send whatever response arrives on the final iteration to the customer as the agent's answer."
    ],
    answer: [2],
    rationale: [
      "Still uses the presence or absence of text as the completion signal, which is the anti-pattern; a final answer can also arrive with no tool call and the regex approach would mishandle it.",
      "A prompt-only fix makes the bug less frequent but not impossible, and text alongside a tool call is normal, valid model output that the loop must handle.",
      "Correct. stop_reason is the authoritative signal: 'tool_use' means execute the tools and append the results, 'end_turn' means the model has finished.",
      "An arbitrary iteration cap as the primary stopping rule can cut off work mid-task or return an intermediate turn to the customer."
    ],
    takeaway: "Loop control reads stop_reason ('tool_use' continue, 'end_turn' stop), never the presence of assistant text."
  },
  {
    id: "s1-02",
    scenario: 1,
    domain: 1,
    task: "1.4",
    type: "single",
    pick: 1,
    stem: "A customer writes: 'I was charged twice for order #5521, the blender from order #5530 arrived cracked, and I need to change my shipping address for future orders.' Transcripts show the agent resolves the duplicate charge thoroughly, then closes the conversation; the customer has to open two more tickets for the other issues. Which design change best addresses this?",
    options: [
      "Have the agent split the message into distinct issues, investigate each with the shared customer context, then reply once covering all three.",
      "Route any message that mentions more than one issue to escalate_to_human, since mixed billing, return and account requests are too broad to automate.",
      "Have the agent ask the customer to submit each issue as a separate ticket, so that every conversation carries a single trackable concern.",
      "Raise max_tokens and the turn limit so the agent has enough room to keep on working after it has finished resolving the first issue raised."
    ],
    answer: [0],
    rationale: [
      "Correct. Multi-concern requests should be decomposed into items, investigated (in parallel where possible) with the shared context, and synthesized into one resolution.",
      "Each of these issues is routine on its own; escalating every multi-issue message drags first-contact resolution down for no reason.",
      "This pushes the agent's job onto the customer and turns one contact into three, directly hurting the first-contact resolution target.",
      "The agent did not run out of room; it never identified the other two issues. More tokens or turns do not create the missing decomposition step."
    ],
    takeaway: "Multi-concern message: decompose into items, investigate each with shared context, answer once."
  },
  {
    id: "s1-03",
    scenario: 1,
    domain: 1,
    task: "1.4",
    type: "multi",
    pick: 3,
    stem: "When the agent escalates, human agents receive only the note 'Customer unhappy with refund, please assist.' They cannot see the conversation transcript, so they spend several minutes re-verifying the customer and re-investigating the case. You are redesigning the payload the agent passes to <code>escalate_to_human</code>. Which THREE elements should it include? Select THREE.",
    options: [
      "The verified customer ID and the order numbers involved",
      "The root cause the agent identified, with the supporting evidence from tool results",
      "The recommended next action and the refund amount at issue",
      "The agent's self-rated confidence (1-10) that escalation was necessary",
      "A sentiment score summarizing how frustrated the customer sounded"
    ],
    answer: [0, 1, 2],
    rationale: [
      "Correct. The human has no transcript, so the identity work already done must travel with the case.",
      "Correct. Passing the root cause and evidence spares the human from repeating the investigation.",
      "Correct. A recommended action with the amount lets the human decide and act quickly.",
      "Self-reported confidence is poorly calibrated and does not help the human resolve anything.",
      "Sentiment does not tell the human what is wrong or what to do; it is not a substitute for case facts."
    ],
    takeaway: "Handoffs to humans are structured: customer ID, root cause, amount, recommended action."
  },
  {
    id: "s1-04",
    scenario: 1,
    domain: 1,
    task: "1.5",
    type: "single",
    pick: 1,
    stem: "The agent's MCP tools are owned by different backend teams. <code>get_customer</code> returns <code>created_at</code> as a Unix timestamp, <code>lookup_order</code> returns <code>delivered_at</code> in ISO 8601, and order status arrives as numeric codes (3 = delivered, 7 = returned). Logs show the agent sometimes miscalculates whether an order is inside the 30-day return window and occasionally reads status 7 as 'in transit'. What is the most reliable fix?",
    options: [
      "Add a system prompt section that explains each timestamp format and lists what every numeric status code means.",
      "Ask each backend team to move its API to ISO 8601 and string statuses, and hold the agent change until they ship.",
      "Give the agent a convert_timestamp tool and a decode_status tool that it can call whenever it meets a value it needs to compare.",
      "Add a PostToolUse hook that converts timestamps to ISO 8601 and maps status codes to names before the model sees them."
    ],
    answer: [3],
    rationale: [
      "The model still has to do the conversions itself on every turn, so errors remain probabilistic.",
      "Consistent APIs are a reasonable long-term goal, but it ties the fix to other teams' roadmaps; the agent can normalize at its own boundary today.",
      "Adds extra tool calls and relies on the model choosing to call the converter every time, which is exactly where it is already slipping.",
      "Correct. A PostToolUse hook transforms tool results deterministically, so the model only ever reasons over one date format and named statuses."
    ],
    takeaway: "Heterogeneous formats from different tools: normalize them in a PostToolUse hook, not in the prompt."
  },
  {
    id: "s1-05",
    scenario: 1,
    domain: 1,
    task: "1.5",
    type: "single",
    pick: 1,
    stem: "Company policy requires a human for any refund over $500. The system prompt states this in bold, yet an audit finds the agent processed 4 of last month's 310 refunds above $500, usually when a customer listed several items whose combined total crossed the limit. What should you implement?",
    options: [
      "Few-shot examples of multi-item refunds that cross $500, each showing the agent escalating the case instead of refunding.",
      "A hook that intercepts process_refund calls, blocks any amount over $500, and redirects the case to escalate_to_human.",
      "A required step where the agent restates the refund total and confirms it is under $500 before each process_refund call.",
      "Repeat the $500 rule at both the top and bottom of the system prompt so it is not lost in the middle of the instructions."
    ],
    answer: [1],
    rationale: [
      "Few-shot examples improve the odds but remain prompt guidance with a non-zero failure rate on a financial rule.",
      "Correct. A tool-call interception hook gives a deterministic guarantee and turns a would-be violation into the right workflow (escalation).",
      "A self-check is still the model policing itself; it can make the same arithmetic slip it made when choosing the amount.",
      "Better placement helps attention, but the rule stays probabilistic; guaranteed compliance requires code."
    ],
    takeaway: "Business rules that must always hold belong in a hook that blocks and redirects, not in the prompt."
  },
  {
    id: "s1-06",
    scenario: 1,
    domain: 2,
    task: "2.1",
    type: "single",
    pick: 1,
    stem: "After you rewrite the tool descriptions with clear boundaries, tool selection improves on most tests. But the agent still calls <code>escalate_to_human</code> whenever a customer uses the word 'complaint', even for simple order-status questions it could answer with <code>lookup_order</code>. The system prompt contains the line: 'Any complaint must be escalated to the right team.' What is the most likely cause and fix?",
    options: [
      "The escalate_to_human description is still too broad; add negative examples to it listing request types it should not handle.",
      "The model over-weights customer wording; add a classifier that strips emotionally loaded words before messages reach the agent.",
      "The keyword-sensitive system prompt line overrides the tool descriptions; reword it to state the actual escalation criteria.",
      "The tools overlap too much; merge lookup_order and escalate_to_human into one handle_request tool that decides internally."
    ],
    answer: [2],
    rationale: [
      "The descriptions already work on other tests; the misrouting is triggered by a word that matches a system prompt instruction, so editing the description treats the wrong layer.",
      "An extra classifier is over-engineered and would also discard information the agent needs; the cause is the agent's own instructions.",
      "Correct. Keyword-sensitive system prompt wording can create unintended tool associations that beat well-written descriptions; the prompt must be reviewed too.",
      "These tools do completely different things; merging them removes a clear boundary rather than fixing the instruction that causes the confusion."
    ],
    takeaway: "If good tool descriptions still lose, check the system prompt for keyword-triggered instructions."
  },
  {
    id: "s1-07",
    scenario: 1,
    domain: 2,
    task: "2.2",
    type: "multi",
    pick: 2,
    stem: "<code>process_refund</code> returns the same response, isError: true with the text 'Operation failed', for three situations: a payment-gateway timeout, an order outside the 30-day return window, and a malformed amount. Logs show the agent retrying window violations up to five times and telling customers whose refund timed out that they are not eligible. Which TWO changes to the tool's error responses address this? Select TWO.",
    options: [
      "Return an errorCategory (transient, validation, business, permission) and an isRetryable flag with each error",
      "For policy violations, return retryable: false with a customer-friendly explanation the agent can relay",
      "Raise the agent's retry limit so transient timeouts get more chances to succeed before it gives up",
      "Include the full backend stack trace in the error text so the model can diagnose what went wrong",
      "Return isError: false with an empty result for policy violations, since they are not technical failures"
    ],
    answer: [0, 1],
    rationale: [
      "Correct. A category plus a retryable flag lets the agent retry the timeout, fix the malformed amount, and stop retrying the policy refusal.",
      "Correct. Business-rule errors need retryable: false and wording the agent can pass on, so customers hear the real reason instead of a vague failure.",
      "More retries make the waste worse for non-retryable policy errors and do nothing to separate the three cases.",
      "Stack traces are noisy, leak internals, and still do not tell the agent which recovery action is appropriate.",
      "Marking a refusal as success hides it; the agent would think the refund went through or that nothing happened."
    ],
    takeaway: "Uniform 'Operation failed' blocks recovery; return category, isRetryable and a human-readable reason."
  },
  {
    id: "s1-08",
    scenario: 1,
    domain: 2,
    task: "2.2",
    type: "single",
    pick: 1,
    stem: "During a database failover, <code>lookup_order</code> caught connection timeouts and returned an empty order list with no error flag. For 20 minutes the agent told customers 'I can't find any orders on your account', and several of them opened chargebacks. What change prevents this class of problem?",
    options: [
      "Return timeouts as isError: true with a transient category, and keep the empty list for queries that truly found nothing.",
      "Instruct the agent to tell customers the system may be having problems whenever lookup_order returns an empty order list.",
      "Have lookup_order retry the database without limit until it gets a response, so it never returns anything during an outage.",
      "Escalate every conversation in which lookup_order returns no orders at all, so that a human can double-check the customer's account."
    ],
    answer: [0],
    rationale: [
      "Correct. An access failure and a valid empty result mean different things; the tool must report them differently so the agent can retry or explain an outage instead of stating a false fact.",
      "This makes the agent cast doubt on every genuine 'no orders' answer because the tool still does not say which case occurred.",
      "Unbounded retries hang the conversation and still give the agent nothing to tell the customer; bounded retry plus an explicit error is the right shape.",
      "Most empty results are genuine; escalating all of them floods humans, and it still treats an outage as if it were data."
    ],
    takeaway: "'Couldn't check' (error) and 'checked, found nothing' (empty success) must never look the same."
  },
  {
    id: "s1-09",
    scenario: 1,
    domain: 2,
    task: "2.3",
    type: "single",
    pick: 1,
    stem: "You run the agent overnight to work through the email ticket backlog with no customer present. Every ticket must end in an action: <code>process_refund</code>, <code>escalate_to_human</code>, or <code>send_email_reply</code>. In about 6% of tickets the agent instead returns plain text such as 'This one probably needs a person to look at it', and the ticket is left untouched. Which configuration change guarantees an action?",
    options: [
      "Keep tool_choice set to 'auto' and add a prompt line saying that every ticket must end with exactly one tool call.",
      "Force tool_choice to escalate_to_human for these runs, since plain-text replies usually mean the agent wants a person.",
      "Parse the text replies for phrases like 'needs a person' and call escalate_to_human on the agent's behalf when found.",
      "Set tool_choice to 'any' for these runs, so the model must call one of its tools instead of answering in plain text."
    ],
    answer: [3],
    rationale: [
      "'auto' explicitly allows a text response; a prompt line only lowers the rate, it does not guarantee a tool call.",
      "Forcing one specific tool would escalate every ticket, including the ones the agent can refund or answer itself.",
      "Parsing natural language to drive actions is brittle and misses any phrasing the patterns don't anticipate.",
      "Correct. tool_choice 'any' requires a tool call while still letting the model choose which of the actions fits the ticket."
    ],
    takeaway: "tool_choice 'any' guarantees a tool call but leaves the choice of tool to the model."
  },
  {
    id: "s1-10",
    scenario: 1,
    domain: 2,
    task: "2.3",
    type: "single",
    pick: 1,
    stem: "Over two quarters, other teams added their tools to the support agent: inventory, carrier tracking, loyalty points, marketing preferences, store locator and more, bringing it to 18 tools. Since then misrouted tool calls have tripled, mostly between similar-sounding tools. Refund and return cases, 85% of volume, need only four of them. What is the best change?",
    options: [
      "Move to a larger, more capable model, which can keep all 18 tool definitions in mind and choose between them more reliably.",
      "Scope the agent to the tools its role needs, plus a few cross-role tools for frequent needs, and route the rest elsewhere.",
      "Add two few-shot examples for each of the 18 tools, so the model sees exactly when each one is supposed to apply.",
      "Merge all 18 tools into one support_action tool with an action parameter that selects the backend operation to run."
    ],
    answer: [1],
    rationale: [
      "The problem is decision complexity from too many options, not model capacity; a bigger model is a costly way to keep a bad design.",
      "Correct. Too many tools degrades selection reliability; giving the agent the 4-5 it needs plus limited cross-role tools fixes the root cause.",
      "Thirty-six examples add heavy token overhead and still leave the model choosing among 18 overlapping tools.",
      "This hides the same 18-way choice inside a parameter and throws away the per-tool descriptions that guide selection."
    ],
    takeaway: "More tools means worse selection; keep each agent to the few its role needs."
  },
  {
    id: "s1-11",
    scenario: 1,
    domain: 2,
    task: "2.4",
    type: "single",
    pick: 1,
    stem: "Before answering policy questions, the agent makes 6-10 exploratory calls to a <code>search_policies</code> tool with guesses like 'returns electronics', 'returns opened box' and 'returns gift', just to discover which policy documents exist. The policy library is a fixed set of about 40 documents, updated monthly. What change most directly reduces these calls?",
    options: [
      "Expose the policy index as an MCP resource, so the agent can see which documents exist without exploratory tool calls.",
      "Paste the full text of all 40 policy documents into the system prompt, so the agent never needs to search for them.",
      "Limit search_policies to three calls per conversation with a hook, so the agent is forced to choose its guesses carefully.",
      "Replace search_policies with a semantic search over the library, so each guess returns more relevant policy results."
    ],
    answer: [0],
    rationale: [
      "Correct. MCP resources expose content catalogs so the agent can see what is available up front and then fetch the one it needs.",
      "Loads 40 documents into every request, inflating cost and burying the relevant policy in the middle of a long context.",
      "An arbitrary cap cuts off legitimate lookups and does nothing to tell the agent which documents exist.",
      "Better search ranking still leaves the agent guessing blind; the problem is lack of visibility into the catalog, not result quality."
    ],
    takeaway: "Agent probing to learn what exists? Expose a catalog as an MCP resource."
  },
  {
    id: "s1-12",
    scenario: 1,
    domain: 5,
    task: "5.1",
    type: "single",
    pick: 1,
    stem: "To keep long conversations within budget, the agent summarizes earlier turns once history passes 20 messages. In long billing disputes the summary turns 'charged $184.20 twice on 3 March for order #77120; customer expects the duplicate back within 5 days' into 'customer has a billing issue with a recent order.' The agent then asks the customer to repeat the amount and order number. What is the best fix?",
    options: [
      "Summarize less often, for example every 40 messages instead of 20, so fewer details get compressed before the issue is resolved.",
      "Switch to a model with a larger context window so that the conversation never has to be summarized in the first place.",
      "Keep amounts, dates, order numbers and the customer's stated expectation in a case-facts block sent with every prompt.",
      "Instruct the summarizer to be thorough and to keep all of the important details when it condenses the earlier turns."
    ],
    answer: [2],
    rationale: [
      "This only delays the loss; once summarization runs, the same numbers still get flattened.",
      "Raises cost on every turn, still suffers from lost-in-the-middle, and very long disputes can outgrow any window.",
      "Correct. Transactional facts kept in a persistent block outside the summarized history are never paraphrased away.",
      "'Be thorough' is vague; progressive summarization reliably loses exact figures and expectations no matter how it is phrased."
    ],
    takeaway: "Numbers, dates, IDs and promises go in a persistent case-facts block, not in the summary."
  },
  {
    id: "s1-13",
    scenario: 1,
    domain: 5,
    task: "5.1",
    type: "single",
    pick: 1,
    stem: "<code>lookup_order</code> returns about 45 fields per order (warehouse bin, carrier SLA codes, tax jurisdiction, marketing attribution and so on). Customers with return questions often have 6-8 orders looked up in one session, and by the end the agent confuses which order had which delivery date. Only eligibility, delivery date, item, amount and status matter for these cases. What should you do?",
    options: [
      "Ask the agent to restate the key fields after each lookup, so the important values always sit more recently in the context window.",
      "Have the agent look up one order at a time and fully finish it before it calls lookup_order for the next order.",
      "Move to a larger context window, so that the full order records from every lookup fit comfortably in the session.",
      "Trim each lookup result to the return-relevant fields before it enters context, in the tool or a PostToolUse hook."
    ],
    answer: [3],
    rationale: [
      "The 45-field records still pile up in context; restating adds more tokens on top of the noise.",
      "Customers ask about several orders together, and sequencing does not shrink the records that accumulate.",
      "Capacity is not the issue; irrelevant fields dilute attention whatever the window size, and cost grows with every turn.",
      "Correct. Cutting tool output to the fields that matter stops irrelevant data from accumulating and crowding out the facts the agent needs."
    ],
    takeaway: "Trim verbose tool results to the relevant fields before they accumulate in context."
  },
  {
    id: "s1-14",
    scenario: 1,
    domain: 5,
    task: "5.2",
    type: "single",
    pick: 1,
    stem: "A customer's first message is: 'Please connect me to a human agent. I've been charged a fee I don't recognise.' The agent replies 'I can help with that! Let me look up your account first,' calls get_customer and lookup_order, and only escalates after the customer repeats the request twice more. Which behaviour should the agent follow?",
    options: [
      "Investigate the charge first, since resolving it quickly is the fastest route to what the customer actually wants.",
      "Honour the explicit request right away by escalating, passing along the details the customer has already given.",
      "Explain that the queue for a human is long and ask whether they would first like to try the automated agent.",
      "Escalate only if the customer's wording shows strong frustration; otherwise attempt resolution before handing off."
    ],
    answer: [1],
    rationale: [
      "Overrides a clear customer preference; an explicit request for a human is an escalation trigger in itself.",
      "Correct. Explicit requests for a human are honoured immediately, without investigating first.",
      "Still pushes back on a stated preference and delays the handoff the customer asked for.",
      "Sentiment is not the trigger here; the explicit request is, regardless of tone."
    ],
    takeaway: "Customer explicitly asks for a human: escalate now, don't investigate first."
  },
  {
    id: "s1-15",
    scenario: 1,
    domain: 5,
    task: "5.2",
    type: "single",
    pick: 1,
    stem: "A customer writes in capitals: 'THIS IS THE THIRD TIME I'M ASKING. WHERE IS MY REFUND FOR ORDER #4410??' The refund was approved two days ago and is pending with the bank, which the agent can confirm with lookup_order. The customer has not asked for a person. A teammate proposes auto-escalating any message with strong negative sentiment. What should the agent do here?",
    options: [
      "Escalate immediately, because repeated contacts and capital letters show the case is now too complex to automate.",
      "Adopt the sentiment rule, since it is cheap to build and catches the customers most likely to churn after a delay.",
      "Acknowledge the frustration, confirm the refund status and timeline, and escalate only if they then ask for a person.",
      "Ask the customer to rate their frustration on a scale from 1 to 10, and escalate automatically when the score is 7 or higher."
    ],
    answer: [2],
    rationale: [
      "Frustration does not make a case complex; this one is a simple status check the agent can resolve.",
      "Sentiment is an unreliable proxy for complexity and would send many easy cases to humans, hurting first-contact resolution.",
      "Correct. Acknowledge the frustration, resolve the simple issue, and escalate only if the customer reiterates a wish for a human.",
      "A self-rated frustration score is still sentiment-based escalation, and it adds friction for an annoyed customer."
    ],
    takeaway: "Frustrated but simple: acknowledge, resolve, and escalate only if they ask again."
  },
  {
    id: "s1-16",
    scenario: 1,
    domain: 5,
    task: "5.2",
    type: "single",
    pick: 1,
    stem: "A caller gives the name 'Maria Lopez' and the city 'Austin'. <code>get_customer</code> returns three matching accounts. The agent currently picks the account with the most recent order, which is usually right; last week it issued a refund on the wrong Maria Lopez's account. What change should you make?",
    options: [
      "Instruct the agent to ask for another identifier, such as email or an order number, whenever several customers match.",
      "Refine the heuristic to weigh recent orders, account age and city together, then pick the highest-scoring account.",
      "Have get_customer return only its single best match, so the agent is never shown an ambiguous list of accounts.",
      "Escalate every lookup that returns more than one match, so that a human agent can compare the candidate accounts directly."
    ],
    answer: [0],
    rationale: [
      "Correct. Multiple matches call for clarification with an additional identifier, not a guess.",
      "A better heuristic is still a guess and will still occasionally pick the wrong person's account for a refund.",
      "Moves the same guess into the tool and hides the ambiguity from the agent, which is worse.",
      "A single clarifying question resolves this; sending it to a human hurts first-contact resolution unnecessarily."
    ],
    takeaway: "Several customer matches: ask for another identifier, never pick by heuristic."
  },
  {
    id: "s1-17",
    scenario: 1,
    domain: 5,
    task: "5.2",
    type: "single",
    pick: 1,
    stem: "Your price-adjustment policy says customers get the difference refunded if your own site lowers an item's price within 14 days of purchase. A customer asks you to match a lower price they found at a competitor. Transcripts show the agent sometimes refuses outright and sometimes grants the competitor price by citing the 14-day rule. What should the agent do in this case?",
    options: [
      "Apply the 14-day rule by analogy, since a lower competitor price is close enough to the situation the policy covers.",
      "Refuse politely, since the policy does not mention competitor matching and anything unlisted should count as denied.",
      "Grant the match when the price difference is small, for example under $20, to protect the first-contact resolution rate.",
      "Escalate to a human, because the policy is silent on competitor matching and this is a policy gap, not a routine case."
    ],
    answer: [3],
    rationale: [
      "Stretches a policy written for your own price changes into a commitment the business never made.",
      "The policy is silent, not prohibitive; refusing on the agent's own reading is still the agent deciding a policy question.",
      "Invents a threshold that exists nowhere in policy, which is the agent making business decisions it is not authorized to make.",
      "Correct. When policy is ambiguous or silent on the specific request, that gap is an escalation trigger."
    ],
    takeaway: "Policy silent on the request (e.g. competitor price match): escalate the gap."
  },
  {
    id: "s1-18",
    scenario: 1,
    domain: 1,
    task: "1.1",
    type: "single",
    pick: 1,
    stem: "A teammate proposes replacing the agent's tool selection with a fixed sequence for every conversation: get_customer, then lookup_order, then process_refund or escalate_to_human, chosen by keyword rules, because it would be 'more predictable'. Most conversations are ambiguous account, billing and return questions where the needed tools differ. How should you respond?",
    options: [
      "Adopt the fixed sequence, since a predictable tool order is the main requirement for an agent that handles money.",
      "Keep model-driven tool selection, and enforce only critical orderings, such as verification before refunds, in code.",
      "Adopt the fixed sequence, but let the model skip any step whose keyword rule doesn't match the customer's message.",
      "Keep model-driven selection, and add a system prompt line asking Claude to always follow the teammate's proposed order."
    ],
    answer: [1],
    rationale: [
      "A pre-configured decision tree cannot adapt to ambiguous requests, which are the bulk of this agent's work.",
      "Correct. Let Claude reason about which tool to call next from context, and apply programmatic gates only where an ordering is mandatory.",
      "Still a keyword-driven decision tree; keyword rules misfire on the ambiguous wording customers actually use.",
      "Imposes a rigid order through the prompt, losing adaptiveness while giving no guarantee for the orderings that matter."
    ],
    takeaway: "Let the model choose tools; use code gates only for orderings that must never be violated."
  },
  {
    id: "s1-19",
    scenario: 1,
    domain: 4,
    task: "4.2",
    type: "single",
    pick: 1,
    stem: "Requests like 'I paid but my order says cancelled' are handled inconsistently: the agent sometimes looks up the order, sometimes looks up the customer's billing profile, and sometimes escalates straight away. The tool descriptions are already detailed and accurate. What is the most effective next step?",
    options: [
      "Add 15-20 short examples of clear-cut requests to the system prompt, each mapped to the single tool that handles it.",
      "Have the agent output a confidence score with each tool choice, and escalate whenever the score falls below 7.",
      "Add 2-4 few-shot examples of these ambiguous requests showing the tool chosen and why the alternatives were not.",
      "Set the temperature to 0 so the agent makes the same tool choice every time it receives a similar request."
    ],
    answer: [2],
    rationale: [
      "Many easy examples cost tokens and teach nothing about the ambiguous cases that are actually failing.",
      "Self-reported confidence is poorly calibrated and does not teach the agent the right choice.",
      "Correct. Targeted few-shot examples with reasoning show how to handle ambiguous cases and let the model generalize that judgement.",
      "Determinism may make the choice consistent, but it can be consistently wrong; it does not supply the missing judgement."
    ],
    takeaway: "Inconsistent judgement on ambiguous cases: 2-4 few-shot examples that explain the choice."
  },
  {
    id: "s1-20",
    scenario: 1,
    domain: 5,
    task: "5.1",
    type: "single",
    pick: 1,
    stem: "To cut token costs, a developer changes the agent loop so each API request carries only the system prompt, the customer's latest message, and the latest tool result. Soon afterwards the agent asks for order numbers the customer gave two messages earlier and repeats lookups it has already made. What is the root cause?",
    options: [
      "The system prompt does not tell the agent to remember earlier details, which a firmer instruction would correct.",
      "The tool results are too verbose and push the earlier customer messages out of the model's effective attention.",
      "The model is showing the lost-in-the-middle effect, which a key-facts summary at the start would mitigate.",
      "The API is stateless, so the model only knows what each request contains; the loop must send the full history."
    ],
    answer: [3],
    rationale: [
      "There is nothing to remember: the earlier turns are no longer in the request, so no instruction can recover them.",
      "The earlier messages were not pushed aside; they were removed from the request entirely.",
      "Lost-in-the-middle affects long inputs; here the input is short because history was dropped.",
      "Correct. Each request must carry the complete conversation history, including tool_use and tool_result turns, for the model to stay coherent."
    ],
    takeaway: "The Messages API is stateless: send the full conversation every request."
  },

  // ---------------- Scenario 3: Multi-Agent Research System ----------------
  {
    id: "s3-01",
    scenario: 3,
    domain: 1,
    task: "1.2",
    type: "single",
    pick: 1,
    stem: "Usage logs show 40% of queries to your research system are narrow factual questions such as 'When did the EU AI Act enter into force?' Every query still runs through web search, document analysis, synthesis and report generation, taking about 90 seconds and producing a multi-page report for a one-line answer. What change best addresses this?",
    options: [
      "Add a separate classifier model that labels each query as simple or complex before it reaches the coordinator.",
      "Have the coordinator assess each query and invoke only the subagents it needs, rather than the full pipeline.",
      "Run all four subagents in parallel instead of in sequence, so that the simple queries finish much faster.",
      "Tell the report subagent to write a shorter report whenever the synthesized findings turn out to be brief."
    ],
    answer: [1],
    rationale: [
      "Deciding which subagents to use is already the coordinator's job; a separate model adds infrastructure and labelled data for no gain.",
      "Correct. A coordinator should analyze query requirements and dynamically select subagents instead of always routing through the whole pipeline.",
      "Synthesis and reporting depend on earlier outputs, and parallelism still spends four subagents on a one-line answer.",
      "Every stage still runs; only the last step changes, so cost and most of the latency remain."
    ],
    takeaway: "The coordinator picks subagents per query; not every query needs the full pipeline."
  },
  {
    id: "s3-02",
    scenario: 3,
    domain: 1,
    task: "1.2",
    type: "single",
    pick: 1,
    stem: "To speed up research on 'battery storage economics', the coordinator spawns three web search subagents, each given the same brief: 'Research battery storage economics.' Their outputs overlap by about 70%, citing many of the same articles, and the synthesis agent spends much of its context de-duplicating. What is the best fix?",
    options: [
      "Add a de-duplication subagent between search and synthesis that removes any findings another agent already reported.",
      "Drop to a single web search subagent, since parallel searchers on one topic will always return the same sources.",
      "Raise each subagent's temperature so that they try different query phrasings and surface a wider set of sources.",
      "Partition the scope so each subagent gets a distinct subtopic or source type, e.g. costs, incentives, grid studies."
    ],
    answer: [3],
    rationale: [
      "Cleans up the duplicate work after it has been paid for instead of preventing it.",
      "Parallel searchers are useful when they cover different ground; giving up parallelism throws away the speed benefit.",
      "Randomness is not a coverage plan; overlap would drop unpredictably and gaps would remain.",
      "Correct. Assigning distinct subtopics or source types to each subagent minimizes duplication by design."
    ],
    takeaway: "Parallel subagents need distinct scopes (subtopics or source types), not identical briefs."
  },
  {
    id: "s3-03",
    scenario: 3,
    domain: 1,
    task: "1.2",
    type: "single",
    pick: 1,
    stem: "Reviewers say reports are well written but often thin in one area: a report on 'remote work and urban real estate' had strong office-vacancy data but almost nothing on suburban housing demand. The synthesis output itself noted 'limited evidence found on suburban demand.' The pipeline runs search, analysis and synthesis once, then generates the report. What should you add?",
    options: [
      "A loop where the coordinator checks synthesis for gaps, re-delegates targeted queries and re-runs synthesis until covered.",
      "An instruction for the synthesis agent to fill any gaps it notices from its own general knowledge of the topic.",
      "A much larger number of search results per query from the start, so the first pass covers every possible subtopic.",
      "Direct messaging between the synthesis and search subagents, so synthesis can ask for more data without going via the coordinator."
    ],
    answer: [0],
    rationale: [
      "Correct. An iterative refinement loop uses the synthesis output to find gaps and sends targeted follow-up work to search and analysis.",
      "Fills gaps with uncited model knowledge, which defeats the purpose of a cited research report.",
      "Brute-force volume costs more and still has no mechanism to notice and target what is missing.",
      "Bypassing the coordinator breaks hub-and-spoke routing and loses observability and consistent error handling."
    ],
    takeaway: "Coordinator reviews synthesis for gaps and re-delegates targeted queries until coverage is enough."
  },
  {
    id: "s3-04",
    scenario: 3,
    domain: 5,
    task: "5.1",
    type: "single",
    pick: 1,
    stem: "The document analysis subagent returns its full reasoning for each paper: paragraph-by-paragraph notes, rejected interpretations and long quotations, around 8,000 tokens per paper. With 12 papers, the synthesis subagent's input is near its context budget, and its reports regularly omit findings from papers that land in the middle of the input. What is the most effective change?",
    options: [
      "Move the synthesis subagent to a model with a larger context window, so every paper's full analysis fits.",
      "Have the coordinator randomly shuffle the paper order on each run, so no single paper always sits in the middle.",
      "Have the analysis subagent return structured key facts, citations and relevance scores, not verbose reasoning.",
      "Ask the synthesis subagent to read the input twice, forwards then in reverse, before writing the report."
    ],
    answer: [2],
    rationale: [
      "More room does not remove the lost-in-the-middle effect, and the synthesis agent still wades through reasoning it does not need.",
      "Randomizing just moves which findings get lost on each run; coverage becomes unpredictable rather than complete.",
      "Correct. When the downstream agent has a limited budget, the upstream agent should return compact structured data rather than verbose reasoning chains.",
      "Doubles the token load on an already overloaded input and does not address why the input is so large."
    ],
    takeaway: "Downstream context is tight? Make upstream agents return structured facts, not reasoning dumps."
  },
  {
    id: "s3-05",
    scenario: 3,
    domain: 1,
    task: "1.3",
    type: "single",
    pick: 1,
    stem: "You define an AgentDefinition for each of the four research subagents and pass them to the coordinator. In testing, the coordinator writes 'I will delegate the search to the web search agent' and then answers from its own knowledge; no subagent ever runs. The coordinator's allowedTools is ['Read', 'WebSearch']. What is the most likely cause?",
    options: [
      "The coordinator's allowedTools does not include 'Task', so it has no way to spawn the subagents it describes.",
      "The subagent descriptions are much too short, so the coordinator cannot decide which subagent suits the request.",
      "The subagents have no system prompts, so the SDK skips them at runtime and the coordinator answers instead.",
      "The coordinator needs an instruction to delegate, because it only uses subagents when the user asks it to."
    ],
    answer: [0],
    rationale: [
      "Correct. Subagents are spawned through the Task tool, so a coordinator whose allowedTools lacks 'Task' cannot invoke any of them.",
      "Weak descriptions cause the wrong subagent to be picked, not a complete absence of delegation when the coordinator already intends to delegate.",
      "This is not how the SDK behaves; the prompt shows the coordinator trying to delegate, which points to missing permission.",
      "The coordinator already decided to delegate; what it lacks is the tool to do so, not the instruction."
    ],
    takeaway: "A coordinator can only spawn subagents if 'Task' is in its allowedTools."
  },
  {
    id: "s3-06",
    scenario: 3,
    domain: 1,
    task: "1.3",
    type: "single",
    pick: 1,
    stem: "The coordinator collects results from the search and analysis subagents, then invokes the synthesis subagent with the prompt 'Synthesize the findings gathered so far into a coherent summary.' The synthesis output is generic, cites nothing, and sometimes states that no findings were provided. What is the fix?",
    options: [
      "Give the synthesis subagent the same tools as the search subagent, so it can gather the findings it needs itself.",
      "Include the complete findings from the search and analysis subagents directly in the synthesis subagent's prompt.",
      "Enable shared memory between the subagents, so the synthesis subagent can read what earlier subagents have stored.",
      "Run synthesis in the coordinator's own context instead, since a subagent cannot be given another agent's results."
    ],
    answer: [1],
    rationale: [
      "Duplicates the search work and gives synthesis tools outside its role, which invites misuse.",
      "Correct. Subagents do not inherit the coordinator's context; prior findings must be passed explicitly in the prompt.",
      "Subagents do not share memory between invocations; the supported mechanism is passing context in the Task prompt.",
      "Subagents can be given any data in their prompt; folding synthesis into the coordinator also bloats the coordinator's context."
    ],
    takeaway: "Subagents start empty: put the prior agents' complete findings in the prompt."
  },
  {
    id: "s3-07",
    scenario: 3,
    domain: 1,
    task: "1.3",
    type: "single",
    pick: 1,
    stem: "For a query split into five independent subtopics, the coordinator's logs show it issues one Task call, waits for the result, then issues the next in a new turn. Each search subagent takes about 40 seconds, so the search phase alone takes over three minutes. The subtopics do not depend on each other. What change reduces latency most directly?",
    options: [
      "Combine all five subtopics into a single Task call, so one search subagent researches them back to back.",
      "Let each search subagent spawn the next one when it finishes, so the coordinator never spends a turn between.",
      "Lower each search subagent's maximum number of turns, so every individual subagent finishes sooner.",
      "Have the coordinator emit all five Task calls in a single response, so that the subagents run in parallel."
    ],
    answer: [3],
    rationale: [
      "Still sequential inside one subagent, and it crams five subtopics into one context.",
      "Still sequential, and chaining subagents to each other bypasses the coordinator's control and error handling.",
      "Cuts quality to save time while keeping the sequential structure that is the actual cause.",
      "Correct. Multiple Task calls in one coordinator turn run in parallel; calls spread across turns run one after another."
    ],
    takeaway: "Parallel subagents = several Task calls in one coordinator response."
  },
  {
    id: "s3-08",
    scenario: 3,
    domain: 1,
    task: "1.3",
    type: "single",
    pick: 1,
    stem: "The coordinator's prompt to the web search subagent reads: 'Search for the topic, open the first three results, copy the second paragraph of each, and return them.' For topics where the best sources are PDFs, or where the top results are press releases, the subagent dutifully returns irrelevant paragraphs. How should the delegation be rewritten?",
    options: [
      "Add more procedural steps covering PDFs and press releases, such as which page to open and which section to copy.",
      "Raise the number of results opened from three to ten, so relevant content is more likely to be among them.",
      "State the research goal and quality criteria (primary sources, recency, evidence) and let it choose how.",
      "Move the step-by-step procedure into the subagent's system prompt, so the coordinator only names the topic."
    ],
    answer: [2],
    rationale: [
      "Each new case needs another rule; procedural scripts stay brittle against sources the author did not foresee.",
      "Still a fixed procedure, just with more noise for the subagent to copy from.",
      "Correct. Coordinator prompts should specify goals and quality criteria so the subagent can adapt its method to what it finds.",
      "Relocates the same rigid procedure instead of removing it."
    ],
    takeaway: "Delegate goals and quality criteria, not step-by-step procedures."
  },
  {
    id: "s3-09",
    scenario: 3,
    domain: 1,
    task: "1.6",
    type: "single",
    pick: 1,
    stem: "Your coordinator plans every research task up front: it writes a fixed list of five subqueries, runs them, and synthesizes. On a query about a new drug-pricing law, the first search shows that most of the substantive analysis concerns a court challenge that was not in the original plan, and the final report barely mentions it. What decomposition strategy fits this kind of task better?",
    options: [
      "A longer fixed plan with more subqueries written before any search runs, so unexpected angles are covered.",
      "Adaptive decomposition, where the coordinator creates new subtasks based on what each round of findings reveals.",
      "A strict prompt chain where each subquery's output is passed as the only input to the next subquery in turn.",
      "Running the same fixed plan twice and merging both reports, so that anything missed once is caught the second time."
    ],
    answer: [1],
    rationale: [
      "A longer plan is still written blind; it cannot anticipate an angle that only appears once research starts.",
      "Correct. Open-ended investigation suits dynamic decomposition that generates subtasks from intermediate findings.",
      "Prompt chaining suits predictable, fixed steps; it does not add new subtasks when something unexpected appears.",
      "The same plan misses the same angle twice; repetition is not adaptation."
    ],
    takeaway: "Open-ended research: adaptive decomposition; predictable multi-step work: prompt chaining."
  },
  {
    id: "s3-10",
    scenario: 3,
    domain: 1,
    task: "1.7",
    type: "single",
    pick: 1,
    stem: "After a two-hour session in which the system gathered and analyzed 30 sources on a market, stakeholders want to compare two report framings: one organized by region and one by customer segment. Both should build on the same analysis without either influencing the other. What is the best approach?",
    options: [
      "Use fork_session to create two independent branches from the shared analysis and develop one framing in each.",
      "Resume the session, write the regional framing, then ask the same session to rewrite the report by segment.",
      "Start two new sessions and rerun the full search and analysis in each one, so the framings are fully independent.",
      "Run /compact on the session, then request both framings in one response so they share a single summary."
    ],
    answer: [0],
    rationale: [
      "Correct. fork_session creates independent branches from a shared baseline, which is exactly the need when exploring divergent approaches.",
      "The second framing is shaped by the first one sitting in the same context, so they are not independent.",
      "Throws away two hours of valid analysis and may produce different source sets, making the comparison less fair.",
      "Compaction manages context size; it does not create separate branches, and one response mixes the two framings."
    ],
    takeaway: "Two divergent directions from one baseline: fork_session."
  },
  {
    id: "s3-11",
    scenario: 3,
    domain: 1,
    task: "1.7",
    type: "single",
    pick: 1,
    stem: "A named research session, 'grid-storage-q3', analyzed 14 internal documents last week. Since then 2 of the 14 have been revised with updated figures; the other 12 are unchanged. You need to continue the investigation today. What is the most effective way to proceed?",
    options: [
      "Resume the session as it is; the model will notice the two documents changed the next time it reads them.",
      "Start a brand-new session and have it re-read and re-analyze all 14 of the documents from the very beginning.",
      "Resume the session and ask it to re-verify every finding from last week before continuing the work.",
      "Resume with --resume grid-storage-q3 and tell it which two documents changed, so it re-analyzes only those."
    ],
    answer: [3],
    rationale: [
      "The session holds last week's tool results and has no reason to re-read; it will reason over the stale figures.",
      "Most prior context is still valid, so discarding it wastes the earlier work; a fresh start suits cases where most results are stale.",
      "Forces a full re-exploration when only two documents need attention.",
      "Correct. Resume when prior context is mostly valid, and inform the session about the specific changes for targeted re-analysis."
    ],
    takeaway: "Mostly valid context: resume and name what changed. Mostly stale: start fresh with a summary."
  },
  {
    id: "s3-12",
    scenario: 3,
    domain: 5,
    task: "5.4",
    type: "single",
    pick: 1,
    stem: "A long research job running four subagents crashed 70 minutes in when the coordinator's host restarted. On restart the coordinator had no record of which subtopics were finished, so the whole job reran from the beginning, repeating about 60 minutes of completed work. How should you design for recovery?",
    options: [
      "Have the coordinator keep a running progress summary in its own context, so it can recall what has finished.",
      "Run each research job as a single subagent, so there are fewer moving parts that can fail on a long run.",
      "Have each agent export its state to a known location, and have the coordinator load a manifest on resume.",
      "Add a watchdog that restarts the job automatically after a crash, so operators don't need to rerun it."
    ],
    answer: [2],
    rationale: [
      "Anything held only in the context window disappears with the crashed process.",
      "Gives up parallelism and specialization, and a single long run can still crash with nothing saved.",
      "Correct. Structured state exports plus a manifest the coordinator loads (and injects into agent prompts) let the job resume where it stopped.",
      "Automates the restart but still restarts from scratch; nothing records what was already done."
    ],
    takeaway: "Crash recovery: agents export state to a known place; coordinator loads a manifest on resume."
  },
  {
    id: "s3-13",
    scenario: 3,
    domain: 2,
    task: "2.2",
    type: "single",
    pick: 1,
    stem: "The web search subagent calls a search API that returns HTTP 503 a few times an hour; a retry a few seconds later almost always succeeds. Today the subagent reports every 503 straight to the coordinator, which then re-plans and re-delegates the whole subtopic, roughly doubling run time. How should error handling be restructured?",
    options: [
      "Have the coordinator call the search API itself whenever a subagent reports a 503, bypassing that subagent entirely.",
      "Retry transient failures in the subagent; propagate only unresolved errors, with attempts and partial results.",
      "Suppress 503s inside the subagent and return whatever results were gathered as a normal successful response.",
      "Treat any 503 as fatal for the research job, so the run stops before it can produce an incomplete report."
    ],
    answer: [1],
    rationale: [
      "Pulls tool-level work into the coordinator and gives it tools outside its role; the retry belongs closer to the failure.",
      "Correct. Subagents should recover locally from transient failures and escalate only what they cannot resolve, with what they tried and what they have.",
      "Silently passing off a failure as success hides gaps from the coordinator and the reader.",
      "Terminating the whole workflow on a single, usually transient, failure is an anti-pattern."
    ],
    takeaway: "Retry transient errors locally; escalate only what you can't fix, with context."
  },
  {
    id: "s3-14",
    scenario: 3,
    domain: 5,
    task: "5.3",
    type: "single",
    pick: 1,
    stem: "A report on 'clinical trials of drug X' states 'no internal trial data exists for this compound.' Investigation shows the document analysis subagent's credentials for the internal trials repository had expired; the repository tool returned an empty list, and the subagent reported 'no matching documents.' What should change?",
    options: [
      "Make the tool and subagent report access failures as errors, distinct from queries that found no matches.",
      "Have the synthesis agent treat every empty result as suspicious and leave out any statement that depends on one.",
      "Have the coordinator rerun any subagent whose results come back empty, up to three times, before accepting them.",
      "Add a standard line to every report noting that some sources may have been unavailable during the research."
    ],
    answer: [0],
    rationale: [
      "Correct. Access failures need retry or rerouting decisions; valid empty results are real answers. Reporting them differently lets the coordinator act correctly.",
      "Discards genuine 'nothing found' answers, which are often meaningful findings in their own right.",
      "Expired credentials will fail the same way every time, and genuine empty results get rerun for nothing.",
      "A blanket disclaimer gives readers no idea which claims are affected, and the false statement still appears."
    ],
    takeaway: "Access failure is not 'no results'; report them differently."
  },
  {
    id: "s3-15",
    scenario: 3,
    domain: 5,
    task: "5.3",
    type: "single",
    pick: 1,
    stem: "During a run on 'global lithium supply', the academic database used by the document analysis subagent was down for the whole job. The subagent returned structured error context, and the coordinator sensibly continued with web sources. But the final report reads as a complete review, and readers had no way to tell that peer-reviewed sources were missing. What should you add?",
    options: [
      "Abort the run whenever any source type is unavailable, so that incomplete reports are never produced at all.",
      "Have the synthesis agent fill the academic gap from its own training knowledge so the report stays complete.",
      "Retry the database at the end of the run, and hold the report back until the database finally responds.",
      "Coverage annotations in the synthesis marking well-supported findings and gaps from unavailable sources."
    ],
    answer: [3],
    rationale: [
      "Terminating on one unavailable source throws away useful partial results; continuing was the right call.",
      "Uncited model knowledge passed off as research is worse than an acknowledged gap.",
      "Blocks delivery on an outage of unknown length; the report can ship now if it is honest about coverage.",
      "Correct. Synthesis should state which findings are well supported and which areas have gaps due to unavailable sources."
    ],
    takeaway: "Continue with partial results, and annotate coverage so the gaps are visible."
  },
  {
    id: "s3-16",
    scenario: 3,
    domain: 5,
    task: "5.6",
    type: "multi",
    pick: 2,
    stem: "Reports increasingly contain statements with no citation, or with a citation to the wrong source. Tracing shows the search and analysis subagents return accurate prose summaries, but by the time the synthesis subagent compresses them, the link between each claim and its source is gone. Which TWO changes best preserve provenance? Select TWO.",
    options: [
      "Require search and analysis subagents to output structured claim-source mappings: claim, source URL or document, excerpt and date",
      "Have the report subagent search the web at the end for some source that supports each uncited sentence",
      "Instruct the synthesis subagent to preserve and merge those mappings when combining findings, not rewrite them as prose",
      "Give the synthesis subagent a larger context window so it can keep every source document in full",
      "Ask the synthesis subagent to attach a self-reported confidence score to every claim in the report"
    ],
    answer: [0, 2],
    rationale: [
      "Correct. Structured mappings separate content from metadata, so attribution survives each handoff.",
      "Post-hoc citation finds something that agrees, not the source the claim actually came from, and can attach the wrong one.",
      "Correct. The mappings only help if synthesis is required to carry them through and merge them rather than summarizing them away.",
      "Attribution is lost through compression, not lack of space; full documents also crowd the synthesis context.",
      "Confidence scores say nothing about where a claim came from and are not well calibrated."
    ],
    takeaway: "Provenance survives only if claim-source mappings are produced upstream and preserved through synthesis."
  },
  {
    id: "s3-17",
    scenario: 3,
    domain: 5,
    task: "5.6",
    type: "single",
    pick: 1,
    stem: "Two credible sources give different 2025 figures for the share of US households with home batteries: a government survey says 4.1% and an industry association says 6.3%. The synthesis subagent's report states '4.1%' with no mention of the other figure; asked why, it says it 'chose the more conservative source.' What is the right behaviour?",
    options: [
      "Average the two values and report 5.2%, with a note that the figure combines two different sources.",
      "Report both values with their sources and methods, and present the figure as a contested finding.",
      "Prefer the government figure by default, since public agencies are generally more reliable than industry.",
      "Leave the statistic out of the report, since conflicting values mean the figure cannot be trusted."
    ],
    answer: [1],
    rationale: [
      "An average is a number neither source reported and hides the disagreement the reader needs to see.",
      "Correct. Conflicting statistics from credible sources are kept and annotated with attribution, and the report separates contested from well-established findings.",
      "A blanket preference is just a different arbitrary choice; it still silently drops a credible source.",
      "Omitting it loses information the reader would want; the disagreement itself is a finding."
    ],
    takeaway: "Credible sources conflict: keep both values with attribution, mark them contested."
  },
  {
    id: "s3-18",
    scenario: 3,
    domain: 5,
    task: "5.6",
    type: "single",
    pick: 1,
    stem: "A report on remote-work adoption says sources 'disagree sharply': one reports 12% of employees fully remote, another 28%. On inspection, the 12% comes from a 2019 survey and the 28% from a 2023 survey; both are accurate for their year. The subagents' outputs did not include dates. What change prevents this misreading?",
    options: [
      "Require subagents to include publication or data collection dates in their structured outputs.",
      "Instruct the synthesis agent to drop any source older than three years so stale figures can't conflict.",
      "Have the synthesis agent report the higher of two conflicting values, since it is more likely recent.",
      "Have the synthesis agent flag every numeric disagreement as contested without checking the cause."
    ],
    answer: [0],
    rationale: [
      "Correct. Dates in structured outputs let synthesis read the two figures as a change over time rather than a contradiction.",
      "Discards the historical data point that shows the trend, and some older sources remain authoritative.",
      "An arbitrary rule that guesses at recency instead of recording it.",
      "Still mislabels a trend as a dispute; without dates the agent cannot tell the two situations apart."
    ],
    takeaway: "Require publication/collection dates so temporal change isn't read as contradiction."
  },
  {
    id: "s3-19",
    scenario: 3,
    domain: 2,
    task: "2.3",
    type: "multi",
    pick: 2,
    stem: "The document analysis subagent was given a generic <code>fetch_url</code> tool plus the web search tool 'in case it needs them.' Logs show it fetching login pages, ad-heavy news sites and arbitrary links found inside documents, and running its own web searches that duplicate the search subagent's work. Which TWO changes best fix this? Select TWO.",
    options: [
      "Replace fetch_url with a load_document tool that validates the URL points to a supported document before loading it",
      "Remove the web search tool from the document analysis subagent so its tool set matches its role",
      "Keep both tools and add a system prompt line asking the subagent to fetch only document URLs",
      "Give the subagent every tool in the system, with longer descriptions, so it can pick the right one itself",
      "Add a second analysis subagent that reviews each fetched page and discards the ones that aren't documents"
    ],
    answer: [0, 1],
    rationale: [
      "Correct. Replacing a generic tool with a constrained one enforces the boundary in the tool itself.",
      "Correct. Agents with tools outside their specialization tend to misuse them; scope tools to the role.",
      "A prompt-only restriction leaves the generic capability in place and relies on the model to hold back.",
      "More tools increase decision complexity and cross-role misuse, the opposite of what is needed.",
      "Over-engineered: it cleans up after bad fetches instead of preventing them, and adds cost to every page."
    ],
    takeaway: "Scope tools to the role, and swap generic tools for constrained ones."
  },
  {
    id: "s3-20",
    scenario: 3,
    domain: 2,
    task: "2.1",
    type: "single",
    pick: 1,
    stem: "The document analysis subagent has one tool, <code>analyze_document(doc, instructions)</code>, which it uses to pull statistics, summarize papers, and check whether a source supports a claim. Output shape varies from call to call, and claim checks sometimes come back as summaries. What is the best redesign?",
    options: [
      "Keep the single tool but require longer, more detailed instructions in every call, so the output is predictable.",
      "Add few-shot examples of each use of analyze_document to the system prompt to stabilize the output format.",
      "Split it into extract_data_points, summarize_content and verify_claim_against_source, each with a contract.",
      "Move all document analysis into the synthesis subagent, so that one agent controls the output format from end to end."
    ],
    answer: [2],
    rationale: [
      "The tool still has no defined output contract; consistency depends on free-text instructions each time.",
      "Examples may help format, but one generic tool still blurs three jobs with no input/output contract to enforce.",
      "Correct. Splitting a generic tool into purpose-specific tools with defined input/output contracts makes both selection and output reliable.",
      "Merges two roles, bloats the synthesis context, and leaves the generic tool problem untouched."
    ],
    takeaway: "Split a vague do-everything tool into purpose-specific tools with clear contracts."
  },
]);
