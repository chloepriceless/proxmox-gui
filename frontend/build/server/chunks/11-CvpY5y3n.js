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

const index = 11;
let component_cache;
const component = async () => component_cache ??= (await import('./_page.svelte-DQ6vaKja.js')).default;
const server_id = "src/routes/admin/users/+page.server.ts";
const imports = ["_app/immutable/nodes/11.BrU2A96j.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/Cmh71_M-.js","_app/immutable/chunks/B76fPDHw.js","_app/immutable/chunks/DIeogL5L.js","_app/immutable/chunks/BZy2rKVh.js","_app/immutable/chunks/DG-AIyDW.js","_app/immutable/chunks/HtuQ-t6z.js","_app/immutable/chunks/DFf0_9oh.js","_app/immutable/chunks/B0O0__6X.js","_app/immutable/chunks/Da8-qn49.js","_app/immutable/chunks/BkYbJ__8.js","_app/immutable/chunks/1_Ev5Rxk.js","_app/immutable/chunks/Cv6kQ42Y.js","_app/immutable/chunks/CcQORYn5.js","_app/immutable/chunks/CSJZfSZd.js","_app/immutable/chunks/CbiA0b_9.js","_app/immutable/chunks/DaMzvvl3.js","_app/immutable/chunks/e5JljhQb.js","_app/immutable/chunks/Tjug4qrk.js","_app/immutable/chunks/gf1xWwEA.js","_app/immutable/chunks/C6ALetTt.js","_app/immutable/chunks/DX6rZLP_.js","_app/immutable/chunks/CFTFTl3J.js","_app/immutable/chunks/Brr_OKOa.js","_app/immutable/chunks/D3KbMdW9.js","_app/immutable/chunks/DMQMzTaZ.js","_app/immutable/chunks/BkPKArPq.js","_app/immutable/chunks/DehlN6xb.js","_app/immutable/chunks/DMY-2uJ3.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/DhV7fKLW.js","_app/immutable/chunks/kMNdv31G.js","_app/immutable/chunks/C4pqkLNX.js"];
const stylesheets = [];
const fonts = [];

export { component, fonts, imports, index, _page_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=11-CvpY5y3n.js.map
