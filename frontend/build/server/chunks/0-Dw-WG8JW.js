import { redirect } from '@sveltejs/kit';
import { a as api } from './client2-WJrlUD72.js';

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
const component = async () => component_cache ??= (await import('./_layout.svelte-cpdBCVm_.js')).default;
const server_id = "src/routes/+layout.server.ts";
const imports = ["_app/immutable/nodes/0.C0cPfRV9.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/Cmh71_M-.js","_app/immutable/chunks/B76fPDHw.js","_app/immutable/chunks/DIeogL5L.js","_app/immutable/chunks/1_Ev5Rxk.js","_app/immutable/chunks/Cv6kQ42Y.js","_app/immutable/chunks/DG-AIyDW.js","_app/immutable/chunks/HtuQ-t6z.js","_app/immutable/chunks/DFf0_9oh.js","_app/immutable/chunks/Da8-qn49.js","_app/immutable/chunks/C0jgbGGP.js","_app/immutable/chunks/Du75oJPC.js","_app/immutable/chunks/DH5X63wM.js","_app/immutable/chunks/BkYbJ__8.js","_app/immutable/chunks/B0O0__6X.js","_app/immutable/chunks/BZy2rKVh.js","_app/immutable/chunks/CmoxhcTY.js","_app/immutable/chunks/irNS9udM.js","_app/immutable/chunks/CMQyX1cW.js","_app/immutable/chunks/CFMgycCt.js","_app/immutable/chunks/2Aij0Weq.js","_app/immutable/chunks/Brfayfu2.js","_app/immutable/chunks/e5JljhQb.js","_app/immutable/chunks/Tjug4qrk.js","_app/immutable/chunks/gf1xWwEA.js","_app/immutable/chunks/C6ALetTt.js","_app/immutable/chunks/DX6rZLP_.js","_app/immutable/chunks/CFTFTl3J.js","_app/immutable/chunks/Brr_OKOa.js","_app/immutable/chunks/69_IOA4Y.js","_app/immutable/chunks/Beh3eMVO.js","_app/immutable/chunks/KBDW0R29.js","_app/immutable/chunks/DWMSRsl4.js","_app/immutable/chunks/Ce_j8yZB.js","_app/immutable/chunks/CmYxEM7h.js","_app/immutable/chunks/lC3J6yHt.js","_app/immutable/chunks/vZ-i5BTB.js","_app/immutable/chunks/DMY-2uJ3.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/kMNdv31G.js","_app/immutable/chunks/CSpF5A54.js","_app/immutable/chunks/BkPKArPq.js","_app/immutable/chunks/SaooNa5r.js","_app/immutable/chunks/3e5_4EXJ.js","_app/immutable/chunks/BAwm5wUc.js","_app/immutable/chunks/Caj_lD0O.js","_app/immutable/chunks/dYsEJFvI.js","_app/immutable/chunks/-F8ZGLZK.js","_app/immutable/chunks/B7oWRHuv.js","_app/immutable/chunks/BXdBUgbY.js","_app/immutable/chunks/BbKbShp8.js"];
const stylesheets = ["_app/immutable/assets/0.8ef1sw-v.css"];
const fonts = ["_app/immutable/assets/Inter-Variable.DiVDrmQJ.woff2"];

export { component, fonts, imports, index, _layout_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=0-Dw-WG8JW.js.map
