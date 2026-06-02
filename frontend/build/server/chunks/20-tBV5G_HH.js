import { redirect, error } from '@sveltejs/kit';
import { a as api, A as ApiError } from './client2-WJrlUD72.js';

async function probeBackupStorage(clusterId, fetch) {
  try {
    const cluster = await api.clusters.get({ id: clusterId }, { fetch });
    return !!cluster.backup_storage;
  } catch {
    return true;
  }
}
const load = async ({ locals, params, url, fetch }) => {
  if (!locals.user) {
    const next = encodeURIComponent(url.pathname + url.search);
    throw redirect(303, `/login?next=${next}`);
  }
  const clusterId = Number(params.cluster);
  const vmid = Number(params.vmid);
  if (!Number.isInteger(clusterId) || clusterId <= 0 || !Number.isInteger(vmid) || vmid <= 0) {
    throw error(404, "Not found");
  }
  try {
    const detail = await api.inventory.getDetail({ clusterId, vmid, type: "vm", fetch });
    const backupStorageConfigured = await probeBackupStorage(clusterId, fetch);
    return { user: locals.user, detail, backupStorageConfigured, loadError: false };
  } catch (e1) {
    if (!(e1 instanceof ApiError && e1.status === 403)) ;
    try {
      const detail = await api.inventory.getDetail({ clusterId, vmid, type: "lxc", fetch });
      const backupStorageConfigured = await probeBackupStorage(clusterId, fetch);
      return { user: locals.user, detail, backupStorageConfigured, loadError: false };
    } catch (e2) {
      if (e2 instanceof ApiError && (e2.status === 403 || e2.status === 404)) {
        throw error(404, "Not found");
      }
      return {
        user: locals.user,
        detail: null,
        backupStorageConfigured: true,
        loadError: true
      };
    }
  }
};

var _page_server_ts = /*#__PURE__*/Object.freeze({
  __proto__: null,
  load: load
});

const index = 20;
let component_cache;
const component = async () => component_cache ??= (await import('./_page.svelte-DYRh5T1E.js')).default;
const server_id = "src/routes/inventory/[cluster]/[vmid]/+page.server.ts";
const imports = ["_app/immutable/nodes/20.ZW_daiKO.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/RR2SEOsk.js","_app/immutable/chunks/DIeogL5L.js","_app/immutable/chunks/CtxHTuXR.js","_app/immutable/chunks/D64NQve6.js","_app/immutable/chunks/s3yjbAhm.js","_app/immutable/chunks/Cxcrlh5n.js","_app/immutable/chunks/D5aDoj7M.js","_app/immutable/chunks/MZ9IL_0X.js","_app/immutable/chunks/BS4mR_6-.js","_app/immutable/chunks/XXrISPRp.js","_app/immutable/chunks/BlTd84kF.js","_app/immutable/chunks/BzqC8FgQ.js","_app/immutable/chunks/C65twzK6.js","_app/immutable/chunks/DROBfb48.js","_app/immutable/chunks/-xA_ljcr.js","_app/immutable/chunks/CQ7digqE.js","_app/immutable/chunks/Cnxr7g58.js","_app/immutable/chunks/B-_TOQoo.js","_app/immutable/chunks/DX6rZLP_.js","_app/immutable/chunks/BsXubLQ0.js","_app/immutable/chunks/DXdao7Dl.js","_app/immutable/chunks/DByFSPPP.js","_app/immutable/chunks/CQG14OX6.js","_app/immutable/chunks/CPjW97WW.js","_app/immutable/chunks/BVd6eqLD.js","_app/immutable/chunks/D1rdV2l6.js","_app/immutable/chunks/BuexN0M3.js","_app/immutable/chunks/3uAMLWE4.js","_app/immutable/chunks/AuB2X62Y.js","_app/immutable/chunks/Da_1-pxj.js","_app/immutable/chunks/DMY-2uJ3.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/LE3FM59i.js","_app/immutable/chunks/Cf5E47gx.js","_app/immutable/chunks/CeOsULOH.js","_app/immutable/chunks/CmMO8MZe.js","_app/immutable/chunks/CdUgkO0U.js","_app/immutable/chunks/UZHiAZkH.js","_app/immutable/chunks/DIHgtdlL.js","_app/immutable/chunks/JW-elGPO.js","_app/immutable/chunks/-YrLaBmF.js","_app/immutable/chunks/Pa-iekPG.js","_app/immutable/chunks/C_brZbnu.js","_app/immutable/chunks/Bmv0KEJ-.js","_app/immutable/chunks/L-M73iBu.js","_app/immutable/chunks/vG5W5MrS.js","_app/immutable/chunks/D0wBRbAx.js","_app/immutable/chunks/DKTwPRsf.js","_app/immutable/chunks/69_IOA4Y.js","_app/immutable/chunks/BDthO0oC.js","_app/immutable/chunks/ClFHqJz7.js","_app/immutable/chunks/Dm85_Df2.js","_app/immutable/chunks/AZLIevlM.js","_app/immutable/chunks/BmDmrrKp.js","_app/immutable/chunks/D--Jdt90.js","_app/immutable/chunks/B_qRnoTm.js","_app/immutable/chunks/D_M_52fr.js","_app/immutable/chunks/Cx3Lny5_.js","_app/immutable/chunks/D7FHA9NO.js","_app/immutable/chunks/CmW2mqN3.js","_app/immutable/chunks/V7XQyoWH.js","_app/immutable/chunks/ADQIYfqg.js","_app/immutable/chunks/BwxoLkxg.js","_app/immutable/chunks/CZh8055f.js","_app/immutable/chunks/yJlkTJ-x.js","_app/immutable/chunks/CZ5WGE5_.js"];
const stylesheets = ["_app/immutable/assets/select-trigger.CV-KWLNP.css"];
const fonts = [];

export { component, fonts, imports, index, _page_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=20-tBV5G_HH.js.map
