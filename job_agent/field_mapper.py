"""
מודול מיפוי שדות טופס - משתמש ב-LLM למפות labels/IDs לנתוני הפרופיל.
"""

from __future__ import annotations

import json


def map_fields(
    form_fields: list[dict],
    profile_context: dict,
    client,
    model: str = "claude-sonnet-4-6",
) -> dict[str, str]:
    """
    מקבל רשימת שדות טופס ומחזיר dict של {field_id -> value}.

    form_fields: [{"id": "...", "label": "...", "type": "text|email|tel|file|textarea", "required": bool}]
    """
    fields_json = json.dumps(form_fields, ensure_ascii=False, indent=2)
    profile_json = json.dumps(profile_context, ensure_ascii=False, indent=2)

    prompt = f"""You are a form-filling assistant. Map each form field to the correct value from the candidate profile.

## Form Fields (JSON)
{fields_json}

## Candidate Profile (JSON)
{profile_json}

Rules:
- For "file" type fields: return the string "__RESUME_FILE__" (the system will upload the actual file)
- For textarea/cover letter fields: use screening_answers.cover_letter_default
- For unknown fields: use empty string ""
- For salary fields: prefer expected_salary_ils unless label says USD
- Return ONLY a JSON object: {{"field_id": "value_to_fill", ...}}
- Skip fields with type "submit" or "hidden"
- If a field asks for full name and there's no separate first/last, concatenate them"""

    response = client.messages.create(
        model=model,
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}]
    )
    raw = response.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}


def answer_screening_question(
    question_text: str,
    profile_context: dict,
    resume_text: str,
    client,
    model: str = "claude-sonnet-4-6",
) -> str:
    """
    מנסח תשובה לשאלת סינון ספציפית בהתבסס על הפרופיל וה-CV.
    """
    prompt = f"""Answer this job application screening question concisely and professionally.
Use the candidate profile and resume to give an accurate, honest answer.

Question: {question_text}

Profile: {json.dumps(profile_context.get('screening_answers', {}), ensure_ascii=False)}
Resume excerpt: {resume_text[:800]}

Respond with ONLY the answer text (1-3 sentences max)."""

    response = client.messages.create(
        model=model,
        max_tokens=256,
        messages=[{"role": "user", "content": prompt}]
    )
    return response.content[0].text.strip()
