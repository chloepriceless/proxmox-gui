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

const index = 7;
let component_cache;
const component = async () => component_cache ??= (await import('./_page.svelte-Bk7ojxbO.js')).default;
const server_id = "src/routes/admin/teams/[id]/+page.server.ts";
const imports = ["_app/immutable/nodes/7.B0FTzxPl.js","_app/immutable/chunks/kSsaFjxf.js","_app/immutable/chunks/8Q54h-zb.js","_app/immutable/chunks/DhdLFye8.js","_app/immutable/chunks/Cr-q87Tu.js","_app/immutable/chunks/D1ZTAtSI.js","_app/immutable/chunks/Cr6JEVsd.js","_app/immutable/chunks/BanPfVL4.js","_app/immutable/chunks/BxxFkhu7.js","_app/immutable/chunks/BYsOGmcf.js","_app/immutable/chunks/Cpaoj_V7.js","_app/immutable/chunks/kjIi5wpe.js","_app/immutable/chunks/BS5acttY.js","_app/immutable/chunks/Du1eGV_S.js","_app/immutable/chunks/B8q5y6JZ.js","_app/immutable/chunks/DX6rZLP_.js","_app/immutable/chunks/DPhlvvxk.js","_app/immutable/chunks/DiCuuEi6.js","_app/immutable/chunks/D4AlTCkS.js","_app/immutable/chunks/CvjJxdq9.js","_app/immutable/chunks/rZsgLI0O.js","_app/immutable/chunks/BZaIOe1W.js","_app/immutable/chunks/Cw23Rtpp.js","_app/immutable/chunks/__4kodT9.js","_app/immutable/chunks/C3w8NTMF.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/DmHOGX6j.js"];
const stylesheets = [];
const fonts = [];

export { component, fonts, imports, index, _page_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=7-BNUBv1Cv.js.map
