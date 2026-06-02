import 'clsx';
import { M as Monitor } from './monitor-CcjG5ZXJ.js';
import './renderer-mZFfBJIU.js';
import './Icon-oF8immWv.js';

function _layout($$renderer, $$props) {
  let { children } = $$props;
  $$renderer.push(`<div class="flex flex-col items-center gap-3 rounded-md border border-dashed border-border px-6 py-12 text-center md:hidden">`);
  Monitor($$renderer, { class: "size-8 text-muted-foreground", "aria-hidden": "true" });
  $$renderer.push(`<!----> <h1 class="text-[18px] font-semibold">Best on a larger screen</h1> <p class="text-muted-foreground max-w-sm text-[14px]">The create wizard works best on a larger screen. Open this page on a tablet
    or desktop to provision a new VM or container.</p> <a href="/inventory" class="text-primary text-[14px] underline-offset-4 hover:underline">← Back to inventory</a></div> <div class="hidden md:block">`);
  children($$renderer);
  $$renderer.push(`<!----></div>`);
}

export { _layout as default };
//# sourceMappingURL=_layout.svelte-CjR1x1GS.js.map
