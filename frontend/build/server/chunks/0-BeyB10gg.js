import { redirect } from '@sveltejs/kit';
import { a as api } from './client2-FWmWn_B2.js';
import './api-By_nInf4.js';

const SETUP_PREFIX = "/setup";
const LOGIN_PATH = "/login";
function isSetupRoute(pathname) {
  return pathname === SETUP_PREFIX || pathname.startsWith(`${SETUP_PREFIX}/`);
}
function isLoginRoute(pathname) {
  return pathname === LOGIN_PATH || pathname.startsWith(`${LOGIN_PATH}/`);
}
const load = async ({ fetch, url }) => {
  const setupStatus = await api.setup.status({ fetch });
  const apiReachable = setupStatus !== null;
  if (setupStatus?.no_admin_yet) {
    if (!isSetupRoute(url.pathname)) {
      throw redirect(303, "/setup");
    }
    return { user: null, setupNeeded: true, apiReachable, clusters: [] };
  }
  const user = apiReachable ? await api.me.get({ fetch }) : null;
  if (user === null) {
    if (!isLoginRoute(url.pathname) && !isSetupRoute(url.pathname)) {
      const next = url.pathname + url.search;
      const search = next === "/" ? "" : `?next=${encodeURIComponent(next)}`;
      throw redirect(303, `${LOGIN_PATH}${search}`);
    }
    return { user: null, setupNeeded: false, apiReachable, clusters: [] };
  }
  let clusters = [];
  try {
    const clusterList = await api.clusters.list({ fetch });
    clusters = clusterList.map((c) => ({ id: c.id, name: c.name }));
  } catch {
    clusters = [];
  }
  return { user, setupNeeded: false, apiReachable, clusters };
};

var _layout_server_ts = /*#__PURE__*/Object.freeze({
  __proto__: null,
  load: load
});

const index = 0;
let component_cache;
const component = async () => component_cache ??= (await import('./_layout.svelte-B7VNHKZ4.js')).default;
const server_id = "src/routes/+layout.server.ts";
const imports = ["_app/immutable/nodes/0.C6UW86aL.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/CkHOVrVr.js","_app/immutable/chunks/Dz1QOFME.js","_app/immutable/chunks/DIeogL5L.js","_app/immutable/chunks/FWqmEuGW.js","_app/immutable/chunks/D05lJ7N6.js","_app/immutable/chunks/DOYCa-jC.js","_app/immutable/chunks/BWtVFkZa.js","_app/immutable/chunks/D1PT0PJt.js","_app/immutable/chunks/V0qHDq3T.js","_app/immutable/chunks/BEbkK47e.js","_app/immutable/chunks/BnecOcTy.js","_app/immutable/chunks/BHFuJqpS.js","_app/immutable/chunks/D0S7EkDK.js","_app/immutable/chunks/0vWx1Ok7.js","_app/immutable/chunks/BLuQ-h8b.js","_app/immutable/chunks/Bkp9Bvf2.js","_app/immutable/chunks/ByKwoKRa.js","_app/immutable/chunks/DeMueevT.js","_app/immutable/chunks/BzDeVsP6.js","_app/immutable/chunks/uGX2Zfj8.js","_app/immutable/chunks/KgF9d3BR.js","_app/immutable/chunks/DzNQdqtF.js","_app/immutable/chunks/Ch2cpRvR.js","_app/immutable/chunks/DVfxaIax.js","_app/immutable/chunks/nLFAuVns.js","_app/immutable/chunks/YTKhnm1F.js","_app/immutable/chunks/PbjDttTu.js","_app/immutable/chunks/BM8cuwzl.js","_app/immutable/chunks/Cm0_jSID.js","_app/immutable/chunks/CLnOhmYe.js","_app/immutable/chunks/DX6rZLP_.js","_app/immutable/chunks/BHzRzDuM.js","_app/immutable/chunks/Bjy7N-1Z.js","_app/immutable/chunks/BybhHQDJ.js","_app/immutable/chunks/B5LKCUWQ.js","_app/immutable/chunks/MmXwFXPw.js","_app/immutable/chunks/69_IOA4Y.js","_app/immutable/chunks/C9koXsUJ.js","_app/immutable/chunks/CIeWdfCN.js","_app/immutable/chunks/jOSrxZVU.js","_app/immutable/chunks/D_4E1sb_.js","_app/immutable/chunks/CSuFVlI8.js","_app/immutable/chunks/Cvinc6lT.js","_app/immutable/chunks/BqK01NXd.js","_app/immutable/chunks/DMxHxQob.js","_app/immutable/chunks/CiRzWSu_.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/BDN8t5bm.js","_app/immutable/chunks/DIJ6X1Rv.js","_app/immutable/chunks/BKsq3Otk.js","_app/immutable/chunks/DoZTJyNP.js","_app/immutable/chunks/CVgbUHPo.js","_app/immutable/chunks/fusRndV3.js","_app/immutable/chunks/BfZHOyn8.js","_app/immutable/chunks/BNPJ3329.js","_app/immutable/chunks/5HG34pHC.js","_app/immutable/chunks/BMhCvoyS.js"];
const stylesheets = ["_app/immutable/assets/0.Caql5m_w.css"];
const fonts = ["_app/immutable/assets/Inter-Variable.DiVDrmQJ.woff2"];

export { component, fonts, imports, index, _layout_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=0-BeyB10gg.js.map
