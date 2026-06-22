"""Defense-in-depth PII tripwire.

Anonymization is the client's job. This is a *server-side safety net*: if a
payload reaches the cloud still carrying obvious raw identifiers, we reject it
rather than persist a privilege breach. It is intentionally strict.
"""
from __future__ import annotations

import re

# Patterns that should NEVER appear in a correctly anonymized LdrCase.
_TRIPWIRES: list[tuple[str, re.Pattern[str]]] = [
    ("israeli_id", re.compile(r"\b\d{9}\b")),
    ("phone", re.compile(r"\b0\d{1,2}[-\s]?\d{7}\b")),
    ("email", re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b")),
    ("parcel", re.compile(r"\b(?:גוש|חלקה)\s*\d+")),
    ("raw_currency", re.compile(r'(?:₪|ש"ח|NIS|ILS)\s?[\d,]+')),
]


def scan_for_pii(text: str) -> list[str]:
    """Return the labels of any tripwires that fired. Empty list == clean."""
    return [label for label, pat in _TRIPWIRES if pat.search(text)]
