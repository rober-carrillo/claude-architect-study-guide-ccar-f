"""Validation of an extraction: Pydantic for shape and format, plus cross-field semantic checks.

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

    # The model's own arithmetic must be right; this is retryable.
    if abs(inv.calculated_total - expected) > TOLERANCE:
        issues.append(Issue(
            "calc_wrong",
            f"calculated_total={inv.calculated_total} but line items ({items_sum}) + tax ({inv.tax or 0}) = {expected}.",
            retryable=True,
        ))

    # A mismatch between printed and computed totals is fine if it is FLAGGED.
    if inv.stated_total is not None and abs(inv.stated_total - expected) > TOLERANCE and not inv.conflict_detected:
        issues.append(Issue(
            "conflict_unflagged",
            f"stated_total={inv.stated_total} differs from line items + tax = {expected}, "
            "but conflict_detected is false. Re-read the document; if the document itself disagrees, "
            "set conflict_detected=true and explain in conflict_notes. Do not change printed values.",
            retryable=True,
        ))

    for li in inv.line_items:
        if li.quantity is not None and li.unit_price is not None and abs(li.quantity * li.unit_price - li.amount) > TOLERANCE:
            issues.append(Issue(
                "line_math",
                f"line '{li.description}': {li.quantity} x {li.unit_price} != {li.amount}.",
                retryable=True,
            ))

    if inv.invoice_date and inv.due_date and inv.due_date < inv.invoice_date:
        issues.append(Issue("dates", f"due_date {inv.due_date} is before invoice_date {inv.invoice_date}.", retryable=True))

    # Business policy: invoices over $1000 need a PO number.
    total = inv.stated_total if inv.stated_total is not None else inv.calculated_total
    if total > PO_REQUIRED_ABOVE and not inv.po_number:
        if PO_PATTERN.search(source_text):
            issues.append(Issue(
                "po_missed",
                "po_number is null but the document mentions a purchase order. Extract it.",
                retryable=True,
            ))
        else:
            issues.append(Issue(
                "po_absent_from_source",
                f"Total {total:.2f} > {PO_REQUIRED_ABOVE:.0f} requires a PO number, and the document has none. "
                "Retrying cannot fix this. Ask the vendor or the requester.",
                retryable=False,
            ))

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
