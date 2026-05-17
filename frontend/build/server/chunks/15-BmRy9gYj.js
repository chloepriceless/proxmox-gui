import { redirect } from '@sveltejs/kit';
import { a as api } from './client2-WJrlUD72.js';

const load = async ({ locals, url, fetch }) => {
  if (!locals.user) {
    const next = encodeURIComponent(url.pathname + url.search);
    throw redirect(303, `/login?next=${next}`);
  }
  try {
    const schedules = await api.lifecycle.listScheduledBackups({ fetch });
    return { user: locals.user, schedules, loadError: false };
  } catch {
    return { user: locals.user, schedules: [], loadError: true };
  }
};

var _page_server_ts = /*#__PURE__*/Object.freeze({
  __proto__: null,
  load: load
});

const index = 15;
let component_cache;
const component = async () => component_cache ??= (await import('./_page.svelte-CzIg57UW.js')).default;
const server_id = "src/routes/backups/+page.server.ts";
const imports = ["_app/immutable/nodes/15.DfA1t05C.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/B76fPDHw.js","_app/immutable/chunks/DIeogL5L.js","_app/immutable/chunks/BZy2rKVh.js","_app/immutable/chunks/DG-AIyDW.js","_app/immutable/chunks/HtuQ-t6z.js","_app/immutable/chunks/DFf0_9oh.js","_app/immutable/chunks/B0O0__6X.js","_app/immutable/chunks/Da8-qn49.js","_app/immutable/chunks/BkYbJ__8.js","_app/immutable/chunks/1_Ev5Rxk.js","_app/immutable/chunks/Cv6kQ42Y.js","_app/immutable/chunks/CcQORYn5.js","_app/immutable/chunks/Du75oJPC.js","_app/immutable/chunks/Cmh71_M-.js","_app/immutable/chunks/DaMzvvl3.js","_app/immutable/chunks/Gl5zOG39.js","_app/immutable/chunks/irNS9udM.js","_app/immutable/chunks/BAwm5wUc.js"];
const stylesheets = [];
const fonts = [];

export { component, fonts, imports, index, _page_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=15-BmRy9gYj.js.map
