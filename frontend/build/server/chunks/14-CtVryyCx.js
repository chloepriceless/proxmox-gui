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

const index = 14;
let component_cache;
const component = async () => component_cache ??= (await import('./_page.svelte-DAcIOqWN.js')).default;
const server_id = "src/routes/audit/+page.server.ts";
const imports = ["_app/immutable/nodes/14.CdGvBmQo.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/B76fPDHw.js","_app/immutable/chunks/DIeogL5L.js","_app/immutable/chunks/1_Ev5Rxk.js","_app/immutable/chunks/Cv6kQ42Y.js","_app/immutable/chunks/BZy2rKVh.js","_app/immutable/chunks/DG-AIyDW.js","_app/immutable/chunks/HtuQ-t6z.js","_app/immutable/chunks/DFf0_9oh.js","_app/immutable/chunks/B0O0__6X.js","_app/immutable/chunks/Da8-qn49.js","_app/immutable/chunks/BkYbJ__8.js","_app/immutable/chunks/DGAkiTgi.js","_app/immutable/chunks/Cmh71_M-.js","_app/immutable/chunks/DCpwOU7E.js","_app/immutable/chunks/C6ALetTt.js","_app/immutable/chunks/e5JljhQb.js","_app/immutable/chunks/Tjug4qrk.js","_app/immutable/chunks/gf1xWwEA.js","_app/immutable/chunks/DX6rZLP_.js","_app/immutable/chunks/CFTFTl3J.js","_app/immutable/chunks/KBDW0R29.js","_app/immutable/chunks/Dx6FHG0s.js","_app/immutable/chunks/69_IOA4Y.js","_app/immutable/chunks/Beh3eMVO.js","_app/immutable/chunks/C9dUKBca.js","_app/immutable/chunks/CmYxEM7h.js","_app/immutable/chunks/DehlN6xb.js","_app/immutable/chunks/BjvSsvRu.js","_app/immutable/chunks/SaooNa5r.js","_app/immutable/chunks/CmkDz7us.js","_app/immutable/chunks/DaMzvvl3.js","_app/immutable/chunks/3e5_4EXJ.js","_app/immutable/chunks/CbiA0b_9.js","_app/immutable/chunks/DSnCMneG.js","_app/immutable/chunks/CxBXpsTP.js","_app/immutable/chunks/DMY-2uJ3.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/CGcfMLRt.js","_app/immutable/chunks/kMNdv31G.js"];
const stylesheets = [];
const fonts = [];

export { component, fonts, imports, index, _page_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=14-CtVryyCx.js.map
