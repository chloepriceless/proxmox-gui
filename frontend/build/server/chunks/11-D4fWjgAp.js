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

const index = 11;
let component_cache;
const component = async () => component_cache ??= (await import('./_page.svelte-CmpRN5aZ.js')).default;
const server_id = "src/routes/audit/+page.server.ts";
const imports = ["_app/immutable/nodes/11.D0s4dZtJ.js","_app/immutable/chunks/kSsaFjxf.js","_app/immutable/chunks/8Q54h-zb.js","_app/immutable/chunks/DhdLFye8.js","_app/immutable/chunks/Cr-q87Tu.js","_app/immutable/chunks/D1ZTAtSI.js","_app/immutable/chunks/Cr6JEVsd.js","_app/immutable/chunks/BanPfVL4.js","_app/immutable/chunks/Du1eGV_S.js","_app/immutable/chunks/B8q5y6JZ.js","_app/immutable/chunks/BxxFkhu7.js","_app/immutable/chunks/BYsOGmcf.js","_app/immutable/chunks/Cpaoj_V7.js","_app/immutable/chunks/kjIi5wpe.js","_app/immutable/chunks/CjG3KYa8.js","_app/immutable/chunks/DPhlvvxk.js","_app/immutable/chunks/DiCuuEi6.js","_app/immutable/chunks/DX6rZLP_.js","_app/immutable/chunks/BsvYabiT.js","_app/immutable/chunks/Ccmicir1.js","_app/immutable/chunks/HwuRrUyr.js","_app/immutable/chunks/BhguS1DR.js","_app/immutable/chunks/BKdQ7m5y.js","_app/immutable/chunks/BM4R31_8.js","_app/immutable/chunks/D_bRkq8V.js","_app/immutable/chunks/g7hqBG47.js","_app/immutable/chunks/0wRbRz3B.js","_app/immutable/chunks/BZaIOe1W.js","_app/immutable/chunks/CYCj7vOM.js","_app/immutable/chunks/gXqHeQGP.js","_app/immutable/chunks/DBXwc7kw.js","_app/immutable/chunks/D3X6iaz6.js","_app/immutable/chunks/BOj9pCku.js","_app/immutable/chunks/C3w8NTMF.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/DmHOGX6j.js"];
const stylesheets = [];
const fonts = [];

export { component, fonts, imports, index, _page_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=11-D4fWjgAp.js.map
