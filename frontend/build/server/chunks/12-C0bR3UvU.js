import { redirect } from '@sveltejs/kit';
import { a as api } from './client2-vvZGy19D.js';

const load = async ({ locals, url, fetch }) => {
  if (!locals.user) {
    const next = encodeURIComponent(url.pathname + url.search);
    throw redirect(303, `/login?next=${next}`);
  }
  try {
    const inventory = await api.inventory.listAll({ fetch });
    return { user: locals.user, inventory, loadError: false };
  } catch {
    return { user: locals.user, inventory: [], loadError: true };
  }
};

var _page_server_ts = /*#__PURE__*/Object.freeze({
  __proto__: null,
  load: load
});

const index = 12;
let component_cache;
const component = async () => component_cache ??= (await import('./_page.svelte-BiOl3Im-.js')).default;
const server_id = "src/routes/inventory/+page.server.ts";
const imports = ["_app/immutable/nodes/12.BJpHiPvj.js","_app/immutable/chunks/kSsaFjxf.js","_app/immutable/chunks/8Q54h-zb.js","_app/immutable/chunks/DhdLFye8.js","_app/immutable/chunks/Cr-q87Tu.js","_app/immutable/chunks/D1ZTAtSI.js","_app/immutable/chunks/Cr6JEVsd.js","_app/immutable/chunks/BanPfVL4.js","_app/immutable/chunks/Du1eGV_S.js","_app/immutable/chunks/B8q5y6JZ.js","_app/immutable/chunks/BxxFkhu7.js","_app/immutable/chunks/CLaOwPZH.js","_app/immutable/chunks/Cpaoj_V7.js","_app/immutable/chunks/DqmRHnIV.js","_app/immutable/chunks/CjG3KYa8.js","_app/immutable/chunks/DPhlvvxk.js","_app/immutable/chunks/DiCuuEi6.js","_app/immutable/chunks/DX6rZLP_.js","_app/immutable/chunks/BsvYabiT.js","_app/immutable/chunks/gXqHeQGP.js","_app/immutable/chunks/BOj9pCku.js","_app/immutable/chunks/__4kodT9.js","_app/immutable/chunks/CNrV3U9r.js","_app/immutable/chunks/C8WhxpTB.js","_app/immutable/chunks/CyO3DNvU.js","_app/immutable/chunks/g7hqBG47.js","_app/immutable/chunks/0wRbRz3B.js","_app/immutable/chunks/BZaIOe1W.js","_app/immutable/chunks/Bt_XVpwk.js"];
const stylesheets = [];
const fonts = [];

export { component, fonts, imports, index, _page_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=12-C0bR3UvU.js.map
