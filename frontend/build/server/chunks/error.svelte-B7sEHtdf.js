import { c as escape_html, t as getContext } from './renderer-mZFfBJIU.js';
import 'clsx';
import './state.svelte-DtuilCOR.js';
import { s as stores } from './client-vbU_CWqW.js';
import './root-C3vAr9go.js';
import '@sveltejs/kit/internal/server';
import '@sveltejs/kit/internal';
import './index-B0sFcY-v.js';

({
  check: stores.updated.check
});
function context() {
  return getContext("__request__");
}
const page$1 = {
  get error() {
    return context().page.error;
  },
  get status() {
    return context().page.status;
  }
};
const page = page$1;
function Error$1($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    $$renderer2.push(`<h1>${escape_html(page.status)}</h1> <p>${escape_html(page.error?.message)}</p>`);
  });
}

export { Error$1 as default };
//# sourceMappingURL=error.svelte-B7sEHtdf.js.map
