"""STARTER - Lab 03 schema. Fill in TODO 1-4. Solution: solution/schema.py.

The extraction tool: a JSON schema the model must fill in, plus the prompt around it.

Design choices (each is an exam point):
- Fields that may be missing from the source are NULLABLE, so the model can say "not there"
  instead of inventing a value to satisfy a required field.
- Every property is listed in `required` (with null allowed). The model must make a decision
  about each one. Strict tool use also requires this, along with additionalProperties: false.
- Closed categories are enums with an escape hatch: "other" + a *_detail string, and
  "unclear" for genuinely ambiguous documents.
- The model reports BOTH the total printed on the page (stated_total) and the total it
  computes from line items + tax (calculated_total), and flags conflict_detected. Code can
  then check the arithmetic instead of trusting either number.
- field_confidence lets us route low-confidence extractions to a human.
"""

from __future__ import annotations

TOOL_NAME = "record_invoice"

NULLABLE_STR = {"type": ["string", "null"]}
NULLABLE_NUM = {"type": ["number", "null"]}

INVOICE_TOOL = {
    "name": TOOL_NAME,
    "description": "Record the fields extracted from ONE invoice.",
    "strict": True,
    "input_schema": {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            # TODO(1): these are plain "string". Which ones can be missing from a real invoice?
            #          Make them nullable (NULLABLE_STR) so the model can say "not there" instead
            #          of inventing a value. Run inv_02_missing_fields.txt before and after.
            "vendor_name": {"type": "string"},
            "invoice_number": {"type": "string"},
            "invoice_date": {"type": "string", "description": "YYYY-MM-DD"},
            "due_date": {"type": "string", "description": "YYYY-MM-DD"},
            "po_number": {"type": "string"},
            # TODO(2): add "other" to the currency enum plus a nullable currency_other_detail field
            #          (inv_04 is in CHF). Do the same for category: add "other" and "unclear"
            #          plus category_detail.
            "currency": {"type": "string", "enum": ["USD", "EUR", "GBP", "CLP"]},
            "category": {
                "type": "string",
                "enum": ["software", "hardware", "professional_services", "facilities", "office_supplies"],
            },
            "line_items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "description": {"type": "string"},
                        "quantity": NULLABLE_NUM,
                        "unit_price": NULLABLE_NUM,
                        "amount": {"type": "number"},
                    },
                    "required": ["description", "quantity", "unit_price", "amount"],
                },
            },
            "tax": NULLABLE_NUM,
            # TODO(3): one "total" field hides conflicts. Replace it with stated_total (as printed,
            #          nullable), calculated_total (line items + tax, computed by the model),
            #          conflict_detected (boolean) and conflict_notes (nullable string).
            "total": {"type": "number"},
            # TODO(4): add field_confidence: an object with a number 0-1 for vendor_name,
            #          invoice_number, due_date, stated_total, category (no min/max: strict mode
            #          doesn't support numeric constraints).
        },
        # Strict tool use: every property must appear here (nullable fields allow null).
        "required": [
            "vendor_name", "invoice_number", "invoice_date", "due_date", "po_number",
            "currency", "category", "line_items", "tax", "total",
        ],
    },
}

# TODO(5) (after step 6 of the README): compare results with and without the <examples> block.
SYSTEM_PROMPT = """You extract data from vendor invoices for accounts payable by calling the record_invoice tool.

Normalisation rules:
- Dates -> YYYY-MM-DD. "03.09.2026" on a European invoice is 3 September 2026.
- Amounts -> plain numbers without symbols or thousands separators. "CHF 2.480,00" -> 2480.00;
  "$1,200.00" -> 1200.00. "a dozen" -> 12.
- A field that is not in the document is null. Do not infer invoice numbers, PO numbers or due
  dates that are not written down.

<examples>
<example>
<input>Invoice says "Net 30" and also "Due: 2026-05-01", but Net 30 from the invoice date gives 2026-04-28.</input>
<output>due_date: "2026-05-01", conflict_detected: true,
conflict_notes: "Explicit due date 2026-05-01 disagrees with Net 30 (2026-04-28)."</output>
<why>The explicit date wins over computed terms, and the disagreement is recorded rather than hidden.</why>
</example>
<example>
<input>A typed-up receipt with no invoice number and no due date. Line items sum to 200.00; "Total: $200.00".</input>
<output>invoice_number: null, due_date: null, stated_total: 200.0, calculated_total: 200.0, conflict_detected: false</output>
<why>Missing data is null. Nothing is invented to fill required fields.</why>
</example>
<example>
<input>Items: 400.00 + 75.00, tax 0.00, "Balance due $500.00".</input>
<output>stated_total: 500.0, calculated_total: 475.0, conflict_detected: true,
conflict_notes: "Printed total 500.00 does not equal line items plus tax (475.00)."</output>
<why>Report both numbers. Do not "fix" the printed total or the line items to make them agree.</why>
</example>
</examples>"""

# Models that reject forced tool_choice ({"type": "tool"} / {"type": "any"}) with a 400.
# The exam teaches forced tool_choice; on these models use "auto" + strict + an explicit
# instruction, and check that a tool_use block actually came back.
NO_FORCED_TOOL_CHOICE = {"claude-opus-5-5", "claude-sonnet-5-5", "claude-fable-5-1", "claude-mythos-5-1"}


def tool_choice_for(model: str) -> dict:
    if model in NO_FORCED_TOOL_CHOICE:
        return {"type": "auto"}
    return {"type": "tool", "name": TOOL_NAME}  # forced: the model MUST call record_invoice


def user_message(document: str, model: str) -> str:
    must = f"\nCall the {TOOL_NAME} tool now." if model in NO_FORCED_TOOL_CHOICE else ""
    return f"<invoice>\n{document}\n</invoice>\nExtract this invoice.{must}"
