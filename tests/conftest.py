"""Shared pytest fixtures."""

from __future__ import annotations

import sys
import types
from pathlib import Path

# Ensure the project root is importable regardless of where pytest is invoked.
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def _install_anthropic_stub() -> None:
    """Install a minimal `anthropic` stub when the real SDK is not installed.

    Tests should always use ``unittest.mock.patch`` to substitute the client,
    so we only need the module + ``Anthropic`` symbol to import cleanly.
    """
    if "anthropic" in sys.modules:
        return
    stub = types.ModuleType("anthropic")

    class _StubClient:  # pragma: no cover - replaced by mocks in tests
        def __init__(self, *args, **kwargs):
            raise RuntimeError(
                "Real anthropic.Anthropic must not be constructed in tests; "
                "patch prompt_builder.agents.<module>.anthropic.Anthropic instead."
            )

    stub.Anthropic = _StubClient
    sys.modules["anthropic"] = stub


_install_anthropic_stub()
