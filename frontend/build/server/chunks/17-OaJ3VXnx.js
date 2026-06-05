import { redirect } from '@sveltejs/kit';
import { a as api } from './client2-FWmWn_B2.js';
import './api-By_nInf4.js';

const load = async ({ locals, url, fetch }) => {
  if (!locals.user) {
    const next = encodeURIComponent(url.pathname + url.search);
    throw redirect(303, `/login?next=${next}`);
  }
  try {
    const schedules = await api.lifecycle.listScheduledBackups({ fetch });
    return { user: locals.user, schedules, loadError: false };
  } catch {
    return { user: locals.user, schedules: [], loadError: true };
  }
};

var _page_server_ts = /*#__PURE__*/Object.freeze({
  __proto__: null,
  load: load
});

const index = 17;
let component_cache;
const component = async () => component_cache ??= (await import('./_page.svelte-Dk53fvcA.js')).default;
const server_id = "src/routes/backups/+page.server.ts";
const imports = ["_app/immutable/nodes/17.CoFH1520.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/Dz1QOFME.js","_app/immutable/chunks/DIeogL5L.js","_app/immutable/chunks/FWqmEuGW.js","_app/immutable/chunks/D05lJ7N6.js","_app/immutable/chunks/D1PT0PJt.js","_app/immutable/chunks/V0qHDq3T.js","_app/immutable/chunks/BLuQ-h8b.js","_app/immutable/chunks/BEbkK47e.js","_app/immutable/chunks/Bkp9Bvf2.js","_app/immutable/chunks/0vWx1Ok7.js","_app/immutable/chunks/DOYCa-jC.js","_app/immutable/chunks/BWtVFkZa.js","_app/immutable/chunks/BzDeVsP6.js","_app/immutable/chunks/DiruNafU.js","_app/immutable/chunks/BN7qKuWY.js","_app/immutable/chunks/CkHOVrVr.js","_app/immutable/chunks/CVq1OWDu.js","_app/immutable/chunks/CLnOhmYe.js","_app/immutable/chunks/CmMO8MZe.js","_app/immutable/chunks/KgF9d3BR.js","_app/immutable/chunks/BKsq3Otk.js"];
const stylesheets = [];
const fonts = [];

export { component, fonts, imports, index, _page_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=17-OaJ3VXnx.js.map
