import { redirect } from '@sveltejs/kit';
import { a as api } from './client2-vvZGy19D.js';

const load = async ({ locals, url, fetch }) => {
  if (!locals.user) {
    const next = encodeURIComponent(url.pathname + url.search);
    throw redirect(303, `/login?next=${next}`);
  }
  if (!locals.user.is_admin) {
    throw redirect(303, "/");
  }
  try {
    const users = await api.users.list({ fetch });
    return { user: locals.user, users, loadError: false };
  } catch {
    return { user: locals.user, users: [], loadError: true };
  }
};

var _page_server_ts = /*#__PURE__*/Object.freeze({
  __proto__: null,
  load: load
});

const index = 10;
let component_cache;
const component = async () => component_cache ??= (await import('./_page.svelte-B9vKKbxZ.js')).default;
const server_id = "src/routes/admin/users/+page.server.ts";
const imports = ["_app/immutable/nodes/10.Dq2KsTG8.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/DIFdNeux.js","_app/immutable/chunks/DtgIT0Nk.js","_app/immutable/chunks/DIeogL5L.js","_app/immutable/chunks/VBX2TTCL.js","_app/immutable/chunks/Bx2UN8uz.js","_app/immutable/chunks/wDcso0V5.js","_app/immutable/chunks/BjBfRCTG.js","_app/immutable/chunks/CYGcQVzr.js","_app/immutable/chunks/BX9zuvTI.js","_app/immutable/chunks/C9-TIUVJ.js","_app/immutable/chunks/IGP5Wxuu.js","_app/immutable/chunks/58iVOwiH.js","_app/immutable/chunks/C41prowm.js","_app/immutable/chunks/CLSS4PPm.js","_app/immutable/chunks/DZg0xur0.js","_app/immutable/chunks/DMJLSCn6.js","_app/immutable/chunks/DW38_v_t.js","_app/immutable/chunks/Cl_WtxYR.js","_app/immutable/chunks/DxYeJU7q.js","_app/immutable/chunks/BfYloIzP.js","_app/immutable/chunks/DX6rZLP_.js","_app/immutable/chunks/Dbi-q6K0.js","_app/immutable/chunks/BjGsnwAT.js","_app/immutable/chunks/DYh20XpK.js","_app/immutable/chunks/DsF8yCE9.js","_app/immutable/chunks/wG_HTVV7.js","_app/immutable/chunks/CKBi3O3H.js","_app/immutable/chunks/C3w8NTMF.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/C-1xjlcG.js","_app/immutable/chunks/CoiN2_Uy.js","_app/immutable/chunks/Df80g9ue.js"];
const stylesheets = [];
const fonts = [];

export { component, fonts, imports, index, _page_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=10-BUzxskAu.js.map
