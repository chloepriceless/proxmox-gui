// Human-readable formatting helpers for the inventory detail view.
//
// PVE returns raw machine values — uptime in seconds, memory/throughput in
// bytes, CPU as a 0..1 fraction. These helpers turn them into the compact
// strings the detail page and Sparkline tooltips render.

/**
 * Format a duration in seconds as a compact human string.
 *
 *   0 / negative → "—"  (a stopped guest reports uptime 0)
 *   90061        → "1d 1h"
 *   3720         → "1h 2m"
 *   45           → "45s"
 */
export function formatUptime(seconds: number): string {
  if (!seconds || seconds <= 0) return '—';
  const s = Math.floor(seconds);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

/**
 * Auto-scale a byte count to the largest unit that keeps it readable.
 *
 *   0            → "0 B"
 *   4096         → "4.0 KB"
 *   1610612736   → "1.5 GB"
 */
export function formatBytes(n: number, fractionDigits = 1): string {
  if (!n || n <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  const value = n / 1024 ** i;
  // Whole bytes need no decimals; everything else gets `fractionDigits`.
  return `${value.toFixed(i === 0 ? 0 : fractionDigits)} ${units[i]}`;
}

/** Auto-scale a byte-per-second throughput, e.g. "1.5 MB/s". */
export function formatRate(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`;
}

/**
 * Format a 0..1 fraction as a percentage string.
 *
 *   0.4231 → "42%"
 */
export function formatPercent(fraction: number, fractionDigits = 0): string {
  if (!Number.isFinite(fraction)) return '—';
  return `${(fraction * 100).toFixed(fractionDigits)}%`;
}

/**
 * Format an elapsed duration (in seconds) as a compact "ago" phrase.
 *
 *   0..4    → "just now"
 *   5..59   → "12s ago"
 *   60..    → "3m ago"  (then "2h ago")
 *
 * Used by the inventory "Updated … ago" indicator.
 */
export function formatAgo(secondsAgo: number): string {
  const s = Math.max(0, Math.floor(secondsAgo));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

/** Format a UNIX timestamp (seconds) as a local "HH:MM" clock string. */
export function formatClock(unixSeconds: number): string {
  if (!unixSeconds) return '';
  const d = new Date(unixSeconds * 1000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
