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
function formatClock(unixSeconds) {
  if (!unixSeconds) return "";
  const d = new Date(unixSeconds * 1e3);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export { formatBytes as a, formatUptime as b, formatPercent as c, formatRate as d, formatClock as f };
//# sourceMappingURL=format-Cmwi-iZ7.js.map
