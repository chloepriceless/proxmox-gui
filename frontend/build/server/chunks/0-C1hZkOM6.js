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
const component = async () => component_cache ??= (await import('./_layout.svelte-BnYfsx_m.js')).default;
const server_id = "src/routes/+layout.server.ts";
const imports = ["_app/immutable/nodes/0.QNdH4REp.js","_app/immutable/chunks/kSsaFjxf.js","_app/immutable/chunks/8Q54h-zb.js","_app/immutable/chunks/Cpaoj_V7.js","_app/immutable/chunks/DhdLFye8.js","_app/immutable/chunks/Cr-q87Tu.js","_app/immutable/chunks/Cr6JEVsd.js","_app/immutable/chunks/BanPfVL4.js","_app/immutable/chunks/B8q5y6JZ.js","_app/immutable/chunks/kjIi5wpe.js","_app/immutable/chunks/BYsOGmcf.js","_app/immutable/chunks/DYa5Zg-7.js","_app/immutable/chunks/BxxFkhu7.js","_app/immutable/chunks/Du1eGV_S.js","_app/immutable/chunks/D1ZTAtSI.js","_app/immutable/chunks/sMgIYs0m.js","_app/immutable/chunks/CVwKji1V.js","_app/immutable/chunks/CjG3KYa8.js","_app/immutable/chunks/DPhlvvxk.js","_app/immutable/chunks/DiCuuEi6.js","_app/immutable/chunks/DX6rZLP_.js","_app/immutable/chunks/BsvYabiT.js","_app/immutable/chunks/BwI86FTS.js","_app/immutable/chunks/BhguS1DR.js","_app/immutable/chunks/Ccmicir1.js","_app/immutable/chunks/BPfKPa1_.js","_app/immutable/chunks/DBQQ19gE.js","_app/immutable/chunks/B2CX1UO4.js","_app/immutable/chunks/BM4R31_8.js","_app/immutable/chunks/CvjJxdq9.js","_app/immutable/chunks/rZsgLI0O.js","_app/immutable/chunks/BZaIOe1W.js","_app/immutable/chunks/D3X6iaz6.js","_app/immutable/chunks/C3w8NTMF.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/DmHOGX6j.js","_app/immutable/chunks/DgsMve4N.js"];
const stylesheets = ["_app/immutable/assets/0.DacwK6a5.css"];
const fonts = ["_app/immutable/assets/Inter-Variable.DiVDrmQJ.woff2"];

export { component, fonts, imports, index, _layout_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=0-C1hZkOM6.js.map
