import { redirect } from '@sveltejs/kit';
import { a as api } from './client2-vvZGy19D.js';

const load = async ({ fetch }) => {
  const status = await api.setup.status({ fetch });
  if (status && !status.no_admin_yet) {
    throw redirect(303, "/login");
  }
  return {};
};

var _page_server_ts = /*#__PURE__*/Object.freeze({
  __proto__: null,
  load: load
});

const index = 21;
let component_cache;
const component = async () => component_cache ??= (await import('./_page.svelte-C8lAB2rJ.js')).default;
const server_id = "src/routes/setup/+page.server.ts";
const imports = ["_app/immutable/nodes/21.D2gtXPTI.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/DtgIT0Nk.js","_app/immutable/chunks/DIeogL5L.js","_app/immutable/chunks/VBX2TTCL.js","_app/immutable/chunks/Bx2UN8uz.js","_app/immutable/chunks/wDcso0V5.js","_app/immutable/chunks/BjBfRCTG.js","_app/immutable/chunks/CYGcQVzr.js","_app/immutable/chunks/BX9zuvTI.js","_app/immutable/chunks/C9-TIUVJ.js","_app/immutable/chunks/IGP5Wxuu.js","_app/immutable/chunks/58iVOwiH.js","_app/immutable/chunks/C41prowm.js","_app/immutable/chunks/DIFdNeux.js","_app/immutable/chunks/D8VB7bmC.js","_app/immutable/chunks/Bvg1YchZ.js","_app/immutable/chunks/CRhdZnMJ.js","_app/immutable/chunks/BfYloIzP.js","_app/immutable/chunks/CKBi3O3H.js","_app/immutable/chunks/jOCS1_eD.js","_app/immutable/chunks/DZRqd1Sg.js","_app/immutable/chunks/BUoQgrpu.js","_app/immutable/chunks/D9EM1o3c.js","_app/immutable/chunks/C3w8NTMF.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/DmYsQdH5.js","_app/immutable/chunks/BoBeuc60.js"];
const stylesheets = [];
const fonts = [];

export { component, fonts, imports, index, _page_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=21-Dwi8i96n.js.map
