"""Unit tests for prompt_builder.utils.formatter."""

from prompt_builder.templates.app_templates import STEPS
from prompt_builder.utils.formatter import format_steps_overview


def test_overview_contains_header():
    assert format_steps_overview().startswith("6 השלבים לבניית פרומפט:")


def test_overview_lists_every_step_with_bilingual_titles_and_question():
    out = format_steps_overview()
    for step in STEPS:
        assert f"{step.number}. {step.title_he} ({step.title_en})" in out
        assert step.core_question in out


def test_overview_orders_steps_one_to_six():
    out = format_steps_overview()
    positions = [out.find(f"{s.number}. {s.title_he}") for s in STEPS]
    assert positions == sorted(positions)
    assert all(p != -1 for p in positions)
