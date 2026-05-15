import { redirect, error } from '@sveltejs/kit';
import { a as api, A as ApiError } from './client2-vvZGy19D.js';

const load = async ({ locals, params, url, fetch }) => {
  if (!locals.user) {
    const next = encodeURIComponent(url.pathname + url.search);
    throw redirect(303, `/login?next=${next}`);
  }
  const clusterId = Number(params.cluster);
  const vmid = Number(params.vmid);
  if (!Number.isInteger(clusterId) || clusterId <= 0 || !Number.isInteger(vmid) || vmid <= 0) {
    throw error(404, "Not found");
  }
  try {
    const detail = await api.inventory.getDetail({ clusterId, vmid, type: "vm", fetch });
    return { user: locals.user, detail, loadError: false };
  } catch (e1) {
    if (!(e1 instanceof ApiError && e1.status === 403)) ;
    try {
      const detail = await api.inventory.getDetail({ clusterId, vmid, type: "lxc", fetch });
      return { user: locals.user, detail, loadError: false };
    } catch (e2) {
      if (e2 instanceof ApiError && (e2.status === 403 || e2.status === 404)) {
        throw error(404, "Not found");
      }
      return { user: locals.user, detail: null, loadError: true };
    }
  }
};

var _page_server_ts = /*#__PURE__*/Object.freeze({
  __proto__: null,
  load: load
});

const index = 15;
let component_cache;
const component = async () => component_cache ??= (await import('./_page.svelte-CiqMq33A.js')).default;
const server_id = "src/routes/inventory/[cluster]/[vmid]/+page.server.ts";
const imports = ["_app/immutable/nodes/15.Bw9WzMKH.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/DtgIT0Nk.js","_app/immutable/chunks/DIeogL5L.js","_app/immutable/chunks/CYGcQVzr.js","_app/immutable/chunks/BX9zuvTI.js","_app/immutable/chunks/VBX2TTCL.js","_app/immutable/chunks/Bx2UN8uz.js","_app/immutable/chunks/BjBfRCTG.js","_app/immutable/chunks/wDcso0V5.js","_app/immutable/chunks/C9-TIUVJ.js","_app/immutable/chunks/IGP5Wxuu.js","_app/immutable/chunks/C41prowm.js","_app/immutable/chunks/DIFdNeux.js","_app/immutable/chunks/DoJuxm4-.js","_app/immutable/chunks/qQI37Ln8.js","_app/immutable/chunks/BfYloIzP.js","_app/immutable/chunks/DX6rZLP_.js","_app/immutable/chunks/Cl_WtxYR.js","_app/immutable/chunks/DxYeJU7q.js","_app/immutable/chunks/D8VB7bmC.js","_app/immutable/chunks/B5MDW0ny.js","_app/immutable/chunks/DZg0xur0.js","_app/immutable/chunks/DMJLSCn6.js","_app/immutable/chunks/CLSS4PPm.js","_app/immutable/chunks/Dbi-q6K0.js","_app/immutable/chunks/qHJ1jtrh.js","_app/immutable/chunks/DxXaj6Tq.js","_app/immutable/chunks/Ds90VJYb.js","_app/immutable/chunks/DmYsQdH5.js","_app/immutable/chunks/SNMxVn7f.js","_app/immutable/chunks/CghoW6jw.js","_app/immutable/chunks/C3w8NTMF.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/CoiN2_Uy.js","_app/immutable/chunks/C-1xjlcG.js","_app/immutable/chunks/4hmrJTb3.js","_app/immutable/chunks/7WNkIIOH.js"];
const stylesheets = [];
const fonts = [];

export { component, fonts, imports, index, _page_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=15-B0Aj0YSz.js.map
