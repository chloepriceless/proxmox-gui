import { redirect } from '@sveltejs/kit';

const load = async ({ locals, url }) => {
  if (!locals.user) {
    const next = encodeURIComponent(url.pathname + url.search);
    throw redirect(303, `/login?next=${next}`);
  }
  if (!locals.user.is_admin) {
    throw redirect(303, "/");
  }
  return { user: locals.user };
};

var _page_server_ts = /*#__PURE__*/Object.freeze({
  __proto__: null,
  load: load
});

const index = 8;
let component_cache;
const component = async () => component_cache ??= (await import('./_page.svelte-D7VmPD4y.js')).default;
const server_id = "src/routes/admin/clusters/new/+page.server.ts";
const imports = ["_app/immutable/nodes/8.ByIsNTEQ.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/Dz1QOFME.js","_app/immutable/chunks/DIeogL5L.js","_app/immutable/chunks/FWqmEuGW.js","_app/immutable/chunks/D05lJ7N6.js","_app/immutable/chunks/D1PT0PJt.js","_app/immutable/chunks/V0qHDq3T.js","_app/immutable/chunks/BzDeVsP6.js","_app/immutable/chunks/DiruNafU.js","_app/immutable/chunks/BHFuJqpS.js","_app/immutable/chunks/CkHOVrVr.js","_app/immutable/chunks/BWtVFkZa.js","_app/immutable/chunks/DIJ6X1Rv.js","_app/immutable/chunks/BEbkK47e.js","_app/immutable/chunks/Bkp9Bvf2.js","_app/immutable/chunks/0vWx1Ok7.js","_app/immutable/chunks/DOYCa-jC.js","_app/immutable/chunks/CLnOhmYe.js","_app/immutable/chunks/BIfe9GDi.js","_app/immutable/chunks/CCo_xN6n.js","_app/immutable/chunks/DJgManEa.js","_app/immutable/chunks/CeauKHQw.js","_app/immutable/chunks/Cm0_jSID.js","_app/immutable/chunks/BMhCvoyS.js","_app/immutable/chunks/CDp3X21l.js","_app/immutable/chunks/CSuFVlI8.js","_app/immutable/chunks/BM8cuwzl.js","_app/immutable/chunks/69_IOA4Y.js","_app/immutable/chunks/C9koXsUJ.js","_app/immutable/chunks/BZQjfy36.js","_app/immutable/chunks/Cvinc6lT.js","_app/immutable/chunks/DMxHxQob.js","_app/immutable/chunks/BLuQ-h8b.js","_app/immutable/chunks/Bd0LP9d6.js","_app/immutable/chunks/B-_BP1nh.js","_app/immutable/chunks/C3ypeMEV.js","_app/immutable/chunks/BfZHOyn8.js","_app/immutable/chunks/1B9DwrM1.js","_app/immutable/chunks/DhGnAx7r.js","_app/immutable/chunks/fusRndV3.js","_app/immutable/chunks/CiRzWSu_.js","_app/immutable/chunks/DeMueevT.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/XgUID7zq.js","_app/immutable/chunks/CVgbUHPo.js","_app/immutable/chunks/BDN8t5bm.js"];
const stylesheets = [];
const fonts = [];

export { component, fonts, imports, index, _page_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=8-BxVckz3E.js.map
