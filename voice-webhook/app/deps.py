"""FastAPI dependency providers.

Kept in one place so tests can override them with ``app.dependency_overrides``
and never touch the network.
"""
from __future__ import annotations

from functools import lru_cache

from .config import Settings, get_settings
from .db import SupabaseRepository
from .intent import IntentExtractor


@lru_cache
def _extractor_singleton() -> IntentExtractor:
    return IntentExtractor(get_settings())


@lru_cache
def _repo_singleton() -> SupabaseRepository:
    return SupabaseRepository(get_settings())


def get_settings_dep() -> Settings:
    return get_settings()


def get_extractor() -> IntentExtractor:
    return _extractor_singleton()


def get_repo() -> SupabaseRepository:
    return _repo_singleton()
