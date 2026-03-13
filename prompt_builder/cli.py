"""ממשק CLI אינטראקטיבי - מודל 6 השלבים לבניית פרומפטים"""

import sys
from pathlib import Path

from rich.console import Console
from rich.markdown import Markdown
from rich.panel import Panel
from rich.prompt import Prompt
from rich.table import Table
from rich.text import Text

from prompt_builder.agents.builder_agent import PromptBuilderAgent
from prompt_builder.templates.app_templates import ALL_DOMAINS


console = Console()


def print_welcome() -> None:
    console.print()
    console.print(
        Panel(
            "[bold cyan]סוכן בניית פרומפטים מקצועיים[/]\n\n"
            "הסוכן יוביל אותך דרך [bold]6 שלבים[/] מובנים:\n"
            "  1️⃣  תפקיד (Role)        - מי ה-AI?\n"
            "  2️⃣  קהל יעד (Audience)   - עבור מי?\n"
            "  3️⃣  נתונים (Input)       - על בסיס מה?\n"
            "  4️⃣  משימה (Task)         - מה לעשות?\n"
            "  5️⃣  אילוצים (Constraints) - מה המגבלות?\n"
            "  6️⃣  פלט (Output)         - איך זה נראה?\n\n"
            "[dim]הקלד 'יציאה' בכל שלב כדי לצאת | 'דלג' כדי לדלג על שלב[/]",
            title="🏗️  Prompt Builder Agent",
            border_style="cyan",
        )
    )


def select_domain() -> str | None:
    """מציג את התחומים המקצועיים ומבקש בחירה"""
    console.print()

    table = Table(title="תחומים מקצועיים", show_header=True, border_style="blue")
    table.add_column("#", style="bold cyan", width=3)
    table.add_column("תחום", style="bold")
    table.add_column("תיאור", style="dim")

    domain_names = list(ALL_DOMAINS.keys())
    for i, (key, domain) in enumerate(ALL_DOMAINS.items(), 1):
        table.add_row(str(i), domain.display_name, domain.description)

    console.print(table)
    console.print()

    choice = Prompt.ask(
        "בחר תחום (מספר או שם)",
        default="1",
    )

    if choice == "יציאה":
        return None

    if choice.isdigit():
        idx = int(choice) - 1
        if 0 <= idx < len(domain_names):
            return domain_names[idx]
        console.print("[red]מספר לא תקין[/]")
        return None

    # חיפוש לפי שם
    for key, domain in ALL_DOMAINS.items():
        if choice in (key, domain.display_name):
            return key

    console.print(f"[red]תחום '{choice}' לא נמצא[/]")
    return None


def run_step(agent: PromptBuilderAgent, use_ai: bool = True) -> bool:
    """מריץ שלב בודד. מחזיר False אם המשתמש רוצה לצאת."""
    step = agent.get_current_step()
    if not step:
        return True

    # הצגת השלב
    progress = agent.get_progress_bar()
    step_display = agent.format_step_display()

    console.print()
    console.print(f"  [dim]{progress}[/]")
    console.print(Panel(step_display, border_style="blue"))

    # קבלת תשובה מהמשתמש
    user_input = Prompt.ask("[bold cyan]התשובה שלך[/]")

    if user_input == "יציאה":
        return False
    if user_input == "דלג":
        agent.advance_step()
        return True

    # פענוח בחירה ממוספרת
    if user_input.isdigit() and step.options:
        idx = int(user_input) - 1
        if 0 <= idx < len(step.options):
            selected = step.options[idx]
            user_input = selected.label
            console.print(f"  [green]✓ נבחר: {selected.label}[/]")

    # שמירת התשובה
    agent.save_answer(step.key, user_input)

    # שיחה עם AI להעמקה (אם זמין)
    if use_ai:
        try:
            ai_response = agent.chat(
                f"בשלב '{step.title}', המשתמש ענה: '{user_input}'. "
                f"שאל שאלת העמקה אחת קצרה וממוקדת כדי לחדד את התשובה. "
                f"רמז: {step.follow_up_hint}"
            )
            console.print()
            console.print(Panel(ai_response, title="🤖 הסוכן שואל", border_style="magenta"))

            # תשובת המשתמש להעמקה
            follow_up = Prompt.ask("[bold cyan]תשובתך (או Enter לדלג)[/]", default="")
            if follow_up and follow_up not in ("יציאה", "דלג"):
                # עדכון התשובה עם ההעמקה
                current = agent.answers.get(step.key, "")
                agent.save_answer(step.key, f"{current}. {follow_up}")

                # תשובת AI
                ai_ack = agent.chat(follow_up)
                console.print(f"  [magenta]🤖 {ai_ack[:200]}{'...' if len(ai_ack) > 200 else ''}[/]")
            elif follow_up == "יציאה":
                return False
        except Exception as e:
            console.print(f"  [dim]⚠ לא ניתן להתחבר ל-AI: {e}[/]")

    agent.advance_step()
    return True


def show_summary(agent: PromptBuilderAgent) -> None:
    """מציג סיכום של כל התשובות לפני יצירת הפרומפט"""
    console.print()

    table = Table(title="📋 סיכום התשובות", show_header=True, border_style="green")
    table.add_column("שלב", style="bold cyan", width=20)
    table.add_column("תשובה", style="white")

    step_names = {
        "role": "1. תפקיד",
        "audience": "2. קהל יעד",
        "input_context": "3. נתונים",
        "task": "4. משימה",
        "constraints": "5. אילוצים",
        "output_structure": "6. מבנה פלט",
    }

    for key, label in step_names.items():
        answer = agent.answers.get(key, "[לא הוגדר]")
        # חותך תשובות ארוכות
        display = answer if len(answer) <= 80 else answer[:77] + "..."
        table.add_row(label, display)

    console.print(table)


def interactive_session(agent: PromptBuilderAgent) -> None:
    """מנהל את הסשן המלא"""

    # שם הפרויקט
    project_name = Prompt.ask("\n📌 מה שם הפרויקט / האפליקציה?")
    if project_name == "יציאה":
        return
    agent.project_name = project_name

    # האם להשתמש ב-AI?
    use_ai_choice = Prompt.ask(
        "\nלהשתמש ב-AI לשאלות העמקה?",
        choices=["כן", "לא"],
        default="כן",
    )
    use_ai = use_ai_choice == "כן"

    if use_ai:
        console.print("  [green]✓ הסוכן ישאל שאלות העמקה בכל שלב[/]")
    else:
        console.print("  [yellow]→ מצב מהיר - ללא שאלות העמקה[/]")

    # מעבר על 6 השלבים
    while not agent.is_complete():
        if not run_step(agent, use_ai=use_ai):
            return

    # סיכום
    show_summary(agent)

    # אישור ועריכה
    console.print()
    edit_choice = Prompt.ask(
        "לערוך שלב כלשהו?",
        choices=["לא", "1", "2", "3", "4", "5", "6"],
        default="לא",
    )

    if edit_choice != "לא":
        step_idx = int(edit_choice) - 1
        if agent.domain and 0 <= step_idx < len(agent.domain.steps):
            step = agent.domain.steps[step_idx]
            console.print(f"\n[bold]עריכת שלב: {step.title}[/]")
            console.print(f"[dim]ערך נוכחי: {agent.answers.get(step.key, '')}[/]")
            new_val = Prompt.ask("ערך חדש")
            if new_val and new_val != "יציאה":
                agent.save_answer(step.key, new_val)
                show_summary(agent)

    # יצירת הפרומפטים
    console.print("\n[bold yellow]⚡ מייצר פרומפטים...[/]\n")

    # פרומפט One-liner
    one_liner = agent.generate_one_liner()
    console.print(
        Panel(one_liner, title="📝 פרומפט בשורה אחת", border_style="yellow")
    )

    # פרומפט מלא
    full_prompt = agent.generate_prompt()
    console.print(
        Panel(Markdown(full_prompt), title="📄 פרומפט מלא", border_style="green")
    )

    # שמירה לקובץ
    save = Prompt.ask("\nלשמור לקובץ?", choices=["כן", "לא"], default="כן")
    if save == "כן":
        filename = f"{agent.project_name.replace(' ', '_')}_prompt.md"
        Path(filename).write_text(full_prompt, encoding="utf-8")
        console.print(f"  [green]✓ נשמר: {filename}[/]")

    # שיפור עם AI
    if use_ai:
        enhance = Prompt.ask("לשפר את הפרומפט עם AI?", choices=["כן", "לא"], default="כן")
        if enhance == "כן":
            console.print("\n[bold yellow]🔄 משפר את הפרומפט...[/]\n")
            try:
                enhanced = agent.generate_enhanced_prompt()
                console.print(
                    Panel(Markdown(enhanced), title="✨ פרומפט משופר", border_style="magenta")
                )
                enhanced_filename = f"{agent.project_name.replace(' ', '_')}_enhanced.md"
                Path(enhanced_filename).write_text(enhanced, encoding="utf-8")
                console.print(f"  [green]✓ נשמר: {enhanced_filename}[/]")
            except Exception as e:
                console.print(f"  [red]שגיאה בשיפור: {e}[/]")


def main() -> None:
    """נקודת כניסה ראשית"""
    print_welcome()

    domain_name = select_domain()
    if not domain_name:
        console.print("[yellow]להתראות![/]")
        sys.exit(0)

    agent = PromptBuilderAgent()
    domain = agent.select_domain(domain_name)
    if not domain:
        console.print(f"[red]תחום '{domain_name}' לא נמצא[/]")
        sys.exit(1)

    console.print(f"\n  [green]✓ נבחר תחום: {domain.display_name}[/]")
    console.print(f"  [dim]{domain.description}[/]")

    interactive_session(agent)
    console.print("\n[bold cyan]תודה שהשתמשת ב-Prompt Builder Agent! 🚀[/]\n")


if __name__ == "__main__":
    main()
