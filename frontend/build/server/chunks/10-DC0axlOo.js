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

const index = 10;
let component_cache;
const component = async () => component_cache ??= (await import('./_page.svelte-B9vKKbxZ.js')).default;
const server_id = "src/routes/admin/users/+page.server.ts";
const imports = ["_app/immutable/nodes/10.BziWyWdl.js","_app/immutable/chunks/CMT2gXTl.js","_app/immutable/chunks/nMe2PDh0.js","_app/immutable/chunks/CYy-j-nn.js","_app/immutable/chunks/CERU589C.js","_app/immutable/chunks/2EOrEV4J.js","_app/immutable/chunks/D0scdGz7.js","_app/immutable/chunks/BvIrdU2Z.js","_app/immutable/chunks/COMVsDF6.js","_app/immutable/chunks/Dj2AhZJ6.js","_app/immutable/chunks/B8oe2iq3.js","_app/immutable/chunks/DMbBZyaY.js","_app/immutable/chunks/CA0NtBrQ.js","_app/immutable/chunks/BPUTH6z7.js","_app/immutable/chunks/BSfWWMNN.js","_app/immutable/chunks/CIBfkCdn.js","_app/immutable/chunks/DwSIRGTU.js","_app/immutable/chunks/Basa6-iB.js","_app/immutable/chunks/DNayJybw.js","_app/immutable/chunks/q8K2smeH.js","_app/immutable/chunks/D-HtDwqB.js","_app/immutable/chunks/DX6rZLP_.js","_app/immutable/chunks/njJjZ6u3.js","_app/immutable/chunks/CclbWlWt.js","_app/immutable/chunks/vMiXAwsv.js","_app/immutable/chunks/D3T5qvDm.js","_app/immutable/chunks/CP-ExwxP.js","_app/immutable/chunks/BHvW3iEQ.js","_app/immutable/chunks/C3w8NTMF.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/DzpNtI0K.js","_app/immutable/chunks/DR-izm2S.js","_app/immutable/chunks/BuqmBQE6.js"];
const stylesheets = [];
const fonts = [];

export { component, fonts, imports, index, _page_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=10-DC0axlOo.js.map
