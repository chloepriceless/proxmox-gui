import 'clsx';
import '@sveltejs/kit/internal';
import './root-C3vAr9go.js';
import { w as writable } from './index-B0sFcY-v.js';
import '@sveltejs/kit/internal/server';
import './state.svelte-DtuilCOR.js';

function create_updated_store() {
  const { set, subscribe } = writable(false);
  {
    return {
      subscribe,
      // eslint-disable-next-line @typescript-eslint/require-await
      check: async () => false
    };
  }
}
const stores = {
  updated: /* @__PURE__ */ create_updated_store()
};
function goto(url, opts = {}) {
  {
    throw new Error("Cannot call goto(...) on the server");
  }
}
function invalidateAll() {
  {
    throw new Error("Cannot call invalidateAll() on the server");
  }
}

export { goto as g, invalidateAll as i, stores as s };
//# sourceMappingURL=client-vbU_CWqW.js.map
