"""Tool (function calling) schemas for the Action Execution Layer (DOM framework).

The agent extracts structured JSON entities that drive downstream systems:
calendar scheduling, CRM lead capture, and internal task creation. Schemas are
defined once and marked cache-friendly so they ride the cached prompt prefix.
"""
from __future__ import annotations

TOOLS: list[dict] = [
    {
        "name": "schedule_appointment",
        "description": (
            "Book a consultation or callback on the calendar. Use when the caller "
            "agrees to a specific day and time, or asks to be booked in."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "full_name": {"type": "string"},
                "phone": {"type": "string", "description": "E.164 if known"},
                "topic": {"type": "string"},
                "preferred_datetime": {
                    "type": "string",
                    "description": "ISO 8601 local datetime the caller proposed",
                },
                "duration_minutes": {"type": "integer", "default": 30},
            },
            "required": ["full_name", "preferred_datetime"],
        },
    },
    {
        "name": "capture_lead",
        "description": (
            "Record a new lead in the CRM and route it. Use when the caller shares "
            "contact details or expresses interest in a service."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "full_name": {"type": "string"},
                "phone": {"type": "string"},
                "email": {"type": "string"},
                "interest": {"type": "string"},
                "urgency": {"type": "string", "enum": ["low", "medium", "high"]},
                "notes": {"type": "string"},
            },
            "required": ["full_name", "interest"],
        },
    },
    {
        "name": "create_office_task",
        "description": (
            "Open a task in the internal office management app for staff follow-up, "
            "for example document requests or callbacks that need a human."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "description": {"type": "string"},
                "category": {
                    "type": "string",
                    "enum": ["callback", "document_request", "billing", "general"],
                },
                "priority": {"type": "string", "enum": ["low", "normal", "high"]},
            },
            "required": ["title", "category"],
        },
    },
]

# Attach cache_control to the final tool so the whole tool array is cached with
# the system preamble (Anthropic caches the prefix up to the last marked block).
if TOOLS:
    TOOLS[-1] = {**TOOLS[-1], "cache_control": {"type": "ephemeral"}}
