import { redirect, error } from '@sveltejs/kit';
import { a as api, A as ApiError } from './client2-vvZGy19D.js';

const load = async ({ locals, params, url, fetch }) => {
  if (!locals.user) {
    const next = encodeURIComponent(url.pathname + url.search);
    throw redirect(303, `/login?next=${next}`);
  }
  if (!locals.user.is_admin) {
    throw redirect(303, "/");
  }
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) {
    throw error(404, "User not found");
  }
  try {
    const target = await api.users.get({ id }, { fetch });
    let teams = [];
    try {
      teams = await api.teams.list({ fetch });
    } catch {
      teams = [];
    }
    return { user: locals.user, target, teams };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      throw error(404, "User not found");
    }
    throw error(500, "Could not load user");
  }
};

var _page_server_ts = /*#__PURE__*/Object.freeze({
  __proto__: null,
  load: load
});

const index = 11;
let component_cache;
const component = async () => component_cache ??= (await import('./_page.svelte-DxU3mN15.js')).default;
const server_id = "src/routes/admin/users/[id]/+page.server.ts";
const imports = ["_app/immutable/nodes/11.rGe4DgVo.js","_app/immutable/chunks/CMT2gXTl.js","_app/immutable/chunks/nMe2PDh0.js","_app/immutable/chunks/CERU589C.js","_app/immutable/chunks/2EOrEV4J.js","_app/immutable/chunks/D0scdGz7.js","_app/immutable/chunks/BvIrdU2Z.js","_app/immutable/chunks/COMVsDF6.js","_app/immutable/chunks/Dj2AhZJ6.js","_app/immutable/chunks/B8oe2iq3.js","_app/immutable/chunks/DMbBZyaY.js","_app/immutable/chunks/CA0NtBrQ.js","_app/immutable/chunks/BPUTH6z7.js","_app/immutable/chunks/CYy-j-nn.js","_app/immutable/chunks/e6sNuQvl.js","_app/immutable/chunks/WhuL-KVn.js","_app/immutable/chunks/Bamql8uG.js","_app/immutable/chunks/yFINY5bt.js","_app/immutable/chunks/BSfWWMNN.js","_app/immutable/chunks/D-HtDwqB.js","_app/immutable/chunks/BHvW3iEQ.js","_app/immutable/chunks/BKOTW_l5.js","_app/immutable/chunks/q8K2smeH.js","_app/immutable/chunks/9RgIyoY-.js","_app/immutable/chunks/BZVYgfsK.js","_app/immutable/chunks/-sIcaygn.js","_app/immutable/chunks/DX6rZLP_.js","_app/immutable/chunks/Cq6xiIyk.js","_app/immutable/chunks/HxF7MWIb.js","_app/immutable/chunks/DyITn7Vu.js","_app/immutable/chunks/CdyZtJvn.js","_app/immutable/chunks/okoh3Ugm.js","_app/immutable/chunks/DIH5CpZM.js","_app/immutable/chunks/BvenazgL.js","_app/immutable/chunks/vMiXAwsv.js","_app/immutable/chunks/D3T5qvDm.js","_app/immutable/chunks/DNayJybw.js","_app/immutable/chunks/CP-ExwxP.js","_app/immutable/chunks/C3w8NTMF.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/C_UAyONT.js","_app/immutable/chunks/DR-izm2S.js"];
const stylesheets = [];
const fonts = [];

export { component, fonts, imports, index, _page_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=11-CKFvc1ll.js.map
