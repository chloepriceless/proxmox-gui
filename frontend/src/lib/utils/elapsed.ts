// Elapsed-time formatter for the Tasks-drawer job rows.
//
// UI-SPEC §"Elapsed-timer formatting": elapsed time is computed client-side
// from the job's `created_at`. Format:
//   <60s   → "12s"
//   <60m   → "4m 12s"
//   >=60m  → "1h 04m"  (minutes zero-padded)
// No date library — pure arithmetic. UI-SPEC bans any external date/time
// dependency for this formatter; this module imports none.

/**
 * Format the elapsed time between an ISO timestamp and "now".
 *
 * @param fromISO  the job's `created_at` (ISO 8601).
 * @param nowMs    the current epoch-ms; pass a ticking `$state` value so the
 *                 timer keeps moving. Defaults to `Date.now()`.
 */
export function formatElapsed(fromISO: string, nowMs?: number): string {
  const now = nowMs ?? Date.now();
  const startMs = Date.parse(fromISO);
  if (Number.isNaN(startMs)) return '0s';
  const totalSec = Math.max(0, Math.floor((now - startMs) / 1000));
  if (totalSec < 60) return `${totalSec}s`;
  if (totalSec < 3600) {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}m ${s}s`;
  }
  const h = Math.floor(totalSec / 3600);
  const mm = Math.floor((totalSec % 3600) / 60);
  return `${h}h ${String(mm).padStart(2, '0')}m`;
}
