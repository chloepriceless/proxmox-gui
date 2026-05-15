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

const index = 7;
let component_cache;
const component = async () => component_cache ??= (await import('./_page.svelte-C8Ktx7dQ.js')).default;
const server_id = "src/routes/admin/teams/+page.server.ts";
const imports = ["_app/immutable/nodes/7.purdLbEr.js","_app/immutable/chunks/CMT2gXTl.js","_app/immutable/chunks/nMe2PDh0.js","_app/immutable/chunks/CYy-j-nn.js","_app/immutable/chunks/CERU589C.js","_app/immutable/chunks/2EOrEV4J.js","_app/immutable/chunks/D0scdGz7.js","_app/immutable/chunks/BvIrdU2Z.js","_app/immutable/chunks/COMVsDF6.js","_app/immutable/chunks/Dj2AhZJ6.js","_app/immutable/chunks/B8oe2iq3.js","_app/immutable/chunks/DMbBZyaY.js","_app/immutable/chunks/CA0NtBrQ.js","_app/immutable/chunks/BPUTH6z7.js","_app/immutable/chunks/BSfWWMNN.js","_app/immutable/chunks/CIBfkCdn.js","_app/immutable/chunks/DwSIRGTU.js","_app/immutable/chunks/DzpNtI0K.js","_app/immutable/chunks/DR-izm2S.js"];
const stylesheets = [];
const fonts = [];

export { component, fonts, imports, index, _page_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=7-DCnG6ev1.js.map
