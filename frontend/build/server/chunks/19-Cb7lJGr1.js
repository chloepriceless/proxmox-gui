import { redirect } from '@sveltejs/kit';
import { a as api } from './client2-vvZGy19D.js';

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

const index = 19;
let component_cache;
const component = async () => component_cache ??= (await import('./_page.svelte-qbX3qMCs.js')).default;
const server_id = "src/routes/profile/ssh-keys/+page.server.ts";
const imports = ["_app/immutable/nodes/19.C3RvF9uO.js","_app/immutable/chunks/CMT2gXTl.js","_app/immutable/chunks/nMe2PDh0.js","_app/immutable/chunks/CYy-j-nn.js","_app/immutable/chunks/CERU589C.js","_app/immutable/chunks/2EOrEV4J.js","_app/immutable/chunks/D0scdGz7.js","_app/immutable/chunks/BvIrdU2Z.js","_app/immutable/chunks/COMVsDF6.js","_app/immutable/chunks/Dj2AhZJ6.js","_app/immutable/chunks/B8oe2iq3.js","_app/immutable/chunks/DMbBZyaY.js","_app/immutable/chunks/CA0NtBrQ.js","_app/immutable/chunks/BPUTH6z7.js","_app/immutable/chunks/e6sNuQvl.js","_app/immutable/chunks/WhuL-KVn.js","_app/immutable/chunks/Bamql8uG.js","_app/immutable/chunks/yFINY5bt.js","_app/immutable/chunks/C9Sj2SOW.js","_app/immutable/chunks/C9Zkd1y4.js","_app/immutable/chunks/D3T5qvDm.js","_app/immutable/chunks/D-HtDwqB.js","_app/immutable/chunks/q8K2smeH.js","_app/immutable/chunks/DNayJybw.js","_app/immutable/chunks/DX6rZLP_.js","_app/immutable/chunks/BzkMVAVa.js","_app/immutable/chunks/CP-ExwxP.js","_app/immutable/chunks/Basa6-iB.js","_app/immutable/chunks/njJjZ6u3.js","_app/immutable/chunks/BHvW3iEQ.js","_app/immutable/chunks/DQn15KtG.js","_app/immutable/chunks/okoh3Ugm.js","_app/immutable/chunks/DIH5CpZM.js","_app/immutable/chunks/BvenazgL.js","_app/immutable/chunks/vMiXAwsv.js","_app/immutable/chunks/C3w8NTMF.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/DR-izm2S.js","_app/immutable/chunks/BUi5cdfG.js","_app/immutable/chunks/BuqmBQE6.js"];
const stylesheets = [];
const fonts = [];

export { component, fonts, imports, index, _page_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=19-Cb7lJGr1.js.map
