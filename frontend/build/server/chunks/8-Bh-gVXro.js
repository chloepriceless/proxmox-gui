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
const imports = ["_app/immutable/nodes/8.DtGQzGlh.js","_app/immutable/chunks/CMT2gXTl.js","_app/immutable/chunks/nMe2PDh0.js","_app/immutable/chunks/B8oe2iq3.js","_app/immutable/chunks/DMbBZyaY.js","_app/immutable/chunks/CERU589C.js","_app/immutable/chunks/2EOrEV4J.js","_app/immutable/chunks/D0scdGz7.js","_app/immutable/chunks/Dj2AhZJ6.js","_app/immutable/chunks/BPUTH6z7.js","_app/immutable/chunks/CYy-j-nn.js","_app/immutable/chunks/DNJSSTD3.js","_app/immutable/chunks/BkkJ-4fv.js","_app/immutable/chunks/BvIrdU2Z.js","_app/immutable/chunks/COMVsDF6.js","_app/immutable/chunks/D-HtDwqB.js","_app/immutable/chunks/DX6rZLP_.js","_app/immutable/chunks/DNayJybw.js","_app/immutable/chunks/q8K2smeH.js","_app/immutable/chunks/C9Sj2SOW.js","_app/immutable/chunks/C9Zkd1y4.js","_app/immutable/chunks/D3T5qvDm.js","_app/immutable/chunks/BzkMVAVa.js","_app/immutable/chunks/CP-ExwxP.js","_app/immutable/chunks/Bamql8uG.js","_app/immutable/chunks/DIH5CpZM.js","_app/immutable/chunks/C3w8NTMF.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/DR-izm2S.js"];
const stylesheets = [];
const fonts = [];

export { component, fonts, imports, index, _page_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=8-Bh-gVXro.js.map
