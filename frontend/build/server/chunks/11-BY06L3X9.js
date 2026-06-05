import { redirect, error } from '@sveltejs/kit';
import { a as api } from './client2-FWmWn_B2.js';
import './api-By_nInf4.js';

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

const index = 11;
let component_cache;
const component = async () => component_cache ??= (await import('./_page.svelte-B2EjaTRK.js')).default;
const server_id = "src/routes/admin/teams/[id]/+page.server.ts";
const imports = ["_app/immutable/nodes/11.w2BvgmQo.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/Dz1QOFME.js","_app/immutable/chunks/DIeogL5L.js","_app/immutable/chunks/DOYCa-jC.js","_app/immutable/chunks/BWtVFkZa.js","_app/immutable/chunks/FWqmEuGW.js","_app/immutable/chunks/D05lJ7N6.js","_app/immutable/chunks/D1PT0PJt.js","_app/immutable/chunks/V0qHDq3T.js","_app/immutable/chunks/BzDeVsP6.js","_app/immutable/chunks/BN7qKuWY.js","_app/immutable/chunks/CkHOVrVr.js","_app/immutable/chunks/Ci4YN2dC.js","_app/immutable/chunks/6I7ffYvk.js","_app/immutable/chunks/0vWx1Ok7.js","_app/immutable/chunks/CLnOhmYe.js","_app/immutable/chunks/Bkp9Bvf2.js","_app/immutable/chunks/BEbkK47e.js","_app/immutable/chunks/Cm0_jSID.js","_app/immutable/chunks/DX6rZLP_.js","_app/immutable/chunks/PbjDttTu.js","_app/immutable/chunks/BM8cuwzl.js","_app/immutable/chunks/BLuQ-h8b.js","_app/immutable/chunks/BybhHQDJ.js","_app/immutable/chunks/B5LKCUWQ.js","_app/immutable/chunks/MmXwFXPw.js","_app/immutable/chunks/iSi4Pzi1.js","_app/immutable/chunks/DJgManEa.js","_app/immutable/chunks/C3ypeMEV.js","_app/immutable/chunks/CiRzWSu_.js","_app/immutable/chunks/DeMueevT.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/BDN8t5bm.js","_app/immutable/chunks/CDp3X21l.js","_app/immutable/chunks/CSuFVlI8.js","_app/immutable/chunks/69_IOA4Y.js","_app/immutable/chunks/C9koXsUJ.js","_app/immutable/chunks/BZQjfy36.js","_app/immutable/chunks/Cvinc6lT.js","_app/immutable/chunks/DMxHxQob.js","_app/immutable/chunks/BMhCvoyS.js","_app/immutable/chunks/DIJ6X1Rv.js"];
const stylesheets = [];
const fonts = [];

export { component, fonts, imports, index, _page_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=11-BY06L3X9.js.map
