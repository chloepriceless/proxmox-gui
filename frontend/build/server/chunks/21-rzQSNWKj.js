import { redirect, error } from '@sveltejs/kit';
import { a as api } from './client2-FWmWn_B2.js';
import { ApiError } from './api-By_nInf4.js';

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

const index = 21;
let component_cache;
const component = async () => component_cache ??= (await import('./_page.svelte-HO1xOp35.js')).default;
const server_id = "src/routes/inventory/[cluster]/[vmid]/+page.server.ts";
const imports = ["_app/immutable/nodes/21.B_ibxrTS.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/Dz1QOFME.js","_app/immutable/chunks/DIeogL5L.js","_app/immutable/chunks/DOYCa-jC.js","_app/immutable/chunks/BWtVFkZa.js","_app/immutable/chunks/FWqmEuGW.js","_app/immutable/chunks/D05lJ7N6.js","_app/immutable/chunks/V0qHDq3T.js","_app/immutable/chunks/D1PT0PJt.js","_app/immutable/chunks/BLuQ-h8b.js","_app/immutable/chunks/BEbkK47e.js","_app/immutable/chunks/Bkp9Bvf2.js","_app/immutable/chunks/0vWx1Ok7.js","_app/immutable/chunks/BzDeVsP6.js","_app/immutable/chunks/BHFuJqpS.js","_app/immutable/chunks/CkHOVrVr.js","_app/immutable/chunks/BnecOcTy.js","_app/immutable/chunks/6I7ffYvk.js","_app/immutable/chunks/CLnOhmYe.js","_app/immutable/chunks/Cm0_jSID.js","_app/immutable/chunks/DX6rZLP_.js","_app/immutable/chunks/PbjDttTu.js","_app/immutable/chunks/BM8cuwzl.js","_app/immutable/chunks/DIJ6X1Rv.js","_app/immutable/chunks/ZMm3M5dQ.js","_app/immutable/chunks/jOSrxZVU.js","_app/immutable/chunks/BHzRzDuM.js","_app/immutable/chunks/D_4E1sb_.js","_app/immutable/chunks/CSuFVlI8.js","_app/immutable/chunks/Cvinc6lT.js","_app/immutable/chunks/BqK01NXd.js","_app/immutable/chunks/DMxHxQob.js","_app/immutable/chunks/CiRzWSu_.js","_app/immutable/chunks/DeMueevT.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/BDN8t5bm.js","_app/immutable/chunks/CWg6qSpM.js","_app/immutable/chunks/BgfYEq4a.js","_app/immutable/chunks/CmMO8MZe.js","_app/immutable/chunks/YTKhnm1F.js","_app/immutable/chunks/Bjy7N-1Z.js","_app/immutable/chunks/BFscmzoS.js","_app/immutable/chunks/B0_wZjZN.js","_app/immutable/chunks/DED-Im-D.js","_app/immutable/chunks/Dp9GAd6J.js","_app/immutable/chunks/B5LKCUWQ.js","_app/immutable/chunks/BMhCvoyS.js","_app/immutable/chunks/BybhHQDJ.js","_app/immutable/chunks/MmXwFXPw.js","_app/immutable/chunks/iSi4Pzi1.js","_app/immutable/chunks/BfbWwwt1.js","_app/immutable/chunks/69_IOA4Y.js","_app/immutable/chunks/C9koXsUJ.js","_app/immutable/chunks/BZQjfy36.js","_app/immutable/chunks/BKsq3Otk.js","_app/immutable/chunks/D8nahQwp.js","_app/immutable/chunks/CjW_xI9i.js","_app/immutable/chunks/DoZTJyNP.js","_app/immutable/chunks/BfZHOyn8.js","_app/immutable/chunks/C4yxh-Fi.js","_app/immutable/chunks/5HG34pHC.js","_app/immutable/chunks/B7To-JRC.js","_app/immutable/chunks/BIfe9GDi.js","_app/immutable/chunks/BAI7ug_o.js","_app/immutable/chunks/ADQIYfqg.js","_app/immutable/chunks/BNPJ3329.js","_app/immutable/chunks/CVgbUHPo.js","_app/immutable/chunks/DP7xhTtP.js","_app/immutable/chunks/CVq1OWDu.js"];
const stylesheets = ["_app/immutable/assets/select-trigger.CV-KWLNP.css"];
const fonts = [];

export { component, fonts, imports, index, _page_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=21-rzQSNWKj.js.map
