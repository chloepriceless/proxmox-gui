import { redirect } from '@sveltejs/kit';
import { g as getSettings } from './settings-B0AyWnlD.js';
import './api-By_nInf4.js';

const load = async ({ locals, url, fetch }) => {
  if (!locals.user) {
    const next = encodeURIComponent(url.pathname + url.search);
    throw redirect(303, `/login?next=${next}`);
  }
  if (!locals.user.is_admin) {
    throw redirect(303, "/");
  }
  try {
    const settings = await getSettings({ fetch });
    return { user: locals.user, settings, loadError: false };
  } catch {
    return { user: locals.user, settings: null, loadError: true };
  }
};

var _page_server_ts = /*#__PURE__*/Object.freeze({
  __proto__: null,
  load: load
});

const index = 9;
let component_cache;
const component = async () => component_cache ??= (await import('./_page.svelte-C_2GDUzi.js')).default;
const server_id = "src/routes/admin/settings/+page.server.ts";
const imports = ["_app/immutable/nodes/9.DcV9RNFz.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/CkHOVrVr.js","_app/immutable/chunks/Dz1QOFME.js","_app/immutable/chunks/DIeogL5L.js","_app/immutable/chunks/FWqmEuGW.js","_app/immutable/chunks/D05lJ7N6.js","_app/immutable/chunks/D1PT0PJt.js","_app/immutable/chunks/V0qHDq3T.js","_app/immutable/chunks/BzDeVsP6.js","_app/immutable/chunks/DIJ6X1Rv.js","_app/immutable/chunks/BEbkK47e.js","_app/immutable/chunks/Bkp9Bvf2.js","_app/immutable/chunks/0vWx1Ok7.js","_app/immutable/chunks/DOYCa-jC.js","_app/immutable/chunks/BWtVFkZa.js","_app/immutable/chunks/CLnOhmYe.js","_app/immutable/chunks/BIfe9GDi.js","_app/immutable/chunks/CCo_xN6n.js","_app/immutable/chunks/Cm0_jSID.js","_app/immutable/chunks/BMhCvoyS.js","_app/immutable/chunks/ByKwoKRa.js","_app/immutable/chunks/DeMueevT.js","_app/immutable/chunks/BDN8t5bm.js"];
const stylesheets = [];
const fonts = [];

export { component, fonts, imports, index, _page_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=9-BXGJLSev.js.map
