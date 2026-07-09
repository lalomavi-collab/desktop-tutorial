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


DEALS_BASE_DEFAULT = r"C:\Users\lalom\OneDrive\שולחן העבודה\LALUM\עסקאות"


def pick_deal_folder() -> str | None:
    """מצב אינטראקטיבי: מציג את תיקיות העסקאות ומבקש בחירה במספר."""
    import os
    base = Path(os.environ.get("DEALS_BASE_FOLDER", DEALS_BASE_DEFAULT)).expanduser()
    if not base.is_dir():
        print(f"תיקיית העסקאות לא נמצאה: {base}")
        print("צור אותה ושים בתוכה תיקייה לכל עסקה, או הגדר DEALS_BASE_FOLDER.")
        return None
    deals = sorted([d for d in base.iterdir() if d.is_dir()],
                   key=lambda d: d.stat().st_mtime, reverse=True)
    if not deals:
        print(f"אין תיקיות עסקאות בתוך: {base}")
        return None
    print(f"\nעסקאות בתיקייה {base}:\n")
    for i, d in enumerate(deals, 1):
        has_report = "📊" if (d / "report.html").exists() else "  "
        print(f"  {i}. {has_report} {d.name}")
    choice = input("\nמספר עסקה לניתוח (Enter לביטול): ").strip()
    if not choice.isdigit() or not (1 <= int(choice) <= len(deals)):
        return None
    return str(deals[int(choice) - 1])


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--folder", default=None, help="תיקיית מסמכי העסקה (ללא: בחירה מרשימה)")
    p.add_argument("--name", default="", help="שם העסקה לדוח")
    p.add_argument("--price", type=float, default=None)
    p.add_argument("--value", type=float, default=None, help="שווי צפוי")
    p.add_argument("--renovation", type=float, default=0.0)
    p.add_argument("--other", type=float, default=0.0)
    p.add_argument("--equity", type=float, default=0.0)
    p.add_argument("--rate", type=float, default=None,
                   help="ריבית שנתית, ברירת מחדל: ריבית בנק ישראל + מרווח")
    p.add_argument("--years", type=float, default=2.0)
    p.add_argument("--rent", type=float, default=0.0)
    p.add_argument("--single-home", action="store_true")
    p.add_argument("--out", default=None, help="נתיב קובץ הדוח (ברירת מחדל: report.html בתיקיית העסקה)")
    p.add_argument("--no-ai", action="store_true", help="דלג על ניתוח AI גם אם יש מפתח API")
    p.add_argument("--address", default=None, help="כתובת הנכס (מפעיל עסקאות השוואה ומחקר תכנוני)")
    p.add_argument("--fetch-url", action="append", default=[],
                   help="קישור למסמך PDF להורדה לתיקייה לפני הניתוח (ניתן מספר פעמים)")
    p.add_argument("--open", action="store_true", help="פתח את הדוח בדפדפן בסיום")
    args = p.parse_args()

    interactive = args.folder is None
    if interactive:
        picked = pick_deal_folder()
        if not picked:
            return
        args.folder = picked

    folder = Path(args.folder).expanduser()
    name = args.name or folder.name

    print(f"\n{'='*55}\n  ניתוח עסקה: {name}\n{'='*55}")

    # שלב 0: הורדת מסמכים מקישורים (מהדגל ומ-deal.json)
    pre_params = {}
    deal_json_path = folder / "deal.json"
    if deal_json_path.exists():
        pre_params = json.loads(deal_json_path.read_text(encoding="utf-8"))
    urls = list(args.fetch_url) + pre_params.get("document_urls", [])
    if urls:
        from deal_analysis.sources.doc_fetch import fetch_document
        for url in urls:
            result = fetch_document(url, str(folder))
            if result["ok"]:
                print(f"⬇️  הורד: {Path(result['path']).name}" +
                      (f" ({result['note']})" if result.get("note") else ""))
            else:
                print(f"⚠️  {result['error']} ({url[:60]})")

    address = args.address or pre_params.get("address")

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

    # שלב 3: פרמטרים כלכליים (deal.json נטען בשלב 0, שורת הפקודה גוברת)
    params = pre_params
    if params:
        print(f"\n💾 נטענו פרמטרים מ-deal.json")

    price = args.price if args.price is not None else params.get("price")
    value = args.value if args.value is not None else params.get("expected_value")

    # שלב 3ב: מקורות חיצוניים (השוואות, ריבית, מחקר תכנוני)
    externals = {"comparables": None, "value_check": None, "planning_research": None, "boi": None}

    loan_rate = args.rate if args.rate is not None else params.get("loan_rate")
    if loan_rate is None:
        from deal_analysis.sources.interest import fetch_boi_rate
        boi = fetch_boi_rate()
        externals["boi"] = boi
        if boi["ok"]:
            loan_rate = boi["suggested_loan_rate"]
            print(f"\n🏦 ריבית בנק ישראל: {boi['boi_rate'] * 100:.2f}%, "
                  f"ריבית מימון משוערת: {loan_rate * 100:.2f}%")
        else:
            loan_rate = 0.05
            print(f"\n⚠️  {boi['error']}, משתמש בברירת מחדל 5%")

    if address:
        from deal_analysis.sources.comparables import fetch_comparables
        print(f"\n🏘️  מביא עסקאות השוואה לכתובת: {address}")
        comps = fetch_comparables(address)
        externals["comparables"] = comps
        if comps["ok"]:
            print(f"  {comps['count']} עסקאות, חציון {comps['median_per_sqm']:,} ש\"ח למ\"ר")
        else:
            print(f"  ⚠️  {comps['error']}")

        if not args.no_ai:
            from deal_analysis.ai_analyzer import research_planning_status
            research = research_planning_status(address)
            externals["planning_research"] = research
            if research["ok"]:
                print("🔎 מחקר תכנוני הושלם")
            else:
                print(f"⚠️  {research['error']}")

    feasibility = None
    if price and value:
        inputs = DealInputs(
            price=price,
            expected_value=value,
            renovation_cost=args.renovation or params.get("renovation_cost", 0.0),
            other_costs=args.other or params.get("other_costs", 0.0),
            equity=args.equity or params.get("equity", 0.0),
            loan_rate=loan_rate,
            betterment_levy=params.get("betterment_levy", 0.0),
            loan_years=args.years if args.years != 2.0 else params.get("loan_years", 2.0),
            monthly_rent=args.rent or params.get("monthly_rent", 0.0),
            is_single_home=args.single_home or params.get("is_single_home", False),
        )
        feasibility = analyze(inputs)
        print(f"\n💰 כדאיות: {feasibility['verdict']}")
        print(f"  סך השקעה:   {feasibility['total_investment']:,} ש\"ח")
        print(f"  רווח נקי:    {feasibility['net_profit']:,} ש\"ח")
        print(f"  תשואה שנתית: {feasibility['annual_roi_pct']}%")

        # בדיקת סבירות שווי מול השוק
        comps = externals.get("comparables")
        area = params.get("area_sqm", 0.0)
        if comps and area:
            from deal_analysis.sources.comparables import value_sanity_check
            check = value_sanity_check(value, area, comps)
            externals["value_check"] = check
            if check:
                print(f"  🟡 {check['warning']}")
    else:
        print("\n⚠️  לא הוזנו מחיר ושווי צפוי (--price / --value או deal.json), מדלג על ניתוח כדאיות")

    # שלב 4: דוח
    out = Path(args.out) if args.out else folder / "report.html"
    out.write_text(build_report(name, intake, planning, feasibility, externals), encoding="utf-8")
    print(f"\n📊 הדוח נשמר: {out}\n")

    # במצב אינטראקטיבי (או עם --open) הדוח נפתח אוטומטית בדפדפן
    if interactive or args.open:
        import webbrowser
        webbrowser.open(out.resolve().as_uri())


if __name__ == "__main__":
    main()
