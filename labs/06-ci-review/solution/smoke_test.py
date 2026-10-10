"""No-API smoke test for lab 06. Run: python smoke_test.py

Builds the sample repo, then runs the whole review pipeline with a fake `claude` runner, so the
pass structure, prompts, envelope parsing and dedup are checked without spending tokens.
"""

from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

import review

LAB = Path(__file__).resolve().parent
LAB = LAB if (LAB / "make_sample_repo.sh").exists() else LAB.parent


def make_repo() -> Path:
    target = Path(tempfile.mkdtemp()) / "sample-pr-repo"
    out = subprocess.run(["bash", str(LAB / "make_sample_repo.sh"), str(target)], check=True,
                         capture_output=True, text=True).stdout.strip()
    return Path(out)


def F(file, line, pattern, cat="bug", sev="high"):
    return {"file": file, "line": line, "severity": sev, "category": cat, "detected_pattern": pattern,
            "message": "m", "fix": "f", "confidence": 0.9}


def test_schema():
    item = review.SCHEMA["properties"]["findings"]["items"]
    assert set(item["required"]) == {"file", "line", "severity", "category", "detected_pattern", "message", "fix",
                                     "confidence"}
    assert item["additionalProperties"] is False
    print("schema: OK")


def test_envelope():
    ok = {"type": "result", "is_error": False, "result": "", "session_id": "s",
          "structured_output": {"findings": [F("a.py", 1, "x")], "summary": "s"}}
    assert review.parse_envelope(json.dumps(ok))["findings"][0]["file"] == "a.py"
    # Shape captured from the real CLI when auth fails:
    bad = {"type": "result", "subtype": "success", "is_error": True, "result": "Not logged in · Please run /login",
           "terminal_reason": "api_error"}
    try:
        review.parse_envelope(json.dumps(bad))
    except RuntimeError as e:
        assert "Not logged in" in str(e)
    else:
        raise AssertionError("is_error envelope must raise")
    print("envelope parsing: OK")


def test_dedup():
    prior = [F("src/db.py", 5, "sql-fstring")]
    current = [F("src/db.py", 6, "sql-fstring"),         # same issue, line moved by 1 -> still open
               F("src/billing.py", 5, "float-money"),    # new
               F("src/billing.py", 5, "float-money")]    # duplicate across passes
    new, still = review.dedup(current, prior)
    assert [f["detected_pattern"] for f in new] == ["float-money"]
    assert [f["detected_pattern"] for f in still] == ["sql-fstring"]
    print("dedup: OK")


def test_pipeline_with_fake_claude():
    repo = make_repo()
    files = review.changed_files(repo, "main")
    assert files == ["src/billing.py", "src/db.py", "tests/test_billing.py"], files

    prompts = []

    def fake_runner(repo_, prompt, max_turns=8):
        prompts.append(prompt)
        if "CROSS-FILE" in prompt:
            return {"findings": [F("src/api.py", 5, "caller-signature-mismatch", "integration")], "summary": "1 issue"}
        if "src/db.py" in prompt.split("\n")[0]:
            return {"findings": [F("src/db.py", 5, "sql-fstring", "security")], "summary": ""}
        if "src/billing.py" in prompt.split("\n")[0]:
            return {"findings": [F("src/billing.py", 5, "float-money")], "summary": ""}
        return {"findings": [], "summary": ""}

    prior = [F("src/db.py", 5, "sql-fstring", "security")]
    result = review.review(repo, "main", prior, jobs=1, runner=fake_runner, log=lambda *_: None)

    assert len(prompts) == 4  # 3 per-file + 1 integration
    per_file = [p for p in prompts if "CROSS-FILE" not in p]
    assert all("<diff>" in p and "DO NOT REPORT" in p for p in per_file)
    db_prompt = next(p for p in per_file if p.startswith("You are reviewing ONE file of a pull request: src/db.py"))
    assert "<prior_findings>" in db_prompt                      # prior finding for this file is in context
    integ = next(p for p in prompts if "CROSS-FILE" in p)
    assert "float-money" in integ and "Grep" in integ           # local findings + instruction to find callers
    assert {f["detected_pattern"] for f in result["new"]} == {"float-money", "caller-signature-mismatch"}
    assert [f["detected_pattern"] for f in result["still_open"]] == ["sql-fstring"]
    print("pipeline (fake claude): OK")


if __name__ == "__main__":
    test_schema()
    test_envelope()
    test_dedup()
    test_pipeline_with_fake_claude()
    print("all smoke tests passed")
