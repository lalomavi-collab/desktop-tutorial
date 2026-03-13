"""בנייה מהירה של פרומפט בפקודה אחת - ללא אינטראקציה"""

import anthropic

from prompt_builder.templates.app_templates import ALL_TEMPLATES
from prompt_builder.utils.formatter import format_prompt


def quick_build(description: str, app_type: str = "web_app") -> str:
    """מייצר פרומפט מלא מתיאור קצר.

    Args:
        description: תיאור קצר של האפליקציה הרצויה
        app_type: סוג האפליקציה (web_app, api_service, mobile_app, cli_tool, automation)

    Returns:
        פרומפט מלא ומובנה בפורמט Markdown
    """
    template = ALL_TEMPLATES.get(app_type)
    if not template:
        raise ValueError(f"סוג אפליקציה לא מוכר: {app_type}. אפשרויות: {list(ALL_TEMPLATES.keys())}")

    section_names = [s.title for s in template.sections]

    client = anthropic.Anthropic()
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        system=(
            "אתה מומחה בניתוח דרישות תוכנה. "
            "קיבלת תיאור קצר של אפליקציה. "
            "עליך למלא כל אחד מהחלקים הבאים בצורה מפורטת ומקצועית. "
            "החזר תשובה בפורמט JSON עם מפתחות לכל חלק.\n\n"
            f"חלקים למילוי: {section_names}"
        ),
        messages=[
            {
                "role": "user",
                "content": f"בנה אפליקציה: {description}",
            }
        ],
    )

    # ניתוח התשובה ובניית הפרומפט
    answers = {"project_name": description[:50]}

    # אם Claude החזיר JSON, ננסה לפרסר
    raw = response.content[0].text
    import json

    try:
        parsed = json.loads(raw)
        for section in template.sections:
            if section.title in parsed:
                answers[section.title] = str(parsed[section.title])
    except json.JSONDecodeError:
        # אם זה לא JSON, נשתמש בטקסט הגולמי כתיאור כללי
        answers["סקירה כללית"] = raw

    return format_prompt(template, answers)
