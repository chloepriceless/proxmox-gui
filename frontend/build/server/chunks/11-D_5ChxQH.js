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
const imports = ["_app/immutable/nodes/11.CtvnWuIl.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/DtgIT0Nk.js","_app/immutable/chunks/DIeogL5L.js","_app/immutable/chunks/VBX2TTCL.js","_app/immutable/chunks/Bx2UN8uz.js","_app/immutable/chunks/wDcso0V5.js","_app/immutable/chunks/BjBfRCTG.js","_app/immutable/chunks/CYGcQVzr.js","_app/immutable/chunks/BX9zuvTI.js","_app/immutable/chunks/C9-TIUVJ.js","_app/immutable/chunks/IGP5Wxuu.js","_app/immutable/chunks/58iVOwiH.js","_app/immutable/chunks/C41prowm.js","_app/immutable/chunks/DIFdNeux.js","_app/immutable/chunks/D8VB7bmC.js","_app/immutable/chunks/Cv7FRnQS.js","_app/immutable/chunks/Bvg1YchZ.js","_app/immutable/chunks/CRhdZnMJ.js","_app/immutable/chunks/CLSS4PPm.js","_app/immutable/chunks/BfYloIzP.js","_app/immutable/chunks/CKBi3O3H.js","_app/immutable/chunks/CYRXNNKL.js","_app/immutable/chunks/DxYeJU7q.js","_app/immutable/chunks/69_IOA4Y.js","_app/immutable/chunks/CKSBknU8.js","_app/immutable/chunks/DZtUfXhX.js","_app/immutable/chunks/CghoW6jw.js","_app/immutable/chunks/DX6rZLP_.js","_app/immutable/chunks/BAddTLgc.js","_app/immutable/chunks/SNMxVn7f.js","_app/immutable/chunks/DmYsQdH5.js","_app/immutable/chunks/jOCS1_eD.js","_app/immutable/chunks/DZRqd1Sg.js","_app/immutable/chunks/BUoQgrpu.js","_app/immutable/chunks/D9EM1o3c.js","_app/immutable/chunks/DYh20XpK.js","_app/immutable/chunks/DsF8yCE9.js","_app/immutable/chunks/Cl_WtxYR.js","_app/immutable/chunks/wG_HTVV7.js","_app/immutable/chunks/C3w8NTMF.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/QYwc91az.js","_app/immutable/chunks/CoiN2_Uy.js"];
const stylesheets = [];
const fonts = [];

export { component, fonts, imports, index, _page_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=11-D_5ChxQH.js.map
