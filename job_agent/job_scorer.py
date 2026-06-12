"""
מודול ציון משרות - מדרג משרות ומסנן לפי סף ציון.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any


@dataclass
class JobListing:
    title: str
    company: str
    url: str
    description: str
    location: str = ""
    salary: str = ""
    score: float = 0.0
    score_reason: str = ""
    raw: dict[str, Any] = field(default_factory=dict)


def score_jobs(
    jobs: list[JobListing],
    profile_context: dict,
    resume_text: str,
    client,
    model: str = "claude-sonnet-4-6",
    min_score: float = 8.0,
) -> list[JobListing]:
    """
    מציין כל משרה 1-10 לפי התאמה לפרופיל ול-CV.
    מחזיר רק משרות עם ציון >= min_score, ממוינות בסדר יורד.
    """
    scored: list[JobListing] = []

    profile_summary = json.dumps({
        "location": profile_context["personal"].get("location"),
        "notice_period": profile_context["job_preferences"].get("notice_period_text"),
        "expected_salary_ils": profile_context["job_preferences"].get("expected_salary_ils"),
        "work_type": profile_context["job_preferences"].get("work_type"),
        "willing_to_relocate": profile_context["job_preferences"].get("willing_to_relocate"),
    }, ensure_ascii=False)

    for job in jobs:
        prompt = f"""You are scoring a job match for Dr. Avraham Lalum — an AI Law expert.

CANDIDATE STRENGTHS:
- PhD in Law & Economics (University of Córdoba, Spain, 2022-2026)
- 20+ years legal practice (attorney, notary, mediator)
- 5+ years specializing in AI & Law, algorithmic decision-making, autonomous systems liability
- Lecturer at Tel Aviv University on AI, law and conflict resolution
- Published peer-reviewed research on AI-based risk modeling (Scopus/JCR journals)
- Deputy Chair, Israel Bar Association (2015-2023)
- Founder & Managing Partner, law firm (20 years)
- Expertise: AI governance, explainable AI, LegalTech, law & economics, autonomous systems

CANDIDATE PREFERENCES:
{profile_summary}

JOB TO SCORE:
Title: {job.title}
Company: {job.company}
Location: {job.location}
Salary: {job.salary}
Description: {job.description[:1000]}

SCORING GUIDE (1-10):
9-10: Perfect — AI law, policy, governance, legal counsel for tech/AV companies, academia AI law
7-8:  Good — legal roles at tech companies, policy/regulatory roles, LegalTech, law + tech hybrid
5-6:  Moderate — general legal, compliance, or tech-adjacent roles with some AI element
3-4:  Weak — pure software engineering, non-legal tech, or very junior roles
1-2:  Irrelevant — no legal or AI connection

Score high (8+) for: "AI policy", "legal counsel AI", "autonomous vehicles law", "AI governance",
"head of AI law", "director legal AI", "regulatory affairs AI", "LegalTech", "law professor AI".

Respond ONLY with valid JSON (no markdown):
{{"score": <1-10>, "reason": "<one sentence max 25 words>"}}"""

        response = client.messages.create(
            model=model,
            max_tokens=200,
            messages=[{"role": "user", "content": prompt}]
        )
        try:
            raw_text = response.content[0].text.strip()
            # strip markdown fences if present
            if raw_text.startswith("```"):
                raw_text = raw_text.split("```")[1]
                if raw_text.startswith("json"):
                    raw_text = raw_text[4:]
            result = json.loads(raw_text)
            job.score = float(result.get("score", 0))
            job.score_reason = result.get("reason", "")
        except (json.JSONDecodeError, ValueError):
            job.score = 0.0
            job.score_reason = "Scoring failed"

        if job.score >= min_score:
            scored.append(job)

    return sorted(scored, key=lambda j: j.score, reverse=True)


def load_jobs_from_file(path: str) -> list[JobListing]:
    """
    טוען רשימת משרות מ-JSON לצורכי בדיקה.
    פורמט: [{"title": ..., "company": ..., "url": ..., "description": ...}, ...]
    """
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    return [JobListing(**{k: v for k, v in item.items() if k in JobListing.__dataclass_fields__}) for item in data]
