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
const imports = ["_app/immutable/nodes/13.DeooOPSY.js","_app/immutable/chunks/CMT2gXTl.js","_app/immutable/chunks/nMe2PDh0.js","_app/immutable/chunks/B8oe2iq3.js","_app/immutable/chunks/DMbBZyaY.js","_app/immutable/chunks/CERU589C.js","_app/immutable/chunks/2EOrEV4J.js","_app/immutable/chunks/D0scdGz7.js","_app/immutable/chunks/BvIrdU2Z.js","_app/immutable/chunks/COMVsDF6.js","_app/immutable/chunks/Dj2AhZJ6.js","_app/immutable/chunks/BPUTH6z7.js","_app/immutable/chunks/CYy-j-nn.js","_app/immutable/chunks/DNJSSTD3.js","_app/immutable/chunks/D-HtDwqB.js","_app/immutable/chunks/Basa6-iB.js","_app/immutable/chunks/DNayJybw.js","_app/immutable/chunks/q8K2smeH.js","_app/immutable/chunks/DX6rZLP_.js","_app/immutable/chunks/njJjZ6u3.js","_app/immutable/chunks/BrdvnNnr.js","_app/immutable/chunks/BKOTW_l5.js","_app/immutable/chunks/9RgIyoY-.js","_app/immutable/chunks/BZVYgfsK.js","_app/immutable/chunks/-sIcaygn.js","_app/immutable/chunks/BHvW3iEQ.js","_app/immutable/chunks/CwiUZSdT.js","_app/immutable/chunks/DVefQIQk.js","_app/immutable/chunks/BzkMVAVa.js","_app/immutable/chunks/GjPJcSW-.js","_app/immutable/chunks/CIBfkCdn.js","_app/immutable/chunks/DwSIRGTU.js","_app/immutable/chunks/e6sNuQvl.js","_app/immutable/chunks/BSfWWMNN.js","_app/immutable/chunks/C3w8NTMF.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/DR-izm2S.js"];
const stylesheets = [];
const fonts = [];

export { component, fonts, imports, index, _page_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=13-BgKDIvdf.js.map
