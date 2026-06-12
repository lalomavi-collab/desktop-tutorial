#!/usr/bin/env python3
"""
Worker — הרצה מלאה בסביבת Claude Code (ללא ANTHROPIC_API_KEY ישיר).
משתמש ב-claude CLI לציון ומיפוי שדות.
"""

import json
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from job_agent.resume_parser import extract_text
from job_agent.approval_flow import LOG_FILE, _log_decision
from job_agent.job_scorer import JobListing
from job_agent.job_scraper import run_scrape, DEFAULT_QUERIES

# ── צבעים לטרמינל ─────────────────────────────────────────────────────────

RESET = "\033[0m"
BOLD  = "\033[1m"
GREEN = "\033[92m"
AMBER = "\033[93m"
RED   = "\033[91m"
BLUE  = "\033[94m"
GRAY  = "\033[90m"
CYAN  = "\033[96m"

def c(text, color): return f"{color}{text}{RESET}"

# ── Claude CLI helper ──────────────────────────────────────────────────────

CLAUDE_BIN = "/opt/claude-code/bin/claude"

def claude(prompt: str, max_words: int = 300) -> str:
    """מריץ prompt דרך claude CLI ומחזיר תשובה."""
    result = subprocess.run(
        [CLAUDE_BIN, "--print"],
        input=prompt,
        capture_output=True,
        text=True,
        timeout=60,
    )
    return result.stdout.strip()


def score_job_cli(job: JobListing, profile: dict, resume_text: str) -> tuple[float, str]:
    """מציין משרה 1-10 דרך claude CLI."""
    target_titles = ', '.join(profile['job_preferences']['target_titles'][:4])
    prompt = f"""Score this job 1-10 for Dr. Avraham Lalum, AI Law expert.

CANDIDATE STRENGTHS:
- PhD Law & Economics, University of Córdoba (2022-2026)
- 20+ years legal practice; 5+ years AI Law research
- Expertise: AI governance, autonomous systems liability, explainable AI, LegalTech
- Lecturer: Tel Aviv University, AI & Law courses
- Published: Scopus/JCR peer-reviewed AI research
- Deputy Chair, Israel Bar Association (2015-2023)
- Target roles: {target_titles}
- Open to relocation: US, EU, UK, Germany

SCORING GUIDE:
9-10 = AI law/policy/governance role, legal counsel for tech/AV, AI ethics officer, law professor AI
7-8  = Legal role at tech company, regulatory affairs with AI, LegalTech, compliance + AI
5-6  = General legal/compliance with some tech element
3-4  = Pure tech engineering, non-legal, or very junior
1-2  = Completely irrelevant

JOB:
Title: {job.title}
Company: {job.company}
Location: {job.location}
Salary: {job.salary}
Description: {job.description[:700]}

Respond with ONLY valid JSON (no markdown):
{{"score": <number 1-10>, "reason": "<one sentence max 20 words>"}}"""

    raw = claude(prompt)
    # strip markdown fences
    if "```" in raw:
        raw = raw.split("```")[1]
        if raw.startswith("json"): raw = raw[4:]
    try:
        data = json.loads(raw.strip())
        return float(data["score"]), data.get("reason", "")
    except Exception:
        return 0.0, "scoring error"


def map_fields_cli(form_fields: list[dict], profile: dict) -> dict[str, str]:
    """ממפה שדות טופס לערכי פרופיל דרך claude CLI."""
    prompt = f"""Map these form fields to profile values.

FORM FIELDS: {json.dumps(form_fields, ensure_ascii=False)}

PROFILE: {json.dumps({
    'first_name': profile['personal']['first_name'],
    'last_name': profile['personal']['last_name'],
    'full_name': profile['personal']['full_name'],
    'email': profile['personal']['email'],
    'phone': profile['personal']['phone'],
    'location': profile['personal']['location'],
    'linkedin': profile['personal']['linkedin_url'],
    'website': profile['personal']['website_url'],
    'salary': profile['job_preferences']['expected_salary_usd'],
    'notice_period': profile['job_preferences']['notice_period_text'],
    'cover_letter': profile['screening_answers']['cover_letter_default'][:300],
    'years_experience': profile['screening_answers']['years_of_experience'],
}, ensure_ascii=False)}

Rules:
- file fields: return "__RESUME_FILE__"
- textarea/cover_letter: use the cover_letter value
- Return ONLY valid JSON object: {{"field_id": "value"}}"""

    raw = claude(prompt)
    if "```" in raw:
        raw = raw.split("```")[1]
        if raw.startswith("json"): raw = raw[4:]
    try:
        return json.loads(raw.strip())
    except Exception:
        return {}

# ── Display helpers ────────────────────────────────────────────────────────

def print_header():
    print()
    print(c("╔══════════════════════════════════════════════════════╗", BLUE))
    print(c("║        Worker — Full-Cycle Job Application Agent     ║", BLUE))
    print(c("║     ד\"ר אברהם לאלום · AI Law · Autonomous Systems    ║", BLUE))
    print(c("╚══════════════════════════════════════════════════════╝", BLUE))
    print()

def print_job_card(job: JobListing):
    score_color = GREEN if job.score >= 9 else AMBER if job.score >= 8 else RED
    print(c("┌─────────────────────────────────────────────────────┐", GRAY))
    print(f"  {c(job.title, BOLD)}")
    print(f"  {c(job.company, CYAN)}  ·  {job.location}")
    print(f"  שכר: {job.salary}")
    print(f"  ציון AI: {c(f'{job.score:.1f}/10', score_color)}")
    print(f"  {c(job.score_reason, GRAY)}")
    print(c("└─────────────────────────────────────────────────────┘", GRAY))

def ask_approval(job: JobListing) -> bool:
    print()
    print(c(f"  אשר הגשה ל: {job.title} @ {job.company}?", BOLD))
    print(f"  {c('y', GREEN)} = אשר והגש   {c('n', RED)} = דלג   {c('d', AMBER)} = פרטים")
    while True:
        ans = input(f"\n  {c('בחירה:', CYAN)} ").strip().lower()
        if ans in ("y", "yes", "כן"):
            _log_decision(job, "approved")
            return True
        elif ans in ("n", "no", "לא"):
            _log_decision(job, "skipped")
            print(c("  ⏭  דילוג — עובר למשרה הבאה", GRAY))
            return False
        elif ans in ("d", "details"):
            print()
            print(c("  תיאור מלא:", BOLD))
            for line in job.description.split(". "):
                if line.strip():
                    print(f"  {GRAY}{line.strip()}.{RESET}")
        else:
            print(c("  הקלד y / n / d", GRAY))

# ── Jobs to scan ───────────────────────────────────────────────────────────

STATIC_JOBS = [
    JobListing(
        title="Head of AI Policy & Autonomous Systems Law",
        company="Waymo (Alphabet)",
        url="https://waymo.com/careers/",
        description="Waymo seeks a senior legal-policy expert to lead Autonomous Vehicle regulatory and liability strategy. Own engagement with NHTSA, FTC and international regulators, draft position papers on AV decision-making liability, represent Waymo in legislative hearings, and build the legal framework governing how our AI makes life-and-death decisions. PhD in Law or Economics strongly preferred. Deep understanding of AI systems required. Executive-level role shaping global AV regulation.",
        location="San Francisco / Remote",
        salary="$250,000–$320,000 + RSU",
    ),
    JobListing(
        title="Director of AI Law & Public Policy",
        company="Mercedes-Benz AG",
        url="https://mercedes-benz.com/careers/",
        description="Mercedes-Benz seeks Director of AI Law to lead global policy strategy for autonomous vehicles. Engage with ISO 26262, UN WP.29 regulation on automated driving (UNECE), and country-specific AV legislation. Define liability protocols for Level 3–4 autonomy decisions. PhD preferred in law, economics, or public policy.",
        location="Stuttgart, Germany / Tel Aviv (Hybrid option)",
        salary="€150,000–€200,000",
    ),
    JobListing(
        title="AI & Law Tenure-track Professor",
        company="Hebrew University of Jerusalem",
        url="https://huji.ac.il/careers/",
        description="Hebrew University Faculty of Law invites applications for a tenure-track position in AI & Law. Teach algorithmic governance, AI liability, and autonomous systems regulation. Lead new interdisciplinary AI & Society research center. PhD in Law required.",
        location="ירושלים",
        salary="28,000–38,000 ₪",
    ),
]

def get_jobs(live_scrape: bool = False, headed: bool = False) -> list[JobListing]:
    """מחזיר משרות — סטטיות או מסריקה חיה."""
    if not live_scrape:
        return STATIC_JOBS

    print(c("\n  סורק משרות חיות מ-LinkedIn ו-Indeed...", CYAN))
    try:
        jobs = run_scrape(
            queries=DEFAULT_QUERIES,
            sources=["linkedin", "indeed"],
            headless=not headed,
        )
        print(c(f"  נמצאו {len(jobs)} משרות ייחודיות", GREEN))
        # אם הסריקה ריקה — חזור לסטטי
        return jobs if jobs else STATIC_JOBS
    except Exception as e:
        print(c(f"  שגיאה בסריקה: {e} — עובר למשרות סטטיות", AMBER))
        return STATIC_JOBS

# ── Main ───────────────────────────────────────────────────────────────────

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Worker — Job Application Agent")
    parser.add_argument("--scrape", action="store_true", help="סרוק משרות חיות מ-LinkedIn/Indeed")
    parser.add_argument("--headed", action="store_true", help="הצג דפדפן בזמן הסריקה")
    args = parser.parse_args()

    print_header()

    # Load profile + CV
    profile_path = Path(__file__).parent / "profile_context.json"
    resume_path  = Path(__file__).parent / "resume.docx"

    with open(profile_path, encoding="utf-8") as f:
        profile = json.load(f)

    print(c(f"  מועמד: {profile['personal']['full_name']}", BOLD))
    print(f"  PhD: {profile['academic']['phd_institution']}")
    print(f"  התמחות: AI Law · Autonomous Systems · Law & Economics")

    resume_text = extract_text(resume_path)
    print(f"  CV: {len(resume_text)} תווים — {c('נקרא ✓', GREEN)}")
    print()

    jobs = get_jobs(live_scrape=args.scrape, headed=args.headed)
    print(c(f"═══ שלב 1: סריקה וציון {len(jobs)} משרות ════════════════════", BLUE))
    print()

    scored = []
    for i, job in enumerate(jobs, 1):
        print(f"  [{i}/{len(jobs)}] מציין: {job.title[:45]}...", end="", flush=True)
        score, reason = score_job_cli(job, profile, resume_text)
        job.score = score
        job.score_reason = reason
        color = GREEN if score >= 9 else AMBER if score >= 7 else RED
        print(f" {c(f'{score:.1f}', color)}")
        if score >= 7:
            scored.append(job)

    scored.sort(key=lambda j: j.score, reverse=True)
    print()
    print(c(f"═══ שלב 2: {len(scored)} משרות עברו סף 7 — ממתין לאישורך ════", BLUE))

    for job in scored:
        print()
        print_job_card(job)
        approved = ask_approval(job)
        if approved:
            print()
            print(c(f"  ✅ מאושר! Worker מתחיל תהליך הגשה...", GREEN))
            print(c("  ──────────────────────────────────────────────────", GRAY))
            print(c("  [Playwright] — להרצה אמיתית עם דפדפן:", AMBER))
            print(f"  python -m job_agent.main --resume job_agent/resume.docx --headed")
            print()
            print(c("  שדות שימולאו בטופס:", BOLD))
            form_fields = [
                {"id": "first_name", "label": "First Name", "type": "text"},
                {"id": "last_name",  "label": "Last Name",  "type": "text"},
                {"id": "email",      "label": "Email",      "type": "email"},
                {"id": "phone",      "label": "Phone",      "type": "tel"},
                {"id": "linkedin",   "label": "LinkedIn",   "type": "url"},
                {"id": "resume",     "label": "Resume",     "type": "file"},
                {"id": "cover_letter","label":"Cover Letter","type":"textarea"},
            ]
            print(c("  ממפה שדות עם AI...", GRAY), end="", flush=True)
            mapping = map_fields_cli(form_fields, profile)
            print(c(" ✓", GREEN))
            for fid, val in mapping.items():
                if val and val != "__RESUME_FILE__":
                    display = val[:55] + "..." if len(val) > 55 else val
                    print(f"  {CYAN}{fid:<15}{RESET} → {display}")
                elif val == "__RESUME_FILE__":
                    print(f"  {CYAN}{'resume':<15}{RESET} → {c('resume.docx (upload)', GREEN)}")
            print()
            _log_decision(job, "applied", {"fields_mapped": len(mapping)})
            print(c(f"  📋 נרשם ביומן: job_agent/logs/application_log.jsonl", GRAY))

    print()
    print(c("═══ סיום ════════════════════════════════════════════", BLUE))
    print(c("  פקודות להרצה אמיתית על המחשב שלך:", BOLD))
    print()
    print(f"  {CYAN}# סריקת משרות חיות + הגשה אוטומטית:{RESET}")
    print(f"  {GRAY}set ANTHROPIC_API_KEY=sk-ant-...{RESET}")
    print(f"  {GRAY}python -m job_agent.main --scrape --resume job_agent/resume.docx --headed{RESET}")
    print()
    print(f"  {CYAN}# רק סריקה וציון (ללא הגשה):{RESET}")
    print(f"  {GRAY}python -m job_agent.main --scrape --dry-run --headed{RESET}")
    print()
    print(f"  {CYAN}# סריקה עם שאילתות מותאמות:{RESET}")
    print(f"  {GRAY}python -m job_agent.main --scrape --queries \"AI law policy,legal AI governance\" --headed{RESET}")
    print()

if __name__ == "__main__":
    main()
