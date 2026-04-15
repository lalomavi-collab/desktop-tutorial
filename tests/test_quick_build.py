"""Tests for prompt_builder.agents.quick_build.

These tests pin down the JSON-extraction behaviour of `quick_build`, which is
the single most fragile piece of code in the agent: it slices the LLM output
between the first ``{`` and last ``}`` and falls back silently on parse
errors. The mock returns deterministic Claude responses so the tests don't hit
the real API.
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from prompt_builder.agents import quick_build as qb
from prompt_builder.templates.app_templates import STEP_KEYS


def _mock_response(text: str) -> SimpleNamespace:
    """Mimic the shape of `anthropic.Anthropic().messages.create(...)`."""
    return SimpleNamespace(content=[SimpleNamespace(text=text)])


def _patched_client(text: str) -> MagicMock:
    client = MagicMock()
    client.messages.create.return_value = _mock_response(text)
    return client


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------


def test_quick_build_parses_valid_json_response():
    payload = {
        "role": "עורך דין נדל\"ן",
        "audience": "לקוח פרטי",
        "input_context": "חוזה PDF",
        "task": "בדיקת סיכונים",
        "constraints": "חוק המכר",
        "output_structure": "טבלת סיכונים",
    }
    text = "להלן הפרומפט בפורמט JSON:\n" + str(payload).replace("'", '"')

    with patch.object(qb.anthropic, "Anthropic", return_value=_patched_client(text)):
        result = qb.quick_build("בדיקת חוזה", domain="משפטי")

    # All six step values should appear in the rendered Markdown prompt.
    for value in payload.values():
        assert value in result
    assert "# פרומפט:" in result


def test_quick_build_truncates_long_descriptions_in_project_name():
    """Project name comes from description[:60] – verify we don't blow past it."""
    long_desc = "א" * 200
    text = '{"role": "x"}'
    with patch.object(qb.anthropic, "Anthropic", return_value=_patched_client(text)):
        result = qb.quick_build(long_desc)
    title_line = result.splitlines()[0]
    # Header is "# פרומפט: <name>" – name must be <= 60 chars
    assert len(title_line) <= len("# פרומפט: ") + 60


def test_quick_build_passes_domain_into_system_prompt():
    text = "{}"
    client = _patched_client(text)
    with patch.object(qb.anthropic, "Anthropic", return_value=client):
        qb.quick_build("desc", domain="חינוך")
    kwargs = client.messages.create.call_args.kwargs
    assert "חינוך" in kwargs["system"]


# ---------------------------------------------------------------------------
# Resilience to malformed LLM output
# ---------------------------------------------------------------------------


def test_quick_build_extracts_json_embedded_in_prose():
    # The slice between first { and last } should still yield valid JSON.
    text = (
        "בוודאי, הנה התוצאה:\n"
        '{"role": "X", "task": "Y"}\n'
        "תודה שפנית."
    )
    with patch.object(qb.anthropic, "Anthropic", return_value=_patched_client(text)):
        result = qb.quick_build("desc")
    assert "X" in result
    assert "Y" in result


def test_quick_build_handles_response_without_braces():
    """No braces means no JSON, no answers — should still render a prompt."""
    text = "Sorry, I can't help with that."
    with patch.object(qb.anthropic, "Anthropic", return_value=_patched_client(text)):
        result = qb.quick_build("desc")
    # Empty session → all steps marked as undefined.
    assert result.count("*לא הוגדר*") == 6


def test_quick_build_falls_back_to_raw_text_on_invalid_json():
    """Per source code: invalid JSON puts the raw text into `task`."""
    text = "{not really json at all}"
    with patch.object(qb.anthropic, "Anthropic", return_value=_patched_client(text)):
        result = qb.quick_build("desc")
    # The raw response should be preserved in the `task` slot.
    assert text in result


def test_quick_build_ignores_unknown_keys_in_response():
    text = '{"role": "ok", "unknown_field": "ignored"}'
    with patch.object(qb.anthropic, "Anthropic", return_value=_patched_client(text)):
        result = qb.quick_build("desc")
    assert "ok" in result
    assert "ignored" not in result


@pytest.mark.parametrize("value", [42, True, ["a", "b"], {"nested": 1}])
def test_quick_build_coerces_non_string_values(value):
    """`session.answers[key] = str(parsed[key])` — should never crash."""
    text = f'{{"role": {value!r}}}' if isinstance(value, str) else \
           '{"role": ' + __import__("json").dumps(value) + '}'
    with patch.object(qb.anthropic, "Anthropic", return_value=_patched_client(text)):
        result = qb.quick_build("desc")
    assert str(value) in result


# ---------------------------------------------------------------------------
# Anthropic API contract
# ---------------------------------------------------------------------------


def test_quick_build_calls_anthropic_with_expected_model():
    text = "{}"
    client = _patched_client(text)
    with patch.object(qb.anthropic, "Anthropic", return_value=client):
        qb.quick_build("desc")
    kwargs = client.messages.create.call_args.kwargs
    assert kwargs["model"] == "claude-sonnet-4-6"
    assert kwargs["max_tokens"] >= 1024
    # System prompt enumerates all six step keys
    for key in STEP_KEYS:
        assert key in kwargs["system"]
