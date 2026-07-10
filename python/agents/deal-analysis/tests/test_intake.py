"""בדיקות למודול קליטת המסמכים."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from deal_analysis.intake import intake_folder, extract_numbers, _classify


def test_classify_registry():
    assert _classify("נסח רישום מקרקעין טאבו גוש חלקה", "נסח_טאבו.txt") == "registry"


def test_classify_planning():
    assert _classify('תב"ע זכויות בנייה היתר בנייה', "תכנוני.txt") == "planning"


def test_classify_unknown():
    assert _classify("טקסט כללי ללא מילות מפתח", "קובץ.txt") == "other"


def test_extract_numbers():
    text = 'שטח רשום: 95 מ"ר, מחיר: 2,800,000 ש"ח, 12 יח"ד'
    nums = extract_numbers(text)
    assert nums["area_sqm"] == 95
    assert nums["price_nis"] == 2_800_000
    assert nums["units"] == 12


def test_missing_folder():
    result = intake_folder("/nonexistent/folder/xyz")
    assert result["documents"] == []
    assert "error" in result


def test_intake_reads_txt(tmp_path):
    (tmp_path / "נסח_טאבו.txt").write_text("נסח טאבו גוש 1234", encoding="utf-8")
    result = intake_folder(str(tmp_path))
    assert result["count"] == 1
    assert result["documents"][0]["category"] == "registry"
    assert result["documents"][0]["error"] is None


def test_intake_corrupt_pdf(tmp_path):
    (tmp_path / "bad.pdf").write_bytes(b"not a real pdf")
    result = intake_folder(str(tmp_path))
    assert result["count"] == 1
    assert result["documents"][0]["error"] is not None
