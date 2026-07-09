"""בדיקות לסקירה התכנונית."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from deal_analysis.planning import review


def _doc(text: str, category: str = "other") -> dict:
    return {"filename": "doc.txt", "text": text, "category": category}


def test_red_flags_detected():
    docs = [_doc("על הנכס רשום עיקול וקיימת הערת אזהרה לטובת הבנק")]
    result = review(docs)
    warnings = [f["warning"] for f in result["red_flags"]]
    assert any("עיקול" in w for w in warnings)
    assert any("הערות אזהרה" in w or "אזהרה" in w for w in warnings)


def test_no_red_flags_on_clean_text():
    result = review([_doc("מסמך נקי ללא בעיות")])
    assert result["red_flags"] == []


def test_building_rights_extraction():
    docs = [_doc("זכויות בנייה: 180% משטח המגרש, שטח עיקרי 171")]
    result = review(docs)
    assert result["building_rights"]["building_pct"] == 180
    assert result["building_rights"]["main_area_sqm"] == 171


def test_checklist_and_completeness():
    docs = [_doc("נסח טאבו", category="registry")]
    result = review(docs)
    assert 0 < result["completeness_pct"] < 100
    found_items = [c["item"] for c in result["checklist"] if c["found"]]
    assert "נסח טאבו עדכני" in found_items
    assert "חוות דעת שמאי" in result["missing_documents"]
