"""בדיקות למנוע הכדאיות ומדרגות המס."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from deal_analysis.feasibility import (
    DealInputs, analyze, purchase_tax, purchase_tax_brackets,
)


def test_single_home_below_first_bracket():
    # דירה יחידה מתחת למדרגה הראשונה: פטור מלא
    assert purchase_tax(1_500_000, is_single_home=True) == 0


def test_single_home_second_bracket():
    # 2,000,000: המדרגה הראשונה פטורה, 3.5% על היתרה
    expected = round((2_000_000 - 1_978_745) * 0.035)
    assert purchase_tax(2_000_000, is_single_home=True) == expected


def test_single_home_third_bracket():
    # 3,000,000: פטור + 3.5% על המדרגה השנייה + 5% על היתרה
    expected = round((2_347_040 - 1_978_745) * 0.035) + round((3_000_000 - 2_347_040) * 0.05)
    assert purchase_tax(3_000_000, is_single_home=True) == expected


def test_investor_flat_8pct():
    assert purchase_tax(2_000_000, is_single_home=False) == round(2_000_000 * 0.08)


def test_investor_above_threshold():
    price = 7_000_000
    expected = round(6_055_070 * 0.08) + round((price - 6_055_070) * 0.10)
    assert purchase_tax(price, is_single_home=False) == expected


def test_brackets_detail_sums_to_total():
    for price in (1_000_000, 2_500_000, 5_000_000, 25_000_000):
        for single in (True, False):
            detail = purchase_tax_brackets(price, single)
            assert sum(b["amount"] for b in detail) == purchase_tax(price, single)
            # המדרגה האחרונה מסתיימת במחיר עצמו
            assert detail[-1]["to"] == price


def test_analyze_profit_and_verdict():
    inputs = DealInputs(
        price=2_000_000, expected_value=3_500_000,
        renovation_cost=200_000, other_costs=50_000,
        equity=1_000_000, loan_rate=0.05, loan_years=2.0,
    )
    result = analyze(inputs)
    assert result["net_profit"] > 0
    assert result["verdict"] in ("כדאית", "גבולית", "לא כדאית")
    assert len(result["sensitivity"]) == 5
    assert result["sensitivity"][2]["value_change_pct"] == 0
    # מס רכישה בפירוט תואם לסכום
    assert sum(b["amount"] for b in result["purchase_tax_detail"]) == result["purchase_tax"]


def test_analyze_betterment_levy_increases_investment():
    base = DealInputs(price=2_000_000, expected_value=3_000_000, equity=2_000_000, loan_rate=0.0)
    with_levy = DealInputs(price=2_000_000, expected_value=3_000_000, equity=2_000_000,
                           loan_rate=0.0, betterment_levy=300_000)
    assert analyze(with_levy)["total_investment"] == analyze(base)["total_investment"] + 300_000


def test_purchase_tax_override():
    inputs = DealInputs(price=2_000_000, expected_value=3_000_000,
                        purchase_tax_override=123_456)
    result = analyze(inputs)
    assert result["purchase_tax"] == 123_456
    assert result["purchase_tax_detail"] == []


def test_losing_deal_verdict():
    inputs = DealInputs(price=3_000_000, expected_value=2_800_000, equity=3_000_000)
    result = analyze(inputs)
    assert result["net_profit"] < 0
    assert result["verdict"] == "לא כדאית"
