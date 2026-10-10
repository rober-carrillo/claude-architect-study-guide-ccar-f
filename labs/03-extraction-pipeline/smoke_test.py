"""No-API smoke test for lab 03. Run: python smoke_test.py

- checks the tool schema obeys strict-tool-use rules
- runs the validator on hand-written "model outputs" for each sample invoice
- drives extract_with_retries() and the batch collector with fake clients that return real
  anthropic SDK response objects (parsed from JSON), so no tokens are spent
"""

from __future__ import annotations

import copy
from types import SimpleNamespace as NS

from anthropic.types import Message
from anthropic.types.messages import MessageBatchIndividualResponse

import batch
import extract
from schema import INVOICE_TOOL, NO_FORCED_TOOL_CHOICE, tool_choice_for
from validate import route, validate

DOCS = batch.load_documents()

CONF = {"vendor_name": 0.95, "invoice_number": 0.95, "due_date": 0.9, "stated_total": 0.95, "category": 0.9}

GOOD = {
    "inv_01_clean": {
        "vendor_name": "Northwind Cloud Services LLC", "invoice_number": "NW-2026-0915",
        "invoice_date": "2026-09-15", "due_date": "2026-10-15", "po_number": "PO-77812",
        "currency": "USD", "currency_other_detail": None, "category": "software", "category_detail": None,
        "line_items": [
            {"description": "Platform subscription (Sept)", "quantity": 1, "unit_price": 1200.0, "amount": 1200.0},
            {"description": "Additional seats", "quantity": 10, "unit_price": 25.0, "amount": 250.0},
        ],
        "tax": 119.63, "stated_total": 1569.63, "calculated_total": 1569.63,
        "conflict_detected": False, "conflict_notes": None, "field_confidence": CONF,
    },
    "inv_02_missing_fields": {
        "vendor_name": "Joe's Window Cleaning", "invoice_number": None, "invoice_date": "2026-09-30",
        "due_date": None, "po_number": None, "currency": "USD", "currency_other_detail": None,
        "category": "facilities", "category_detail": None,
        "line_items": [
            {"description": "Cleaned street-facing windows, 2 floors", "quantity": None, "unit_price": None, "amount": 180.0},
            {"description": "Ladder fee", "quantity": None, "unit_price": None, "amount": 20.0},
        ],
        "tax": None, "stated_total": 200.0, "calculated_total": 200.0,
        "conflict_detected": False, "conflict_notes": None,
        "field_confidence": {**CONF, "invoice_number": 0.99, "due_date": 0.99},
    },
}


def test_schema_is_strict_compatible():
    def walk(node, path="input_schema"):
        if isinstance(node, dict) and node.get("type") == "object":
            assert node.get("additionalProperties") is False, f"{path}: additionalProperties must be false"
            assert set(node["required"]) == set(node["properties"]), f"{path}: every property must be required"
            for k, v in node["properties"].items():
                walk(v, f"{path}.{k}")
        if isinstance(node, dict) and node.get("type") == "array":
            walk(node["items"], f"{path}[]")
        if isinstance(node, dict):
            for bad in ("minimum", "maximum", "minLength", "maxLength"):
                assert bad not in node, f"{path}: {bad} is not supported with strict"
    walk(INVOICE_TOOL["input_schema"])
    assert tool_choice_for("claude-haiku-4-5") == {"type": "tool", "name": "record_invoice"}
    assert tool_choice_for("claude-sonnet-5-5") == {"type": "auto"}
    print("schema: OK")


def test_validator():
    # Clean invoices are accepted.
    for cid in ("inv_01_clean", "inv_02_missing_fields"):
        inv, issues = validate(GOOD[cid], DOCS[cid])
        assert inv is not None and issues == [], (cid, issues)
        assert route(inv, issues)[0] == "accept", cid

    # A fabricated-looking wrong calculated_total is caught and retryable.
    bad = copy.deepcopy(GOOD["inv_01_clean"])
    bad["calculated_total"] = 1450.0
    _, issues = validate(bad, DOCS["inv_01_clean"])
    assert [i.code for i in issues] == ["calc_wrong"] and issues[0].retryable

    # Total mismatch: unflagged -> retryable issue; flagged -> accepted by validator, routed to human.
    mismatch = {
        **copy.deepcopy(GOOD["inv_01_clean"]),
        "vendor_name": "Brightline Office Supply", "invoice_number": "BL-55102", "po_number": "PO-77901",
        "invoice_date": "2026-09-22", "due_date": "2026-10-07", "category": "office_supplies",
        "line_items": [
            {"description": "Ergonomic chair", "quantity": 4, "unit_price": 245.0, "amount": 980.0},
            {"description": "Monitor arm", "quantity": 4, "unit_price": 50.0, "amount": 200.0},
        ],
        "tax": 0.0, "stated_total": 1250.0, "calculated_total": 1180.0,
    }
    _, issues = validate(mismatch, DOCS["inv_03_total_mismatch"])
    assert [i.code for i in issues] == ["conflict_unflagged"], issues
    mismatch["conflict_detected"], mismatch["conflict_notes"] = True, "printed 1250 vs computed 1180"
    inv, issues = validate(mismatch, DOCS["inv_03_total_mismatch"])
    assert issues == [] and route(inv, issues)[0] == "human_review"

    # PO policy: absent from source -> NOT retryable; present but missed -> retryable.
    no_po = {
        **copy.deepcopy(GOOD["inv_01_clean"]),
        "vendor_name": "Harlow & Finch Consulting", "invoice_number": "HF-0042", "po_number": None,
        "invoice_date": "2026-09-29", "due_date": "2026-10-29", "category": "professional_services",
        "line_items": [
            {"description": "Discovery workshops", "quantity": 3, "unit_price": 1800.0, "amount": 5400.0},
            {"description": "Architecture report", "quantity": None, "unit_price": None, "amount": 3000.0},
        ],
        "tax": None, "stated_total": 8400.0, "calculated_total": 8400.0,
    }
    _, issues = validate(no_po, DOCS["inv_05_no_po_large"])
    assert [(i.code, i.retryable) for i in issues] == [("po_absent_from_source", False)], issues
    missed = {**copy.deepcopy(GOOD["inv_01_clean"]), "po_number": None}
    _, issues = validate(missed, DOCS["inv_01_clean"])
    assert [(i.code, i.retryable) for i in issues] == [("po_missed", True)], issues

    # Pydantic catches format problems: bad date, 'other' without detail.
    fmt = {**copy.deepcopy(GOOD["inv_01_clean"]), "due_date": "15/10/2026", "currency": "other"}
    inv, issues = validate(fmt, DOCS["inv_01_clean"])
    assert inv is None and len(issues) >= 1 and all(i.retryable for i in issues), issues
    print("validator: OK")


def fake_message(tool_input: dict | None, stop_reason="tool_use") -> Message:
    content = [{"type": "tool_use", "id": "toolu_01", "name": "record_invoice", "input": tool_input}] if tool_input else \
        [{"type": "text", "text": "Here is the invoice summary..."}]
    return Message.model_validate({
        "id": "msg_01", "type": "message", "role": "assistant", "model": "fake", "content": content,
        "stop_reason": stop_reason, "stop_sequence": None,
        "usage": {"input_tokens": 10, "output_tokens": 10},
    })


def test_retry_loop():
    bad = copy.deepcopy(GOOD["inv_01_clean"])
    bad["calculated_total"] = 1450.0
    scripted = [fake_message(None, "end_turn"), fake_message(bad), fake_message(GOOD["inv_01_clean"])]
    sent = []

    def create(**params):
        sent.append(params)
        return scripted.pop(0)

    client = NS(messages=NS(create=create))
    result = extract.extract_with_retries(client, DOCS["inv_01_clean"], log=lambda *_: None)
    assert result["decision"] == "accept" and len(result["attempts"]) == 3, result
    # The 3rd request carries the document, the failed extraction and the specific error.
    retry_text = sent[2]["messages"][0]["content"]
    assert "<invoice>" in retry_text and "<previous_extraction>" in retry_text and "calc_wrong" in retry_text

    # Non-retryable issue: stops after ONE attempt and routes to a human.
    no_po = {**copy.deepcopy(GOOD["inv_02_missing_fields"]), "stated_total": 8400.0, "calculated_total": 8400.0,
             "line_items": [{"description": "x", "quantity": None, "unit_price": None, "amount": 8400.0}]}
    scripted[:] = [fake_message(no_po)]
    result = extract.extract_with_retries(client, DOCS["inv_05_no_po_large"], log=lambda *_: None)
    assert result["decision"] == "human_review" and len(result["attempts"]) == 1, result
    print("retry loop (fake client): OK")


def test_batch_requests_and_collect():
    reqs = batch.build_requests({cid: extract.first_messages(t) for cid, t in DOCS.items()})
    assert [r["custom_id"] for r in reqs] == sorted(DOCS)
    assert reqs[0]["params"]["tools"][0]["name"] == "record_invoice"
    assert batch.max_submission_interval(30) == 4

    def resp(cid, result):
        return MessageBatchIndividualResponse.model_validate({"custom_id": cid, "result": result})

    ok = {"type": "succeeded", "message": fake_message(GOOD["inv_01_clean"]).model_dump()}
    lines = [
        resp("inv_02_missing_fields", {"type": "succeeded", "message": fake_message(GOOD["inv_02_missing_fields"]).model_dump()}),
        resp("inv_01_clean", ok),  # out of order on purpose
        resp("inv_03_total_mismatch", {"type": "errored", "error": {"type": "error", "error": {"type": "overloaded_error", "message": "busy"}}}),
        resp("inv_04_other_currency", {"type": "errored", "error": {"type": "error", "error": {"type": "invalid_request_error", "message": "too long"}}}),
        resp("inv_05_no_po_large", {"type": "expired"}),
    ]
    client = NS(messages=NS(batches=NS(results=lambda _id: iter(lines))))
    out = batch.collect(client, "msgbatch_fake", DOCS)
    assert out["inv_01_clean"]["state"] == "accept"
    assert out["inv_02_missing_fields"]["state"] == "accept"
    assert out["inv_03_total_mismatch"]["state"] == "resubmit"
    assert out["inv_04_other_currency"]["state"] == "fix_request"
    assert out["inv_05_no_po_large"]["state"] == "resubmit"
    print("batch build/collect (fake results): OK")


if __name__ == "__main__":
    assert set(NO_FORCED_TOOL_CHOICE) >= {"claude-sonnet-5-5"}
    test_schema_is_strict_compatible()
    test_validator()
    test_retry_loop()
    test_batch_requests_and_collect()
    print("all smoke tests passed")
