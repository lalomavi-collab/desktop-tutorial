"""Test fixtures: provide dummy env so config.Settings loads without secrets."""
from __future__ import annotations

import os

import pytest

_DUMMY_ENV = {
    "ANTHROPIC_API_KEY": "test",
    "DEEPGRAM_API_KEY": "test",
    "ELEVENLABS_API_KEY": "test",
    "ELEVENLABS_VOICE_ID": "voice",
    "DATABASE_URL": "postgresql://localhost/test",
    "COMPANY_NAME": "LALUM",
}


@pytest.fixture(autouse=True)
def _env():
    for k, v in _DUMMY_ENV.items():
        os.environ.setdefault(k, v)
    from app.config import get_settings

    get_settings.cache_clear()
    yield
