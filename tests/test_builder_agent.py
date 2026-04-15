"""Tests for prompt_builder.agents.builder_agent.PromptBuilderAgent.

We mock the Anthropic SDK and verify:
- conversation state is appended in the correct user/assistant order
- the system prompt includes the running context
- step lifecycle (ask -> answer -> follow-up -> advance) updates the session
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from prompt_builder.agents import builder_agent as ba
from prompt_builder.agents.builder_agent import PromptBuilderAgent
from prompt_builder.templates.app_templates import STEPS


def _mock_response(text: str) -> SimpleNamespace:
    return SimpleNamespace(content=[SimpleNamespace(text=text)])


class _SnapshottingClient:
    """Mock client that snapshots `messages` at call-time.

    The real `PromptBuilderAgent` mutates `self.conversation` *after* the call
    returns (appending the assistant reply). MagicMock would capture a
    reference and we'd see the post-mutation state, so we deep-copy here.
    """

    def __init__(self, reply_text: str = "MOCK_ASSISTANT_REPLY"):
        self.reply_text = reply_text
        self.calls: list[dict] = []
        self.messages = SimpleNamespace(create=self._create)

    def _create(self, **kwargs):
        snapshot = {
            "model": kwargs.get("model"),
            "max_tokens": kwargs.get("max_tokens"),
            "system": kwargs.get("system"),
            "messages": [dict(m) for m in kwargs.get("messages", [])],
        }
        self.calls.append(snapshot)
        return _mock_response(self.reply_text)

    @property
    def last_call(self) -> dict:
        return self.calls[-1]


@pytest.fixture
def patched_client():
    """Patch anthropic.Anthropic and return the snapshotting client."""
    client = _SnapshottingClient()
    with patch.object(ba.anthropic, "Anthropic", return_value=client):
        yield client


# ---------------------------------------------------------------------------
# Construction & setup
# ---------------------------------------------------------------------------


def test_set_project_info_populates_session(patched_client):
    agent = PromptBuilderAgent()
    agent.set_project_info("Demo", "משפטי", "web")
    assert agent.session.project_name == "Demo"
    assert agent.session.domain == "משפטי"
    assert agent.session.platform == "web"


def test_agent_starts_at_step_one(patched_client):
    agent = PromptBuilderAgent()
    assert agent.session.current_step == 0
    assert agent.session.get_current_step() is STEPS[0]


# ---------------------------------------------------------------------------
# ask_step
# ---------------------------------------------------------------------------


def test_ask_step_without_user_message_requests_question(patched_client):
    agent = PromptBuilderAgent()
    agent.set_project_info("Demo", "נדל\"ן")

    reply = agent.ask_step()

    assert reply == "MOCK_ASSISTANT_REPLY"
    user_msg = patched_client.last_call["messages"][-1]
    assert user_msg["role"] == "user"
    assert "שלב 1/6" in user_msg["content"]
    assert "נדל\"ן" in user_msg["content"]


def test_ask_step_with_answer_saves_and_asks_followup(patched_client):
    agent = PromptBuilderAgent()
    agent.set_project_info("Demo", "משפטי")

    agent.ask_step("עורך דין נדל\"ן")

    assert agent.session.answers["role"] == "עורך דין נדל\"ן"
    user_msg = patched_client.last_call["messages"][-1]
    assert "עורך דין נדל\"ן" in user_msg["content"]
    assert "העמקה" in user_msg["content"]


def test_ask_step_returns_final_prompt_when_complete(patched_client):
    agent = PromptBuilderAgent()
    agent.session.current_step = len(STEPS)
    agent.session.answers["role"] = "X"
    out = agent.ask_step()
    assert "כל 6 השלבים הושלמו" in out
    # No API call needed for the terminal state.
    assert patched_client.calls == []


# ---------------------------------------------------------------------------
# Conversation memory
# ---------------------------------------------------------------------------


def test_chat_appends_to_conversation_history(patched_client):
    agent = PromptBuilderAgent()
    agent.chat("שלום")
    agent.chat("המשך")
    roles = [m["role"] for m in agent.conversation]
    assert roles == ["user", "assistant", "user", "assistant"]
    # First call sends only the new user message.
    first_msgs = patched_client.calls[0]["messages"]
    assert len(first_msgs) == 1
    assert first_msgs[0] == {"role": "user", "content": "שלום"}
    # Second call should include both prior turns plus the new user message.
    second_msgs = patched_client.calls[1]["messages"]
    assert len(second_msgs) == 3
    assert second_msgs[0]["content"] == "שלום"
    assert second_msgs[1]["role"] == "assistant"
    assert second_msgs[2] == {"role": "user", "content": "המשך"}


def test_chat_includes_context_in_system_prompt(patched_client):
    agent = PromptBuilderAgent()
    agent.set_project_info("MyProj", "מיסוי")
    agent.chat("hi")
    system = patched_client.last_call["system"]
    assert "MyProj" in system
    assert "מיסוי" in system
    assert "## הקשר נוכחי:" in system


# ---------------------------------------------------------------------------
# Follow-up + advance
# ---------------------------------------------------------------------------


def test_process_follow_up_appends_to_existing_answer(patched_client):
    agent = PromptBuilderAgent()
    agent.session.answers["role"] = "עו\"ד"
    agent.process_follow_up("עם 10 שנות ניסיון")
    assert agent.session.answers["role"] == "עו\"ד. עם 10 שנות ניסיון"


def test_process_follow_up_with_empty_answer_is_noop(patched_client):
    agent = PromptBuilderAgent()
    agent.session.answers["role"] = "עו\"ד"
    agent.process_follow_up("")
    assert agent.session.answers["role"] == "עו\"ד"


def test_process_follow_up_when_no_existing_answer_sets_value(patched_client):
    agent = PromptBuilderAgent()
    agent.process_follow_up("חדש")
    assert agent.session.answers["role"] == "חדש"


def test_advance_walks_through_all_steps(patched_client):
    agent = PromptBuilderAgent()
    advances = [agent.advance() for _ in range(len(STEPS))]
    # First five return True (more steps remain), the sixth returns False.
    assert advances == [True, True, True, True, True, False]
    assert agent.session.is_complete


# ---------------------------------------------------------------------------
# generate_enhanced_prompt
# ---------------------------------------------------------------------------


def test_generate_enhanced_prompt_returns_llm_text(patched_client):
    patched_client.reply_text = "ENHANCED"
    agent = PromptBuilderAgent()
    agent.set_project_info("Demo", "משפטי")
    out = agent.generate_enhanced_prompt()
    assert out == "ENHANCED"
    kwargs = patched_client.last_call
    assert kwargs["model"] == "claude-sonnet-4-6"
    assert "משפטי" in kwargs["system"]
    # The raw prompt is sent as the user message.
    assert "Demo" in kwargs["messages"][0]["content"]
