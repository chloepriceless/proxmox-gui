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
const imports = ["_app/immutable/nodes/15.DgtFtlW7.js","_app/immutable/chunks/CMT2gXTl.js","_app/immutable/chunks/nMe2PDh0.js","_app/immutable/chunks/B8oe2iq3.js","_app/immutable/chunks/DMbBZyaY.js","_app/immutable/chunks/CERU589C.js","_app/immutable/chunks/D0scdGz7.js","_app/immutable/chunks/2EOrEV4J.js","_app/immutable/chunks/BvIrdU2Z.js","_app/immutable/chunks/COMVsDF6.js","_app/immutable/chunks/Dj2AhZJ6.js","_app/immutable/chunks/BPUTH6z7.js","_app/immutable/chunks/CYy-j-nn.js","_app/immutable/chunks/DNJSSTD3.js","_app/immutable/chunks/BkkJ-4fv.js","_app/immutable/chunks/D-HtDwqB.js","_app/immutable/chunks/DX6rZLP_.js","_app/immutable/chunks/DNayJybw.js","_app/immutable/chunks/q8K2smeH.js","_app/immutable/chunks/e6sNuQvl.js","_app/immutable/chunks/GjPJcSW-.js","_app/immutable/chunks/CIBfkCdn.js","_app/immutable/chunks/DwSIRGTU.js","_app/immutable/chunks/BSfWWMNN.js","_app/immutable/chunks/njJjZ6u3.js","_app/immutable/chunks/BrdvnNnr.js","_app/immutable/chunks/sAZfxpCj.js","_app/immutable/chunks/Dnj1o9UR.js","_app/immutable/chunks/DyITn7Vu.js","_app/immutable/chunks/HxF7MWIb.js","_app/immutable/chunks/-sIcaygn.js","_app/immutable/chunks/C3w8NTMF.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/DR-izm2S.js","_app/immutable/chunks/DzpNtI0K.js","_app/immutable/chunks/DQn15KtG.js","_app/immutable/chunks/DVefQIQk.js"];
const stylesheets = [];
const fonts = [];

export { component, fonts, imports, index, _page_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=15-Bbcjz_NO.js.map
