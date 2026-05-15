import { redirect } from '@sveltejs/kit';

const load = async ({ locals, url }) => {
  if (!locals.user) {
    const next = encodeURIComponent(url.pathname + url.search);
    throw redirect(303, `/login?next=${next}`);
  }
  if (!locals.user.is_admin) {
    throw redirect(303, "/");
  }
  return { user: locals.user };
};

var _page_server_ts = /*#__PURE__*/Object.freeze({
  __proto__: null,
  load: load
});

const index = 6;
let component_cache;
const component = async () => component_cache ??= (await import('./_page.svelte-CIX1qi-J.js')).default;
const server_id = "src/routes/admin/clusters/new/+page.server.ts";
const imports = ["_app/immutable/nodes/6.vUrol5TZ.js","_app/immutable/chunks/CMT2gXTl.js","_app/immutable/chunks/nMe2PDh0.js","_app/immutable/chunks/CERU589C.js","_app/immutable/chunks/2EOrEV4J.js","_app/immutable/chunks/D0scdGz7.js","_app/immutable/chunks/Dj2AhZJ6.js","_app/immutable/chunks/B8oe2iq3.js","_app/immutable/chunks/DMbBZyaY.js","_app/immutable/chunks/CA0NtBrQ.js","_app/immutable/chunks/BPUTH6z7.js","_app/immutable/chunks/CYy-j-nn.js","_app/immutable/chunks/e6sNuQvl.js","_app/immutable/chunks/COMVsDF6.js","_app/immutable/chunks/BvIrdU2Z.js","_app/immutable/chunks/WhuL-KVn.js","_app/immutable/chunks/Bamql8uG.js","_app/immutable/chunks/yFINY5bt.js","_app/immutable/chunks/D-HtDwqB.js","_app/immutable/chunks/BHvW3iEQ.js","_app/immutable/chunks/Cq6xiIyk.js","_app/immutable/chunks/HxF7MWIb.js","_app/immutable/chunks/q8K2smeH.js","_app/immutable/chunks/9RgIyoY-.js","_app/immutable/chunks/BZVYgfsK.js","_app/immutable/chunks/-sIcaygn.js","_app/immutable/chunks/DyITn7Vu.js","_app/immutable/chunks/CdyZtJvn.js","_app/immutable/chunks/okoh3Ugm.js","_app/immutable/chunks/DIH5CpZM.js","_app/immutable/chunks/BvenazgL.js","_app/immutable/chunks/BvphFi8n.js","_app/immutable/chunks/DJI3tkAA.js","_app/immutable/chunks/C3w8NTMF.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/C_UAyONT.js","_app/immutable/chunks/DR-izm2S.js"];
const stylesheets = [];
const fonts = [];

export { component, fonts, imports, index, _page_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=6-D59KKJ_w.js.map
