// Unit tests for the inventory detail-view formatting helpers.
//
// These turn raw PVE machine values (uptime seconds, byte counts, 0..1 CPU
// fractions) into the human-readable strings the detail page + Sparkline
// tooltips render.

import { describe, expect, it } from 'vitest';
import {
  formatUptime,
  formatBytes,
  formatRate,
  formatPercent,
  formatAgo,
  formatClock
} from '$lib/utils/format';

describe('formatUptime', () => {
  it('renders an em dash for a stopped guest (uptime 0)', () => {
    expect(formatUptime(0)).toBe('—');
    expect(formatUptime(-5)).toBe('—');
  });

  it('renders days + hours', () => {
    expect(formatUptime(90061)).toBe('1d 1h'); // 1d 1h 1m 1s
  });

  it('drops the hours component when it is zero', () => {
    expect(formatUptime(86400)).toBe('1d');
  });

  it('renders hours + minutes below a day', () => {
    expect(formatUptime(3720)).toBe('1h 2m');
  });

  it('renders minutes, then seconds, for short uptimes', () => {
    expect(formatUptime(180)).toBe('3m');
    expect(formatUptime(45)).toBe('45s');
  });
});

describe('formatBytes', () => {
  it('renders 0 B for zero/negative', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(-1)).toBe('0 B');
  });

  it('renders whole bytes without decimals', () => {
    expect(formatBytes(512)).toBe('512 B');
  });

  it('auto-scales to KB / MB / GB', () => {
    expect(formatBytes(4096)).toBe('4.0 KB');
    expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5 MB');
    expect(formatBytes(1.5 * 1024 ** 3)).toBe('1.5 GB');
  });
});

describe('formatRate', () => {
  it('appends /s to the auto-scaled byte value', () => {
    expect(formatRate(0)).toBe('0 B/s');
    expect(formatRate(2 * 1024 * 1024)).toBe('2.0 MB/s');
  });
});

describe('formatPercent', () => {
  it('renders a 0..1 fraction as a whole percentage', () => {
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(0.4231)).toBe('42%');
    expect(formatPercent(1)).toBe('100%');
  });

  it('tolerates a non-finite input', () => {
    expect(formatPercent(NaN)).toBe('—');
  });
});

describe('formatAgo', () => {
  it('renders "just now" for the first few seconds', () => {
    expect(formatAgo(0)).toBe('just now');
    expect(formatAgo(4)).toBe('just now');
    expect(formatAgo(-3)).toBe('just now'); // clamps a negative drift
  });

  it('renders whole seconds below a minute', () => {
    expect(formatAgo(5)).toBe('5s ago');
    expect(formatAgo(12.7)).toBe('12s ago'); // floored
    expect(formatAgo(59)).toBe('59s ago');
  });

  it('renders minutes, then hours', () => {
    expect(formatAgo(60)).toBe('1m ago');
    expect(formatAgo(540)).toBe('9m ago');
    expect(formatAgo(3600)).toBe('1h ago');
    expect(formatAgo(7800)).toBe('2h ago');
  });
});

describe('formatClock', () => {
  it('renders an empty string for a missing timestamp', () => {
    expect(formatClock(0)).toBe('');
  });

  it('renders a zero-padded HH:MM clock', () => {
    const s = formatClock(1700000000);
    expect(s).toMatch(/^\d{2}:\d{2}$/);
  });
});
