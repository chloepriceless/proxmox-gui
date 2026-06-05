import { redirect } from '@sveltejs/kit';
import { a as api } from './client2-FWmWn_B2.js';
import './api-By_nInf4.js';

function parseFilters(url) {
  const sp = url.searchParams;
  const list = (k) => {
    const v = sp.get(k);
    return v ? v.split(",").filter(Boolean) : void 0;
  };
  return {
    from: sp.get("from") ?? void 0,
    to: sp.get("to") ?? void 0,
    action: list("action"),
    user_id: sp.get("user_id") ? Number(sp.get("user_id")) : void 0,
    target_type: list("type"),
    vmid: sp.get("vmid") ? Number(sp.get("vmid")) : void 0,
    cluster_id: sp.get("cluster_id") ? Number(sp.get("cluster_id")) : void 0,
    show_team_actions: sp.get("show_team_actions") === "1" || sp.get("show_team_actions") === "true",
    page: sp.get("page") ? Number(sp.get("page")) : 1,
    page_size: 50
  };
}
const load = async ({ locals, url, fetch }) => {
  if (!locals.user) {
    const next = encodeURIComponent(url.pathname + url.search);
    throw redirect(303, `/login?next=${next}`);
  }
  const filters = parseFilters(url);
  try {
    const page = await api.audit.list({ filters }, { fetch });
    return { user: locals.user, page, filters, loadError: false };
  } catch {
    return {
      user: locals.user,
      page: { rows: [], total: 0, page: 1, page_size: 50 },
      filters,
      loadError: true
    };
  }
};

var _page_server_ts = /*#__PURE__*/Object.freeze({
  __proto__: null,
  load: load
});

const index = 16;
let component_cache;
const component = async () => component_cache ??= (await import('./_page.svelte-B0l0UcVP.js')).default;
const server_id = "src/routes/audit/+page.server.ts";
const imports = ["_app/immutable/nodes/16.C7atc4C-.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/CkHOVrVr.js","_app/immutable/chunks/Dz1QOFME.js","_app/immutable/chunks/DIeogL5L.js","_app/immutable/chunks/FWqmEuGW.js","_app/immutable/chunks/D05lJ7N6.js","_app/immutable/chunks/DOYCa-jC.js","_app/immutable/chunks/BWtVFkZa.js","_app/immutable/chunks/D1PT0PJt.js","_app/immutable/chunks/V0qHDq3T.js","_app/immutable/chunks/BLuQ-h8b.js","_app/immutable/chunks/BEbkK47e.js","_app/immutable/chunks/Bkp9Bvf2.js","_app/immutable/chunks/0vWx1Ok7.js","_app/immutable/chunks/BzDeVsP6.js","_app/immutable/chunks/BN7qKuWY.js","_app/immutable/chunks/Ci4YN2dC.js","_app/immutable/chunks/Cm0_jSID.js","_app/immutable/chunks/CLnOhmYe.js","_app/immutable/chunks/YTKhnm1F.js","_app/immutable/chunks/PbjDttTu.js","_app/immutable/chunks/BM8cuwzl.js","_app/immutable/chunks/DX6rZLP_.js","_app/immutable/chunks/BHzRzDuM.js","_app/immutable/chunks/jOSrxZVU.js","_app/immutable/chunks/BfbWwwt1.js","_app/immutable/chunks/69_IOA4Y.js","_app/immutable/chunks/C9koXsUJ.js","_app/immutable/chunks/BZQjfy36.js","_app/immutable/chunks/Cvinc6lT.js","_app/immutable/chunks/BMhCvoyS.js","_app/immutable/chunks/CKoIbHhL.js","_app/immutable/chunks/MmXwFXPw.js","_app/immutable/chunks/DP7xhTtP.js","_app/immutable/chunks/CVq1OWDu.js","_app/immutable/chunks/DIJ6X1Rv.js","_app/immutable/chunks/BAI7ug_o.js","_app/immutable/chunks/BFscmzoS.js","_app/immutable/chunks/B0_wZjZN.js","_app/immutable/chunks/DeMueevT.js","_app/immutable/chunks/CiRzWSu_.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/C3XrmSLs.js","_app/immutable/chunks/BDN8t5bm.js"];
const stylesheets = [];
const fonts = [];

export { component, fonts, imports, index, _page_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=16-Der0aSVF.js.map
