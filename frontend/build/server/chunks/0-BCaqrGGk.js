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
const component = async () => component_cache ??= (await import('./_layout.svelte-Bu6nN8NH.js')).default;
const server_id = "src/routes/+layout.server.ts";
const imports = ["_app/immutable/nodes/0.DB1c5o7s.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/DROBfb48.js","_app/immutable/chunks/RR2SEOsk.js","_app/immutable/chunks/DIeogL5L.js","_app/immutable/chunks/s3yjbAhm.js","_app/immutable/chunks/Cxcrlh5n.js","_app/immutable/chunks/CtxHTuXR.js","_app/immutable/chunks/D64NQve6.js","_app/immutable/chunks/MZ9IL_0X.js","_app/immutable/chunks/D5aDoj7M.js","_app/immutable/chunks/XXrISPRp.js","_app/immutable/chunks/-xA_ljcr.js","_app/immutable/chunks/C65twzK6.js","_app/immutable/chunks/DZg9MFjN.js","_app/immutable/chunks/BlTd84kF.js","_app/immutable/chunks/BS4mR_6-.js","_app/immutable/chunks/BzqC8FgQ.js","_app/immutable/chunks/CemO2Jyd.js","_app/immutable/chunks/BpeGkFft.js","_app/immutable/chunks/Drzg6HrL.js","_app/immutable/chunks/C-HwgIk_.js","_app/immutable/chunks/DworOeMO.js","_app/immutable/chunks/DMnEFB5-.js","_app/immutable/chunks/CdUgkO0U.js","_app/immutable/chunks/BsXubLQ0.js","_app/immutable/chunks/DXdao7Dl.js","_app/immutable/chunks/B-_TOQoo.js","_app/immutable/chunks/Cnxr7g58.js","_app/immutable/chunks/DX6rZLP_.js","_app/immutable/chunks/BVd6eqLD.js","_app/immutable/chunks/UZHiAZkH.js","_app/immutable/chunks/vG5W5MrS.js","_app/immutable/chunks/C_brZbnu.js","_app/immutable/chunks/D0wBRbAx.js","_app/immutable/chunks/69_IOA4Y.js","_app/immutable/chunks/BDthO0oC.js","_app/immutable/chunks/ib89QPY-.js","_app/immutable/chunks/CPjW97WW.js","_app/immutable/chunks/D1rdV2l6.js","_app/immutable/chunks/BuexN0M3.js","_app/immutable/chunks/3uAMLWE4.js","_app/immutable/chunks/AuB2X62Y.js","_app/immutable/chunks/Da_1-pxj.js","_app/immutable/chunks/DMY-2uJ3.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/LE3FM59i.js","_app/immutable/chunks/DByFSPPP.js","_app/immutable/chunks/Dm85_Df2.js","_app/immutable/chunks/D--Jdt90.js","_app/immutable/chunks/CZh8055f.js","_app/immutable/chunks/TacstRM6.js","_app/immutable/chunks/B_qRnoTm.js","_app/immutable/chunks/BwxoLkxg.js","_app/immutable/chunks/Cx3Lny5_.js"];
const stylesheets = ["_app/immutable/assets/0.DJrnwqai.css"];
const fonts = ["_app/immutable/assets/Inter-Variable.DiVDrmQJ.woff2"];

export { component, fonts, imports, index, _layout_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=0-BCaqrGGk.js.map
