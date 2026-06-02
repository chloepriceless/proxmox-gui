import 'clsx';
import { as as noop } from './renderer-mZFfBJIU.js';
import './root-C3vAr9go.js';
import '@sveltejs/kit/internal/server';

const is_legacy = noop.toString().includes("$$") || /function \w+\(\) \{\}/.test(noop.toString());
const placeholder_url = "a:";
if (is_legacy) {
  ({
    url: new URL(placeholder_url)
  });
}
//# sourceMappingURL=state.svelte-DtuilCOR.js.map
