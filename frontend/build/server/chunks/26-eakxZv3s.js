import { redirect } from '@sveltejs/kit';
import { a as api } from './client2-FWmWn_B2.js';
import './api-By_nInf4.js';

const load = async ({ locals, url, fetch }) => {
  if (!locals.user) {
    const next = encodeURIComponent(url.pathname + url.search);
    throw redirect(303, `/login?next=${next}`);
  }
  try {
    const tokens = await api.me.listTokens({ fetch });
    return { user: locals.user, tokens, loadError: false };
  } catch {
    return { user: locals.user, tokens: [], loadError: true };
  }
};

var _page_server_ts = /*#__PURE__*/Object.freeze({
  __proto__: null,
  load: load
});

const index = 26;
let component_cache;
const component = async () => component_cache ??= (await import('./_page.svelte-DK5YhTWV.js')).default;
const server_id = "src/routes/profile/tokens/+page.server.ts";
const imports = ["_app/immutable/nodes/26.CzxHMPkt.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/CkHOVrVr.js","_app/immutable/chunks/Dz1QOFME.js","_app/immutable/chunks/DIeogL5L.js","_app/immutable/chunks/FWqmEuGW.js","_app/immutable/chunks/D05lJ7N6.js","_app/immutable/chunks/D1PT0PJt.js","_app/immutable/chunks/V0qHDq3T.js","_app/immutable/chunks/BLuQ-h8b.js","_app/immutable/chunks/BEbkK47e.js","_app/immutable/chunks/Bkp9Bvf2.js","_app/immutable/chunks/0vWx1Ok7.js","_app/immutable/chunks/DOYCa-jC.js","_app/immutable/chunks/BWtVFkZa.js","_app/immutable/chunks/BzDeVsP6.js","_app/immutable/chunks/DiruNafU.js","_app/immutable/chunks/BHFuJqpS.js","_app/immutable/chunks/DIJ6X1Rv.js","_app/immutable/chunks/CLnOhmYe.js","_app/immutable/chunks/BIfe9GDi.js","_app/immutable/chunks/CCo_xN6n.js","_app/immutable/chunks/DJgManEa.js","_app/immutable/chunks/CeauKHQw.js","_app/immutable/chunks/BybhHQDJ.js","_app/immutable/chunks/B5LKCUWQ.js","_app/immutable/chunks/Cm0_jSID.js","_app/immutable/chunks/BM8cuwzl.js","_app/immutable/chunks/PbjDttTu.js","_app/immutable/chunks/DX6rZLP_.js","_app/immutable/chunks/MmXwFXPw.js","_app/immutable/chunks/iSi4Pzi1.js","_app/immutable/chunks/YTKhnm1F.js","_app/immutable/chunks/BHzRzDuM.js","_app/immutable/chunks/BAI7ug_o.js","_app/immutable/chunks/BMhCvoyS.js","_app/immutable/chunks/B-_BP1nh.js","_app/immutable/chunks/C3ypeMEV.js","_app/immutable/chunks/BfZHOyn8.js","_app/immutable/chunks/DED-Im-D.js","_app/immutable/chunks/Dp9GAd6J.js","_app/immutable/chunks/DMxHxQob.js","_app/immutable/chunks/C4yxh-Fi.js","_app/immutable/chunks/CiRzWSu_.js","_app/immutable/chunks/DeMueevT.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/BDN8t5bm.js","_app/immutable/chunks/Ch2cpRvR.js","_app/immutable/chunks/CVgbUHPo.js","_app/immutable/chunks/B7To-JRC.js"];
const stylesheets = [];
const fonts = [];

export { component, fonts, imports, index, _page_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=26-eakxZv3s.js.map
