"""Tests for Hebrew greeting string validation."""

import unittest
from hebrew_greetings import GREETINGS, is_hebrew, get_greeting


class TestHebrewGreetings(unittest.TestCase):

    def test_all_greetings_are_hebrew(self):
        for key, greeting in GREETINGS.items():
            self.assertTrue(is_hebrew(greeting), f"'{key}' greeting is not Hebrew: {greeting}")

    def test_greetings_not_empty(self):
        for key, greeting in GREETINGS.items():
            self.assertTrue(len(greeting) > 0, f"'{key}' greeting is empty")

    def test_hello_is_shalom(self):
        self.assertEqual(get_greeting("hello"), "שלום")

    def test_good_morning(self):
        self.assertEqual(get_greeting("good_morning"), "בוקר טוב")

    def test_good_evening(self):
        self.assertEqual(get_greeting("good_evening"), "ערב טוב")

    def test_goodbye(self):
        self.assertEqual(get_greeting("goodbye"), "להתראות")

    def test_welcome(self):
        self.assertEqual(get_greeting("welcome"), "ברוכים הבאים")

    def test_peace(self):
        self.assertEqual(get_greeting("peace"), "שלום עליכם")

    def test_invalid_key_returns_none(self):
        self.assertIsNone(get_greeting("nonexistent"))

    def test_is_hebrew_with_hebrew_text(self):
        self.assertTrue(is_hebrew("שלום"))

    def test_is_hebrew_with_english_text(self):
        self.assertFalse(is_hebrew("hello"))

    def test_is_hebrew_with_mixed_text(self):
        self.assertTrue(is_hebrew("hello שלום"))


if __name__ == "__main__":
    unittest.main()
