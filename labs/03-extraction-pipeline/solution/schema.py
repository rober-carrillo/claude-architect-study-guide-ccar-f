"""The extraction tool: a JSON schema the model must fill in, plus the prompt around it.

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
    "description": (
        "Record the fields extracted from ONE invoice. Call exactly once per document. "
        "Use null for any field that does not appear in the document; never guess."
    ),
    "strict": True,  # arguments are guaranteed to validate against input_schema
    "input_schema": {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "vendor_name": {**NULLABLE_STR, "description": "Issuer of the invoice as printed."},
            "invoice_number": {**NULLABLE_STR, "description": "As printed, e.g. 'NW-2026-0915'. Null if none."},
            "invoice_date": {**NULLABLE_STR, "description": "YYYY-MM-DD. Null if absent."},
            "due_date": {
                **NULLABLE_STR,
                "description": "YYYY-MM-DD. An explicit date wins over payment terms. Null if neither appears.",
            },
            "po_number": {**NULLABLE_STR, "description": "Purchase order reference, e.g. 'PO-77812'. Null if absent."},
            "currency": {"type": "string", "enum": ["USD", "EUR", "GBP", "CLP", "other"]},
            "currency_other_detail": {**NULLABLE_STR, "description": "ISO code when currency is 'other', else null."},
            "category": {
                "type": "string",
                "enum": ["software", "hardware", "professional_services", "facilities", "office_supplies",
                         "other", "unclear"],
            },
            "category_detail": {
                **NULLABLE_STR,
                "description": "Required when category is 'other' or 'unclear': say what it is or why it is unclear.",
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
                        "amount": {"type": "number", "description": "Line total as a plain number, e.g. 1234.5"},
                    },
                    "required": ["description", "quantity", "unit_price", "amount"],
                },
            },
            "tax": {**NULLABLE_NUM, "description": "Tax amount. 0 if stated as zero; null if not mentioned."},
            "stated_total": {**NULLABLE_NUM, "description": "The grand total exactly as printed. Null if none printed."},
            "calculated_total": {"type": "number", "description": "Sum of line item amounts plus tax, computed by you."},
            "conflict_detected": {
                "type": "boolean",
                "description": "True if the document contradicts itself (totals, dates vs terms, quantities).",
            },
            "conflict_notes": {**NULLABLE_STR, "description": "What conflicts, citing both values. Null if none."},
            "field_confidence": {
                "type": "object",
                "additionalProperties": False,
                "description": "Your confidence 0.0-1.0 that each field is correct.",
                "properties": {
                    "vendor_name": {"type": "number"},
                    "invoice_number": {"type": "number"},
                    "due_date": {"type": "number"},
                    "stated_total": {"type": "number"},
                    "category": {"type": "number"},
                },
                "required": ["vendor_name", "invoice_number", "due_date", "stated_total", "category"],
            },
        },
        "required": [
            "vendor_name", "invoice_number", "invoice_date", "due_date", "po_number",
            "currency", "currency_other_detail", "category", "category_detail",
            "line_items", "tax", "stated_total", "calculated_total",
            "conflict_detected", "conflict_notes", "field_confidence",
        ],
    },
}

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
