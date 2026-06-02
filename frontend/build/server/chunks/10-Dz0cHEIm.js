import { redirect } from '@sveltejs/kit';
import { a as api } from './client2-FWmWn_B2.js';
import './api-By_nInf4.js';

const load = async ({ locals, url, fetch }) => {
  if (!locals.user) {
    const next = encodeURIComponent(url.pathname + url.search);
    throw redirect(303, `/login?next=${next}`);
  }
  if (!locals.user.is_admin) {
    throw redirect(303, "/");
  }
  try {
    const teams = await api.teams.list({ fetch });
    return { user: locals.user, teams, loadError: false };
  } catch {
    return { user: locals.user, teams: [], loadError: true };
  }
};

var _page_server_ts = /*#__PURE__*/Object.freeze({
  __proto__: null,
  load: load
});

const index = 10;
let component_cache;
const component = async () => component_cache ??= (await import('./_page.svelte-Bg616hbV.js')).default;
const server_id = "src/routes/admin/teams/+page.server.ts";
const imports = ["_app/immutable/nodes/10.C_GN4ZkJ.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/CkHOVrVr.js","_app/immutable/chunks/Dz1QOFME.js","_app/immutable/chunks/DIeogL5L.js","_app/immutable/chunks/FWqmEuGW.js","_app/immutable/chunks/D05lJ7N6.js","_app/immutable/chunks/D1PT0PJt.js","_app/immutable/chunks/V0qHDq3T.js","_app/immutable/chunks/BLuQ-h8b.js","_app/immutable/chunks/BEbkK47e.js","_app/immutable/chunks/Bkp9Bvf2.js","_app/immutable/chunks/0vWx1Ok7.js","_app/immutable/chunks/DOYCa-jC.js","_app/immutable/chunks/BWtVFkZa.js","_app/immutable/chunks/BzDeVsP6.js","_app/immutable/chunks/DiruNafU.js","_app/immutable/chunks/BHFuJqpS.js","_app/immutable/chunks/CLnOhmYe.js","_app/immutable/chunks/BAI7ug_o.js","_app/immutable/chunks/CVq1OWDu.js","_app/immutable/chunks/CWg6qSpM.js","_app/immutable/chunks/BDN8t5bm.js"];
const stylesheets = [];
const fonts = [];

export { component, fonts, imports, index, _page_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=10-Dz0cHEIm.js.map
