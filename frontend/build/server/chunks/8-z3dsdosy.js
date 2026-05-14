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

const index = 8;
let component_cache;
const component = async () => component_cache ??= (await import('./_page.svelte-D_YVbr8o.js')).default;
const server_id = "src/routes/admin/users/+page.server.ts";
const imports = ["_app/immutable/nodes/8.Dbz93XrP.js","_app/immutable/chunks/kSsaFjxf.js","_app/immutable/chunks/8Q54h-zb.js","_app/immutable/chunks/Cpaoj_V7.js","_app/immutable/chunks/D1ZTAtSI.js","_app/immutable/chunks/Cr6JEVsd.js","_app/immutable/chunks/BanPfVL4.js","_app/immutable/chunks/Du1eGV_S.js","_app/immutable/chunks/B8q5y6JZ.js","_app/immutable/chunks/BxxFkhu7.js","_app/immutable/chunks/DhdLFye8.js","_app/immutable/chunks/Cr-q87Tu.js","_app/immutable/chunks/DT8vi1U8.js","_app/immutable/chunks/BYsOGmcf.js","_app/immutable/chunks/BOj9pCku.js","_app/immutable/chunks/gXqHeQGP.js","_app/immutable/chunks/DBXwc7kw.js","_app/immutable/chunks/CjG3KYa8.js","_app/immutable/chunks/DPhlvvxk.js","_app/immutable/chunks/DiCuuEi6.js","_app/immutable/chunks/DX6rZLP_.js","_app/immutable/chunks/BsvYabiT.js","_app/immutable/chunks/BwI86FTS.js","_app/immutable/chunks/UVOmlu3o.js","_app/immutable/chunks/rZsgLI0O.js","_app/immutable/chunks/Cw23Rtpp.js","_app/immutable/chunks/D_bRkq8V.js","_app/immutable/chunks/C3w8NTMF.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/BW2bfEe_.js","_app/immutable/chunks/DmHOGX6j.js","_app/immutable/chunks/CTicnuED.js"];
const stylesheets = [];
const fonts = [];

export { component, fonts, imports, index, _page_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=8-z3dsdosy.js.map
