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
    line = build_billing_line(905, 1000.0)
    assert line.billed_hours == 0.5
    assert line.net_amount == 500.0      # 0.5h * 1000
    assert line.vat_amount == 0.0        # no VAT rate passed
    assert line.amount == 500.0          # gross == net when VAT is 0
    assert line.hourly_rate == 1000.0
    assert line.currency == "ILS"


def test_build_billing_line_adds_vat():
    # LALUM rate: 1000 net + 18% VAT.
    line = build_billing_line(905, 1000.0, vat_rate=0.18)
    assert line.billed_hours == 0.5
    assert line.net_amount == 500.0      # 0.5h * 1000
    assert line.vat_rate == 0.18
    assert line.vat_amount == 90.0       # 500 * 0.18
    assert line.amount == 590.0          # gross = net + VAT


def test_vat_on_a_full_hour():
    line = build_billing_line(3600, 1000.0, vat_rate=0.18)
    assert line.billed_hours == 1.0
    assert line.net_amount == 1000.0
    assert line.vat_amount == 180.0
    assert line.amount == 1180.0


def test_vat_on_quarter_hour():
    line = build_billing_line(10, 1000.0, vat_rate=0.18)
    assert line.net_amount == 250.0
    assert line.vat_amount == 45.0
    assert line.amount == 295.0


def test_build_billing_line_zero_duration_is_free():
    line = build_billing_line(0, 1000.0, vat_rate=0.18)
    assert line.billed_hours == 0.0
    assert line.net_amount == 0.0
    assert line.vat_amount == 0.0
    assert line.amount == 0.0


def test_negative_vat_is_rejected():
    with pytest.raises(ValueError):
        build_billing_line(100, 1000.0, vat_rate=-0.1)


def test_amount_has_no_float_noise():
    # 0.75 * 1333.33 must round cleanly to 2 decimals.
    line = build_billing_line(1801, 1333.33, vat_rate=0.18)
    assert line.billed_hours == 0.75
    assert line.net_amount == round(0.75 * 1333.33, 2)
    assert line.amount == round(line.net_amount + line.vat_amount, 2)
    # Sanity: amounts are finite 2-decimal numbers.
    assert math.isfinite(line.amount)
