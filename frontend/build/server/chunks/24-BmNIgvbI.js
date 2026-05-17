import { redirect } from '@sveltejs/kit';
import { a as api } from './client2-WJrlUD72.js';

const load = async ({ locals, url, fetch }) => {
  if (!locals.user) {
    const next = encodeURIComponent(url.pathname + url.search);
    throw redirect(303, `/login?next=${next}`);
  }
  try {
    const tokens = await api.me.listTokens({ fetch });
    return { user: locals.user, tokens, loadError: false };
  } catch {
    return { user: locals.user, tokens: [], loadError: true };
  }
};

var _page_server_ts = /*#__PURE__*/Object.freeze({
  __proto__: null,
  load: load
});

const index = 24;
let component_cache;
const component = async () => component_cache ??= (await import('./_page.svelte-CR5dNhHM.js')).default;
const server_id = "src/routes/profile/tokens/+page.server.ts";
const imports = ["_app/immutable/nodes/24.DqP95Kaw.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/Cmh71_M-.js","_app/immutable/chunks/B76fPDHw.js","_app/immutable/chunks/DIeogL5L.js","_app/immutable/chunks/BZy2rKVh.js","_app/immutable/chunks/DG-AIyDW.js","_app/immutable/chunks/HtuQ-t6z.js","_app/immutable/chunks/DFf0_9oh.js","_app/immutable/chunks/B0O0__6X.js","_app/immutable/chunks/Da8-qn49.js","_app/immutable/chunks/BkYbJ__8.js","_app/immutable/chunks/1_Ev5Rxk.js","_app/immutable/chunks/Cv6kQ42Y.js","_app/immutable/chunks/CcQORYn5.js","_app/immutable/chunks/D_MEs5oK.js","_app/immutable/chunks/3e5_4EXJ.js","_app/immutable/chunks/CKvDEHfU.js","_app/immutable/chunks/bddXi7Xq.js","_app/immutable/chunks/C_CXB-aj.js","_app/immutable/chunks/DyhqqZP2.js","_app/immutable/chunks/Ch7fc4m1.js","_app/immutable/chunks/CSpF5A54.js","_app/immutable/chunks/BkPKArPq.js","_app/immutable/chunks/C6ALetTt.js","_app/immutable/chunks/gf1xWwEA.js","_app/immutable/chunks/Tjug4qrk.js","_app/immutable/chunks/DX6rZLP_.js","_app/immutable/chunks/SaooNa5r.js","_app/immutable/chunks/e5JljhQb.js","_app/immutable/chunks/CFTFTl3J.js","_app/immutable/chunks/CbiA0b_9.js","_app/immutable/chunks/DehlN6xb.js","_app/immutable/chunks/B5iXubSn.js","_app/immutable/chunks/yuBbTQ9Y.js","_app/immutable/chunks/B7oWRHuv.js","_app/immutable/chunks/D3KbMdW9.js","_app/immutable/chunks/DMQMzTaZ.js","_app/immutable/chunks/vZ-i5BTB.js","_app/immutable/chunks/OGfdzmU5.js","_app/immutable/chunks/DMY-2uJ3.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/kMNdv31G.js","_app/immutable/chunks/CFMgycCt.js","_app/immutable/chunks/dYsEJFvI.js","_app/immutable/chunks/C4pqkLNX.js"];
const stylesheets = [];
const fonts = [];

export { component, fonts, imports, index, _page_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=24-BmNIgvbI.js.map
