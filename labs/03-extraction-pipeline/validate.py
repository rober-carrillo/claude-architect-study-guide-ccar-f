"""STARTER - Lab 03 validation. Fill in TODO 6-8. Solution: solution/validate.py.

Validation of an extraction: Pydantic for shape and format, plus cross-field semantic checks.

Strict tool use guarantees the JSON matches the schema. It does NOT guarantee the numbers add
up, the dates are real, or the right value went in the right field. Code checks those.

Every problem is an Issue with a `retryable` flag:
- retryable=True   the model can fix it by re-reading the document (format, arithmetic,
                   a value it missed, a conflict it didn't flag)
- retryable=False  retrying is pointless: the information isn't in the source document.
                   Route to a human (or back to the vendor) instead.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, ValidationError, field_validator, model_validator

PO_REQUIRED_ABOVE = 1000.00
TOLERANCE = 0.01
CONFIDENCE_FLOOR = 0.80


class LineItem(BaseModel):
    description: str
    quantity: Optional[float]
    unit_price: Optional[float]
    amount: float


class FieldConfidence(BaseModel):
    vendor_name: float
    invoice_number: float
    due_date: float
    stated_total: float
    category: float


class Invoice(BaseModel):
    # The TARGET contract. Your schema.py (TODO 1-4) must produce exactly these fields.
    vendor_name: Optional[str]
    invoice_number: Optional[str]
    invoice_date: Optional[str]
    due_date: Optional[str]
    po_number: Optional[str]
    currency: Literal["USD", "EUR", "GBP", "CLP", "other"]
    currency_other_detail: Optional[str]
    category: Literal["software", "hardware", "professional_services", "facilities", "office_supplies",
                      "other", "unclear"]
    category_detail: Optional[str]
    line_items: list[LineItem]
    tax: Optional[float]
    stated_total: Optional[float]
    calculated_total: float
    conflict_detected: bool
    conflict_notes: Optional[str]
    field_confidence: FieldConfidence

    @field_validator("invoice_date", "due_date")
    @classmethod
    def iso_date(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            date.fromisoformat(v)  # raises ValueError -> ValidationError
        return v

    @model_validator(mode="after")
    def other_needs_detail(self) -> "Invoice":
        if self.currency == "other" and not self.currency_other_detail:
            raise ValueError("currency is 'other' but currency_other_detail is empty")
        if self.category in ("other", "unclear") and not self.category_detail:
            raise ValueError(f"category is '{self.category}' but category_detail is empty")
        return self


@dataclass
class Issue:
    code: str
    message: str
    retryable: bool

    def __str__(self) -> str:
        return f"[{self.code}] {self.message}"


PO_PATTERN = re.compile(r"\bP\.?\s?O\.?\b|purchase order|bestellnummer", re.IGNORECASE)


def validate(extraction: dict, source_text: str) -> tuple[Optional[Invoice], list[Issue]]:
    """Return (parsed invoice or None, issues). No issues means accept."""
    try:
        inv = Invoice.model_validate(extraction)
    except ValidationError as e:
        issues = [
            Issue("schema", f"{'.'.join(str(p) for p in err['loc']) or '(root)'}: {err['msg']}", retryable=True)
            for err in e.errors()
        ]
        return None, issues

    issues: list[Issue] = []
    items_sum = round(sum(li.amount for li in inv.line_items), 2)
    expected = round(items_sum + (inv.tax or 0.0), 2)

    # TODO(6): arithmetic. If inv.calculated_total != expected (beyond TOLERANCE), append a
    #          retryable Issue("calc_wrong", ...) that states both numbers.
    # TODO(7): conflicts. If stated_total differs from expected and conflict_detected is False,
    #          append a retryable Issue("conflict_unflagged", ...). If it IS flagged, that's not
    #          an error: route() sends it to a human.
    #          Also check each line item: quantity x unit_price == amount ("line_math").
    # TODO(8): PO policy. If the total is above PO_REQUIRED_ABOVE and po_number is null:
    #            - PO_PATTERN found in source_text -> retryable "po_missed"
    #            - not found                       -> NON-retryable "po_absent_from_source"
    #          The second case is the point of this lab: no retry can produce a value that
    #          isn't in the document.

    return inv, issues


def route(inv: Optional[Invoice], issues: list[Issue]) -> tuple[str, list[str]]:
    """Decide what happens next: 'accept' or 'human_review', with reasons."""
    reasons = [str(i) for i in issues]
    if inv is not None:
        if inv.conflict_detected:
            reasons.append(f"source conflict: {inv.conflict_notes}")
        low = {k: v for k, v in inv.field_confidence.model_dump().items() if v < CONFIDENCE_FLOOR}
        if low:
            reasons.append(f"low confidence: {low}")
        if inv.category == "unclear":
            reasons.append(f"category unclear: {inv.category_detail}")
    return ("human_review" if reasons else "accept"), reasons
