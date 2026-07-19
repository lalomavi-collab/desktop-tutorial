"""Unit tests for the billing rounding math."""
import math

import pytest

from app.billing import billable_hours, build_billing_line


@pytest.mark.parametrize(
    "seconds, expected_hours",
    [
        # The two examples called out in the spec.
        (10, 0.25),      # any positive time rounds up to one 15-min block
        (905, 0.50),     # 905s = 15m5s -> two blocks
        # Boundaries around the 15-minute increment.
        (0, 0.0),        # no time -> no charge
        (1, 0.25),
        (900, 0.25),     # exactly 15 minutes -> one block
        (901, 0.50),     # one second over -> next block
        (1800, 0.50),    # exactly 30 minutes
        (1801, 0.75),
        (3600, 1.0),     # exactly one hour
        (3601, 1.25),
    ],
)
def test_billable_hours_rounds_up_to_quarter_hours(seconds, expected_hours):
    assert billable_hours(seconds) == expected_hours


def test_negative_duration_bills_nothing():
    assert billable_hours(-30) == 0.0


def test_zero_increment_is_rejected():
    with pytest.raises(ValueError):
        billable_hours(100, increment_minutes=0)


def test_custom_increment_of_six_minutes():
    # 6-minute increments -> 0.1 hour blocks (a common alternative rule).
    assert billable_hours(1, increment_minutes=6) == 0.1
    assert billable_hours(360, increment_minutes=6) == 0.1
    assert billable_hours(361, increment_minutes=6) == 0.2


def test_build_billing_line_multiplies_by_rate():
    line = build_billing_line(905, 900.0)
    assert line.billed_hours == 0.5
    assert line.amount == 450.0          # 0.5h * 900
    assert line.hourly_rate == 900.0
    assert line.currency == "ILS"


def test_build_billing_line_zero_duration_is_free():
    line = build_billing_line(0, 900.0)
    assert line.billed_hours == 0.0
    assert line.amount == 0.0


def test_amount_has_no_float_noise():
    # 0.75 * 1333.33 must round cleanly to 2 decimals.
    line = build_billing_line(1801, 1333.33)
    assert line.billed_hours == 0.75
    assert line.amount == round(0.75 * 1333.33, 2)
    # Sanity: amount is a finite 2-decimal number.
    assert math.isfinite(line.amount)
