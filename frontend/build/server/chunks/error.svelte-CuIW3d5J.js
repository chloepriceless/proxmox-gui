import { l as escape_html, r as getContext } from './renderer-5OqEGBJa.js';
import 'clsx';
import './state.svelte-Bqwbw8qw.js';
import { s as stores } from './client-BLBuBvl1.js';
import './root-BZo_tL0Z.js';
import '@sveltejs/kit/internal/server';
import '@sveltejs/kit/internal';
import './index-Siz_BmGa.js';

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
//# sourceMappingURL=error.svelte-CuIW3d5J.js.map
