import { redirect } from '@sveltejs/kit';
import { a as api } from './client2-WJrlUD72.js';

const load = async ({ locals, url, fetch }) => {
  if (!locals.user) {
    const next = encodeURIComponent(url.pathname + url.search);
    throw redirect(303, `/login?next=${next}`);
  }
  try {
    const keys = await api.me.listSshKeys({ fetch });
    return { user: locals.user, keys, loadError: false };
  } catch {
    return { user: locals.user, keys: [], loadError: true };
  }
};

var _page_server_ts = /*#__PURE__*/Object.freeze({
  __proto__: null,
  load: load
});

const index = 24;
let component_cache;
const component = async () => component_cache ??= (await import('./_page.svelte-C99ebGpf.js')).default;
const server_id = "src/routes/profile/ssh-keys/+page.server.ts";
const imports = ["_app/immutable/nodes/24.Bd83aqFV.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/DROBfb48.js","_app/immutable/chunks/RR2SEOsk.js","_app/immutable/chunks/DIeogL5L.js","_app/immutable/chunks/s3yjbAhm.js","_app/immutable/chunks/Cxcrlh5n.js","_app/immutable/chunks/MZ9IL_0X.js","_app/immutable/chunks/D5aDoj7M.js","_app/immutable/chunks/BS4mR_6-.js","_app/immutable/chunks/XXrISPRp.js","_app/immutable/chunks/BlTd84kF.js","_app/immutable/chunks/CtxHTuXR.js","_app/immutable/chunks/D64NQve6.js","_app/immutable/chunks/BzqC8FgQ.js","_app/immutable/chunks/CO9Uq63f.js","_app/immutable/chunks/C65twzK6.js","_app/immutable/chunks/DByFSPPP.js","_app/immutable/chunks/Cnxr7g58.js","_app/immutable/chunks/CmW2mqN3.js","_app/immutable/chunks/CjdJh7cz.js","_app/immutable/chunks/B5UJlWCz.js","_app/immutable/chunks/28G6IXYX.js","_app/immutable/chunks/L-M73iBu.js","_app/immutable/chunks/vG5W5MrS.js","_app/immutable/chunks/C_brZbnu.js","_app/immutable/chunks/B-_TOQoo.js","_app/immutable/chunks/DXdao7Dl.js","_app/immutable/chunks/BsXubLQ0.js","_app/immutable/chunks/DX6rZLP_.js","_app/immutable/chunks/D0wBRbAx.js","_app/immutable/chunks/CdUgkO0U.js","_app/immutable/chunks/BVd6eqLD.js","_app/immutable/chunks/Bmv0KEJ-.js","_app/immutable/chunks/CeOsULOH.js","_app/immutable/chunks/BiwpzDcT.js","_app/immutable/chunks/Ca6f3fYo.js","_app/immutable/chunks/B_qRnoTm.js","_app/immutable/chunks/-YrLaBmF.js","_app/immutable/chunks/Pa-iekPG.js","_app/immutable/chunks/DMY-2uJ3.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/LE3FM59i.js","_app/immutable/chunks/Drzg6HrL.js","_app/immutable/chunks/D7FHA9NO.js","_app/immutable/chunks/CZh8055f.js"];
const stylesheets = [];
const fonts = [];

export { component, fonts, imports, index, _page_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=24-3tHobXrI.js.map
