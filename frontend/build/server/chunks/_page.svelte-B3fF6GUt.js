import { aB as head, d as derived, c as store_get, m as escape_html, n as unsubscribe_stores } from './renderer--hvGDOOw.js';
import '@sveltejs/kit/internal';
import './root-DHp9To-z.js';
import '@sveltejs/kit/internal/server';
import './state.svelte-BYtSRxhp.js';
import { p as page } from './stores-CCN9TkGO.js';
import { C as Card } from './card-BUGQ1elQ.js';
import { C as Card_header, b as Card_content, a as Card_title } from './card-title-DQvVyNSe.js';
import { C as Card_description } from './card-description-MliYuxx-.js';
import 'clsx';
import { A as Alert } from './alert-CDmFQdZq.js';
import { A as Alert_description } from './alert-description-Cz6DQ4pO.js';
import { A as Alert_title } from './alert-title-BufPPCWl.js';
import { B as Button } from './button-ntOmtgiY.js';
import { I as Input } from './input-Buwd_f-b.js';
import { L as Label } from './label-7gbcsuPJ.js';
import { C as Checkbox } from './checkbox-BaIm7C4I.js';
import { P as PasswordInput } from './PasswordInput-BJVk5pAx.js';
import { F as FormSummaryAlert } from './FormSummaryAlert-Cd0-Zz2l.js';
import { T as Triangle_alert } from './triangle-alert-D6NlG2tC.js';
import 'tailwind-merge';
import './is-HJ-O5XFN.js';
import './clone-BTaVLdQ_.js';
import './hidden-input-C4DjPWyi.js';
import './sr-only-styles-BFTOatBw.js';
import './check-Czpunie5.js';
import './Icon-B86w_tDb.js';

function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let username = "";
    let password = "";
    let rememberMe = false;
    let submitting = false;
    let fieldErrors = {};
    const sessionExpired = derived(() => store_get($$store_subs ??= {}, "$page", page).url.searchParams.has("expired"));
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      head("1x05zx6", $$renderer3, ($$renderer4) => {
        $$renderer4.title(($$renderer5) => {
          $$renderer5.push(`<title>Sign in — Proxmox GUI</title>`);
        });
      });
      $$renderer3.push(`<div class="bg-muted flex min-h-screen items-center justify-center px-4 py-12"><div class="flex w-full max-w-sm flex-col items-center gap-6"><div class="flex items-center gap-2"><svg viewBox="0 0 24 24" class="text-primary size-8" role="img" aria-label="Proxmox GUI logo" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="3" width="7" height="7" rx="1.5"></rect><rect x="3" y="14" width="7" height="7" rx="1.5"></rect><rect x="14" y="14" width="7" height="7" rx="1.5"></rect></svg> <span class="text-lg font-semibold tracking-tight">Proxmox GUI</span></div> `);
      if (sessionExpired()) {
        $$renderer3.push("<!--[0-->");
        if (Alert) {
          $$renderer3.push("<!--[-->");
          Alert($$renderer3, {
            class: "bg-warning/10 border-warning/30 text-warning w-full",
            children: ($$renderer4) => {
              Triangle_alert($$renderer4, { "aria-hidden": "true" });
              $$renderer4.push(`<!----> `);
              if (Alert_title) {
                $$renderer4.push("<!--[-->");
                Alert_title($$renderer4, {
                  class: "text-warning",
                  children: ($$renderer5) => {
                    $$renderer5.push(`<!---->Session expired`);
                  },
                  $$slots: { default: true }
                });
                $$renderer4.push("<!--]-->");
              } else {
                $$renderer4.push("<!--[!-->");
                $$renderer4.push("<!--]-->");
              }
              $$renderer4.push(` `);
              if (Alert_description) {
                $$renderer4.push("<!--[-->");
                Alert_description($$renderer4, {
                  class: "text-foreground",
                  children: ($$renderer5) => {
                    $$renderer5.push(`<!---->Your session expired. Please sign in again.`);
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
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--> `);
      if (Card) {
        $$renderer3.push("<!--[-->");
        Card($$renderer3, {
          class: "w-full",
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
                        $$renderer6.push(`<!---->Sign in`);
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
                        $$renderer6.push(`<!---->Enter your credentials to continue.`);
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
                  FormSummaryAlert($$renderer5, { errors: fieldErrors, id: "login-summary" });
                  $$renderer5.push(`<!----> `);
                  {
                    $$renderer5.push("<!--[-1-->");
                  }
                  $$renderer5.push(`<!--]--> <div class="flex flex-col gap-2">`);
                  Label($$renderer5, {
                    for: "login-username",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->Username`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> `);
                  Input($$renderer5, {
                    id: "login-username",
                    type: "text",
                    name: "username",
                    autocomplete: "username",
                    autocapitalize: "off",
                    autocorrect: "off",
                    spellcheck: false,
                    disabled: submitting,
                    required: true,
                    "aria-invalid": fieldErrors["login-username"] ? "true" : void 0,
                    get value() {
                      return username;
                    },
                    set value($$value) {
                      username = $$value;
                      $$settled = false;
                    }
                  });
                  $$renderer5.push(`<!----> `);
                  if (fieldErrors["login-username"]) {
                    $$renderer5.push("<!--[0-->");
                    $$renderer5.push(`<p class="text-destructive text-[13px]">${escape_html(fieldErrors["login-username"])}</p>`);
                  } else {
                    $$renderer5.push("<!--[-1-->");
                  }
                  $$renderer5.push(`<!--]--></div> <div class="flex flex-col gap-2">`);
                  Label($$renderer5, {
                    for: "login-password",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->Password`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> `);
                  PasswordInput($$renderer5, {
                    id: "login-password",
                    name: "password",
                    autocomplete: "current-password",
                    disabled: submitting,
                    required: true,
                    "aria-invalid": fieldErrors["login-password"] ? "true" : void 0,
                    get value() {
                      return password;
                    },
                    set value($$value) {
                      password = $$value;
                      $$settled = false;
                    }
                  });
                  $$renderer5.push(`<!----> `);
                  if (fieldErrors["login-password"]) {
                    $$renderer5.push("<!--[0-->");
                    $$renderer5.push(`<p class="text-destructive text-[13px]">${escape_html(fieldErrors["login-password"])}</p>`);
                  } else {
                    $$renderer5.push("<!--[-1-->");
                  }
                  $$renderer5.push(`<!--]--></div> <label class="flex items-center gap-2 text-sm">`);
                  Checkbox($$renderer5, {
                    disabled: submitting,
                    get checked() {
                      return rememberMe;
                    },
                    set checked($$value) {
                      rememberMe = $$value;
                      $$settled = false;
                    }
                  });
                  $$renderer5.push(`<!----> <span>Remember me</span></label> `);
                  Button($$renderer5, {
                    type: "submit",
                    class: "w-full",
                    disabled: submitting,
                    children: ($$renderer6) => {
                      {
                        $$renderer6.push("<!--[-1-->");
                        $$renderer6.push(`Sign in`);
                      }
                      $$renderer6.push(`<!--]-->`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----></form>`);
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
      $$renderer3.push(` <p class="text-muted-foreground text-[13px]">Need help? Contact your administrator.</p></div></div>`);
    }
    do {
      $$settled = true;
      $$inner_renderer = $$renderer2.copy();
      $$render_inner($$inner_renderer);
    } while (!$$settled);
    $$renderer2.subsume($$inner_renderer);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}

export { _page as default };
//# sourceMappingURL=_page.svelte-B3fF6GUt.js.map
