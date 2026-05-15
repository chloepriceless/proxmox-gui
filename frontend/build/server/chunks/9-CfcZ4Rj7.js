import { redirect, error } from '@sveltejs/kit';
import { a as api, A as ApiError } from './client2-vvZGy19D.js';

const load = async ({ locals, params, url, fetch }) => {
  if (!locals.user) {
    const next = encodeURIComponent(url.pathname + url.search);
    throw redirect(303, `/login?next=${next}`);
  }
  if (!locals.user.is_admin) {
    throw redirect(303, "/");
  }
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) {
    throw error(404, "User not found");
  }
  try {
    const target = await api.users.get({ id }, { fetch });
    let teams = [];
    try {
      teams = await api.teams.list({ fetch });
    } catch {
      teams = [];
    }
    return { user: locals.user, target, teams };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      throw error(404, "User not found");
    }
    throw error(500, "Could not load user");
  }
};

var _page_server_ts = /*#__PURE__*/Object.freeze({
  __proto__: null,
  load: load
});

const index = 9;
let component_cache;
const component = async () => component_cache ??= (await import('./_page.svelte-cQlhCwQJ.js')).default;
const server_id = "src/routes/admin/users/[id]/+page.server.ts";
const imports = ["_app/immutable/nodes/9.C22xi4fx.js","_app/immutable/chunks/kSsaFjxf.js","_app/immutable/chunks/8Q54h-zb.js","_app/immutable/chunks/D1ZTAtSI.js","_app/immutable/chunks/Cr6JEVsd.js","_app/immutable/chunks/BanPfVL4.js","_app/immutable/chunks/Du1eGV_S.js","_app/immutable/chunks/B8q5y6JZ.js","_app/immutable/chunks/BxxFkhu7.js","_app/immutable/chunks/DhdLFye8.js","_app/immutable/chunks/Cr-q87Tu.js","_app/immutable/chunks/DT8vi1U8.js","_app/immutable/chunks/CLaOwPZH.js","_app/immutable/chunks/Cpaoj_V7.js","_app/immutable/chunks/D3X6iaz6.js","_app/immutable/chunks/UsEaE9d9.js","_app/immutable/chunks/__4kodT9.js","_app/immutable/chunks/CNrV3U9r.js","_app/immutable/chunks/BOj9pCku.js","_app/immutable/chunks/D_bRkq8V.js","_app/immutable/chunks/HwuRrUyr.js","_app/immutable/chunks/DiCuuEi6.js","_app/immutable/chunks/BhguS1DR.js","_app/immutable/chunks/BKdQ7m5y.js","_app/immutable/chunks/BM4R31_8.js","_app/immutable/chunks/DX6rZLP_.js","_app/immutable/chunks/D6DkEh41.js","_app/immutable/chunks/B2CX1UO4.js","_app/immutable/chunks/DBQQ19gE.js","_app/immutable/chunks/BBeLsFdq.js","_app/immutable/chunks/CvyRKL9b.js","_app/immutable/chunks/DgsMve4N.js","_app/immutable/chunks/UVOmlu3o.js","_app/immutable/chunks/rZsgLI0O.js","_app/immutable/chunks/DPhlvvxk.js","_app/immutable/chunks/Cw23Rtpp.js","_app/immutable/chunks/C3w8NTMF.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/rbHrO_E8.js","_app/immutable/chunks/DmHOGX6j.js"];
const stylesheets = [];
const fonts = [];

export { component, fonts, imports, index, _page_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=9-CfcZ4Rj7.js.map
