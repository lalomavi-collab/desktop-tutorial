"""בנייה מהירה של פרומפט בפקודה אחת - ללא אינטראקציה"""

import json

import anthropic

from prompt_builder.templates.app_templates import STEP_KEYS, STEPS, PromptSession


def quick_build(description: str, domain: str = "") -> str:
    """מייצר פרומפט מלא מתיאור קצר.

    Args:
        description: תיאור קצר של האפליקציה הרצויה
        domain: תחום מקצועי (חופשי - לדוגמה: משפטי, חינוך, רפואה)

    Returns:
        פרומפט מלא ומובנה בפורמט Markdown
    """
    steps_desc = "\n".join(
        f'- "{s.key}": {s.core_question}' for s in STEPS
    )

    client = anthropic.Anthropic()
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        system=(
            f"אתה מומחה בבניית פרומפטים"
            f"{f' בתחום {domain}' if domain else ''}.\n"
            f"קיבלת תיאור קצר של אפליקציה. מלא 6 שלבים בפורמט JSON.\n\n"
            f"השלבים:\n{steps_desc}\n\n"
            f"החזר JSON בלבד עם 6 המפתחות. כתוב בעברית."
        ),
        messages=[
            {"role": "user", "content": f"בנה פרומפט עבור: {description}"},
        ],
    )

    raw = response.content[0].text

    session = PromptSession(
        project_name=description[:60],
        domain=domain,
    )

    try:
        json_start = raw.find("{")
        json_end = raw.rfind("}") + 1
        if json_start >= 0 and json_end > json_start:
            parsed = json.loads(raw[json_start:json_end])
            for key in STEP_KEYS:
                if key in parsed:
                    session.answers[key] = str(parsed[key])
    except json.JSONDecodeError:
        session.answers["task"] = raw

    return session.generate_full_prompt()
