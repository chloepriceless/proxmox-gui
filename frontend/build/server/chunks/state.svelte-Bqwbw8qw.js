import 'clsx';
import { at as noop } from './renderer-5OqEGBJa.js';
import './root-BZo_tL0Z.js';
import '@sveltejs/kit/internal/server';

const is_legacy = noop.toString().includes("$$") || /function \w+\(\) \{\}/.test(noop.toString());
const placeholder_url = "a:";
if (is_legacy) {
  ({
    url: new URL(placeholder_url)
  });
}
//# sourceMappingURL=state.svelte-Bqwbw8qw.js.map
