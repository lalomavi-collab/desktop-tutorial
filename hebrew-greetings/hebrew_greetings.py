"""Hebrew greeting strings and validation."""

GREETINGS = {
    "hello": "שלום",
    "good_morning": "בוקר טוב",
    "good_evening": "ערב טוב",
    "goodbye": "להתראות",
    "welcome": "ברוכים הבאים",
    "peace": "שלום עליכם",
}


def is_hebrew(text):
    """Check if text contains Hebrew characters."""
    return any("\u0590" <= ch <= "\u05FF" for ch in text)


def get_greeting(key):
    """Return the Hebrew greeting for the given key."""
    return GREETINGS.get(key)
