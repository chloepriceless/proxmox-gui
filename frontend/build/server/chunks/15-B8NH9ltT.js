import { redirect } from '@sveltejs/kit';
import { a as api } from './client2-WJrlUD72.js';

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

const index = 15;
let component_cache;
const component = async () => component_cache ??= (await import('./_page.svelte-BNsVH_RO.js')).default;
const server_id = "src/routes/audit/+page.server.ts";
const imports = ["_app/immutable/nodes/15.ikG0yI_o.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/RR2SEOsk.js","_app/immutable/chunks/DIeogL5L.js","_app/immutable/chunks/CtxHTuXR.js","_app/immutable/chunks/D64NQve6.js","_app/immutable/chunks/s3yjbAhm.js","_app/immutable/chunks/Cxcrlh5n.js","_app/immutable/chunks/MZ9IL_0X.js","_app/immutable/chunks/D5aDoj7M.js","_app/immutable/chunks/BS4mR_6-.js","_app/immutable/chunks/XXrISPRp.js","_app/immutable/chunks/BlTd84kF.js","_app/immutable/chunks/BzqC8FgQ.js","_app/immutable/chunks/C65twzK6.js","_app/immutable/chunks/DROBfb48.js","_app/immutable/chunks/-xA_ljcr.js","_app/immutable/chunks/B-_TOQoo.js","_app/immutable/chunks/Cnxr7g58.js","_app/immutable/chunks/CdUgkO0U.js","_app/immutable/chunks/BsXubLQ0.js","_app/immutable/chunks/DXdao7Dl.js","_app/immutable/chunks/DX6rZLP_.js","_app/immutable/chunks/BVd6eqLD.js","_app/immutable/chunks/CPjW97WW.js","_app/immutable/chunks/DKTwPRsf.js","_app/immutable/chunks/69_IOA4Y.js","_app/immutable/chunks/BDthO0oC.js","_app/immutable/chunks/ClFHqJz7.js","_app/immutable/chunks/3uAMLWE4.js","_app/immutable/chunks/Bmv0KEJ-.js","_app/immutable/chunks/AeamBCE7.js","_app/immutable/chunks/D0wBRbAx.js","_app/immutable/chunks/yJlkTJ-x.js","_app/immutable/chunks/CZ5WGE5_.js","_app/immutable/chunks/DByFSPPP.js","_app/immutable/chunks/V7XQyoWH.js","_app/immutable/chunks/DIHgtdlL.js","_app/immutable/chunks/JW-elGPO.js","_app/immutable/chunks/DMY-2uJ3.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/DQqwOzHM.js","_app/immutable/chunks/LE3FM59i.js"];
const stylesheets = [];
const fonts = [];

export { component, fonts, imports, index, _page_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=15-B8NH9ltT.js.map
