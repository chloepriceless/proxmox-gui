import { redirect } from '@sveltejs/kit';
import { a as api } from './client2-vvZGy19D.js';

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

const index = 20;
let component_cache;
const component = async () => component_cache ??= (await import('./_page.svelte-2VY8u-DE.js')).default;
const server_id = "src/routes/profile/tokens/+page.server.ts";
const imports = ["_app/immutable/nodes/20.I_062swm.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/DIFdNeux.js","_app/immutable/chunks/DtgIT0Nk.js","_app/immutable/chunks/DIeogL5L.js","_app/immutable/chunks/VBX2TTCL.js","_app/immutable/chunks/Bx2UN8uz.js","_app/immutable/chunks/wDcso0V5.js","_app/immutable/chunks/BjBfRCTG.js","_app/immutable/chunks/CYGcQVzr.js","_app/immutable/chunks/BX9zuvTI.js","_app/immutable/chunks/C9-TIUVJ.js","_app/immutable/chunks/IGP5Wxuu.js","_app/immutable/chunks/58iVOwiH.js","_app/immutable/chunks/C41prowm.js","_app/immutable/chunks/D8VB7bmC.js","_app/immutable/chunks/Cv7FRnQS.js","_app/immutable/chunks/Bvg1YchZ.js","_app/immutable/chunks/CRhdZnMJ.js","_app/immutable/chunks/DpYqMj1u.js","_app/immutable/chunks/Bo0LVusD.js","_app/immutable/chunks/DsF8yCE9.js","_app/immutable/chunks/BfYloIzP.js","_app/immutable/chunks/DxYeJU7q.js","_app/immutable/chunks/Cl_WtxYR.js","_app/immutable/chunks/DX6rZLP_.js","_app/immutable/chunks/CnkkOk4e.js","_app/immutable/chunks/wG_HTVV7.js","_app/immutable/chunks/DW38_v_t.js","_app/immutable/chunks/Dbi-q6K0.js","_app/immutable/chunks/CLSS4PPm.js","_app/immutable/chunks/CKBi3O3H.js","_app/immutable/chunks/DZRqd1Sg.js","_app/immutable/chunks/BUoQgrpu.js","_app/immutable/chunks/D9EM1o3c.js","_app/immutable/chunks/DYh20XpK.js","_app/immutable/chunks/DmYsQdH5.js","_app/immutable/chunks/C3w8NTMF.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/CoiN2_Uy.js","_app/immutable/chunks/Dqha2pZG.js","_app/immutable/chunks/Df80g9ue.js"];
const stylesheets = [];
const fonts = [];

export { component, fonts, imports, index, _page_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=20-B2fUHtoy.js.map
