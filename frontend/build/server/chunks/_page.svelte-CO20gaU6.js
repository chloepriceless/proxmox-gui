import { A as head } from './renderer-5OqEGBJa.js';
import { g as goto } from './client-BLBuBvl1.js';
import { C as Card } from './card-d0K3O0_w.js';
import { C as Card_header, b as Card_title, c as Card_description, a as Card_content } from './card-title-CwYi2S8Q.js';
import 'clsx';
import './alert-DKR6l6LD.js';
import { B as Button } from './button-B5bCAdGN.js';
import { I as Input } from './input-CVUkBx6i.js';
import { L as Label } from './label-DVSPNLFi.js';
import { A as Arrow_left } from './arrow-left-CPxn2LPE.js';
import '@sveltejs/kit/internal';
import './root-BZo_tL0Z.js';
import './index-Siz_BmGa.js';
import '@sveltejs/kit/internal/server';
import './state.svelte-Bqwbw8qw.js';
import 'tailwind-merge';

function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let name = "";
    let submitting = false;
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      head("1t37izg", $$renderer3, ($$renderer4) => {
        $$renderer4.title(($$renderer5) => {
          $$renderer5.push(`<title>New team — Proxmox GUI</title>`);
        });
      });
      $$renderer3.push(`<div class="mx-auto flex w-full max-w-[720px] flex-col gap-6"><header class="flex flex-col gap-2"><a href="/admin/teams" class="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-[13px]">`);
      Arrow_left($$renderer3, { class: "size-4", "aria-hidden": "true" });
      $$renderer3.push(`<!----> Back to Teams</a> <h1 class="text-[28px] font-semibold tracking-tight">New team</h1> <p class="text-muted-foreground text-sm">Creating a team provisions a Proxmox pool and a privilege-separated token on
      every active cluster.</p></header> `);
      if (Card) {
        $$renderer3.push("<!--[-->");
        Card($$renderer3, {
          children: ($$renderer4) => {
            if (Card_header) {
              $$renderer4.push("<!--[-->");
              Card_header($$renderer4, {
                children: ($$renderer5) => {
                  if (Card_title) {
                    $$renderer5.push("<!--[-->");
                    Card_title($$renderer5, {
                      class: "text-lg font-semibold tracking-tight",
                      children: ($$renderer6) => {
                        $$renderer6.push(`<!---->Team details`);
                      },
                      $$slots: { default: true }
                    });
                    $$renderer5.push("<!--]-->");
                  } else {
                    $$renderer5.push("<!--[!-->");
                    $$renderer5.push("<!--]-->");
                  }
                  $$renderer5.push(` `);
                  if (Card_description) {
                    $$renderer5.push("<!--[-->");
                    Card_description($$renderer5, {
                      children: ($$renderer6) => {
                        $$renderer6.push(`<!---->Add members and quotas after the team is created.`);
                      },
                      $$slots: { default: true }
                    });
                    $$renderer5.push("<!--]-->");
                  } else {
                    $$renderer5.push("<!--[!-->");
                    $$renderer5.push("<!--]-->");
                  }
                },
                $$slots: { default: true }
              });
              $$renderer4.push("<!--]-->");
            } else {
              $$renderer4.push("<!--[!-->");
              $$renderer4.push("<!--]-->");
            }
            $$renderer4.push(` `);
            if (Card_content) {
              $$renderer4.push("<!--[-->");
              Card_content($$renderer4, {
                children: ($$renderer5) => {
                  $$renderer5.push(`<form class="flex flex-col gap-4" novalidate="">`);
                  {
                    $$renderer5.push("<!--[-1-->");
                  }
                  $$renderer5.push(`<!--]--> <div class="flex flex-col gap-2">`);
                  Label($$renderer5, {
                    for: "team-new-name",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->Team name`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> `);
                  Input($$renderer5, {
                    id: "team-new-name",
                    type: "text",
                    autocomplete: "off",
                    spellcheck: false,
                    disabled: submitting,
                    required: true,
                    "aria-invalid": void 0,
                    get value() {
                      return name;
                    },
                    set value($$value) {
                      name = $$value;
                      $$settled = false;
                    }
                  });
                  $$renderer5.push(`<!----> `);
                  {
                    $$renderer5.push("<!--[-1-->");
                    $$renderer5.push(`<p class="text-muted-foreground text-[13px]">A short, recognisable name — e.g. "platform" or "media".</p>`);
                  }
                  $$renderer5.push(`<!--]--></div> <div class="flex justify-end gap-2">`);
                  Button($$renderer5, {
                    type: "button",
                    variant: "ghost",
                    onclick: () => goto(),
                    disabled: submitting,
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->Cancel`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> `);
                  Button($$renderer5, {
                    type: "submit",
                    disabled: submitting,
                    children: ($$renderer6) => {
                      {
                        $$renderer6.push("<!--[-1-->");
                        $$renderer6.push(`Create team`);
                      }
                      $$renderer6.push(`<!--]-->`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----></div></form>`);
                },
                $$slots: { default: true }
              });
              $$renderer4.push("<!--]-->");
            } else {
              $$renderer4.push("<!--[!-->");
              $$renderer4.push("<!--]-->");
            }
          },
          $$slots: { default: true }
        });
        $$renderer3.push("<!--]-->");
      } else {
        $$renderer3.push("<!--[!-->");
        $$renderer3.push("<!--]-->");
      }
      $$renderer3.push(`</div>`);
    }
    do {
      $$settled = true;
      $$inner_renderer = $$renderer2.copy();
      $$render_inner($$inner_renderer);
    } while (!$$settled);
    $$renderer2.subsume($$inner_renderer);
  });
}

export { _page as default };
//# sourceMappingURL=_page.svelte-CO20gaU6.js.map
