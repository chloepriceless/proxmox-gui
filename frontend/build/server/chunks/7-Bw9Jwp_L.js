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
    throw error(404, "Cluster not found");
  }
  try {
    const cluster = await api.clusters.get({ id }, { fetch });
    return { user: locals.user, cluster };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      throw error(404, "Cluster not found");
    }
    throw error(500, "Could not load cluster");
  }
};

var _page_server_ts = /*#__PURE__*/Object.freeze({
  __proto__: null,
  load: load
});

const index = 7;
let component_cache;
const component = async () => component_cache ??= (await import('./_page.svelte-DYmEtWdz.js')).default;
const server_id = "src/routes/admin/clusters/[id]/+page.server.ts";
const imports = ["_app/immutable/nodes/7.CPqSTubW.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/RR2SEOsk.js","_app/immutable/chunks/DIeogL5L.js","_app/immutable/chunks/s3yjbAhm.js","_app/immutable/chunks/Cxcrlh5n.js","_app/immutable/chunks/MZ9IL_0X.js","_app/immutable/chunks/D5aDoj7M.js","_app/immutable/chunks/BS4mR_6-.js","_app/immutable/chunks/XXrISPRp.js","_app/immutable/chunks/BlTd84kF.js","_app/immutable/chunks/CtxHTuXR.js","_app/immutable/chunks/D64NQve6.js","_app/immutable/chunks/BzqC8FgQ.js","_app/immutable/chunks/CO9Uq63f.js","_app/immutable/chunks/C65twzK6.js","_app/immutable/chunks/DROBfb48.js","_app/immutable/chunks/DByFSPPP.js","_app/immutable/chunks/Cnxr7g58.js","_app/immutable/chunks/CmW2mqN3.js","_app/immutable/chunks/CjdJh7cz.js","_app/immutable/chunks/B5UJlWCz.js","_app/immutable/chunks/28G6IXYX.js","_app/immutable/chunks/AZLIevlM.js","_app/immutable/chunks/BVd6eqLD.js","_app/immutable/chunks/B-_TOQoo.js","_app/immutable/chunks/BsXubLQ0.js","_app/immutable/chunks/DXdao7Dl.js","_app/immutable/chunks/DX6rZLP_.js","_app/immutable/chunks/ClFHqJz7.js","_app/immutable/chunks/3uAMLWE4.js","_app/immutable/chunks/Da_1-pxj.js","_app/immutable/chunks/JW-elGPO.js","_app/immutable/chunks/BmDmrrKp.js","_app/immutable/chunks/D--Jdt90.js","_app/immutable/chunks/Bmv0KEJ-.js","_app/immutable/chunks/6Cqh88Hg.js","_app/immutable/chunks/BuexN0M3.js","_app/immutable/chunks/69_IOA4Y.js","_app/immutable/chunks/BDthO0oC.js","_app/immutable/chunks/DKTwPRsf.js","_app/immutable/chunks/BJ3edVnq.js","_app/immutable/chunks/BiwpzDcT.js","_app/immutable/chunks/Ca6f3fYo.js","_app/immutable/chunks/B_qRnoTm.js","_app/immutable/chunks/-YrLaBmF.js","_app/immutable/chunks/Pa-iekPG.js","_app/immutable/chunks/C_brZbnu.js","_app/immutable/chunks/D3ZoGAAg.js","_app/immutable/chunks/DvvynLAU.js","_app/immutable/chunks/TacstRM6.js","_app/immutable/chunks/DMY-2uJ3.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/DIxP2VRk.js","_app/immutable/chunks/CZh8055f.js","_app/immutable/chunks/LE3FM59i.js"];
const stylesheets = ["_app/immutable/assets/select-trigger.CV-KWLNP.css"];
const fonts = [];

export { component, fonts, imports, index, _page_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=7-Bw9Jwp_L.js.map
