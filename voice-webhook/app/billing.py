"""Billing math for call time.

Kept as pure functions with no I/O so the rounding rules are trivially unit
tested. The rule: round the call duration UP to the nearest billing increment
(default 15 minutes), then price it at the standard hourly rate.

    10 seconds  -> 0.25 hours   (ceil to one 15-minute block)
    905 seconds -> 0.50 hours   (ceil to two 15-minute blocks)
"""
from __future__ import annotations

import math
from dataclasses import dataclass

SECONDS_PER_MINUTE = 60
MINUTES_PER_HOUR = 60


def billable_hours(duration_seconds: int, increment_minutes: int = 15) -> float:
    """Round ``duration_seconds`` up to the nearest ``increment_minutes`` block
    and return the result expressed in hours.

    A zero (or negative) duration bills nothing. Any positive duration bills at
    least one increment.
    """
    if increment_minutes <= 0:
        raise ValueError("increment_minutes must be positive")
    if duration_seconds <= 0:
        return 0.0

    increment_seconds = increment_minutes * SECONDS_PER_MINUTE
    blocks = math.ceil(duration_seconds / increment_seconds)
    hours = blocks * (increment_minutes / MINUTES_PER_HOUR)
    # Two decimals is enough for quarter-hour granularity and avoids float noise
    # such as 0.7500000000000001.
    return round(hours, 2)


@dataclass(frozen=True)
class BillingLine:
    duration_seconds: int
    billed_hours: float
    hourly_rate: float       # net rate per hour, before VAT
    net_amount: float        # hours * hourly_rate
    vat_rate: float          # e.g. 0.18 for 18%
    vat_amount: float        # net_amount * vat_rate
    amount: float            # gross total charged (net + VAT)
    currency: str


def build_billing_line(
    duration_seconds: int,
    hourly_rate: float,
    *,
    vat_rate: float = 0.0,
    increment_minutes: int = 15,
    currency: str = "ILS",
) -> BillingLine:
    """Compute a full billing line for a call: hours, net, VAT, and gross.

    ``hourly_rate`` is the net (pre-VAT) rate. In Israel legal fees carry VAT,
    so the client is charged the gross ``amount`` while ``net_amount`` is the
    firm's fee and ``vat_amount`` is remitted to the tax authority.
    """
    if vat_rate < 0:
        raise ValueError("vat_rate must not be negative")
    hours = billable_hours(duration_seconds, increment_minutes)
    net_amount = round(hours * hourly_rate, 2)
    vat_amount = round(net_amount * vat_rate, 2)
    gross_amount = round(net_amount + vat_amount, 2)
    return BillingLine(
        duration_seconds=duration_seconds,
        billed_hours=hours,
        hourly_rate=hourly_rate,
        net_amount=net_amount,
        vat_rate=vat_rate,
        vat_amount=vat_amount,
        amount=gross_amount,
        currency=currency,
    )
