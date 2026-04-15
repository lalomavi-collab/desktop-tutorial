"""Unit tests for prompt_builder.templates.app_templates."""

from __future__ import annotations

import pytest

from prompt_builder.templates.app_templates import (
    STEP_KEYS,
    STEPS,
    PromptSession,
    StepDefinition,
)


# ---------------------------------------------------------------------------
# STEPS / STEP_KEYS structural invariants
# ---------------------------------------------------------------------------


def test_steps_are_six_and_numbered_sequentially():
    assert len(STEPS) == 6
    assert [s.number for s in STEPS] == [1, 2, 3, 4, 5, 6]


def test_step_keys_are_unique_and_match_steps():
    assert len(set(STEP_KEYS)) == len(STEP_KEYS)
    assert STEP_KEYS == [s.key for s in STEPS]


def test_step_keys_match_documented_canonical_set():
    # If these change the prompt format breaks; the test is the contract.
    assert STEP_KEYS == [
        "role",
        "audience",
        "input_context",
        "task",
        "constraints",
        "output_structure",
    ]


@pytest.mark.parametrize("step", STEPS, ids=[s.key for s in STEPS])
def test_each_step_has_complete_definition(step: StepDefinition):
    assert step.title_he and step.title_en
    assert step.core_question
    assert step.guidance


# ---------------------------------------------------------------------------
# PromptSession lifecycle
# ---------------------------------------------------------------------------


def test_new_session_starts_at_step_zero():
    s = PromptSession()
    assert s.current_step == 0
    assert s.is_complete is False
    assert s.get_current_step() is STEPS[0]
    assert s.answers == {}


def test_save_answer_writes_to_current_step_key():
    s = PromptSession()
    s.save_answer("עו\"ד נדל\"ן בכיר")
    assert s.answers["role"] == "עו\"ד נדל\"ן בכיר"


def test_save_answer_when_complete_is_noop():
    s = PromptSession(current_step=len(STEPS))
    s.save_answer("late answer")
    assert s.answers == {}


def test_advance_progresses_until_complete():
    s = PromptSession()
    for i in range(len(STEPS) - 1):
        assert s.advance() is True
        assert s.current_step == i + 1
    # Final advance should return False (session is complete)
    assert s.advance() is False
    assert s.is_complete is True
    assert s.get_current_step() is None


def test_advance_past_end_keeps_session_complete():
    s = PromptSession(current_step=len(STEPS))
    assert s.advance() is False
    assert s.is_complete is True


# ---------------------------------------------------------------------------
# Progress + rendering
# ---------------------------------------------------------------------------


def test_get_progress_renders_filled_and_empty_blocks():
    s = PromptSession()
    assert s.get_progress() == "[░░░░░░] 0/6"
    s.current_step = 3
    assert s.get_progress() == "[███░░░] 3/6"
    s.current_step = 6
    assert s.get_progress() == "[██████] 6/6"


def test_get_progress_caps_at_total_steps():
    """Going past the end should clamp the bar (no negative empties)."""
    s = PromptSession(current_step=99)
    bar = s.get_progress()
    assert bar.count("█") == len(STEPS)
    assert "░" not in bar


def test_one_liner_empty_when_no_answers():
    assert PromptSession().generate_one_liner() == ""


def test_one_liner_uses_only_filled_keys_with_numbering():
    s = PromptSession()
    s.answers["role"] = "עורך דין"
    s.answers["task"] = "ניתוח חוזה"
    line = s.generate_one_liner()
    assert "פעל כעורך דין (1)" in line
    assert "המשימה היא ניתוח חוזה (4)" in line
    # Skipped steps should not appear at all
    assert "(2)" not in line
    assert "(3)" not in line
    assert line.endswith(".")


def test_full_prompt_includes_all_steps_even_when_unanswered():
    s = PromptSession(project_name="MyApp", domain="משפטי", platform="web")
    text = s.generate_full_prompt()
    assert "# פרומפט: MyApp" in text
    assert "**תחום:** משפטי" in text
    assert "**פלטפורמה:** web" in text
    for step in STEPS:
        assert step.title_he in text
    # Unanswered steps render the placeholder
    assert "*לא הוגדר*" in text


def test_full_prompt_uses_default_project_name_when_blank():
    text = PromptSession().generate_full_prompt()
    assert "# פרומפט: אפליקציה חדשה" in text


def test_full_prompt_substitutes_real_answers():
    s = PromptSession(project_name="Demo")
    s.answers["role"] = "רואה חשבון"
    text = s.generate_full_prompt()
    assert "רואה חשבון" in text
    # Other steps still show placeholder.
    assert text.count("*לא הוגדר*") == len(STEPS) - 1
