"""ממשק CLI אינטראקטיבי - מודל 6 השלבים הגנרי"""

import sys
from pathlib import Path

from rich.console import Console
from rich.markdown import Markdown
from rich.panel import Panel
from rich.prompt import Prompt
from rich.table import Table

from prompt_builder.agents.builder_agent import PromptBuilderAgent
from prompt_builder.templates.app_templates import STEPS


console = Console()


def print_welcome() -> None:
    console.print()
    console.print(
        Panel(
            "[bold cyan]סוכן בניית פרומפטים מקצועיים[/]\n\n"
            "הסוכן ילווה אותך דרך [bold]6 שלבים[/] לבניית פרומפט מושלם:\n"
            "  1️⃣  תפקיד (Role)         - מי ה-AI?\n"
            "  2️⃣  קהל יעד (Audience)    - עבור מי?\n"
            "  3️⃣  נתונים (Input)        - על בסיס מה?\n"
            "  4️⃣  משימה (Task)          - מה לעשות?\n"
            "  5️⃣  אילוצים (Constraints)  - מה המגבלות?\n"
            "  6️⃣  פלט (Output)          - איך זה נראה?\n\n"
            "[bold]עובד עם כל תחום[/] - הסוכן מתאים את השאלות לתחום שלך\n\n"
            "[dim]הקלד 'יציאה' בכל שלב כדי לצאת | 'דלג' כדי לדלג על שלב[/]",
            title="🏗️  Prompt Builder Agent",
            border_style="cyan",
        )
    )


def get_project_info() -> tuple[str, str, str] | None:
    """שואל שם פרויקט, תחום, ופלטפורמה"""
    console.print()
    name = Prompt.ask("📌 [bold]מה שם הפרויקט / האפליקציה?[/]")
    if name == "יציאה":
        return None

    domain = Prompt.ask(
        "🏷️  [bold]מה התחום המקצועי?[/]\n"
        "   דוגמאות: עו\"ד נדל\"ן, רו\"ח מיסוי, יועץ עסקי, ביטוח, שמאות,\n"
        "   דיני עבודה, M&A, ציות רגולטורי, או כל תחום אחר"
    )
    if domain == "יציאה":
        return None

    platform = Prompt.ask(
        "🖥️  [bold]לאן בונים?[/]\n"
        "   דוגמאות: אתר למשרד, פורטל לקוחות, בוט ווטסאפ, GPT מותאם,\n"
        "   מערכת פנימית, כלי לצוות, אפליקציה",
        default="",
    )
    if platform == "יציאה":
        return None

    return name, domain, platform


def run_step(agent: PromptBuilderAgent, use_ai: bool = True) -> bool:
    """מריץ שלב בודד. מחזיר False אם המשתמש רוצה לצאת."""
    step = agent.session.get_current_step()
    if not step:
        return True

    progress = agent.session.get_progress()
    console.print()
    console.print(f"  [dim]{progress}[/]")

    if use_ai:
        # Claude מציג את השאלה עם אפשרויות מותאמות לתחום
        try:
            question_display = agent.ask_step(user_message=None)
            console.print(Panel(question_display, title=f"שלב {step.number}/6: {step.title_he}", border_style="blue"))
        except Exception as e:
            # fallback בלי AI
            console.print(Panel(
                f"❓ {step.core_question}\n\n[dim]{step.guidance}[/]",
                title=f"שלב {step.number}/6: {step.title_he}",
                border_style="blue",
            ))
    else:
        console.print(Panel(
            f"❓ {step.core_question}\n\n[dim]{step.guidance}[/]",
            title=f"שלב {step.number}/6: {step.title_he}",
            border_style="blue",
        ))

    # תשובת המשתמש
    user_input = Prompt.ask("[bold cyan]התשובה שלך[/]")

    if user_input == "יציאה":
        return False
    if user_input == "דלג":
        agent.advance()
        return True

    # שמירה + שאלת העמקה
    if use_ai:
        try:
            follow_up = agent.ask_step(user_message=user_input)
            console.print()
            console.print(Panel(follow_up, title="🤖 שאלת העמקה", border_style="magenta"))

            follow_answer = Prompt.ask("[bold cyan]תשובתך (או Enter לדלג)[/]", default="")
            if follow_answer and follow_answer not in ("יציאה", "דלג"):
                agent.process_follow_up(follow_answer)
                # אישור מהסוכן
                ack = agent.chat(follow_answer)
                console.print(f"  [magenta]🤖 {ack[:250]}{'...' if len(ack) > 250 else ''}[/]")
            elif follow_answer == "יציאה":
                return False
        except Exception as e:
            agent.session.save_answer(user_input)
            console.print(f"  [dim]⚠ לא ניתן להתחבר ל-AI: {e}[/]")
    else:
        agent.session.save_answer(user_input)

    agent.advance()
    return True


def show_summary(agent: PromptBuilderAgent) -> None:
    """מציג סיכום של כל התשובות"""
    console.print()
    table = Table(title="📋 סיכום התשובות", show_header=True, border_style="green")
    table.add_column("שלב", style="bold cyan", width=22)
    table.add_column("תשובה", style="white")

    for step in STEPS:
        answer = agent.session.answers.get(step.key, "[לא הוגדר]")
        display = answer if len(answer) <= 80 else answer[:77] + "..."
        table.add_row(f"{step.number}. {step.title_he}", display)

    console.print(table)


def interactive_session(agent: PromptBuilderAgent) -> None:
    """מנהל את הסשן המלא"""

    # AI או מצב מהיר
    use_ai_choice = Prompt.ask(
        "\n💡 להשתמש ב-AI לשאלות מותאמות ושאלות העמקה?",
        choices=["כן", "לא"],
        default="כן",
    )
    use_ai = use_ai_choice == "כן"

    if use_ai:
        console.print("  [green]✓ הסוכן יתאים את השאלות לתחום שלך וישאל שאלות העמקה[/]")
    else:
        console.print("  [yellow]→ מצב מהיר - שאלות בסיסיות בלבד[/]")

    # מעבר על 6 השלבים
    while not agent.session.is_complete:
        if not run_step(agent, use_ai=use_ai):
            return

    # סיכום
    show_summary(agent)

    # עריכה
    console.print()
    edit_choice = Prompt.ask(
        "לערוך שלב כלשהו?",
        choices=["לא", "1", "2", "3", "4", "5", "6"],
        default="לא",
    )
    if edit_choice != "לא":
        step_idx = int(edit_choice) - 1
        if 0 <= step_idx < len(STEPS):
            step = STEPS[step_idx]
            console.print(f"\n[bold]עריכת שלב: {step.title_he}[/]")
            console.print(f"[dim]ערך נוכחי: {agent.session.answers.get(step.key, '')}[/]")
            new_val = Prompt.ask("ערך חדש")
            if new_val and new_val != "יציאה":
                agent.session.answers[step.key] = new_val
                show_summary(agent)

    # יצירת פרומפטים
    console.print("\n[bold yellow]⚡ מייצר פרומפטים...[/]\n")

    one_liner = agent.generate_one_liner()
    console.print(Panel(one_liner, title="📝 פרומפט בשורה אחת", border_style="yellow"))

    full_prompt = agent.generate_prompt()
    console.print(Panel(Markdown(full_prompt), title="📄 פרומפט מלא", border_style="green"))

    # שמירה
    save = Prompt.ask("\nלשמור לקובץ?", choices=["כן", "לא"], default="כן")
    if save == "כן":
        filename = f"{agent.session.project_name.replace(' ', '_')}_prompt.md"
        Path(filename).write_text(full_prompt, encoding="utf-8")
        console.print(f"  [green]✓ נשמר: {filename}[/]")

    # שיפור עם AI
    if use_ai:
        enhance = Prompt.ask("לשפר את הפרומפט עם AI?", choices=["כן", "לא"], default="כן")
        if enhance == "כן":
            console.print("\n[bold yellow]🔄 משפר את הפרומפט...[/]\n")
            try:
                enhanced = agent.generate_enhanced_prompt()
                console.print(Panel(Markdown(enhanced), title="✨ פרומפט משופר", border_style="magenta"))
                enhanced_filename = f"{agent.session.project_name.replace(' ', '_')}_enhanced.md"
                Path(enhanced_filename).write_text(enhanced, encoding="utf-8")
                console.print(f"  [green]✓ נשמר: {enhanced_filename}[/]")
            except Exception as e:
                console.print(f"  [red]שגיאה: {e}[/]")


def main() -> None:
    """נקודת כניסה"""
    print_welcome()

    info = get_project_info()
    if not info:
        console.print("[yellow]להתראות![/]")
        sys.exit(0)

    name, domain, platform = info

    agent = PromptBuilderAgent()
    agent.set_project_info(name, domain, platform)

    console.print(f"\n  [green]✓ פרויקט: {name}[/]")
    console.print(f"  [green]✓ תחום: {domain}[/]")
    if platform:
        console.print(f"  [green]✓ פלטפורמה: {platform}[/]")

    interactive_session(agent)
    console.print("\n[bold cyan]תודה שהשתמשת ב-Prompt Builder Agent! 🚀[/]\n")


if __name__ == "__main__":
    main()
