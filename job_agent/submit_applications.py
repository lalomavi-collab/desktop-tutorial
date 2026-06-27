"""
הגשת קורות חיים אוטומטית — Wiz x2 + OpenAI
הרץ מהמחשב שלך:  python submit_applications.py
"""
import asyncio
from pathlib import Path
from browser_apply import auto_apply

RESUME = Path(__file__).parent / "resume.pdf"
APPS   = Path(__file__).parent / "applications"

JOBS = [
    {
        "company": "Wiz",
        "title":   "Privacy AI and Data Protection Counsel",
        "url":     "https://www.wiz.io/careers/job/4624101006",
        "letter":  APPS / "2026-06-19_Wiz_PrivacyAI_DataProtectionCounsel.md",
    },
    {
        "company": "Wiz",
        "title":   "Product and Data Protection Counsel",
        "url":     "https://www.wiz.io/careers/job/4588700006",
        "letter":  APPS / "2026-06-19_Wiz_Product_DataProtectionCounsel.md",
    },
    {
        "company": "OpenAI",
        "title":   "Counsel AI Policy",
        "url":     "https://openai.com/careers/counsel-ai-policy-san-francisco",
        "letter":  APPS / "2026-06-19_OpenAI_CounselAIPolicy.md",
    },
]

BASE_FIELDS = {
    "first_name": "Avraham",
    "last_name":  "Lalum",
    "email":      "avraham@lalum.co",
    "phone":      "+972-52-249-0420",
    "resume":     "__RESUME_FILE__",
    "linkedin":   "https://www.linkedin.com/in/avraham-lalum",
    "website":    "https://www.lalum.co",
}

async def main():
    results = []
    for job in JOBS:
        print(f"\n{'='*55}")
        print(f"  {job['company']} — {job['title']}")
        print(f"  {job['url']}")
        print(f"{'='*55}")

        cover = job["letter"].read_text(encoding="utf-8").split("---")[0].strip()
        mapping = {**BASE_FIELDS, "cover_letter": cover}

        result = await auto_apply(
            job_url=job["url"],
            field_mapping=mapping,
            resume_path=RESUME,
            job_title=job["title"],
            company=job["company"],
            headless=False,   # headless=False = תראה את הדפדפן
        )

        status = "✅ הצליח" if result["success"] else "⚠️  נכשל"
        print(f"  סטטוס:          {status}")
        print(f"  שדות זוהו:      {result['fields_detected']}")
        print(f"  צילום מסך:      {result['screenshot']}")
        if result["error"]:
            print(f"  שגיאה:          {result['error']}")
        results.append({"company": job["company"], "title": job["title"], **result})

    print(f"\n{'='*55}")
    print("סיכום:")
    for r in results:
        icon = "✅" if r["success"] else "❌"
        print(f"  {icon} {r['company']} — {r['title']}")

asyncio.run(main())
