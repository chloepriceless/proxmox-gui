import { apiFetch, apiJson } from './api-By_nInf4.js';

function withFetch$g(opts, init) {
  if (!opts?.fetch) return init;
  return { ...init, _fetch: opts.fetch };
}
async function login(req, opts) {
  await apiJson(
    "/auth/login",
    withFetch$g(opts, {
      method: "POST",
      body: { username: req.username, password: req.password }
    })
  );
}
async function logout(opts) {
  try {
    await apiFetch("/auth/logout", withFetch$g(opts, { method: "POST" }));
  } catch {
  }
}
async function refresh(opts) {
  await apiJson(
    "/auth/refresh",
    withFetch$g(opts, { method: "POST" })
  );
}
const authModule = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  login,
  logout,
  refresh
}, Symbol.toStringTag, { value: "Module" }));
function withFetch$f(opts, init) {
  if (!opts?.fetch) return init;
  return { ...init, _fetch: opts.fetch };
}
async function get$3(opts) {
  const res = await apiFetch("/me/", withFetch$f(opts, { method: "GET" }));
  if (res.status === 401 || res.status === 403) return null;
  if (!res.ok) {
    throw new Error(`GET /api/v1/me failed with status ${res.status}`);
  }
  return await res.json();
}
async function getStrict(opts) {
  return apiJson("/me/", withFetch$f(opts, { method: "GET" }));
}
async function changePassword(body, opts) {
  await apiJson(
    "/me/password",
    withFetch$f(opts, { method: "POST", body: { ...body } })
  );
}
async function listSshKeys(opts) {
  return apiJson("/me/ssh-keys/", withFetch$f(opts, { method: "GET" }));
}
async function addSshKey(body, opts) {
  return apiJson(
    "/me/ssh-keys/",
    withFetch$f(opts, { method: "POST", body: { ...body } })
  );
}
async function deleteSshKey(args, opts) {
  const res = await apiFetch(
    `/me/ssh-keys/${args.id}`,
    withFetch$f(opts, { method: "DELETE" })
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
    const { ApiError } = await import('./api-By_nInf4.js');
    throw new ApiError(res.status, `DELETE /me/ssh-keys/${args.id} failed`, parsed);
  }
}
async function listTokens(opts) {
  return apiJson("/me/tokens/", withFetch$f(opts, { method: "GET" }));
}
async function mintToken(body, opts) {
  return apiJson(
    "/me/tokens/",
    withFetch$f(opts, { method: "POST", body: { ...body } })
  );
}
async function revokeToken(args, opts) {
  const res = await apiFetch(
    `/me/tokens/${args.id}`,
    withFetch$f(opts, { method: "DELETE" })
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
    const { ApiError } = await import('./api-By_nInf4.js');
    throw new ApiError(res.status, `DELETE /me/tokens/${args.id} failed`, parsed);
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
function withFetch$e(opts, init) {
  if (!opts?.fetch) return init;
  return { ...init, _fetch: opts.fetch };
}
async function status(opts) {
  try {
    const res = await apiFetch("/setup/status", withFetch$e(opts, { method: "GET" }));
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
async function createAdmin(body, opts) {
  return apiJson(
    "/setup/admin",
    withFetch$e(opts, { method: "POST", body: { ...body } })
  );
}
const setupModule = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  createAdmin,
  status
}, Symbol.toStringTag, { value: "Module" }));
function withFetch$d(opts, init) {
  if (!opts?.fetch) return init;
  return { ...init, _fetch: opts.fetch };
}
async function test(body, opts) {
  return apiJson(
    "/clusters/test",
    withFetch$d(opts, { method: "POST", body: { ...body } })
  );
}
async function create$2(body, opts) {
  return apiJson(
    "/clusters/",
    withFetch$d(opts, { method: "POST", body: { ...body } })
  );
}
async function list$3(opts) {
  return apiJson("/clusters/", withFetch$d(opts, { method: "GET" }));
}
async function get$2(args, opts) {
  return apiJson(`/clusters/${args.id}`, withFetch$d(opts, { method: "GET" }));
}
async function update$2(args, opts) {
  const { id, ...payload } = args;
  return apiJson(
    `/clusters/${id}`,
    withFetch$d(opts, { method: "PATCH", body: { ...payload } })
  );
}
async function del$3(args, opts) {
  const res = await apiFetch(`/clusters/${args.id}`, withFetch$d(opts, { method: "DELETE" }));
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
    const { ApiError } = await import('./api-By_nInf4.js');
    throw new ApiError(res.status, `DELETE /clusters/${args.id} failed`, parsed);
  }
}
async function testExisting(args, opts) {
  return apiJson(
    `/clusters/${args.id}/test`,
    withFetch$d(opts, { method: "POST" })
  );
}
async function getSshPubkey(opts) {
  return apiJson("/clusters/ssh-pubkey", withFetch$d(opts, { method: "GET" }));
}
async function verifySsh(args, opts) {
  return apiJson(
    `/clusters/${args.id}/verify-ssh`,
    withFetch$d(opts, { method: "POST" })
  );
}
async function listBackupStorages(clusterId, opts) {
  return apiJson(
    `/clusters/${clusterId}/backup-storages`,
    withFetch$d(opts, { method: "GET" })
  );
}
async function getNodeResources(args, opts) {
  return apiJson(
    `/clusters/${args.clusterId}/nodes/resources`,
    withFetch$d(opts, { method: "GET" })
  );
}
const clustersModule = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  create: create$2,
  del: del$3,
  get: get$2,
  getNodeResources,
  getSshPubkey,
  list: list$3,
  listBackupStorages,
  test,
  testExisting,
  update: update$2,
  verifySsh
}, Symbol.toStringTag, { value: "Module" }));
function withFetch$c(opts, init) {
  if (!opts?.fetch) return init;
  return { ...init, _fetch: opts.fetch };
}
async function list$2(opts) {
  return apiJson("/users/", withFetch$c(opts, { method: "GET" }));
}
async function get$1(args, opts) {
  return apiJson(`/users/${args.id}`, withFetch$c(opts, { method: "GET" }));
}
async function create$1(body, opts) {
  return apiJson(
    "/users/",
    withFetch$c(opts, { method: "POST", body: { ...body } })
  );
}
async function update$1(args, opts) {
  const { id, ...payload } = args;
  return apiJson(
    `/users/${id}`,
    withFetch$c(opts, { method: "PATCH", body: { ...payload } })
  );
}
async function del$2(args, opts) {
  const res = await apiFetch(`/users/${args.id}`, withFetch$c(opts, { method: "DELETE" }));
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
    const { ApiError } = await import('./api-By_nInf4.js');
    throw new ApiError(res.status, `DELETE /users/${args.id} failed`, parsed);
  }
}
async function setPassword(args, opts) {
  const body = { new_password: args.new_password };
  await apiJson(
    `/users/${args.id}/password`,
    withFetch$c(opts, { method: "POST", body: { ...body } })
  );
}
async function addTeam(args, opts) {
  return apiJson(
    `/users/${args.id}/teams`,
    withFetch$c(opts, { method: "POST", body: { team_id: args.team_id } })
  );
}
async function removeTeam(args, opts) {
  const res = await apiFetch(
    `/users/${args.id}/teams/${args.team_id}`,
    withFetch$c(opts, { method: "DELETE" })
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
    const { ApiError } = await import('./api-By_nInf4.js');
    throw new ApiError(
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
  del: del$2,
  get: get$1,
  list: list$2,
  removeTeam,
  setPassword,
  update: update$1
}, Symbol.toStringTag, { value: "Module" }));
function withFetch$b(opts, init) {
  if (!opts?.fetch) return init;
  return { ...init, _fetch: opts.fetch };
}
async function list$1(opts) {
  return apiJson("/teams/", withFetch$b(opts, { method: "GET" }));
}
async function get(args, opts) {
  return apiJson(`/teams/${args.id}`, withFetch$b(opts, { method: "GET" }));
}
async function create(body, opts) {
  return apiJson(
    "/teams/",
    withFetch$b(opts, { method: "POST", body: { ...body } })
  );
}
async function update(args, opts) {
  const { id, ...payload } = args;
  return apiJson(
    `/teams/${id}`,
    withFetch$b(opts, { method: "PATCH", body: { ...payload } })
  );
}
async function del$1(args, opts) {
  const res = await apiFetch(`/teams/${args.id}`, withFetch$b(opts, { method: "DELETE" }));
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
    const { ApiError } = await import('./api-By_nInf4.js');
    throw new ApiError(res.status, `DELETE /teams/${args.id} failed`, parsed);
  }
}
const teamsModule = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  create,
  del: del$1,
  get,
  list: list$1,
  update
}, Symbol.toStringTag, { value: "Module" }));
function withFetch$a(opts, init) {
  if (!opts?.fetch) return init;
  return { ...init, _fetch: opts.fetch };
}
function basePath$1(clusterId, kind, vmid) {
  const seg = kind === "lxc" ? "lxcs" : "vms";
  return vmid === void 0 ? `/clusters/${clusterId}/${seg}` : `/clusters/${clusterId}/${seg}/${vmid}`;
}
async function listAll(opts) {
  return apiJson("/me/inventory", withFetch$a(opts, { method: "GET" }));
}
async function listForCluster(args, opts) {
  return apiJson(
    `/clusters/${args.clusterId}/inventory`,
    withFetch$a(opts, { method: "GET" })
  );
}
async function getDetail(args, opts) {
  const fetchOpts = { fetch: args.fetch ?? opts?.fetch };
  return apiJson(
    basePath$1(args.clusterId, args.type, args.vmid),
    withFetch$a(fetchOpts, { method: "GET" })
  );
}
async function getRrd(args, opts) {
  const qs = new URLSearchParams();
  if (args.timeframe) qs.set("timeframe", args.timeframe);
  if (args.cf) qs.set("cf", args.cf);
  const tail = qs.toString() ? `?${qs}` : "";
  return apiJson(
    `${basePath$1(args.clusterId, args.type, args.vmid)}/rrd${tail}`,
    withFetch$a(opts, { method: "GET" })
  );
}
async function setTags(args, opts) {
  return apiJson(
    `${basePath$1(args.clusterId, args.type, args.vmid)}/tags`,
    withFetch$a(opts, { method: "PUT", body: { tags: args.tags } })
  );
}
async function setNotes(args, opts) {
  return apiJson(
    `${basePath$1(args.clusterId, args.type, args.vmid)}/notes`,
    withFetch$a(opts, { method: "PUT", body: { notes: args.notes } })
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
function withFetch$9(opts, init) {
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
  return apiJson(`/audit/${tail}`, withFetch$9(opts, { method: "GET" }));
}
async function listArchives(opts) {
  return apiJson("/audit/archives", withFetch$9(opts, { method: "GET" }));
}
function archiveDownloadUrl(name) {
  return `/api/v1/audit/archives/${encodeURIComponent(name)}`;
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
    const { ApiError } = await import('./api-By_nInf4.js');
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, `GET /audit/export.csv failed`, body);
  }
  return res.blob();
}
const auditModule = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  archiveDownloadUrl,
  exportCsv,
  list,
  listArchives
}, Symbol.toStringTag, { value: "Module" }));
function withFetch$8(opts, init) {
  if (!opts?.fetch) return init;
  return { ...init, _fetch: opts.fetch };
}
async function getTeamQuotas(args, opts) {
  return apiJson(
    `/teams/${args.teamId}/quotas`,
    withFetch$8(opts, { method: "GET" })
  );
}
async function setTeamQuotas(args, opts) {
  return apiJson(
    `/teams/${args.teamId}/quotas`,
    withFetch$8(opts, {
      method: "PUT",
      body: { rows: args.rows, allow_over: args.allowOver ?? false }
    })
  );
}
async function getMyQuotas(opts) {
  return apiJson(
    `/me/quotas`,
    withFetch$8(opts, { method: "GET" })
  );
}
async function preview(args, opts) {
  return apiJson(
    `/quotas/preview`,
    withFetch$8(opts, {
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
function withFetch$7(opts, init) {
  if (!opts?.fetch) return init;
  return { ...init, _fetch: opts.fetch };
}
async function listJobs(args, opts) {
  const qs = new URLSearchParams();
  if (args?.state) qs.set("state", args.state);
  if (args?.limit !== void 0) qs.set("limit", String(args.limit));
  const tail = qs.toString() ? `?${qs}` : "";
  return apiJson(`/jobs${tail}`, withFetch$7(opts, { method: "GET" }));
}
async function getJob(id, opts) {
  return apiJson(`/jobs/${id}`, withFetch$7(opts, { method: "GET" }));
}
async function retryJob(id, opts) {
  return apiJson(`/jobs/${id}/retry`, withFetch$7(opts, { method: "POST" }));
}
const jobsModule = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  getJob,
  listJobs,
  retryJob
}, Symbol.toStringTag, { value: "Module" }));
function withFetch$6(opts, init) {
  if (!opts?.fetch) return init;
  return { ...init, _fetch: opts.fetch };
}
function basePath(clusterId, kind, vmid) {
  const seg = kind === "lxc" ? "lxcs" : "vms";
  return `/clusters/${clusterId}/${seg}/${vmid}`;
}
async function power(args, opts) {
  return apiJson(
    `${basePath(args.clusterId, args.type, args.vmid)}/power`,
    withFetch$6(opts, { method: "POST", body: { action: args.action } })
  );
}
async function del(args, opts) {
  return apiJson(
    basePath(args.clusterId, args.type, args.vmid),
    withFetch$6(opts, { method: "DELETE" })
  );
}
async function bulkPower(args, opts) {
  const prefixCluster = args.targets[0]?.cluster_id;
  if (prefixCluster === void 0) {
    throw new Error("bulkPower requires at least one target");
  }
  return apiJson(
    `/clusters/${prefixCluster}/vms/bulk-power`,
    withFetch$6(opts, { method: "POST", body: { action: args.action, targets: args.targets } })
  );
}
async function listSnapshots(args, opts) {
  return apiJson(
    `${basePath(args.clusterId, args.type, args.vmid)}/snapshots`,
    withFetch$6(opts, { method: "GET" })
  );
}
async function createSnapshot(args, opts) {
  return apiJson(
    `${basePath(args.clusterId, args.type, args.vmid)}/snapshots`,
    withFetch$6(opts, {
      method: "POST",
      body: { name: args.name, description: args.description, vmstate: args.vmstate }
    })
  );
}
async function rollbackSnapshot(args, opts) {
  return apiJson(
    `${basePath(args.clusterId, args.type, args.vmid)}/snapshots/${encodeURIComponent(
      args.name
    )}/rollback`,
    withFetch$6(opts, { method: "POST" })
  );
}
async function deleteSnapshot(args, opts) {
  return apiJson(
    `${basePath(args.clusterId, args.type, args.vmid)}/snapshots/${encodeURIComponent(
      args.name
    )}`,
    withFetch$6(opts, { method: "DELETE" })
  );
}
async function getResizeInfo(args, opts) {
  return apiJson(
    `${basePath(args.clusterId, args.type, args.vmid)}/resize-info`,
    withFetch$6(opts, { method: "GET" })
  );
}
async function resize(args, opts) {
  return apiJson(
    `${basePath(args.clusterId, args.type, args.vmid)}/resize`,
    withFetch$6(opts, { method: "POST", body: { ...args.body } })
  );
}
async function clone(args, opts) {
  return apiJson(
    `${basePath(args.clusterId, args.type, args.vmid)}/clone`,
    withFetch$6(opts, { method: "POST", body: { ...args.body } })
  );
}
async function convertTemplate(args, opts) {
  return apiJson(
    `/clusters/${args.clusterId}/vms/${args.vmid}/convert-template`,
    withFetch$6(opts, { method: "POST" })
  );
}
async function migrate(args, opts) {
  return apiJson(
    `${basePath(args.clusterId, args.type, args.vmid)}/migrate`,
    withFetch$6(opts, { method: "POST", body: { ...args.body } })
  );
}
async function backupNow(args, opts) {
  return apiJson(
    `${basePath(args.clusterId, args.type, args.vmid)}/backup`,
    withFetch$6(opts, { method: "POST" })
  );
}
async function listBackups(args, opts) {
  return apiJson(
    `${basePath(args.clusterId, args.type, args.vmid)}/backups`,
    withFetch$6(opts, { method: "GET" })
  );
}
async function restore(args, opts) {
  return apiJson(
    `${basePath(args.clusterId, args.type, args.vmid)}/restore`,
    withFetch$6(opts, {
      method: "POST",
      body: {
        archive: args.archive,
        mode: args.mode,
        ...args.new_vmid !== void 0 ? { new_vmid: args.new_vmid } : {},
        ...args.new_name !== void 0 ? { new_name: args.new_name } : {}
      }
    })
  );
}
async function getSchedule(args, opts) {
  return apiJson(
    `${basePath(args.clusterId, args.type, args.vmid)}/backup-schedule`,
    withFetch$6(opts, { method: "GET" })
  );
}
async function saveSchedule(args, opts) {
  return apiJson(
    `${basePath(args.clusterId, args.type, args.vmid)}/backup-schedule`,
    withFetch$6(opts, {
      method: "PUT",
      body: {
        enabled: args.enabled,
        frequency: args.frequency,
        keep_last: args.keep_last
      }
    })
  );
}
async function deleteBackupFile(args, opts) {
  return apiJson(
    `${basePath(args.clusterId, args.type, args.vmid)}/backups/${encodeURIComponent(
      args.volid
    )}`,
    withFetch$6(opts, { method: "DELETE" })
  );
}
async function listScheduledBackups(opts) {
  return apiJson(
    "/backups/schedules",
    withFetch$6(opts, { method: "GET" })
  );
}
const lifecycleModule = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  backupNow,
  bulkPower,
  clone,
  convertTemplate,
  createSnapshot,
  del,
  deleteBackupFile,
  deleteSnapshot,
  getResizeInfo,
  getSchedule,
  listBackups,
  listScheduledBackups,
  listSnapshots,
  migrate,
  power,
  resize,
  restore,
  rollbackSnapshot,
  saveSchedule
}, Symbol.toStringTag, { value: "Module" }));
function withFetch$5(opts, init) {
  if (!opts?.fetch) return init;
  return { ...init, _fetch: opts.fetch };
}
async function createLxc(args, opts) {
  return apiJson(
    `/clusters/${args.clusterId}/provisioning/lxc`,
    withFetch$5(opts, { method: "POST", body: { ...args.body } })
  );
}
async function createQemu(args, opts) {
  return apiJson(
    `/clusters/${args.clusterId}/provisioning/qemu`,
    withFetch$5(opts, { method: "POST", body: { ...args.body } })
  );
}
async function createCommunityScript(args, opts) {
  return apiJson(
    `/clusters/${args.clusterId}/provisioning/community-script`,
    withFetch$5(opts, { method: "POST", body: { ...args.body } })
  );
}
async function cloudinitPreview(args, opts) {
  return apiJson(
    `/clusters/${args.clusterId}/provisioning/cloudinit/preview`,
    withFetch$5(opts, { method: "POST", body: { ...args.body } })
  );
}
const provisioningModule = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  cloudinitPreview,
  createCommunityScript,
  createLxc,
  createQemu
}, Symbol.toStringTag, { value: "Module" }));
function withFetch$4(opts, init) {
  if (!opts?.fetch) return init;
  return { ...init, _fetch: opts.fetch };
}
async function listCatalog(args, opts) {
  const qs = new URLSearchParams();
  if (args.view) qs.set("view", args.view);
  if (args.q) qs.set("q", args.q);
  if (args.category) qs.set("category", args.category);
  const tail = qs.toString() ? `?${qs}` : "";
  return apiJson(
    `/clusters/${args.clusterId}/catalog${tail}`,
    withFetch$4(opts, { method: "GET" })
  );
}
async function getCatalogEntry(args, opts) {
  return apiJson(
    `/clusters/${args.clusterId}/catalog/${encodeURIComponent(args.slug)}`,
    withFetch$4(opts, { method: "GET" })
  );
}
async function syncCatalog(opts) {
  return apiJson(
    "/catalog/sync",
    withFetch$4(opts, { method: "POST" })
  );
}
const catalogModule = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  getCatalogEntry,
  listCatalog,
  syncCatalog
}, Symbol.toStringTag, { value: "Module" }));
function withFetch$3(opts, init) {
  if (!opts?.fetch) return init;
  return { ...init, _fetch: opts.fetch };
}
async function listNetworks(args, opts) {
  return apiJson(
    `/clusters/${args.clusterId}/networks`,
    withFetch$3(opts, { method: "GET" })
  );
}
async function getTeamNetworkScope(args, opts) {
  return apiJson(
    `/admin/teams/${args.teamId}/clusters/${args.clusterId}/networks`,
    withFetch$3(opts, { method: "GET" })
  );
}
async function setTeamNetworkScope(args, opts) {
  return apiJson(
    `/admin/teams/${args.teamId}/clusters/${args.clusterId}/networks`,
    withFetch$3(opts, { method: "PUT", body: { ...args.body } })
  );
}
const networksModule = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  getTeamNetworkScope,
  listNetworks,
  setTeamNetworkScope
}, Symbol.toStringTag, { value: "Module" }));
function withFetch$2(opts, init) {
  if (!opts?.fetch) return init;
  return { ...init, _fetch: opts.fetch };
}
async function listIsos(args, opts) {
  const qs = new URLSearchParams({ team_id: String(args.teamId), node: args.node });
  const res = await apiJson(
    `/clusters/${args.clusterId}/iso?${qs}`,
    withFetch$2(opts, { method: "GET" })
  );
  return res.isos;
}
async function listCloudImages(args, opts) {
  const res = await apiJson(
    `/clusters/${args.clusterId}/iso/cloud-images`,
    withFetch$2(opts, { method: "GET" })
  );
  return res.images;
}
async function downloadIso(args, opts) {
  return apiJson(
    `/clusters/${args.clusterId}/iso/download`,
    withFetch$2(opts, { method: "POST", body: { ...args.body } })
  );
}
const isoModule = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  downloadIso,
  listCloudImages,
  listIsos
}, Symbol.toStringTag, { value: "Module" }));
function withFetch$1(opts, init) {
  if (!opts?.fetch) return init;
  return { ...init, _fetch: opts.fetch };
}
async function mintVncProxy(args, opts) {
  const seg = args.kind === "lxc" ? "lxcs" : "vms";
  return apiJson(
    `/clusters/${args.clusterId}/${seg}/${args.vmid}/console/vncproxy`,
    withFetch$1(opts, { method: "POST" })
  );
}
const consoleModule = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  mintVncProxy
}, Symbol.toStringTag, { value: "Module" }));
function withFetch(opts, init) {
  if (!opts?.fetch) return init;
  return { ...init, _fetch: opts.fetch };
}
async function listNotifications(opts) {
  return apiJson("/notifications", withFetch(opts, { method: "GET" }));
}
async function markSeen(opts) {
  return apiJson(
    "/notifications/seen",
    withFetch(opts, { method: "POST" })
  );
}
const notificationsModule = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  listNotifications,
  markSeen
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
  quotas: quotasModule,
  jobs: jobsModule,
  lifecycle: lifecycleModule,
  provisioning: provisioningModule,
  catalog: catalogModule,
  networks: networksModule,
  iso: isoModule,
  console: consoleModule,
  notifications: notificationsModule
};

export { api as a };
//# sourceMappingURL=client2-FWmWn_B2.js.map
