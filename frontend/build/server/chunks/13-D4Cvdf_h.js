import { redirect } from '@sveltejs/kit';
import { a as api } from './client2-vvZGy19D.js';

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

const index = 13;
let component_cache;
const component = async () => component_cache ??= (await import('./_page.svelte-Bs3NIJ78.js')).default;
const server_id = "src/routes/audit/+page.server.ts";
const imports = ["_app/immutable/nodes/13.Cv2unizr.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/DtgIT0Nk.js","_app/immutable/chunks/DIeogL5L.js","_app/immutable/chunks/CYGcQVzr.js","_app/immutable/chunks/BX9zuvTI.js","_app/immutable/chunks/VBX2TTCL.js","_app/immutable/chunks/Bx2UN8uz.js","_app/immutable/chunks/wDcso0V5.js","_app/immutable/chunks/BjBfRCTG.js","_app/immutable/chunks/C9-TIUVJ.js","_app/immutable/chunks/IGP5Wxuu.js","_app/immutable/chunks/C41prowm.js","_app/immutable/chunks/DIFdNeux.js","_app/immutable/chunks/DoJuxm4-.js","_app/immutable/chunks/BfYloIzP.js","_app/immutable/chunks/DW38_v_t.js","_app/immutable/chunks/Cl_WtxYR.js","_app/immutable/chunks/DxYeJU7q.js","_app/immutable/chunks/DX6rZLP_.js","_app/immutable/chunks/Dbi-q6K0.js","_app/immutable/chunks/qHJ1jtrh.js","_app/immutable/chunks/CYRXNNKL.js","_app/immutable/chunks/69_IOA4Y.js","_app/immutable/chunks/CKSBknU8.js","_app/immutable/chunks/DZtUfXhX.js","_app/immutable/chunks/CghoW6jw.js","_app/immutable/chunks/CKBi3O3H.js","_app/immutable/chunks/zBeVzl2-.js","_app/immutable/chunks/7WNkIIOH.js","_app/immutable/chunks/CnkkOk4e.js","_app/immutable/chunks/B5MDW0ny.js","_app/immutable/chunks/DZg0xur0.js","_app/immutable/chunks/DMJLSCn6.js","_app/immutable/chunks/D8VB7bmC.js","_app/immutable/chunks/CLSS4PPm.js","_app/immutable/chunks/C3w8NTMF.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/CoiN2_Uy.js"];
const stylesheets = [];
const fonts = [];

export { component, fonts, imports, index, _page_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=13-D4Cvdf_h.js.map
