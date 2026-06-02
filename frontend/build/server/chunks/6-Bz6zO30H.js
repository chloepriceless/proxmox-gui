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
    const clusters = await api.clusters.list({ fetch });
    return { user: locals.user, clusters, loadError: false };
  } catch {
    return { user: locals.user, clusters: [], loadError: true };
  }
};

var _page_server_ts = /*#__PURE__*/Object.freeze({
  __proto__: null,
  load: load
});

const index = 6;
let component_cache;
const component = async () => component_cache ??= (await import('./_page.svelte-BV_sVHpF.js')).default;
const server_id = "src/routes/admin/clusters/+page.server.ts";
const imports = ["_app/immutable/nodes/6.Bq8z3rqS.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/CkHOVrVr.js","_app/immutable/chunks/Dz1QOFME.js","_app/immutable/chunks/DIeogL5L.js","_app/immutable/chunks/FWqmEuGW.js","_app/immutable/chunks/D05lJ7N6.js","_app/immutable/chunks/D1PT0PJt.js","_app/immutable/chunks/V0qHDq3T.js","_app/immutable/chunks/BLuQ-h8b.js","_app/immutable/chunks/BEbkK47e.js","_app/immutable/chunks/Bkp9Bvf2.js","_app/immutable/chunks/0vWx1Ok7.js","_app/immutable/chunks/DOYCa-jC.js","_app/immutable/chunks/BWtVFkZa.js","_app/immutable/chunks/BzDeVsP6.js","_app/immutable/chunks/DiruNafU.js","_app/immutable/chunks/BHFuJqpS.js","_app/immutable/chunks/CLnOhmYe.js","_app/immutable/chunks/BAI7ug_o.js","_app/immutable/chunks/CVq1OWDu.js","_app/immutable/chunks/YTKhnm1F.js","_app/immutable/chunks/PbjDttTu.js","_app/immutable/chunks/BM8cuwzl.js","_app/immutable/chunks/Cm0_jSID.js","_app/immutable/chunks/DX6rZLP_.js","_app/immutable/chunks/BHzRzDuM.js","_app/immutable/chunks/Bjy7N-1Z.js","_app/immutable/chunks/DED-Im-D.js","_app/immutable/chunks/Dp9GAd6J.js","_app/immutable/chunks/B5LKCUWQ.js","_app/immutable/chunks/BMhCvoyS.js","_app/immutable/chunks/1B9DwrM1.js","_app/immutable/chunks/DhGnAx7r.js","_app/immutable/chunks/fusRndV3.js","_app/immutable/chunks/CiRzWSu_.js","_app/immutable/chunks/DeMueevT.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/BDN8t5bm.js","_app/immutable/chunks/CWg6qSpM.js","_app/immutable/chunks/B7To-JRC.js"];
const stylesheets = [];
const fonts = [];

export { component, fonts, imports, index, _page_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=6-Bz6zO30H.js.map
