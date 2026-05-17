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

const index = 10;
let component_cache;
const component = async () => component_cache ??= (await import('./_page.svelte-DR63yu9-.js')).default;
const server_id = "src/routes/admin/teams/new/+page.server.ts";
const imports = ["_app/immutable/nodes/10.C0pKJ8ap.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/B76fPDHw.js","_app/immutable/chunks/DIeogL5L.js","_app/immutable/chunks/BZy2rKVh.js","_app/immutable/chunks/DG-AIyDW.js","_app/immutable/chunks/HtuQ-t6z.js","_app/immutable/chunks/DFf0_9oh.js","_app/immutable/chunks/BkYbJ__8.js","_app/immutable/chunks/1_Ev5Rxk.js","_app/immutable/chunks/Cv6kQ42Y.js","_app/immutable/chunks/CcQORYn5.js","_app/immutable/chunks/B8PN7SMf.js","_app/immutable/chunks/Cmh71_M-.js","_app/immutable/chunks/3e5_4EXJ.js","_app/immutable/chunks/Da8-qn49.js","_app/immutable/chunks/B0O0__6X.js","_app/immutable/chunks/CKvDEHfU.js","_app/immutable/chunks/bddXi7Xq.js","_app/immutable/chunks/C_CXB-aj.js","_app/immutable/chunks/DyhqqZP2.js","_app/immutable/chunks/C6ALetTt.js","_app/immutable/chunks/DehlN6xb.js","_app/immutable/chunks/DMY-2uJ3.js","_app/immutable/chunks/Dp1pzeXC.js","_app/immutable/chunks/BtKg1HSK.js","_app/immutable/chunks/dYsEJFvI.js","_app/immutable/chunks/B7oWRHuv.js","_app/immutable/chunks/kMNdv31G.js"];
const stylesheets = [];
const fonts = [];

export { component, fonts, imports, index, _page_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=10-5cjnH-xq.js.map
