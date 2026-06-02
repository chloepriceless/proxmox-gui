import { t as getContext } from './renderer-mZFfBJIU.js';
import 'clsx';
import '@sveltejs/kit/internal';
import './root-C3vAr9go.js';
import '@sveltejs/kit/internal/server';
import './state.svelte-DtuilCOR.js';

const getStores = () => {
  const stores$1 = getContext("__svelte__");
  return {
    /** @type {typeof page} */
    page: {
      subscribe: stores$1.page.subscribe
    },
    /** @type {typeof navigating} */
    navigating: {
      subscribe: stores$1.navigating.subscribe
    },
    /** @type {typeof updated} */
    updated: stores$1.updated
  };
};
const page = {
  subscribe(fn) {
    const store = getStores().page;
    return store.subscribe(fn);
  }
};

export { page as p };
//# sourceMappingURL=stores-ByWcCi85.js.map
