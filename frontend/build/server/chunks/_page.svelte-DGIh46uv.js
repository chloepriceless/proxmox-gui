import { A as head } from './renderer-5OqEGBJa.js';
import 'clsx';

function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    head("1uha8ag", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Dashboard — Proxmox GUI</title>`);
      });
    });
    $$renderer2.push(`<div class="flex flex-col gap-6"><header class="flex flex-col gap-2"><h1 class="text-[28px] font-semibold tracking-tight">Dashboard</h1> <p class="text-muted-foreground text-sm">VM and LXC inventory lands in Phase 2.</p></header> `);
    if (!data.apiReachable) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="text-muted-foreground text-sm">Backend unreachable. Start the FastAPI service to see live data.</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}

export { _page as default };
//# sourceMappingURL=_page.svelte-DGIh46uv.js.map
