"""
Full-Cycle Job Application Agent - נקודת הכניסה הראשית.

הפעלה:
    python -m job_agent.main --jobs sample_jobs.json --resume resume.pdf --min-score 8 --headed

מצב דמו (ללא PDF אמיתי):
    python -m job_agent.main --demo
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import anthropic
from rich.console import Console
from rich.rule import Rule

# הוספת תיקיית השורש ל-path
sys.path.insert(0, str(Path(__file__).parent.parent))

from job_agent.resume_parser import extract_text, get_resume_path
from job_agent.job_scorer import JobListing, score_jobs, load_jobs_from_file
from job_agent.field_mapper import map_fields, answer_screening_question
from job_agent.browser_apply import run_auto_apply, detect_form_fields
from job_agent.approval_flow import ask_approval, report_result

console = Console()

PROFILE_PATH = Path(__file__).parent / "profile_context.json"


def load_profile() -> dict:
    with open(PROFILE_PATH, encoding="utf-8") as f:
        return json.load(f)


def demo_jobs() -> list[JobListing]:
    """משרות לדוגמה לצורכי בדיקה."""
    return [
        JobListing(
            title="Senior AI Engineer",
            company="TechVision AI",
            url="https://example.com/apply/senior-ai",
            description="We need a Senior AI Engineer with 5+ years experience in NLP, LLMs, and Python. "
                        "Build and deploy production ML systems. Remote-friendly. "
                        "Salary: 35,000-45,000 ILS/month.",
            location="Tel Aviv, Israel (Remote)",
            salary="35,000–45,000 ILS",
        ),
        JobListing(
            title="Junior Data Analyst",
            company="DataCo",
            url="https://example.com/apply/junior-analyst",
            description="Entry level data analyst position. Excel, basic SQL required.",
            location="Haifa, Israel",
            salary="12,000 ILS",
        ),
        JobListing(
            title="Machine Learning Lead",
            company="FinAI Ltd",
            url="https://example.com/apply/ml-lead",
            description="Lead ML team building fraud detection and risk scoring models. "
                        "Python, PyTorch, strong experience in financial AI. "
                        "Hybrid, 3 days office. Competitive package.",
            location="Tel Aviv, Israel (Hybrid)",
            salary="Competitive",
        ),
    ]


def run_agent(
    jobs: list[JobListing],
    profile: dict,
    resume_path: Path | None,
    resume_text: str,
    client: anthropic.Anthropic,
    min_score: float = 8.0,
    headless: bool = True,
    dry_run: bool = False,
) -> None:
    console.print(Rule("[bold blue]🔍 Scoring Jobs[/bold blue]"))
    console.print(f"Evaluating {len(jobs)} jobs with min score {min_score}/10...\n")

    top_jobs = score_jobs(jobs, profile, resume_text, client, min_score=min_score)

    if not top_jobs:
        console.print(f"[yellow]No jobs scored >= {min_score}. Try lowering --min-score.[/yellow]")
        return

    console.print(f"[green]{len(top_jobs)} job(s) passed the score threshold.[/green]\n")
    console.print(Rule("[bold blue]👤 Human Approval Required[/bold blue]"))

    for i, job in enumerate(top_jobs, 1):
        console.print(f"\n[dim]Job {i}/{len(top_jobs)}[/dim]")

        approved = ask_approval(job)

        if not approved:
            continue

        if dry_run:
            console.print("[dim yellow]DRY RUN: skipping actual browser automation.[/dim yellow]")
            continue

        if resume_path is None:
            console.print("[red]Cannot auto-apply: no resume.pdf provided. Use --resume flag.[/red]")
            continue

        # Map form fields using LLM (uses dummy fields here; in production these come from browser)
        console.print("[dim]Mapping form fields...[/dim]")
        dummy_fields = [
            {"id": "first_name", "label": "First Name", "type": "text", "required": True},
            {"id": "last_name", "label": "Last Name", "type": "text", "required": True},
            {"id": "email", "label": "Email", "type": "email", "required": True},
            {"id": "phone", "label": "Phone", "type": "tel", "required": False},
            {"id": "linkedin", "label": "LinkedIn URL", "type": "url", "required": False},
            {"id": "resume", "label": "Resume", "type": "file", "required": True},
            {"id": "cover_letter", "label": "Cover Letter", "type": "textarea", "required": False},
        ]
        field_mapping = map_fields(dummy_fields, profile, client)

        result = run_auto_apply(
            job_url=job.url,
            field_mapping=field_mapping,
            resume_path=resume_path,
            job_title=job.title,
            company=job.company,
            headless=headless,
        )

        report_result(job, result)

    console.print(Rule("[bold blue]✅ Session Complete[/bold blue]"))
    console.print("[dim]All decisions logged to job_agent/logs/application_log.jsonl[/dim]")


def main() -> None:
    parser = argparse.ArgumentParser(description="Full-Cycle Job Application Agent")
    parser.add_argument("--jobs", help="Path to JSON file with job listings")
    parser.add_argument("--resume", help="Path to resume PDF", default="resume.pdf")
    parser.add_argument("--min-score", type=float, default=8.0, help="Minimum score to apply (default: 8.0)")
    parser.add_argument("--headed", action="store_true", help="Show browser window (default: headless)")
    parser.add_argument("--dry-run", action="store_true", help="Score and approve but don't actually apply")
    parser.add_argument("--demo", action="store_true", help="Run with built-in demo jobs")
    args = parser.parse_args()

    console.print(Rule("[bold magenta]🤖 Full-Cycle Job Application Agent[/bold magenta]"))

    client = anthropic.Anthropic()
    profile = load_profile()

    # Load jobs
    if args.demo:
        jobs = demo_jobs()
        console.print(f"[dim]Demo mode: {len(jobs)} sample jobs loaded.[/dim]\n")
    elif args.jobs:
        jobs = load_jobs_from_file(args.jobs)
        console.print(f"[dim]Loaded {len(jobs)} jobs from {args.jobs}[/dim]\n")
    else:
        console.print("[red]Provide --jobs <file.json> or use --demo[/red]")
        sys.exit(1)

    # Load resume
    resume_path = None
    resume_text = "[No resume provided - using profile context only]"
    resume_file = Path(args.resume)
    if resume_file.exists():
        try:
            resume_path = get_resume_path(resume_file)
            resume_text = extract_text(resume_file)
            console.print(f"[green]✅ Resume loaded: {resume_path.name} ({len(resume_text)} chars)[/green]")
        except Exception as e:
            console.print(f"[yellow]⚠️  Resume parse warning: {e}[/yellow]")
    else:
        console.print(f"[yellow]⚠️  Resume file not found: {resume_file} — continuing without it.[/yellow]")

    run_agent(
        jobs=jobs,
        profile=profile,
        resume_path=resume_path,
        resume_text=resume_text,
        client=client,
        min_score=args.min_score,
        headless=not args.headed,
        dry_run=args.dry_run,
    )


if __name__ == "__main__":
    main()
