"""פורמט פלט של פרומפטים"""

from prompt_builder.templates.app_templates import AppTemplate


def format_prompt(template: AppTemplate, answers: dict[str, str]) -> str:
    """בונה פרומפט מוכן לשימוש מתוך תבנית ותשובות"""
    lines: list[str] = []
    lines.append(f"# בנה לי: {answers.get('project_name', 'אפליקציה חדשה')}")
    lines.append("")

    for section in template.sections:
        answer = answers.get(section.title, "").strip()
        if not answer and not section.required:
            continue
        lines.append(f"## {section.title}")
        if answer:
            lines.append(answer)
        else:
            lines.append(f"[לא סופק - {section.description}]")
        lines.append("")

    # הוספת הנחיות כלליות
    lines.append("## הנחיות נוספות")
    lines.append("- כתוב קוד נקי ומתועד")
    lines.append("- הוסף טיפול בשגיאות")
    lines.append("- כתוב טסטים לפונקציונליות מרכזית")
    lines.append("- השתמש ב-best practices של השפה/הפריימוורק")
    lines.append("")

    return "\n".join(lines)


def format_template_list(templates: dict[str, AppTemplate]) -> str:
    """מציג רשימת תבניות זמינות"""
    lines = ["סוגי אפליקציות זמינים:", ""]
    for i, (key, tmpl) in enumerate(templates.items(), 1):
        lines.append(f"  {i}. {key:<15} - {tmpl.description}")
    return "\n".join(lines)
