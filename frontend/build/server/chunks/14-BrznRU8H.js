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

const index = 14;
let component_cache;
const component = async () => component_cache ??= (await import('./_page.svelte-DitnGsxu.js')).default;
const server_id = "src/routes/inventory/+page.server.ts";
const imports = ["_app/immutable/nodes/14.C9OnU4c2.js","_app/immutable/chunks/CMT2gXTl.js","_app/immutable/chunks/nMe2PDh0.js","_app/immutable/chunks/B8oe2iq3.js","_app/immutable/chunks/DMbBZyaY.js","_app/immutable/chunks/CERU589C.js","_app/immutable/chunks/2EOrEV4J.js","_app/immutable/chunks/D0scdGz7.js","_app/immutable/chunks/BvIrdU2Z.js","_app/immutable/chunks/COMVsDF6.js","_app/immutable/chunks/Dj2AhZJ6.js","_app/immutable/chunks/BPUTH6z7.js","_app/immutable/chunks/CYy-j-nn.js","_app/immutable/chunks/DNJSSTD3.js","_app/immutable/chunks/D-HtDwqB.js","_app/immutable/chunks/Basa6-iB.js","_app/immutable/chunks/DNayJybw.js","_app/immutable/chunks/q8K2smeH.js","_app/immutable/chunks/DX6rZLP_.js","_app/immutable/chunks/njJjZ6u3.js","_app/immutable/chunks/CIBfkCdn.js","_app/immutable/chunks/BSfWWMNN.js","_app/immutable/chunks/Bamql8uG.js","_app/immutable/chunks/DIH5CpZM.js","_app/immutable/chunks/yFINY5bt.js","_app/immutable/chunks/BvphFi8n.js","_app/immutable/chunks/DJI3tkAA.js","_app/immutable/chunks/CwiUZSdT.js","_app/immutable/chunks/DVefQIQk.js","_app/immutable/chunks/BzkMVAVa.js","_app/immutable/chunks/sAZfxpCj.js"];
const stylesheets = [];
const fonts = [];

export { component, fonts, imports, index, _page_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=14-BrznRU8H.js.map
