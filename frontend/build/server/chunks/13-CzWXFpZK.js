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

const index = 13;
let component_cache;
const component = async () => component_cache ??= (await import('./_page.svelte-gYnC0PVm.js')).default;
const server_id = "src/routes/inventory/[cluster]/[vmid]/+page.server.ts";
const imports = ["_app/immutable/nodes/13.DNU0tM5N.js","_app/immutable/chunks/kSsaFjxf.js","_app/immutable/chunks/8Q54h-zb.js","_app/immutable/chunks/DhdLFye8.js","_app/immutable/chunks/Cr-q87Tu.js","_app/immutable/chunks/D1ZTAtSI.js","_app/immutable/chunks/BanPfVL4.js","_app/immutable/chunks/Cr6JEVsd.js","_app/immutable/chunks/Du1eGV_S.js","_app/immutable/chunks/B8q5y6JZ.js","_app/immutable/chunks/BxxFkhu7.js","_app/immutable/chunks/CLaOwPZH.js","_app/immutable/chunks/Cpaoj_V7.js","_app/immutable/chunks/DqmRHnIV.js","_app/immutable/chunks/BS5acttY.js","_app/immutable/chunks/DX6rZLP_.js","_app/immutable/chunks/DPhlvvxk.js","_app/immutable/chunks/DiCuuEi6.js","_app/immutable/chunks/D3X6iaz6.js","_app/immutable/chunks/CYCj7vOM.js","_app/immutable/chunks/gXqHeQGP.js","_app/immutable/chunks/DBXwc7kw.js","_app/immutable/chunks/BOj9pCku.js","_app/immutable/chunks/BsvYabiT.js","_app/immutable/chunks/Ccmicir1.js","_app/immutable/chunks/Bt_XVpwk.js","_app/immutable/chunks/BPfKPa1_.js","_app/immutable/chunks/DBQQ19gE.js","_app/immutable/chunks/B2CX1UO4.js","_app/immutable/chunks/BM4R31_8.js","_app/immutable/chunks/C3w8NTMF.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/DmHOGX6j.js","_app/immutable/chunks/BW2bfEe_.js","_app/immutable/chunks/C8sIhMfx.js","_app/immutable/chunks/0wRbRz3B.js"];
const stylesheets = [];
const fonts = [];

export { component, fonts, imports, index, _page_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=13-CzWXFpZK.js.map
