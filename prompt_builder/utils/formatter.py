"""פורמט פלט - utilities"""

from prompt_builder.templates.app_templates import STEPS


def format_steps_overview() -> str:
    """מציג סקירה של 6 השלבים"""
    lines = ["6 השלבים לבניית פרומפט:", ""]
    for step in STEPS:
        lines.append(f"  {step.number}. {step.title_he} ({step.title_en})")
        lines.append(f"     {step.core_question}")
    return "\n".join(lines)
