import { redirect } from '@sveltejs/kit';
import { a as api } from './client2-WJrlUD72.js';

const load = async ({ locals, url, fetch }) => {
  if (!locals.user) {
    const next = encodeURIComponent(url.pathname + url.search);
    throw redirect(303, `/login?next=${next}`);
  }
  if (!locals.user.is_admin) {
    throw redirect(303, "/");
  }
  try {
    const teams = await api.teams.list({ fetch });
    return { user: locals.user, teams, loadError: false };
  } catch {
    return { user: locals.user, teams: [], loadError: true };
  }
};

var _page_server_ts = /*#__PURE__*/Object.freeze({
  __proto__: null,
  load: load
});

const index = 14;
let component_cache;
const component = async () => component_cache ??= (await import('./_page.svelte-Bywfl5ZY.js')).default;
const server_id = "src/routes/admin/users/new/+page.server.ts";
const imports = ["_app/immutable/nodes/14.s58a2nPD.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/DROBfb48.js","_app/immutable/chunks/RR2SEOsk.js","_app/immutable/chunks/DIeogL5L.js","_app/immutable/chunks/s3yjbAhm.js","_app/immutable/chunks/Cxcrlh5n.js","_app/immutable/chunks/MZ9IL_0X.js","_app/immutable/chunks/D5aDoj7M.js","_app/immutable/chunks/BS4mR_6-.js","_app/immutable/chunks/XXrISPRp.js","_app/immutable/chunks/BlTd84kF.js","_app/immutable/chunks/CtxHTuXR.js","_app/immutable/chunks/D64NQve6.js","_app/immutable/chunks/BzqC8FgQ.js","_app/immutable/chunks/CO9Uq63f.js","_app/immutable/chunks/C65twzK6.js","_app/immutable/chunks/DByFSPPP.js","_app/immutable/chunks/Cnxr7g58.js","_app/immutable/chunks/CmW2mqN3.js","_app/immutable/chunks/CjdJh7cz.js","_app/immutable/chunks/B5UJlWCz.js","_app/immutable/chunks/28G6IXYX.js","_app/immutable/chunks/B-_TOQoo.js","_app/immutable/chunks/Bmv0KEJ-.js","_app/immutable/chunks/DKTwPRsf.js","_app/immutable/chunks/DXdao7Dl.js","_app/immutable/chunks/69_IOA4Y.js","_app/immutable/chunks/BDthO0oC.js","_app/immutable/chunks/ClFHqJz7.js","_app/immutable/chunks/3uAMLWE4.js","_app/immutable/chunks/DX6rZLP_.js","_app/immutable/chunks/6Cqh88Hg.js","_app/immutable/chunks/BuexN0M3.js","_app/immutable/chunks/Da_1-pxj.js","_app/immutable/chunks/BJ3edVnq.js","_app/immutable/chunks/BiwpzDcT.js","_app/immutable/chunks/Ca6f3fYo.js","_app/immutable/chunks/B_qRnoTm.js","_app/immutable/chunks/DMY-2uJ3.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/DIxP2VRk.js","_app/immutable/chunks/LE3FM59i.js","_app/immutable/chunks/CZh8055f.js"];
const stylesheets = [];
const fonts = [];

export { component, fonts, imports, index, _page_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=14-BmpWu0tI.js.map
