import { redirect, error } from '@sveltejs/kit';
import { a as api, A as ApiError } from './client2-WJrlUD72.js';

const load = async ({ locals, params, url, fetch }) => {
  if (!locals.user) {
    const next = encodeURIComponent(url.pathname + url.search);
    throw redirect(303, `/login?next=${next}`);
  }
  if (!locals.user.is_admin) {
    throw redirect(303, "/");
  }
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) {
    throw error(404, "Cluster not found");
  }
  try {
    const cluster = await api.clusters.get({ id }, { fetch });
    return { user: locals.user, cluster };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      throw error(404, "Cluster not found");
    }
    throw error(500, "Could not load cluster");
  }
};

var _page_server_ts = /*#__PURE__*/Object.freeze({
  __proto__: null,
  load: load
});

const index = 6;
let component_cache;
const component = async () => component_cache ??= (await import('./_page.svelte-BRqculps.js')).default;
const server_id = "src/routes/admin/clusters/[id]/+page.server.ts";
const imports = ["_app/immutable/nodes/6.BbeGx6kl.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/B76fPDHw.js","_app/immutable/chunks/DIeogL5L.js","_app/immutable/chunks/BZy2rKVh.js","_app/immutable/chunks/DG-AIyDW.js","_app/immutable/chunks/HtuQ-t6z.js","_app/immutable/chunks/DFf0_9oh.js","_app/immutable/chunks/B0O0__6X.js","_app/immutable/chunks/Da8-qn49.js","_app/immutable/chunks/BkYbJ__8.js","_app/immutable/chunks/1_Ev5Rxk.js","_app/immutable/chunks/Cv6kQ42Y.js","_app/immutable/chunks/CcQORYn5.js","_app/immutable/chunks/CSJZfSZd.js","_app/immutable/chunks/Cmh71_M-.js","_app/immutable/chunks/3e5_4EXJ.js","_app/immutable/chunks/CKvDEHfU.js","_app/immutable/chunks/bddXi7Xq.js","_app/immutable/chunks/C_CXB-aj.js","_app/immutable/chunks/DyhqqZP2.js","_app/immutable/chunks/BM0CW7Zt.js","_app/immutable/chunks/CFTFTl3J.js","_app/immutable/chunks/C6ALetTt.js","_app/immutable/chunks/Tjug4qrk.js","_app/immutable/chunks/gf1xWwEA.js","_app/immutable/chunks/DX6rZLP_.js","_app/immutable/chunks/C9dUKBca.js","_app/immutable/chunks/CmYxEM7h.js","_app/immutable/chunks/vZ-i5BTB.js","_app/immutable/chunks/CxBXpsTP.js","_app/immutable/chunks/D1abEhLG.js","_app/immutable/chunks/Caj_lD0O.js","_app/immutable/chunks/DehlN6xb.js","_app/immutable/chunks/CGjc-1_p.js","_app/immutable/chunks/Ce_j8yZB.js","_app/immutable/chunks/69_IOA4Y.js","_app/immutable/chunks/Beh3eMVO.js","_app/immutable/chunks/Dx6FHG0s.js","_app/immutable/chunks/AEguaSGS.js","_app/immutable/chunks/B5iXubSn.js","_app/immutable/chunks/yuBbTQ9Y.js","_app/immutable/chunks/B7oWRHuv.js","_app/immutable/chunks/D3KbMdW9.js","_app/immutable/chunks/DMQMzTaZ.js","_app/immutable/chunks/BkPKArPq.js","_app/immutable/chunks/TbUPXRZc.js","_app/immutable/chunks/B-L8NdK6.js","_app/immutable/chunks/-F8ZGLZK.js","_app/immutable/chunks/DMY-2uJ3.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/BtKg1HSK.js","_app/immutable/chunks/dYsEJFvI.js","_app/immutable/chunks/kMNdv31G.js"];
const stylesheets = ["_app/immutable/assets/select-trigger.CV-KWLNP.css"];
const fonts = [];

export { component, fonts, imports, index, _page_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=6-Dt14vRP3.js.map
