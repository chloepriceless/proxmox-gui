import { redirect, error } from '@sveltejs/kit';
import { a as api } from './client2-WJrlUD72.js';

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

const index = 10;
let component_cache;
const component = async () => component_cache ??= (await import('./_page.svelte-Cz9bfPrq.js')).default;
const server_id = "src/routes/admin/teams/[id]/+page.server.ts";
const imports = ["_app/immutable/nodes/10.C4k8io4X.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/RR2SEOsk.js","_app/immutable/chunks/DIeogL5L.js","_app/immutable/chunks/CtxHTuXR.js","_app/immutable/chunks/D64NQve6.js","_app/immutable/chunks/s3yjbAhm.js","_app/immutable/chunks/Cxcrlh5n.js","_app/immutable/chunks/MZ9IL_0X.js","_app/immutable/chunks/D5aDoj7M.js","_app/immutable/chunks/BzqC8FgQ.js","_app/immutable/chunks/C65twzK6.js","_app/immutable/chunks/DROBfb48.js","_app/immutable/chunks/-xA_ljcr.js","_app/immutable/chunks/CQ7digqE.js","_app/immutable/chunks/BlTd84kF.js","_app/immutable/chunks/Cnxr7g58.js","_app/immutable/chunks/BS4mR_6-.js","_app/immutable/chunks/XXrISPRp.js","_app/immutable/chunks/B-_TOQoo.js","_app/immutable/chunks/DX6rZLP_.js","_app/immutable/chunks/BsXubLQ0.js","_app/immutable/chunks/DXdao7Dl.js","_app/immutable/chunks/L-M73iBu.js","_app/immutable/chunks/vG5W5MrS.js","_app/immutable/chunks/C_brZbnu.js","_app/immutable/chunks/D0wBRbAx.js","_app/immutable/chunks/B5UJlWCz.js","_app/immutable/chunks/Ca6f3fYo.js","_app/immutable/chunks/DMY-2uJ3.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/LE3FM59i.js","_app/immutable/chunks/6Cqh88Hg.js","_app/immutable/chunks/BuexN0M3.js","_app/immutable/chunks/69_IOA4Y.js","_app/immutable/chunks/BDthO0oC.js","_app/immutable/chunks/ClFHqJz7.js","_app/immutable/chunks/3uAMLWE4.js","_app/immutable/chunks/Da_1-pxj.js","_app/immutable/chunks/Bmv0KEJ-.js","_app/immutable/chunks/DByFSPPP.js"];
const stylesheets = [];
const fonts = [];

export { component, fonts, imports, index, _page_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=10-D9lM7WrT.js.map
