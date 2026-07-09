#!/usr/bin/env python3
"""הרצת ניתוח עסקה מלא: קליטת מסמכים, סקירה תכנונית, כדאיות ודוח.

שימוש:
  python run_deal.py --folder <תיקיית מסמכי העסקה> --name "שם העסקה"
  פרמטרים כלכליים: --price, --value, --renovation, --other, --equity,
                    --rate, --years, --rent, --single-home

אם קיים בתיקייה קובץ deal.json עם הפרמטרים, הוא נטען אוטומטית
והפרמטרים משורת הפקודה גוברים עליו.
"""

import argparse
import json
from pathlib import Path

from deal_analysis.intake import intake_folder
from deal_analysis.planning import review
from deal_analysis.feasibility import DealInputs, analyze
from deal_analysis.report import build_report


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--folder", required=True, help="תיקיית מסמכי העסקה")
    p.add_argument("--name", default="", help="שם העסקה לדוח")
    p.add_argument("--price", type=float, default=None)
    p.add_argument("--value", type=float, default=None, help="שווי צפוי")
    p.add_argument("--renovation", type=float, default=0.0)
    p.add_argument("--other", type=float, default=0.0)
    p.add_argument("--equity", type=float, default=0.0)
    p.add_argument("--rate", type=float, default=0.05)
    p.add_argument("--years", type=float, default=2.0)
    p.add_argument("--rent", type=float, default=0.0)
    p.add_argument("--single-home", action="store_true")
    p.add_argument("--out", default=None, help="נתיב קובץ הדוח (ברירת מחדל: report.html בתיקיית העסקה)")
    p.add_argument("--no-ai", action="store_true", help="דלג על ניתוח AI גם אם יש מפתח API")
    args = p.parse_args()

    folder = Path(args.folder).expanduser()
    name = args.name or folder.name

    print(f"\n{'='*55}\n  ניתוח עסקה: {name}\n{'='*55}")

    # שלב 1: קליטת מסמכים
    intake = intake_folder(str(folder))
    if intake.get("error"):
        print(f"❌ {intake['error']}")
        return
    print(f"\n📄 נקלטו {intake['count']} מסמכים:")
    for d in intake["documents"]:
        status = f"שגיאה: {d['error']}" if d.get("error") else d["category"]
        print(f"  • {d['filename']}: {status}")

    # שלב 1ב: ניתוח AI (אם זמין)
    if not args.no_ai:
        from deal_analysis.ai_analyzer import enrich_documents
        intake["documents"], ai_status = enrich_documents(intake["documents"])
        print(f"\n🤖 {ai_status}")

    # שלב 2: סקירה תכנונית
    planning = review(intake["documents"])

    # מיזוג דגלים אדומים מניתוח ה-AI (ללא כפילויות)
    existing = {f["warning"] for f in planning["red_flags"]}
    for d in intake["documents"]:
        for flag in (d.get("ai") or {}).get("red_flags", []):
            if flag not in existing:
                planning["red_flags"].append({"keyword": "ai", "warning": flag})
                existing.add(flag)
    print(f"\n📋 סקירה תכנונית: שלמות {planning['completeness_pct']}%")
    for f in planning["red_flags"]:
        print(f"  🚩 {f['warning']}")
    if planning["missing_documents"]:
        print(f"  חסרים: {', '.join(planning['missing_documents'][:5])}")

    # שלב 3: פרמטרים כלכליים (deal.json ואז שורת פקודה)
    params = {}
    deal_json = folder / "deal.json"
    if deal_json.exists():
        params = json.loads(deal_json.read_text(encoding="utf-8"))
        print(f"\n💾 נטענו פרמטרים מ-deal.json")

    price = args.price if args.price is not None else params.get("price")
    value = args.value if args.value is not None else params.get("expected_value")

    feasibility = None
    if price and value:
        inputs = DealInputs(
            price=price,
            expected_value=value,
            renovation_cost=args.renovation or params.get("renovation_cost", 0.0),
            other_costs=args.other or params.get("other_costs", 0.0),
            equity=args.equity or params.get("equity", 0.0),
            loan_rate=args.rate if args.rate != 0.05 else params.get("loan_rate", 0.05),
            loan_years=args.years if args.years != 2.0 else params.get("loan_years", 2.0),
            monthly_rent=args.rent or params.get("monthly_rent", 0.0),
            is_single_home=args.single_home or params.get("is_single_home", False),
        )
        feasibility = analyze(inputs)
        print(f"\n💰 כדאיות: {feasibility['verdict']}")
        print(f"  סך השקעה:   {feasibility['total_investment']:,} ש\"ח")
        print(f"  רווח נקי:    {feasibility['net_profit']:,} ש\"ח")
        print(f"  תשואה שנתית: {feasibility['annual_roi_pct']}%")
    else:
        print("\n⚠️  לא הוזנו מחיר ושווי צפוי (--price / --value או deal.json), מדלג על ניתוח כדאיות")

    # שלב 4: דוח
    out = Path(args.out) if args.out else folder / "report.html"
    out.write_text(build_report(name, intake, planning, feasibility), encoding="utf-8")
    print(f"\n📊 הדוח נשמר: {out}\n")


if __name__ == "__main__":
    main()
