import { apiJson } from './api-By_nInf4.js';

function withFetch(opts, init) {
  if (!opts?.fetch) return init;
  return { ...init, _fetch: opts.fetch };
}
async function getSettings(opts) {
  return apiJson("/admin/settings", withFetch(opts, { method: "GET" }));
}
async function keepalive(opts) {
  await apiJson("/auth/keepalive", withFetch(opts, { method: "POST" }));
}

export { getSettings as g, keepalive as k };
//# sourceMappingURL=settings-B0AyWnlD.js.map
