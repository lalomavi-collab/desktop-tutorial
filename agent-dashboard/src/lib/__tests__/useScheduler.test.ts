import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatCountdown, msUntilNextSat19 } from '../useScheduler';

// ────────────────────────────────────────────────────────────────────────────
// msUntilNextSat19 — "next Saturday 19:00 Israel time"
//
// The implementation approximates Israel time as UTC+3. So Saturday 19:00 IL
// is Saturday 16:00 UTC.
// ────────────────────────────────────────────────────────────────────────────

describe('msUntilNextSat19', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const HOUR_MS = 60 * 60 * 1000;
  const DAY_MS = 24 * HOUR_MS;

  it('returns ~6 days from Sunday morning', () => {
    // Sunday 2026-04-12 06:00 UTC == Sunday 09:00 IL
    vi.setSystemTime(new Date('2026-04-12T06:00:00Z'));
    const ms = msUntilNextSat19();
    // next Sat 16:00 UTC == Sat 2026-04-18 16:00Z → 6 days + 10h
    const expected = new Date('2026-04-18T16:00:00Z').getTime()
      - new Date('2026-04-12T06:00:00Z').getTime();
    expect(ms).toBe(expected);
  });

  it('returns ~3 hours when called on Saturday at 16:00 IL (13:00 UTC)', () => {
    // Saturday 2026-04-18 13:00 UTC == 16:00 IL → 3 hours until 19:00 IL
    vi.setSystemTime(new Date('2026-04-18T13:00:00Z'));
    expect(msUntilNextSat19()).toBe(3 * HOUR_MS);
  });

  it('returns full week when called Saturday just after 19:00 IL', () => {
    // 16:00:01 UTC Saturday == 19:00:01 IL → must roll to next week
    vi.setSystemTime(new Date('2026-04-18T16:00:01Z'));
    const ms = msUntilNextSat19();
    expect(ms).toBeGreaterThan(6 * DAY_MS);
    expect(ms).toBeLessThanOrEqual(7 * DAY_MS);
  });

  it('returns 0 exactly at Saturday 19:00 IL', () => {
    vi.setSystemTime(new Date('2026-04-18T16:00:00Z'));
    expect(msUntilNextSat19()).toBe(0);
  });

  it('returns ~1 day from Friday 19:00 IL (16:00 UTC)', () => {
    // Friday 2026-04-17 16:00 UTC == Friday 19:00 IL → 24h until target
    vi.setSystemTime(new Date('2026-04-17T16:00:00Z'));
    expect(msUntilNextSat19()).toBe(DAY_MS);
  });

  it('always returns a non-negative duration', () => {
    // Sample a few moments around the boundary.
    for (const iso of [
      '2026-04-18T15:59:59Z',
      '2026-04-18T16:00:00Z',
      '2026-04-18T16:00:01Z',
      '2026-04-19T00:00:00Z',
      '2026-04-13T00:00:00Z',
    ]) {
      vi.setSystemTime(new Date(iso));
      expect(msUntilNextSat19()).toBeGreaterThanOrEqual(0);
    }
  });

  it('result always lands on a Saturday at 16:00 UTC (Sat 19:00 IL @ UTC+3)', () => {
    for (const iso of [
      '2026-04-12T06:00:00Z', // Sun morning
      '2026-04-15T10:00:00Z', // Wed midday
      '2026-04-17T16:00:00Z', // Fri 19:00 IL
      '2026-04-18T13:00:00Z', // Sat 16:00 IL
      '2026-04-18T16:00:01Z', // Sat 19:00:01 IL → next week
    ]) {
      vi.setSystemTime(new Date(iso));
      const target = new Date(Date.now() + msUntilNextSat19());
      expect(target.getUTCDay()).toBe(6); // Saturday
      expect(target.getUTCHours()).toBe(16); // 19:00 IL == 16:00 UTC at +3
      expect(target.getUTCMinutes()).toBe(0);
      expect(target.getUTCSeconds()).toBe(0);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// formatCountdown
// ────────────────────────────────────────────────────────────────────────────

describe('formatCountdown', () => {
  const min = (n: number) => n * 60_000;
  const hr  = (n: number) => n * 60 * 60_000;
  const day = (n: number) => n * 24 * 60 * 60_000;

  it('formats minutes-only durations', () => {
    expect(formatCountdown(min(5))).toBe('5 דקות');
    expect(formatCountdown(min(45))).toBe('45 דקות');
  });

  it('rounds zero-and-change down to 0 minutes', () => {
    expect(formatCountdown(0)).toBe('0 דקות');
    expect(formatCountdown(30_000)).toBe('0 דקות'); // half a minute → 0
  });

  it('formats hours with zero-padded minutes', () => {
    expect(formatCountdown(hr(2) + min(7))).toBe('2:07 שעות');
    expect(formatCountdown(hr(10) + min(30))).toBe('10:30 שעות');
  });

  it('formats days with hours and minutes', () => {
    expect(formatCountdown(day(3) + hr(4) + min(9))).toBe('3 ימים 4:09ש');
  });

  it('uses days unit when ≥ 24h even with zero remainder', () => {
    expect(formatCountdown(day(1))).toBe('1 ימים 0:00ש');
  });
});
