import { redirect } from '@sveltejs/kit';
import { a as api } from './client2-WJrlUD72.js';

const load = async ({ locals, url, fetch }) => {
  if (!locals.user) {
    const next = encodeURIComponent(url.pathname + url.search);
    throw redirect(303, `/login?next=${next}`);
  }
  try {
    const inventory = await api.inventory.listAll({ fetch });
    const clusters = inventory.map((c) => ({
      id: c.cluster_id,
      name: c.cluster_name,
      status: c.cluster_status,
      is_stale: c.is_stale
    }));
    return { user: locals.user, clusters, loadError: false };
  } catch {
    return { user: locals.user, clusters: [], loadError: true };
  }
};

var _page_server_ts = /*#__PURE__*/Object.freeze({
  __proto__: null,
  load: load
});

const index = 17;
let component_cache;
const component = async () => component_cache ??= (await import('./_page.svelte-Ci6eF2CN.js')).default;
const server_id = "src/routes/create/+page.server.ts";
const imports = ["_app/immutable/nodes/17.BMMZIbAs.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/B76fPDHw.js","_app/immutable/chunks/DIeogL5L.js","_app/immutable/chunks/BZy2rKVh.js","_app/immutable/chunks/DG-AIyDW.js","_app/immutable/chunks/HtuQ-t6z.js","_app/immutable/chunks/DFf0_9oh.js","_app/immutable/chunks/BkYbJ__8.js","_app/immutable/chunks/1_Ev5Rxk.js","_app/immutable/chunks/Cv6kQ42Y.js","_app/immutable/chunks/CcQORYn5.js","_app/immutable/chunks/4BoP6hY8.js","_app/immutable/chunks/Cmh71_M-.js","_app/immutable/chunks/DMQMzTaZ.js","_app/immutable/chunks/Da8-qn49.js","_app/immutable/chunks/DX6rZLP_.js","_app/immutable/chunks/BkPKArPq.js","_app/immutable/chunks/B0O0__6X.js","_app/immutable/chunks/C6ALetTt.js","_app/immutable/chunks/gf1xWwEA.js","_app/immutable/chunks/Tjug4qrk.js","_app/immutable/chunks/3e5_4EXJ.js","_app/immutable/chunks/SaooNa5r.js","_app/immutable/chunks/vZ-i5BTB.js","_app/immutable/chunks/OGfdzmU5.js","_app/immutable/chunks/DITkBtai.js","_app/immutable/chunks/69_IOA4Y.js","_app/immutable/chunks/Beh3eMVO.js","_app/immutable/chunks/C9dUKBca.js","_app/immutable/chunks/CmYxEM7h.js","_app/immutable/chunks/DWMSRsl4.js","_app/immutable/chunks/Ce_j8yZB.js","_app/immutable/chunks/CbiA0b_9.js","_app/immutable/chunks/Ch7fc4m1.js","_app/immutable/chunks/CSpF5A54.js","_app/immutable/chunks/DehlN6xb.js","_app/immutable/chunks/DMY-2uJ3.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/2Aij0Weq.js","_app/immutable/chunks/B7oWRHuv.js","_app/immutable/chunks/BM0CW7Zt.js","_app/immutable/chunks/CFTFTl3J.js","_app/immutable/chunks/CxBXpsTP.js","_app/immutable/chunks/D1abEhLG.js","_app/immutable/chunks/Caj_lD0O.js","_app/immutable/chunks/DSnCMneG.js","_app/immutable/chunks/KBDW0R29.js","_app/immutable/chunks/Dx6FHG0s.js","_app/immutable/chunks/CGjc-1_p.js","_app/immutable/chunks/DaMzvvl3.js","_app/immutable/chunks/CmMO8MZe.js","_app/immutable/chunks/CGcfMLRt.js","_app/immutable/chunks/kMNdv31G.js","_app/immutable/chunks/DTBjLP71.js","_app/immutable/chunks/AEguaSGS.js","_app/immutable/chunks/BAwm5wUc.js"];
const stylesheets = ["_app/immutable/assets/select-trigger.CV-KWLNP.css"];
const fonts = [];

export { component, fonts, imports, index, _page_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=17-BD3pQ77-.js.map
