"""בנייה מהירה של פרומפט בפקודה אחת - ללא אינטראקציה"""

import json

import anthropic

from prompt_builder.templates.app_templates import ALL_DOMAINS


STEP_KEYS = ["role", "audience", "input_context", "task", "constraints", "output_structure"]

STEP_DESCRIPTIONS = {
    "role": "תפקיד / Persona שה-AI מאמץ",
    "audience": "קהל היעד שעבורו התוצר מיועד",
    "input_context": "בסיס הנתונים שה-AI נשען עליו",
    "task": "הפעולה הספציפית שצריך לבצע",
    "constraints": "אילוצים, חוקים, מגבלות",
    "output_structure": "מבנה ופורמט הפלט הרצוי",
}


def quick_build(description: str, domain: str = "generic") -> str:
    """מייצר פרומפט מלא מתיאור קצר.

    Args:
        description: תיאור קצר של האפליקציה הרצויה
        domain: תחום מקצועי (legal, education, business, tech, health, generic)

    Returns:
        פרומפט מלא ומובנה בפורמט Markdown
    """
    domain_template = ALL_DOMAINS.get(domain)
    if not domain_template:
        raise ValueError(
            f"תחום לא מוכר: {domain}. אפשרויות: {list(ALL_DOMAINS.keys())}"
        )

    # בניית הנחיה ל-Claude
    steps_desc = "\n".join(
        f'- "{k}": {v}' for k, v in STEP_DESCRIPTIONS.items()
    )

    domain_context = ""
    if domain_template.extra_questions:
        domain_context = "\nשאלות נוספות לשקול:\n" + "\n".join(
            f"- {q}" for q in domain_template.extra_questions
        )

    client = anthropic.Anthropic()
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        system=(
            f"אתה מומחה בבניית פרומפטים בתחום: {domain_template.display_name}.\n"
            f"קיבלת תיאור קצר של אפליקציה. מלא 6 שלבים בפורמט JSON.\n\n"
            f"השלבים:\n{steps_desc}\n{domain_context}\n\n"
            f"החזר JSON בלבד עם 6 המפתחות. כתוב בעברית."
        ),
        messages=[
            {
                "role": "user",
                "content": f"בנה פרומפט עבור: {description}",
            }
        ],
    )

    raw = response.content[0].text

    # ניתוח JSON
    answers = {"project_name": description[:60]}
    try:
        # ניסיון לחלץ JSON מהתשובה
        json_start = raw.find("{")
        json_end = raw.rfind("}") + 1
        if json_start >= 0 and json_end > json_start:
            parsed = json.loads(raw[json_start:json_end])
            for key in STEP_KEYS:
                if key in parsed:
                    answers[key] = str(parsed[key])
    except json.JSONDecodeError:
        answers["task"] = raw

    # בניית הפרומפט
    from prompt_builder.agents.builder_agent import PromptBuilderAgent

    agent = PromptBuilderAgent.__new__(PromptBuilderAgent)
    agent.answers = answers
    agent.project_name = answers["project_name"]
    agent.domain = domain_template
    agent.conversation = []
    agent.current_step_idx = len(domain_template.steps)
    agent.follow_ups_asked = set()
    agent.client = None

    return agent.generate_prompt()
