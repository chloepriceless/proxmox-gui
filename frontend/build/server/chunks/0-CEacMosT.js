import { redirect } from '@sveltejs/kit';
import { a as api } from './client2-vvZGy19D.js';

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
const component = async () => component_cache ??= (await import('./_layout.svelte-DbbNfcA8.js')).default;
const server_id = "src/routes/+layout.server.ts";
const imports = ["_app/immutable/nodes/0.BJ8MSKsj.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/DIFdNeux.js","_app/immutable/chunks/DtgIT0Nk.js","_app/immutable/chunks/DIeogL5L.js","_app/immutable/chunks/CYGcQVzr.js","_app/immutable/chunks/BX9zuvTI.js","_app/immutable/chunks/Bx2UN8uz.js","_app/immutable/chunks/wDcso0V5.js","_app/immutable/chunks/BjBfRCTG.js","_app/immutable/chunks/IGP5Wxuu.js","_app/immutable/chunks/DoJuxm4-.js","_app/immutable/chunks/C41prowm.js","_app/immutable/chunks/wPj4Jbx9.js","_app/immutable/chunks/C9-TIUVJ.js","_app/immutable/chunks/VBX2TTCL.js","_app/immutable/chunks/eg3AwEJ4.js","_app/immutable/chunks/Dqha2pZG.js","_app/immutable/chunks/DW38_v_t.js","_app/immutable/chunks/Cl_WtxYR.js","_app/immutable/chunks/DxYeJU7q.js","_app/immutable/chunks/BfYloIzP.js","_app/immutable/chunks/DX6rZLP_.js","_app/immutable/chunks/Dbi-q6K0.js","_app/immutable/chunks/BjGsnwAT.js","_app/immutable/chunks/69_IOA4Y.js","_app/immutable/chunks/CKSBknU8.js","_app/immutable/chunks/qHJ1jtrh.js","_app/immutable/chunks/Ds90VJYb.js","_app/immutable/chunks/DmYsQdH5.js","_app/immutable/chunks/SNMxVn7f.js","_app/immutable/chunks/CghoW6jw.js","_app/immutable/chunks/Bo0LVusD.js","_app/immutable/chunks/DsF8yCE9.js","_app/immutable/chunks/CnkkOk4e.js","_app/immutable/chunks/D8VB7bmC.js","_app/immutable/chunks/C3w8NTMF.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/CoiN2_Uy.js","_app/immutable/chunks/D9EM1o3c.js"];
const stylesheets = ["_app/immutable/assets/0.Cx_uca7c.css"];
const fonts = ["_app/immutable/assets/Inter-Variable.DiVDrmQJ.woff2"];

export { component, fonts, imports, index, _layout_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=0-CEacMosT.js.map
