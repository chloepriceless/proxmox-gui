import { redirect, error } from '@sveltejs/kit';
import { a as api } from './client2-vvZGy19D.js';

const load = async ({ locals, params, url, fetch }) => {
  if (!locals.user) {
    const next = encodeURIComponent(url.pathname + url.search);
    throw redirect(303, `/login?next=${next}`);
  }
  if (!locals.user.is_admin) throw redirect(303, "/");
  const teamId = Number(params.id);
  if (!Number.isFinite(teamId) || teamId <= 0) throw error(404, "Not found");
  try {
    const quotas = await api.quotas.getTeamQuotas({ teamId }, { fetch });
    return { user: locals.user, teamId, quotas, loadError: false };
  } catch {
    return {
      user: locals.user,
      teamId,
      quotas: { team_id: teamId, team_name: `Team ${teamId}`, rows: [] },
      loadError: true
    };
  }
};

var _page_server_ts = /*#__PURE__*/Object.freeze({
  __proto__: null,
  load: load
});

const index = 8;
let component_cache;
const component = async () => component_cache ??= (await import('./_page.svelte-Cn8nbP6s.js')).default;
const server_id = "src/routes/admin/teams/[id]/+page.server.ts";
const imports = ["_app/immutable/nodes/8.DCwxaYgF.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/DtgIT0Nk.js","_app/immutable/chunks/DIeogL5L.js","_app/immutable/chunks/CYGcQVzr.js","_app/immutable/chunks/BX9zuvTI.js","_app/immutable/chunks/VBX2TTCL.js","_app/immutable/chunks/Bx2UN8uz.js","_app/immutable/chunks/wDcso0V5.js","_app/immutable/chunks/BjBfRCTG.js","_app/immutable/chunks/C41prowm.js","_app/immutable/chunks/DIFdNeux.js","_app/immutable/chunks/DoJuxm4-.js","_app/immutable/chunks/qQI37Ln8.js","_app/immutable/chunks/C9-TIUVJ.js","_app/immutable/chunks/IGP5Wxuu.js","_app/immutable/chunks/BfYloIzP.js","_app/immutable/chunks/DX6rZLP_.js","_app/immutable/chunks/Cl_WtxYR.js","_app/immutable/chunks/DxYeJU7q.js","_app/immutable/chunks/DpYqMj1u.js","_app/immutable/chunks/Bo0LVusD.js","_app/immutable/chunks/DsF8yCE9.js","_app/immutable/chunks/CnkkOk4e.js","_app/immutable/chunks/wG_HTVV7.js","_app/immutable/chunks/Bvg1YchZ.js","_app/immutable/chunks/BUoQgrpu.js","_app/immutable/chunks/C3w8NTMF.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/CoiN2_Uy.js"];
const stylesheets = [];
const fonts = [];

export { component, fonts, imports, index, _page_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=8-BLsJki0h.js.map
