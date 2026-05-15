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
const imports = ["_app/immutable/nodes/21.BGypbsLA.js","_app/immutable/chunks/CMT2gXTl.js","_app/immutable/chunks/nMe2PDh0.js","_app/immutable/chunks/CERU589C.js","_app/immutable/chunks/2EOrEV4J.js","_app/immutable/chunks/D0scdGz7.js","_app/immutable/chunks/BvIrdU2Z.js","_app/immutable/chunks/COMVsDF6.js","_app/immutable/chunks/Dj2AhZJ6.js","_app/immutable/chunks/B8oe2iq3.js","_app/immutable/chunks/DMbBZyaY.js","_app/immutable/chunks/CA0NtBrQ.js","_app/immutable/chunks/BPUTH6z7.js","_app/immutable/chunks/CYy-j-nn.js","_app/immutable/chunks/e6sNuQvl.js","_app/immutable/chunks/Bamql8uG.js","_app/immutable/chunks/yFINY5bt.js","_app/immutable/chunks/D-HtDwqB.js","_app/immutable/chunks/BHvW3iEQ.js","_app/immutable/chunks/CdyZtJvn.js","_app/immutable/chunks/okoh3Ugm.js","_app/immutable/chunks/DIH5CpZM.js","_app/immutable/chunks/BvenazgL.js","_app/immutable/chunks/C3w8NTMF.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/DyITn7Vu.js","_app/immutable/chunks/DJI3tkAA.js"];
const stylesheets = [];
const fonts = [];

export { component, fonts, imports, index, _page_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=21-DSxQ_n52.js.map
