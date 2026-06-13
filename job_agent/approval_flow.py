"""
Human-in-the-Loop approval flow - הצגת משרה ובקשת אישור לפני אוטו-אפליי.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from pathlib import Path

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich import box

from job_agent.job_scorer import JobListing

console = Console()
LOG_DIR = Path(__file__).parent / "logs"
LOG_DIR.mkdir(exist_ok=True)
LOG_FILE = LOG_DIR / "application_log.jsonl"


def _log_decision(job: JobListing, decision: str, result: dict | None = None) -> None:
    entry = {
        "timestamp": datetime.now().isoformat(),
        "title": job.title,
        "company": job.company,
        "url": job.url,
        "score": job.score,
        "decision": decision,
        "result": result,
    }
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def present_job(job: JobListing) -> None:
    """מציג כרטיס מידע יפה על המשרה."""
    score_color = "green" if job.score >= 9 else "yellow" if job.score >= 8 else "red"

    table = Table(box=box.SIMPLE, show_header=False, padding=(0, 1))
    table.add_column("Field", style="bold cyan", width=20)
    table.add_column("Value")

    table.add_row("Title", f"[bold]{job.title}[/bold]")
    table.add_row("Company", job.company)
    table.add_row("Location", job.location or "—")
    table.add_row("Salary", job.salary or "—")
    table.add_row("Score", f"[{score_color}]{job.score:.1f}/10[/{score_color}]")
    table.add_row("Why", f"[italic]{job.score_reason}[/italic]")
    table.add_row("URL", f"[link={job.url}]{job.url[:70]}[/link]")

    console.print(Panel(table, title="[bold blue]📋 Job Found[/bold blue]", border_style="blue"))


def ask_approval(job: JobListing) -> bool:
    """
    מציג את המשרה ושואל אישור.
    מחזיר True אם המשתמש אישר, False אם דחה.
    """
    present_job(job)

    while True:
        answer = console.input(
            f"\n[bold yellow]Auto-apply to [cyan]{job.title}[/cyan] at [cyan]{job.company}[/cyan]? "
            f"(Score: {job.score}/10)[/bold yellow]\n"
            f"[dim]Enter y=yes, n=no, d=details: [/dim]"
        ).strip().lower()

        if answer in ("y", "yes", "כן"):
            console.print("[green]✅ Approved — launching browser...[/green]\n")
            _log_decision(job, "approved")
            return True

        elif answer in ("n", "no", "לא"):
            console.print("[red]⏭️  Skipped.[/red]\n")
            _log_decision(job, "skipped")
            return False

        elif answer in ("d", "details"):
            console.print(Panel(
                job.description[:1200] + ("..." if len(job.description) > 1200 else ""),
                title="Job Description",
                border_style="dim"
            ))

        else:
            console.print("[dim]Please enter y / n / d[/dim]")


def report_result(job: JobListing, result: dict) -> None:
    """מדווח על תוצאת האפליקציה."""
    if result.get("success"):
        console.print(Panel(
            f"[green]✅ Application submitted![/green]\n"
            f"Fields filled: {result.get('fields_filled', '?')}\n"
            f"Screenshot: [dim]{result.get('screenshot')}[/dim]",
            title=f"[green]Applied: {job.title} @ {job.company}[/green]",
            border_style="green"
        ))
    else:
        console.print(Panel(
            f"[red]❌ Application failed[/red]\n"
            f"Error: {result.get('error', 'Unknown')}\n"
            f"Screenshot: [dim]{result.get('screenshot', 'none')}[/dim]",
            title=f"[red]Failed: {job.title} @ {job.company}[/red]",
            border_style="red"
        ))
    _log_decision(job, "applied" if result.get("success") else "failed", result)
