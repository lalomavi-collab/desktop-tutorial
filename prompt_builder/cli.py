"""ממשק CLI אינטראקטיבי לסוכן בניית הפרומפטים"""

import sys
from pathlib import Path

from rich.console import Console
from rich.markdown import Markdown
from rich.panel import Panel
from rich.prompt import Prompt

from prompt_builder.agents.builder_agent import PromptBuilderAgent
from prompt_builder.templates.app_templates import ALL_TEMPLATES
from prompt_builder.utils.formatter import format_template_list


console = Console()


def print_welcome() -> None:
    console.print(
        Panel(
            "[bold cyan]סוכן בניית פרומפטים לאפליקציות[/]\n\n"
            "הסוכן יעזור לך לבנות פרומפט מובנה ומפורט\n"
            "לפיתוח האפליקציה שלך.\n\n"
            "[dim]הקלד 'יציאה' בכל שלב כדי לצאת[/]",
            title="Prompt Builder Agent",
            border_style="cyan",
        )
    )


def select_template() -> str | None:
    """מציג את התבניות ומבקש בחירה"""
    console.print()
    console.print(format_template_list(ALL_TEMPLATES))
    console.print()

    template_names = list(ALL_TEMPLATES.keys())
    choice = Prompt.ask(
        "בחר סוג אפליקציה (מספר או שם)",
        choices=[*template_names, *[str(i) for i in range(1, len(template_names) + 1)], "יציאה"],
        show_choices=False,
    )

    if choice == "יציאה":
        return None

    if choice.isdigit():
        idx = int(choice) - 1
        if 0 <= idx < len(template_names):
            return template_names[idx]
        console.print("[red]מספר לא תקין[/]")
        return None

    return choice


def interactive_session(agent: PromptBuilderAgent) -> None:
    """מנהל את הסשן האינטראקטיבי"""
    project_name = Prompt.ask("\nמה שם הפרויקט שלך?")
    if project_name == "יציאה":
        return
    agent.answers["project_name"] = project_name

    # שלב ראשון: שיחה חופשית עם הסוכן
    console.print(
        "\n[bold green]בוא נתחיל![/] ספר לי על האפליקציה שאתה רוצה לבנות.\n"
        "[dim]הקלד 'הבא' כדי לעבור לחלק הבא, 'סיום' לייצר את הפרומפט[/]\n"
    )

    while True:
        section_prompt = agent.get_current_section_prompt()
        if section_prompt:
            console.print(Panel(section_prompt, border_style="blue"))

        user_input = Prompt.ask("[bold cyan]אתה[/]")

        if user_input == "יציאה":
            return
        if user_input == "סיום":
            break
        if user_input == "הבא":
            if not agent.advance_section():
                console.print("[yellow]סיימנו את כל החלקים! מייצר פרומפט...[/]")
                break
            continue

        # שמירת התשובה בחלק הנוכחי
        if agent.template and agent.current_section_idx < len(agent.template.sections):
            section = agent.template.sections[agent.current_section_idx]
            agent.save_answer(section.title, user_input)

        # שיחה עם הסוכן
        try:
            response = agent.chat(user_input)
            console.print(f"\n[bold magenta]סוכן[/]: {response}\n")
        except Exception as e:
            console.print(f"[red]שגיאה בתקשורת עם Claude: {e}[/]")
            console.print("[dim]ממשיך ללא תגובת הסוכן...[/]\n")

        agent.advance_section()

    # יצירת הפרומפט
    console.print("\n[bold yellow]מייצר פרומפט...[/]\n")
    prompt = agent.generate_prompt()

    console.print(Panel(Markdown(prompt), title="הפרומפט שלך", border_style="green"))

    # שמירה לקובץ
    save = Prompt.ask("לשמור לקובץ?", choices=["כן", "לא"], default="כן")
    if save == "כן":
        filename = f"{agent.answers.get('project_name', 'prompt')}.md"
        filename = filename.replace(" ", "_")
        Path(filename).write_text(prompt, encoding="utf-8")
        console.print(f"[green]נשמר ל-{filename}[/]")

    # שיפור עם AI
    enhance = Prompt.ask("לשפר את הפרומפט עם AI?", choices=["כן", "לא"], default="כן")
    if enhance == "כן":
        console.print("[bold yellow]משפר את הפרומפט...[/]\n")
        try:
            enhanced = agent.generate_enhanced_prompt()
            console.print(
                Panel(Markdown(enhanced), title="פרומפט משופר", border_style="magenta")
            )
            enhanced_filename = f"{agent.answers.get('project_name', 'prompt')}_enhanced.md"
            enhanced_filename = enhanced_filename.replace(" ", "_")
            Path(enhanced_filename).write_text(enhanced, encoding="utf-8")
            console.print(f"[green]נשמר ל-{enhanced_filename}[/]")
        except Exception as e:
            console.print(f"[red]שגיאה בשיפור: {e}[/]")


def main() -> None:
    """נקודת כניסה ראשית"""
    print_welcome()

    template_name = select_template()
    if not template_name:
        console.print("[yellow]להתראות![/]")
        sys.exit(0)

    agent = PromptBuilderAgent()
    template = agent.select_template(template_name)
    if not template:
        console.print(f"[red]תבנית '{template_name}' לא נמצאה[/]")
        sys.exit(1)

    console.print(f"\n[green]נבחרה תבנית: {template.description}[/]")
    interactive_session(agent)
    console.print("\n[bold cyan]תודה שהשתמשת ב-Prompt Builder Agent![/]\n")


if __name__ == "__main__":
    main()
