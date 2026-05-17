import { redirect } from '@sveltejs/kit';
import { a as api } from './client2-WJrlUD72.js';

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

const index = 25;
let component_cache;
const component = async () => component_cache ??= (await import('./_page.svelte-oR09pCQk.js')).default;
const server_id = "src/routes/setup/+page.server.ts";
const imports = ["_app/immutable/nodes/25.DkOOFKxb.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/B76fPDHw.js","_app/immutable/chunks/DIeogL5L.js","_app/immutable/chunks/BZy2rKVh.js","_app/immutable/chunks/DG-AIyDW.js","_app/immutable/chunks/HtuQ-t6z.js","_app/immutable/chunks/DFf0_9oh.js","_app/immutable/chunks/B0O0__6X.js","_app/immutable/chunks/Da8-qn49.js","_app/immutable/chunks/BkYbJ__8.js","_app/immutable/chunks/1_Ev5Rxk.js","_app/immutable/chunks/Cv6kQ42Y.js","_app/immutable/chunks/CcQORYn5.js","_app/immutable/chunks/DGAkiTgi.js","_app/immutable/chunks/Cmh71_M-.js","_app/immutable/chunks/3e5_4EXJ.js","_app/immutable/chunks/C_CXB-aj.js","_app/immutable/chunks/DyhqqZP2.js","_app/immutable/chunks/C6ALetTt.js","_app/immutable/chunks/DehlN6xb.js","_app/immutable/chunks/AEguaSGS.js","_app/immutable/chunks/B5iXubSn.js","_app/immutable/chunks/yuBbTQ9Y.js","_app/immutable/chunks/B7oWRHuv.js","_app/immutable/chunks/DMY-2uJ3.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/vZ-i5BTB.js","_app/immutable/chunks/dYsEJFvI.js","_app/immutable/chunks/B-L8NdK6.js"];
const stylesheets = [];
const fonts = [];

export { component, fonts, imports, index, _page_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=25-DC_dIydU.js.map
