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

const index = 26;
let component_cache;
const component = async () => component_cache ??= (await import('./_page.svelte-Cj0TWj_h.js')).default;
const server_id = "src/routes/setup/+page.server.ts";
const imports = ["_app/immutable/nodes/26.5AbqCUYt.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/RR2SEOsk.js","_app/immutable/chunks/DIeogL5L.js","_app/immutable/chunks/s3yjbAhm.js","_app/immutable/chunks/Cxcrlh5n.js","_app/immutable/chunks/MZ9IL_0X.js","_app/immutable/chunks/D5aDoj7M.js","_app/immutable/chunks/BS4mR_6-.js","_app/immutable/chunks/XXrISPRp.js","_app/immutable/chunks/BlTd84kF.js","_app/immutable/chunks/CtxHTuXR.js","_app/immutable/chunks/D64NQve6.js","_app/immutable/chunks/BzqC8FgQ.js","_app/immutable/chunks/CO9Uq63f.js","_app/immutable/chunks/C65twzK6.js","_app/immutable/chunks/DROBfb48.js","_app/immutable/chunks/DByFSPPP.js","_app/immutable/chunks/Cnxr7g58.js","_app/immutable/chunks/B5UJlWCz.js","_app/immutable/chunks/28G6IXYX.js","_app/immutable/chunks/B-_TOQoo.js","_app/immutable/chunks/Bmv0KEJ-.js","_app/immutable/chunks/BJ3edVnq.js","_app/immutable/chunks/BiwpzDcT.js","_app/immutable/chunks/Ca6f3fYo.js","_app/immutable/chunks/B_qRnoTm.js","_app/immutable/chunks/DMY-2uJ3.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/Da_1-pxj.js","_app/immutable/chunks/CZh8055f.js","_app/immutable/chunks/DvvynLAU.js"];
const stylesheets = [];
const fonts = [];

export { component, fonts, imports, index, _page_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=26-DVkRZhzs.js.map
