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
const imports = ["_app/immutable/nodes/0.QebxFTN_.js","_app/immutable/chunks/CMT2gXTl.js","_app/immutable/chunks/nMe2PDh0.js","_app/immutable/chunks/CYy-j-nn.js","_app/immutable/chunks/B8oe2iq3.js","_app/immutable/chunks/DMbBZyaY.js","_app/immutable/chunks/2EOrEV4J.js","_app/immutable/chunks/D0scdGz7.js","_app/immutable/chunks/COMVsDF6.js","_app/immutable/chunks/DNJSSTD3.js","_app/immutable/chunks/BPUTH6z7.js","_app/immutable/chunks/CIWDlivB.js","_app/immutable/chunks/Dj2AhZJ6.js","_app/immutable/chunks/BvIrdU2Z.js","_app/immutable/chunks/CERU589C.js","_app/immutable/chunks/BUi5cdfG.js","_app/immutable/chunks/k33SYnwO.js","_app/immutable/chunks/Basa6-iB.js","_app/immutable/chunks/DNayJybw.js","_app/immutable/chunks/q8K2smeH.js","_app/immutable/chunks/D-HtDwqB.js","_app/immutable/chunks/DX6rZLP_.js","_app/immutable/chunks/njJjZ6u3.js","_app/immutable/chunks/CclbWlWt.js","_app/immutable/chunks/9RgIyoY-.js","_app/immutable/chunks/BrdvnNnr.js","_app/immutable/chunks/Dnj1o9UR.js","_app/immutable/chunks/DyITn7Vu.js","_app/immutable/chunks/HxF7MWIb.js","_app/immutable/chunks/-sIcaygn.js","_app/immutable/chunks/C9Zkd1y4.js","_app/immutable/chunks/D3T5qvDm.js","_app/immutable/chunks/BzkMVAVa.js","_app/immutable/chunks/e6sNuQvl.js","_app/immutable/chunks/C3w8NTMF.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/DR-izm2S.js","_app/immutable/chunks/BvenazgL.js"];
const stylesheets = ["_app/immutable/assets/0.Cx_uca7c.css"];
const fonts = ["_app/immutable/assets/Inter-Variable.DiVDrmQJ.woff2"];

export { component, fonts, imports, index, _layout_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=0-DgxFGFhF.js.map
