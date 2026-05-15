import { redirect } from '@sveltejs/kit';
import { a as api } from './client2-vvZGy19D.js';

const load = async ({ locals, url, fetch }) => {
  if (!locals.user) {
    const next = encodeURIComponent(url.pathname + url.search);
    throw redirect(303, `/login?next=${next}`);
  }
  try {
    const inventory = await api.inventory.listAll({ fetch });
    return { user: locals.user, inventory, loadError: false };
  } catch {
    return { user: locals.user, inventory: [], loadError: true };
  }
};

var _page_server_ts = /*#__PURE__*/Object.freeze({
  __proto__: null,
  load: load
});

const index = 14;
let component_cache;
const component = async () => component_cache ??= (await import('./_page.svelte-DitnGsxu.js')).default;
const server_id = "src/routes/inventory/+page.server.ts";
const imports = ["_app/immutable/nodes/14.DFlM6_yC.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/DtgIT0Nk.js","_app/immutable/chunks/DIeogL5L.js","_app/immutable/chunks/CYGcQVzr.js","_app/immutable/chunks/BX9zuvTI.js","_app/immutable/chunks/VBX2TTCL.js","_app/immutable/chunks/Bx2UN8uz.js","_app/immutable/chunks/wDcso0V5.js","_app/immutable/chunks/BjBfRCTG.js","_app/immutable/chunks/C9-TIUVJ.js","_app/immutable/chunks/IGP5Wxuu.js","_app/immutable/chunks/C41prowm.js","_app/immutable/chunks/DIFdNeux.js","_app/immutable/chunks/DoJuxm4-.js","_app/immutable/chunks/BfYloIzP.js","_app/immutable/chunks/DW38_v_t.js","_app/immutable/chunks/Cl_WtxYR.js","_app/immutable/chunks/DxYeJU7q.js","_app/immutable/chunks/DX6rZLP_.js","_app/immutable/chunks/Dbi-q6K0.js","_app/immutable/chunks/DZg0xur0.js","_app/immutable/chunks/CLSS4PPm.js","_app/immutable/chunks/Bvg1YchZ.js","_app/immutable/chunks/BUoQgrpu.js","_app/immutable/chunks/CRhdZnMJ.js","_app/immutable/chunks/CpUClP69.js","_app/immutable/chunks/BoBeuc60.js","_app/immutable/chunks/zBeVzl2-.js","_app/immutable/chunks/7WNkIIOH.js","_app/immutable/chunks/CnkkOk4e.js","_app/immutable/chunks/DxXaj6Tq.js"];
const stylesheets = [];
const fonts = [];

export { component, fonts, imports, index, _page_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=14-AZS7brrd.js.map
