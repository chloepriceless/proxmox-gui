import { redirect } from '@sveltejs/kit';
import { a as api } from './client2-FWmWn_B2.js';
import './api-By_nInf4.js';

const load = async ({ locals, url, fetch }) => {
  if (!locals.user) {
    const next = encodeURIComponent(url.pathname + url.search);
    throw redirect(303, `/login?next=${next}`);
  }
  try {
    const inventory = await api.inventory.listAll({ fetch });
    const clusters = inventory.map((c) => ({
      id: c.cluster_id,
      name: c.cluster_name,
      status: c.cluster_status,
      is_stale: c.is_stale
    }));
    return { user: locals.user, clusters, loadError: false };
  } catch {
    return { user: locals.user, clusters: [], loadError: true };
  }
};

var _page_server_ts = /*#__PURE__*/Object.freeze({
  __proto__: null,
  load: load
});

const index = 19;
let component_cache;
const component = async () => component_cache ??= (await import('./_page.svelte-BNMmjURL.js')).default;
const server_id = "src/routes/create/+page.server.ts";
const imports = ["_app/immutable/nodes/19.B-JURzxq.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/Dz1QOFME.js","_app/immutable/chunks/DIeogL5L.js","_app/immutable/chunks/FWqmEuGW.js","_app/immutable/chunks/D05lJ7N6.js","_app/immutable/chunks/D1PT0PJt.js","_app/immutable/chunks/V0qHDq3T.js","_app/immutable/chunks/BzDeVsP6.js","_app/immutable/chunks/DiruNafU.js","_app/immutable/chunks/BN7qKuWY.js","_app/immutable/chunks/CkHOVrVr.js","_app/immutable/chunks/BWtVFkZa.js","_app/immutable/chunks/Dp9GAd6J.js","_app/immutable/chunks/0vWx1Ok7.js","_app/immutable/chunks/DOYCa-jC.js","_app/immutable/chunks/BEbkK47e.js","_app/immutable/chunks/DX6rZLP_.js","_app/immutable/chunks/B5LKCUWQ.js","_app/immutable/chunks/Bkp9Bvf2.js","_app/immutable/chunks/Cm0_jSID.js","_app/immutable/chunks/CLnOhmYe.js","_app/immutable/chunks/BM8cuwzl.js","_app/immutable/chunks/PbjDttTu.js","_app/immutable/chunks/DIJ6X1Rv.js","_app/immutable/chunks/BLuQ-h8b.js","_app/immutable/chunks/MmXwFXPw.js","_app/immutable/chunks/DMxHxQob.js","_app/immutable/chunks/C4yxh-Fi.js","_app/immutable/chunks/CcCbbweH.js","_app/immutable/chunks/69_IOA4Y.js","_app/immutable/chunks/C9koXsUJ.js","_app/immutable/chunks/BZQjfy36.js","_app/immutable/chunks/Cvinc6lT.js","_app/immutable/chunks/D_4E1sb_.js","_app/immutable/chunks/CSuFVlI8.js","_app/immutable/chunks/BAI7ug_o.js","_app/immutable/chunks/BybhHQDJ.js","_app/immutable/chunks/iSi4Pzi1.js","_app/immutable/chunks/BMhCvoyS.js","_app/immutable/chunks/CiRzWSu_.js","_app/immutable/chunks/DeMueevT.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/DVfxaIax.js","_app/immutable/chunks/BfZHOyn8.js","_app/immutable/chunks/D8nahQwp.js","_app/immutable/chunks/BHzRzDuM.js","_app/immutable/chunks/B0_wZjZN.js","_app/immutable/chunks/CjW_xI9i.js","_app/immutable/chunks/DoZTJyNP.js","_app/immutable/chunks/BFscmzoS.js","_app/immutable/chunks/jOSrxZVU.js","_app/immutable/chunks/BfbWwwt1.js","_app/immutable/chunks/CDp3X21l.js","_app/immutable/chunks/CVq1OWDu.js","_app/immutable/chunks/CmMO8MZe.js","_app/immutable/chunks/C3XrmSLs.js","_app/immutable/chunks/BDN8t5bm.js","_app/immutable/chunks/BgfYEq4a.js","_app/immutable/chunks/Bd0LP9d6.js","_app/immutable/chunks/BKsq3Otk.js"];
const stylesheets = ["_app/immutable/assets/select-trigger.CV-KWLNP.css"];
const fonts = [];

export { component, fonts, imports, index, _page_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=19-BX0MP3sI.js.map
