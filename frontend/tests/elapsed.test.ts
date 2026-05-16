// Unit tests for the elapsed-time formatter (Plan 03-05).
//
// UI-SPEC §"Elapsed-timer formatting": <60s "12s", <60m "4m 12s",
// >=60m "1h 04m" (minutes zero-padded). No date library.

import { describe, expect, it } from 'vitest';
import { formatElapsed } from '../src/lib/utils/elapsed';

/** Build an ISO timestamp `secondsAgo` seconds before `nowMs`. */
function ago(nowMs: number, secondsAgo: number): string {
  return new Date(nowMs - secondsAgo * 1000).toISOString();
}

describe('formatElapsed — <60s range', () => {
  const now = Date.UTC(2026, 4, 16, 12, 0, 0);

  it('formats 0 seconds as "0s"', () => {
    expect(formatElapsed(ago(now, 0), now)).toBe('0s');
  });

  it('formats 12 seconds as "12s"', () => {
    expect(formatElapsed(ago(now, 12), now)).toBe('12s');
  });

  it('formats 59 seconds as "59s"', () => {
    expect(formatElapsed(ago(now, 59), now)).toBe('59s');
  });
});

describe('formatElapsed — <60m range', () => {
  const now = Date.UTC(2026, 4, 16, 12, 0, 0);

  it('formats exactly 60 seconds as "1m 0s"', () => {
    expect(formatElapsed(ago(now, 60), now)).toBe('1m 0s');
  });

  it('formats 4m 12s as "4m 12s"', () => {
    expect(formatElapsed(ago(now, 4 * 60 + 12), now)).toBe('4m 12s');
  });

  it('formats 59m 59s as "59m 59s"', () => {
    expect(formatElapsed(ago(now, 59 * 60 + 59), now)).toBe('59m 59s');
  });
});

describe('formatElapsed — >=60m range', () => {
  const now = Date.UTC(2026, 4, 16, 12, 0, 0);

  it('formats exactly 1 hour as "1h 00m" (zero-padded minutes)', () => {
    expect(formatElapsed(ago(now, 3600), now)).toBe('1h 00m');
  });

  it('formats 1h 04m as "1h 04m"', () => {
    expect(formatElapsed(ago(now, 3600 + 4 * 60), now)).toBe('1h 04m');
  });

  it('formats 2h 30m as "2h 30m"', () => {
    expect(formatElapsed(ago(now, 2 * 3600 + 30 * 60), now)).toBe('2h 30m');
  });
});

describe('formatElapsed — edge cases', () => {
  it('clamps a future timestamp to "0s" (never negative)', () => {
    const now = Date.now();
    expect(formatElapsed(new Date(now + 5000).toISOString(), now)).toBe('0s');
  });

  it('returns "0s" for an unparseable timestamp', () => {
    expect(formatElapsed('not-a-date', Date.now())).toBe('0s');
  });

  it('defaults nowMs to Date.now() when omitted', () => {
    // A timestamp ~10s in the past should land in the <60s range.
    const result = formatElapsed(new Date(Date.now() - 10_000).toISOString());
    expect(result).toMatch(/^\d+s$/);
  });
});
