"""בדיקות למקורות החיצוניים, עם mocks (ללא רשת)."""

import sys
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent.parent))

from deal_analysis.sources.comparables import (
    fetch_comparables, value_sanity_check, _parse_deals,
)
from deal_analysis.sources.interest import fetch_boi_rate
from deal_analysis.sources.doc_fetch import fetch_document, _safe_filename


NADLAN_PAYLOAD = {
    "AllResults": [
        {"DEALAMOUNT": "2,000,000", "DEALNATURE": "80", "DEALDATE": "01.05.2026",
         "FULLADRESS": "הרצל 20 תל אביב", "ASSETROOMNUM": "3"},
        {"DEALAMOUNT": "3,000,000", "DEALNATURE": "100", "DEALDATE": "12.04.2026",
         "FULLADRESS": "הרצל 30 תל אביב", "ASSETROOMNUM": "4"},
        {"DEALAMOUNT": "0", "DEALNATURE": "0"},  # שורה פגומה, מסוננת
    ]
}


def test_parse_deals_filters_invalid():
    deals = _parse_deals(NADLAN_PAYLOAD)
    assert len(deals) == 2
    assert deals[0]["price_per_sqm"] == 25_000
    assert deals[1]["price_per_sqm"] == 30_000


def test_fetch_comparables_median():
    with patch("deal_analysis.sources.comparables.get_json") as mock:
        mock.side_effect = [{"query": "x"}, NADLAN_PAYLOAD]
        result = fetch_comparables("הרצל תל אביב")
    assert result["ok"]
    assert result["median_per_sqm"] == 27_500
    assert result["count"] == 2


def test_fetch_comparables_network_failure():
    with patch("deal_analysis.sources.comparables.get_json", side_effect=OSError("timeout")):
        result = fetch_comparables("כתובת")
    assert not result["ok"]
    assert "שגיאה" in result["error"]


def test_value_sanity_check_flags_large_gap():
    comps = {"ok": True, "median_per_sqm": 27_500}
    # שווי צפוי 4.1M על 95 מ"ר = כ-43,157 למ"ר, פער של כ-57% מהחציון
    check = value_sanity_check(4_100_000, 95, comps)
    assert check is not None
    assert check["gap_pct"] > 15
    assert "גבוה" in check["warning"]


def test_value_sanity_check_ok_within_range():
    comps = {"ok": True, "median_per_sqm": 27_500}
    assert value_sanity_check(2_700_000, 100, comps) is None


def test_boi_rate():
    with patch("deal_analysis.sources.interest.get_json",
               return_value={"currentInterest": 4.5}):
        result = fetch_boi_rate()
    assert result["ok"]
    assert result["boi_rate"] == 0.045
    assert result["suggested_loan_rate"] == 0.06


def test_boi_rate_failure():
    with patch("deal_analysis.sources.interest.get_json", side_effect=OSError("blocked")):
        result = fetch_boi_rate()
    assert not result["ok"]


def test_safe_filename():
    assert _safe_filename("https://x.co/docs/../../etc/passwd").endswith(".pdf")
    assert "/" not in _safe_filename("https://x.co/a/b/c.pdf")
    assert _safe_filename("https://x.co/receipt.pdf") == "receipt.pdf"


def test_fetch_document_rejects_http():
    result = fetch_document("http://insecure.example/doc.pdf", "/tmp")
    assert not result["ok"]


def test_fetch_document_rejects_non_pdf(tmp_path):
    with patch("deal_analysis.sources.doc_fetch.get_bytes", return_value=b"<html>login</html>"):
        result = fetch_document("https://x.co/doc.pdf", str(tmp_path))
    assert not result["ok"]
    assert "אינו PDF" in result["error"]


def test_fetch_document_saves_pdf(tmp_path):
    with patch("deal_analysis.sources.doc_fetch.get_bytes", return_value=b"%PDF-1.4 data"):
        result = fetch_document("https://x.co/receipt.pdf", str(tmp_path))
    assert result["ok"]
    assert Path(result["path"]).read_bytes().startswith(b"%PDF")


def test_fetch_document_no_overwrite(tmp_path):
    (tmp_path / "receipt.pdf").write_bytes(b"%PDF existing")
    with patch("deal_analysis.sources.doc_fetch.get_bytes", return_value=b"%PDF new"):
        result = fetch_document("https://x.co/receipt.pdf", str(tmp_path))
    assert result["ok"]
    assert result.get("note")
    assert (tmp_path / "receipt.pdf").read_bytes() == b"%PDF existing"
