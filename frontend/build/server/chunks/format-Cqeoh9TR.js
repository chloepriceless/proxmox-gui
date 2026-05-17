function formatUptime(seconds) {
  if (!seconds || seconds <= 0) return "—";
  const s = Math.floor(seconds);
  const d = Math.floor(s / 86400);
  const h = Math.floor(s % 86400 / 3600);
  const m = Math.floor(s % 3600 / 60);
  if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}
function formatBytes(n, fractionDigits = 1) {
  if (!n || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  const value = n / 1024 ** i;
  return `${value.toFixed(i === 0 ? 0 : fractionDigits)} ${units[i]}`;
}
function formatRate(bytesPerSecond) {
  return `${formatBytes(bytesPerSecond)}/s`;
}
function formatPercent(fraction, fractionDigits = 0) {
  if (!Number.isFinite(fraction)) return "—";
  return `${(fraction * 100).toFixed(fractionDigits)}%`;
}
function formatAgo(secondsAgo) {
  const s = Math.max(0, Math.floor(secondsAgo));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}
function formatClock(unixSeconds) {
  if (!unixSeconds) return "";
  const d = new Date(unixSeconds * 1e3);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export { formatBytes as a, formatAgo as b, formatUptime as c, formatPercent as d, formatRate as e, formatClock as f };
//# sourceMappingURL=format-Cqeoh9TR.js.map
