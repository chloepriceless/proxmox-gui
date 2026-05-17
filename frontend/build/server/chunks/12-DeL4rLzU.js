import { redirect, error } from '@sveltejs/kit';
import { a as api, A as ApiError } from './client2-WJrlUD72.js';

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

const index = 12;
let component_cache;
const component = async () => component_cache ??= (await import('./_page.svelte-BU7POYd8.js')).default;
const server_id = "src/routes/admin/users/[id]/+page.server.ts";
const imports = ["_app/immutable/nodes/12.H-szWrTi.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/B76fPDHw.js","_app/immutable/chunks/DIeogL5L.js","_app/immutable/chunks/BZy2rKVh.js","_app/immutable/chunks/DG-AIyDW.js","_app/immutable/chunks/HtuQ-t6z.js","_app/immutable/chunks/DFf0_9oh.js","_app/immutable/chunks/B0O0__6X.js","_app/immutable/chunks/Da8-qn49.js","_app/immutable/chunks/BkYbJ__8.js","_app/immutable/chunks/1_Ev5Rxk.js","_app/immutable/chunks/Cv6kQ42Y.js","_app/immutable/chunks/CcQORYn5.js","_app/immutable/chunks/D_MEs5oK.js","_app/immutable/chunks/Cmh71_M-.js","_app/immutable/chunks/3e5_4EXJ.js","_app/immutable/chunks/CKvDEHfU.js","_app/immutable/chunks/bddXi7Xq.js","_app/immutable/chunks/C_CXB-aj.js","_app/immutable/chunks/DyhqqZP2.js","_app/immutable/chunks/CbiA0b_9.js","_app/immutable/chunks/C6ALetTt.js","_app/immutable/chunks/DehlN6xb.js","_app/immutable/chunks/Dx6FHG0s.js","_app/immutable/chunks/gf1xWwEA.js","_app/immutable/chunks/69_IOA4Y.js","_app/immutable/chunks/Beh3eMVO.js","_app/immutable/chunks/C9dUKBca.js","_app/immutable/chunks/CmYxEM7h.js","_app/immutable/chunks/DX6rZLP_.js","_app/immutable/chunks/CGjc-1_p.js","_app/immutable/chunks/Ce_j8yZB.js","_app/immutable/chunks/vZ-i5BTB.js","_app/immutable/chunks/AEguaSGS.js","_app/immutable/chunks/B5iXubSn.js","_app/immutable/chunks/yuBbTQ9Y.js","_app/immutable/chunks/B7oWRHuv.js","_app/immutable/chunks/D3KbMdW9.js","_app/immutable/chunks/DMQMzTaZ.js","_app/immutable/chunks/BkPKArPq.js","_app/immutable/chunks/Tjug4qrk.js","_app/immutable/chunks/DMY-2uJ3.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/BtKg1HSK.js","_app/immutable/chunks/dYsEJFvI.js","_app/immutable/chunks/kMNdv31G.js"];
const stylesheets = [];
const fonts = [];

export { component, fonts, imports, index, _page_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=12-DeL4rLzU.js.map
