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

const index = 19;
let component_cache;
const component = async () => component_cache ??= (await import('./_page.svelte-CEgstCSM.js')).default;
const server_id = "src/routes/setup/+page.server.ts";
const imports = ["_app/immutable/nodes/19.BmmUqbjN.js","_app/immutable/chunks/kSsaFjxf.js","_app/immutable/chunks/8Q54h-zb.js","_app/immutable/chunks/D1ZTAtSI.js","_app/immutable/chunks/Cr6JEVsd.js","_app/immutable/chunks/BanPfVL4.js","_app/immutable/chunks/Du1eGV_S.js","_app/immutable/chunks/B8q5y6JZ.js","_app/immutable/chunks/BxxFkhu7.js","_app/immutable/chunks/DhdLFye8.js","_app/immutable/chunks/Cr-q87Tu.js","_app/immutable/chunks/DT8vi1U8.js","_app/immutable/chunks/BYsOGmcf.js","_app/immutable/chunks/Cpaoj_V7.js","_app/immutable/chunks/D3X6iaz6.js","_app/immutable/chunks/__4kodT9.js","_app/immutable/chunks/CNrV3U9r.js","_app/immutable/chunks/D_bRkq8V.js","_app/immutable/chunks/BBeLsFdq.js","_app/immutable/chunks/CvyRKL9b.js","_app/immutable/chunks/DgsMve4N.js","_app/immutable/chunks/C3w8NTMF.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/DBQQ19gE.js","_app/immutable/chunks/CyO3DNvU.js"];
const stylesheets = [];
const fonts = [];

export { component, fonts, imports, index, _page_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=19-hNGS54iy.js.map
