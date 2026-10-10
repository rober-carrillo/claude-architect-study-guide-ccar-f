# Lab 03 — Structured extraction: schema, validation, retry, batch

**Goal:** extract invoices into a JSON schema through tool use, validate the result with code,
retry with *specific* error feedback when a retry can help, stop when it can't, and run the
same pipeline through the Message Batches API with `custom_id` correlation and failure-only
resubmission.

**Time:** 90 min · **Cost:** about 6 documents × 1–3 calls. The batch run costs half as much
per token.

## Exam task statements exercised

| Task | Where |
|---|---|
| 4.3 Structured output via tool use | `schema.py`: nullable fields, enum + `other`/`unclear` + detail, `tool_choice` |
| 4.4 Validation / retry / feedback | `validate.py` (Pydantic + semantic checks), `extract.py` retry loop |
| 4.5 Batch processing | `batch.py`: `custom_id`, poll, results, resubmit failures only, SLA cadence |
| 4.2 Few-shot | `<examples>` in `SYSTEM_PROMPT` for varied formats and ambiguous cases |
| 5.5 Human review routing | `field_confidence`, `route()` → `accept` / `human_review` |

This is Preparation Exercise 3 from the exam guide.

## The sample invoices

| File | Edge case | Expected behaviour |
|---|---|---|
| `inv_01_clean.txt` | none | accept on first attempt |
| `inv_02_missing_fields.txt` | no invoice no., no due date | **nulls**, not invented values; accept |
| `inv_03_total_mismatch.txt` | printed total 1,250 vs items 1,180 | `stated_total ≠ calculated_total`, `conflict_detected: true` → human review |
| `inv_04_other_currency.txt` | CHF, `03.09.2026`, `2.480,00` | `currency: "other"` + `"CHF"`; normalised dates and numbers |
| `inv_05_no_po_large.txt` | $8,400 and no PO anywhere | `po_absent_from_source` is **not retryable** → human review after 1 call |
| `inv_06_ambiguous_category.txt` | e-mail, "a dozen", Net 30 vs explicit date, mixed goods/services | `quantity: 12`, due-date conflict flagged, category `unclear`/`other` with detail |

## Important: forced `tool_choice` and current models

The exam tests `tool_choice` options: `"auto"`, `"any"`, and forced
`{"type": "tool", "name": "..."}`. **Claude Sonnet 5.5, Opus 5.5 and Fable 5.1 reject `any` and
forced `tool` with a 400** (in Batches too). `schema.tool_choice_for(model)` handles this:

- models that accept forcing (e.g. `claude-haiku-4-5`, `claude-sonnet-5`, `claude-opus-5`) get
  `{"type": "tool", "name": "record_invoice"}`;
- the others get `{"type": "auto"}`, `strict: true` on the tool (schema-valid arguments), an
  explicit "Call the record_invoice tool now", and a check that a `tool_use` block came back
  (`no_tool_call` is treated as a retryable issue).

To see forced `tool_choice` in action: `CLAUDE_MODEL=claude-haiku-4-5 python extract.py`.
For the exam, the concepts are unchanged: `auto` may return text, `any` must call *some* tool,
and forced must call *that* tool.

## Files

```
03-extraction-pipeline/
  invoices/        6 sample documents
  schema.py        STARTER  TODO 1-5   tool schema + system prompt + tool_choice helper
  validate.py      STARTER  TODO 6-8   Pydantic model + semantic checks + routing
  extract.py       STARTER  TODO 9-10  sync extraction with retry-with-feedback
  batch.py         STARTER  TODO 11-12 Message Batches version
  smoke_test.py    no-API tests (validator, retry loop and batch collector with fake clients)
  solution/        working versions
```

## Steps

1. `python smoke_test.py`: it fails at the validator. Run `python batch.py --dry-run` to see
   exactly what one request looks like.
2. **Schema (TODO 1–4).** Make absent-able fields nullable; add `other` + `currency_other_detail`,
   `other`/`unclear` + `category_detail`; replace `total` with `stated_total`, `calculated_total`,
   `conflict_detected`, `conflict_notes`; add `field_confidence`. Keep every property in
   `required` and `additionalProperties: false` (strict tool use needs both).
3. **Before** finishing TODO 1, run `python extract.py invoices/inv_02_missing_fields.txt` with
   `invoice_number` still a required non-null string. Look at what the model puts there. Then
   make it nullable and run again.
4. **Semantic validation (TODO 6–8).** Arithmetic (`calc_wrong`), unflagged conflicts, line math,
   and the PO policy with its two outcomes: `po_missed` (retryable) vs `po_absent_from_source`
   (not retryable).
5. **Retry loop (TODO 9–10).** The retry request contains the original document, the failed
   extraction and the specific errors. Stop immediately when only non-retryable issues remain.
   `python smoke_test.py` should now pass.
6. **Run it:** `python extract.py` (all six). Then try `CLAUDE_MODEL=claude-haiku-4-5 python extract.py`.
7. **Few-shot (TODO 5).** Remove the `<examples>` block and rerun `inv_03` and `inv_06`. Does
   the model still report both totals? Still null the missing fields?
8. **Batch (TODO 11–12).** `python batch.py --sla 30`. Watch `processing_status` go to `ended`,
   results come back keyed by `custom_id`, and only the failures get resubmitted. If you stop
   polling, resume later with `python batch.py --batch-id <id>` (the id is saved in
   `batch_state.json`).

## What to observe

- **Strict schema ≠ correct data.** Every response parses, but `calculated_total` can still be
  wrong, a conflict can go unflagged, and a value can land in the wrong field. Those are semantic
  errors, and only your validator catches them.
- **Retry works for some failures and not others.** Arithmetic and missed fields usually get
  fixed on attempt 2. `inv_05` never gets a PO, however many times you ask, so the loop stops
  after one call and routes it.
- **`inv_03`** comes back with both numbers and `conflict_detected: true`. The model shouldn't
  quietly "fix" the total.
- **Batch results arrive in any order.** `collect()` keys everything by `custom_id`.
- **Routing:** `route()` sends conflicts, `unclear` categories and any field confidence < 0.8 to a
  human, even when validation passed.

## Exam connection

- Tool use + JSON schema is the most reliable way to get schema-compliant output. It removes
  syntax errors, not semantic ones.
- Nullable fields prevent fabrication. Required non-null fields push the model to invent values.
- `enum` + `"other"` + detail string keeps categories extensible, and `"unclear"` gives ambiguity
  somewhere to go.
- `stated_total` vs `calculated_total` + `conflict_detected` is the self-correction pattern.
- Retry with error feedback = document + failed extraction + specific errors. Retries don't help
  when the information is absent from the source.
- Batches: 50% cheaper, up to 24h, no latency SLA, single-turn per request (no mid-request tool
  execution), `custom_id` for correlation, resubmit only failures. Good for overnight and weekly
  jobs; wrong for blocking pre-merge checks.
- SLA math: 30h SLA − 24h batch window − buffer → submit at least every ~4h.
- Aggregate accuracy can hide weak segments. Measure by document type and field before reducing
  human review.

## Stretch exercises

1. **Stratified accuracy.** Write `labels.json` with the correct values for all six invoices.
   Compute accuracy **per field** and **per invoice type** (clean / informal / foreign). Which
   field is weakest? Would a single aggregate number have hidden it?
2. **Calibrate the confidence floor.** Log `field_confidence` vs correctness for 20+ runs and pick
   a `CONFIDENCE_FLOOR` that catches most errors without sending everything to review.
3. **Chunking.** Make a 300-page synthetic invoice that exceeds context. Handle its
   `invalid_request_error` in `batch.py` by splitting it into chunks and resubmitting just that
   `custom_id`.
4. **`tool_choice: "any"` with two schemas.** Add `record_credit_note` and send a mix of documents
   using a model that supports `"any"`. Which tool does it choose for each?
5. **Structured outputs instead of a tool.** Re-implement with `output_config={"format": {...}}`
   on `messages.create` and compare. What does tool use give you that a response format doesn't
   (e.g. several alternative schemas)?
