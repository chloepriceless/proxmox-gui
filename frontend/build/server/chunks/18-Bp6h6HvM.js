import { redirect } from '@sveltejs/kit';
import { a as api } from './client2-vvZGy19D.js';

const load = async ({ locals, url, fetch }) => {
  if (!locals.user) {
    const next = encodeURIComponent(url.pathname + url.search);
    throw redirect(303, `/login?next=${next}`);
  }
  try {
    const tokens = await api.me.listTokens({ fetch });
    return { user: locals.user, tokens, loadError: false };
  } catch {
    return { user: locals.user, tokens: [], loadError: true };
  }
};

var _page_server_ts = /*#__PURE__*/Object.freeze({
  __proto__: null,
  load: load
});

const index = 18;
let component_cache;
const component = async () => component_cache ??= (await import('./_page.svelte-CXN8T8pj.js')).default;
const server_id = "src/routes/profile/tokens/+page.server.ts";
const imports = ["_app/immutable/nodes/18.qFfx0s6x.js","_app/immutable/chunks/kSsaFjxf.js","_app/immutable/chunks/8Q54h-zb.js","_app/immutable/chunks/Cpaoj_V7.js","_app/immutable/chunks/D1ZTAtSI.js","_app/immutable/chunks/Cr6JEVsd.js","_app/immutable/chunks/BanPfVL4.js","_app/immutable/chunks/Du1eGV_S.js","_app/immutable/chunks/B8q5y6JZ.js","_app/immutable/chunks/BxxFkhu7.js","_app/immutable/chunks/DhdLFye8.js","_app/immutable/chunks/Cr-q87Tu.js","_app/immutable/chunks/DT8vi1U8.js","_app/immutable/chunks/CLaOwPZH.js","_app/immutable/chunks/D3X6iaz6.js","_app/immutable/chunks/UsEaE9d9.js","_app/immutable/chunks/__4kodT9.js","_app/immutable/chunks/CNrV3U9r.js","_app/immutable/chunks/D4AlTCkS.js","_app/immutable/chunks/CvjJxdq9.js","_app/immutable/chunks/rZsgLI0O.js","_app/immutable/chunks/DiCuuEi6.js","_app/immutable/chunks/DPhlvvxk.js","_app/immutable/chunks/DX6rZLP_.js","_app/immutable/chunks/BZaIOe1W.js","_app/immutable/chunks/Cw23Rtpp.js","_app/immutable/chunks/CjG3KYa8.js","_app/immutable/chunks/BsvYabiT.js","_app/immutable/chunks/BOj9pCku.js","_app/immutable/chunks/D_bRkq8V.js","_app/immutable/chunks/CvyRKL9b.js","_app/immutable/chunks/DgsMve4N.js","_app/immutable/chunks/UVOmlu3o.js","_app/immutable/chunks/DBQQ19gE.js","_app/immutable/chunks/C3w8NTMF.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/DmHOGX6j.js","_app/immutable/chunks/CVwKji1V.js","_app/immutable/chunks/CTicnuED.js"];
const stylesheets = [];
const fonts = [];

export { component, fonts, imports, index, _page_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=18-Bp6h6HvM.js.map
