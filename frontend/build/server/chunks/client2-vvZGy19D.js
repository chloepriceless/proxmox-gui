const CSRF_COOKIE_NAME = "csrf_token";
function readCsrfCookie() {
  if (typeof document === "undefined") return null;
  const cookies = document.cookie ? document.cookie.split("; ") : [];
  for (const c of cookies) {
    const eq = c.indexOf("=");
    if (eq === -1) continue;
    const name = c.slice(0, eq);
    if (name === CSRF_COOKIE_NAME) {
      try {
        return decodeURIComponent(c.slice(eq + 1));
      } catch {
        return c.slice(eq + 1);
      }
    }
  }
  return null;
}
const API_PREFIX = "/api/v1";
const STATE_CHANGING = /* @__PURE__ */ new Set(["POST", "PUT", "PATCH", "DELETE"]);
class ApiError extends Error {
  status;
  body;
  constructor(status2, message, body) {
    super(message);
    this.name = "ApiError";
    this.status = status2;
    this.body = body;
  }
}
function buildUrl(path) {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (path.startsWith("/api")) return path;
  if (!path.startsWith("/")) return `${API_PREFIX}/${path}`;
  return `${API_PREFIX}${path}`;
}
async function apiFetch(path, init = {}) {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  let body = void 0;
  if (init.body !== void 0 && init.body !== null) {
    if (typeof init.body === "string" || init.body instanceof FormData || init.body instanceof Blob || init.body instanceof ArrayBuffer || init.body instanceof URLSearchParams || typeof ReadableStream !== "undefined" && init.body instanceof ReadableStream) {
      body = init.body;
    } else {
      body = JSON.stringify(init.body);
      if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    }
  }
  if (STATE_CHANGING.has(method)) {
    const token = readCsrfCookie();
    if (token && !headers.has("X-CSRF-Token")) {
      headers.set("X-CSRF-Token", token);
    }
  }
  const fetchImpl = init._fetch ?? fetch;
  const forwarded = { ...init };
  delete forwarded._fetch;
  return fetchImpl(buildUrl(path), {
    ...forwarded,
    method,
    headers,
    body,
    credentials: init.credentials ?? "same-origin"
  });
}
async function apiJson(path, init = {}) {
  const res = await apiFetch(path, init);
  let parsed = null;
  const text = await res.text();
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  if (!res.ok) {
    const message = typeof parsed === "object" && parsed !== null && "detail" in parsed ? String(parsed.detail) : `Request failed: ${res.status}`;
    throw new ApiError(res.status, message, parsed);
  }
  return parsed;
}
const api$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  ApiError,
  apiFetch,
  apiJson
}, Symbol.toStringTag, { value: "Module" }));
function withFetch$8(opts, init) {
  if (!opts?.fetch) return init;
  return { ...init, _fetch: opts.fetch };
}
async function login(req, opts) {
  await apiJson(
    "/auth/login",
    withFetch$8(opts, {
      method: "POST",
      body: { username: req.username, password: req.password }
    })
  );
}
async function logout(opts) {
  try {
    await apiFetch("/auth/logout", withFetch$8(opts, { method: "POST" }));
  } catch {
  }
}
async function refresh(opts) {
  await apiJson(
    "/auth/refresh",
    withFetch$8(opts, { method: "POST" })
  );
}
const authModule = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  login,
  logout,
  refresh
}, Symbol.toStringTag, { value: "Module" }));
function withFetch$7(opts, init) {
  if (!opts?.fetch) return init;
  return { ...init, _fetch: opts.fetch };
}
async function get$3(opts) {
  const res = await apiFetch("/me/", withFetch$7(opts, { method: "GET" }));
  if (res.status === 401 || res.status === 403) return null;
  if (!res.ok) {
    throw new Error(`GET /api/v1/me failed with status ${res.status}`);
  }
  return await res.json();
}
async function getStrict(opts) {
  return apiJson("/me/", withFetch$7(opts, { method: "GET" }));
}
async function changePassword(body, opts) {
  await apiJson(
    "/me/password",
    withFetch$7(opts, { method: "POST", body: { ...body } })
  );
}
async function listSshKeys(opts) {
  return apiJson("/me/ssh-keys/", withFetch$7(opts, { method: "GET" }));
}
async function addSshKey(body, opts) {
  return apiJson(
    "/me/ssh-keys/",
    withFetch$7(opts, { method: "POST", body: { ...body } })
  );
}
async function deleteSshKey(args, opts) {
  const res = await apiFetch(
    `/me/ssh-keys/${args.id}`,
    withFetch$7(opts, { method: "DELETE" })
  );
  if (!res.ok && res.status !== 204) {
    const text = await res.text().catch(() => "");
    let parsed = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }
    const { ApiError: ApiError2 } = await Promise.resolve().then(() => api$1);
    throw new ApiError2(res.status, `DELETE /me/ssh-keys/${args.id} failed`, parsed);
  }
}
async function listTokens(opts) {
  return apiJson("/me/tokens/", withFetch$7(opts, { method: "GET" }));
}
async function mintToken(body, opts) {
  return apiJson(
    "/me/tokens/",
    withFetch$7(opts, { method: "POST", body: { ...body } })
  );
}
async function revokeToken(args, opts) {
  const res = await apiFetch(
    `/me/tokens/${args.id}`,
    withFetch$7(opts, { method: "DELETE" })
  );
  if (!res.ok && res.status !== 204) {
    const text = await res.text().catch(() => "");
    let parsed = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }
    const { ApiError: ApiError2 } = await Promise.resolve().then(() => api$1);
    throw new ApiError2(res.status, `DELETE /me/tokens/${args.id} failed`, parsed);
  }
}
const meModule = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  addSshKey,
  changePassword,
  deleteSshKey,
  get: get$3,
  getStrict,
  listSshKeys,
  listTokens,
  mintToken,
  revokeToken
}, Symbol.toStringTag, { value: "Module" }));
function withFetch$6(opts, init) {
  if (!opts?.fetch) return init;
  return { ...init, _fetch: opts.fetch };
}
async function status(opts) {
  try {
    const res = await apiFetch("/setup/status", withFetch$6(opts, { method: "GET" }));
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
async function createAdmin(body, opts) {
  return apiJson(
    "/setup/admin",
    withFetch$6(opts, { method: "POST", body: { ...body } })
  );
}
const setupModule = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  createAdmin,
  status
}, Symbol.toStringTag, { value: "Module" }));
function withFetch$5(opts, init) {
  if (!opts?.fetch) return init;
  return { ...init, _fetch: opts.fetch };
}
async function test(body, opts) {
  return apiJson(
    "/clusters/test",
    withFetch$5(opts, { method: "POST", body: { ...body } })
  );
}
async function create$2(body, opts) {
  return apiJson(
    "/clusters/",
    withFetch$5(opts, { method: "POST", body: { ...body } })
  );
}
async function list$3(opts) {
  return apiJson("/clusters/", withFetch$5(opts, { method: "GET" }));
}
async function get$2(args, opts) {
  return apiJson(`/clusters/${args.id}`, withFetch$5(opts, { method: "GET" }));
}
async function update$2(args, opts) {
  const { id, ...payload } = args;
  return apiJson(
    `/clusters/${id}`,
    withFetch$5(opts, { method: "PATCH", body: { ...payload } })
  );
}
async function del$2(args, opts) {
  const res = await apiFetch(`/clusters/${args.id}`, withFetch$5(opts, { method: "DELETE" }));
  if (!res.ok && res.status !== 204) {
    const text = await res.text().catch(() => "");
    let parsed = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }
    const { ApiError: ApiError2 } = await Promise.resolve().then(() => api$1);
    throw new ApiError2(res.status, `DELETE /clusters/${args.id} failed`, parsed);
  }
}
async function testExisting(args, opts) {
  return apiJson(
    `/clusters/${args.id}/test`,
    withFetch$5(opts, { method: "POST" })
  );
}
const clustersModule = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  create: create$2,
  del: del$2,
  get: get$2,
  list: list$3,
  test,
  testExisting,
  update: update$2
}, Symbol.toStringTag, { value: "Module" }));
function withFetch$4(opts, init) {
  if (!opts?.fetch) return init;
  return { ...init, _fetch: opts.fetch };
}
async function list$2(opts) {
  return apiJson("/users/", withFetch$4(opts, { method: "GET" }));
}
async function get$1(args, opts) {
  return apiJson(`/users/${args.id}`, withFetch$4(opts, { method: "GET" }));
}
async function create$1(body, opts) {
  return apiJson(
    "/users/",
    withFetch$4(opts, { method: "POST", body: { ...body } })
  );
}
async function update$1(args, opts) {
  const { id, ...payload } = args;
  return apiJson(
    `/users/${id}`,
    withFetch$4(opts, { method: "PATCH", body: { ...payload } })
  );
}
async function del$1(args, opts) {
  const res = await apiFetch(`/users/${args.id}`, withFetch$4(opts, { method: "DELETE" }));
  if (!res.ok && res.status !== 204) {
    const text = await res.text().catch(() => "");
    let parsed = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }
    const { ApiError: ApiError2 } = await Promise.resolve().then(() => api$1);
    throw new ApiError2(res.status, `DELETE /users/${args.id} failed`, parsed);
  }
}
async function setPassword(args, opts) {
  const body = { new_password: args.new_password };
  await apiJson(
    `/users/${args.id}/password`,
    withFetch$4(opts, { method: "POST", body: { ...body } })
  );
}
async function addTeam(args, opts) {
  return apiJson(
    `/users/${args.id}/teams`,
    withFetch$4(opts, { method: "POST", body: { team_id: args.team_id } })
  );
}
async function removeTeam(args, opts) {
  const res = await apiFetch(
    `/users/${args.id}/teams/${args.team_id}`,
    withFetch$4(opts, { method: "DELETE" })
  );
  if (!res.ok && res.status !== 204) {
    const text = await res.text().catch(() => "");
    let parsed = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }
    const { ApiError: ApiError2 } = await Promise.resolve().then(() => api$1);
    throw new ApiError2(
      res.status,
      `DELETE /users/${args.id}/teams/${args.team_id} failed`,
      parsed
    );
  }
}
const usersModule = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  addTeam,
  create: create$1,
  del: del$1,
  get: get$1,
  list: list$2,
  removeTeam,
  setPassword,
  update: update$1
}, Symbol.toStringTag, { value: "Module" }));
function withFetch$3(opts, init) {
  if (!opts?.fetch) return init;
  return { ...init, _fetch: opts.fetch };
}
async function list$1(opts) {
  return apiJson("/teams/", withFetch$3(opts, { method: "GET" }));
}
async function get(args, opts) {
  return apiJson(`/teams/${args.id}`, withFetch$3(opts, { method: "GET" }));
}
async function create(body, opts) {
  return apiJson(
    "/teams/",
    withFetch$3(opts, { method: "POST", body: { ...body } })
  );
}
async function update(args, opts) {
  const { id, ...payload } = args;
  return apiJson(
    `/teams/${id}`,
    withFetch$3(opts, { method: "PATCH", body: { ...payload } })
  );
}
async function del(args, opts) {
  const res = await apiFetch(`/teams/${args.id}`, withFetch$3(opts, { method: "DELETE" }));
  if (!res.ok && res.status !== 204) {
    const text = await res.text().catch(() => "");
    let parsed = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }
    const { ApiError: ApiError2 } = await Promise.resolve().then(() => api$1);
    throw new ApiError2(res.status, `DELETE /teams/${args.id} failed`, parsed);
  }
}
const teamsModule = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  create,
  del,
  get,
  list: list$1,
  update
}, Symbol.toStringTag, { value: "Module" }));
function withFetch$2(opts, init) {
  if (!opts?.fetch) return init;
  return { ...init, _fetch: opts.fetch };
}
function basePath(clusterId, kind, vmid) {
  const seg = kind === "lxc" ? "lxcs" : "vms";
  return vmid === void 0 ? `/clusters/${clusterId}/${seg}` : `/clusters/${clusterId}/${seg}/${vmid}`;
}
async function listAll(opts) {
  return apiJson("/me/inventory", withFetch$2(opts, { method: "GET" }));
}
async function listForCluster(args, opts) {
  return apiJson(
    `/clusters/${args.clusterId}/inventory`,
    withFetch$2(opts, { method: "GET" })
  );
}
async function getDetail(args, opts) {
  const fetchOpts = { fetch: args.fetch ?? opts?.fetch };
  return apiJson(
    basePath(args.clusterId, args.type, args.vmid),
    withFetch$2(fetchOpts, { method: "GET" })
  );
}
async function getRrd(args, opts) {
  const qs = new URLSearchParams();
  if (args.timeframe) qs.set("timeframe", args.timeframe);
  if (args.cf) qs.set("cf", args.cf);
  const tail = qs.toString() ? `?${qs}` : "";
  return apiJson(
    `${basePath(args.clusterId, args.type, args.vmid)}/rrd${tail}`,
    withFetch$2(opts, { method: "GET" })
  );
}
async function setTags(args, opts) {
  return apiJson(
    `${basePath(args.clusterId, args.type, args.vmid)}/tags`,
    withFetch$2(opts, { method: "PUT", body: { tags: args.tags } })
  );
}
async function setNotes(args, opts) {
  return apiJson(
    `${basePath(args.clusterId, args.type, args.vmid)}/notes`,
    withFetch$2(opts, { method: "PUT", body: { notes: args.notes } })
  );
}
const inventoryModule = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  getDetail,
  getRrd,
  listAll,
  listForCluster,
  setNotes,
  setTags
}, Symbol.toStringTag, { value: "Module" }));
function withFetch$1(opts, init) {
  if (!opts?.fetch) return init;
  return { ...init, _fetch: opts.fetch };
}
function buildParams(f) {
  const u = new URLSearchParams();
  if (!f) return u;
  if (f.from) u.set("from", f.from);
  if (f.to) u.set("to", f.to);
  if (f.action && f.action.length) u.set("action", f.action.join(","));
  if (typeof f.user_id === "number") u.set("user_id", String(f.user_id));
  if (f.target_type && f.target_type.length) u.set("target_type", f.target_type.join(","));
  if (typeof f.vmid === "number") u.set("vmid", String(f.vmid));
  if (typeof f.cluster_id === "number") u.set("cluster_id", String(f.cluster_id));
  if (f.show_team_actions) u.set("show_team_actions", "true");
  if (typeof f.page === "number") u.set("page", String(f.page));
  if (typeof f.page_size === "number") u.set("page_size", String(f.page_size));
  return u;
}
async function list(args = {}, opts) {
  const qs = buildParams(args.filters);
  const tail = qs.toString() ? `?${qs}` : "";
  return apiJson(`/audit/${tail}`, withFetch$1(opts, { method: "GET" }));
}
async function exportCsv(args = {}, opts) {
  const qs = buildParams(args.filters);
  const tail = qs.toString() ? `?${qs}` : "";
  const fetchFn = opts?.fetch ?? fetch;
  const res = await fetchFn(`/api/v1/audit/export.csv${tail}`, {
    method: "GET",
    credentials: "include"
  });
  if (!res.ok) {
    const { ApiError: ApiError2 } = await Promise.resolve().then(() => api$1);
    const body = await res.json().catch(() => null);
    throw new ApiError2(res.status, `GET /audit/export.csv failed`, body);
  }
  return res.blob();
}
const auditModule = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  exportCsv,
  list
}, Symbol.toStringTag, { value: "Module" }));
function withFetch(opts, init) {
  if (!opts?.fetch) return init;
  return { ...init, _fetch: opts.fetch };
}
async function getTeamQuotas(args, opts) {
  return apiJson(
    `/teams/${args.teamId}/quotas`,
    withFetch(opts, { method: "GET" })
  );
}
async function setTeamQuotas(args, opts) {
  return apiJson(
    `/teams/${args.teamId}/quotas`,
    withFetch(opts, {
      method: "PUT",
      body: { rows: args.rows, allow_over: args.allowOver ?? false }
    })
  );
}
async function getMyQuotas(opts) {
  return apiJson(
    `/me/quotas`,
    withFetch(opts, { method: "GET" })
  );
}
async function preview(args, opts) {
  return apiJson(
    `/quotas/preview`,
    withFetch(opts, {
      method: "POST",
      body: {
        team_id: args.teamId,
        cluster_id: args.clusterId,
        requested_cpu: args.requestedCpu ?? 0,
        requested_ram_bytes: args.requestedRamBytes ?? 0,
        requested_disk_bytes: args.requestedDiskBytes ?? 0,
        requested_count: args.requestedCount ?? 0
      }
    })
  );
}
const quotasModule = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  getMyQuotas,
  getTeamQuotas,
  preview,
  setTeamQuotas
}, Symbol.toStringTag, { value: "Module" }));
const api = {
  auth: authModule,
  me: meModule,
  setup: setupModule,
  clusters: clustersModule,
  users: usersModule,
  teams: teamsModule,
  inventory: inventoryModule,
  audit: auditModule,
  quotas: quotasModule
};

export { ApiError as A, api as a };
//# sourceMappingURL=client2-vvZGy19D.js.map
