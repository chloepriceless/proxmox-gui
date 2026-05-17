import { aB as head, m as escape_html, h as ensure_array_like, j as attr, k as attr_class, l as stringify } from './renderer--hvGDOOw.js';
import { C as Card } from './card-DccFReV7.js';
import { C as Card_header, b as Card_content, a as Card_title } from './card-title-BuO3I2CK.js';
import { C as Card_description } from './card-description-D_QwGK7A.js';
import 'clsx';
import './alert-B0yY0jmz.js';
import { B as Button } from './button-BxOVow4s.js';
import { L as Label } from './label-BUMhVN7M.js';
import { P as PasswordInput } from './PasswordInput-MnyzC-O5.js';
import { F as FormSummaryAlert } from './FormSummaryAlert-DEDFSQi2.js';
import { S as Sun, M as Moon, a as Monitor, t as theme } from './monitor-DoSke1SI.js';
import 'tailwind-merge';
import './input-CMvV7SCO.js';
import './alert-description-BlBkGLZQ.js';
import './alert-title-DlRvsmMg.js';
import './triangle-alert-DVCT9OKF.js';

function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    let currentPassword = "";
    let newPassword = "";
    let confirmPassword = "";
    let submitting = false;
    let fieldErrors = {};
    const themeOptions = [
      { value: "light", label: "Light", icon: Sun },
      { value: "dark", label: "Dark", icon: Moon },
      { value: "system", label: "System", icon: Monitor }
    ];
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      head("maq4gq", $$renderer3, ($$renderer4) => {
        $$renderer4.title(($$renderer5) => {
          $$renderer5.push(`<title>Profile — Proxmox GUI</title>`);
        });
      });
      $$renderer3.push(`<div class="mx-auto flex w-full max-w-[720px] flex-col gap-6"><header class="flex flex-col gap-2"><h1 class="text-[28px] font-semibold tracking-tight">Profile</h1> <p class="text-muted-foreground text-sm">Manage your account.</p></header> `);
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
                        $$renderer6.push(`<!---->Account`);
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
                        $$renderer6.push(`<!---->Signed in as the user shown below.`);
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
                  $$renderer5.push(`<dl class="grid grid-cols-1 gap-3 text-sm sm:grid-cols-[120px_1fr]"><dt class="text-muted-foreground">Username</dt> <dd class="font-medium">${escape_html(data.user.username)}</dd> <dt class="text-muted-foreground">Email</dt> <dd class="font-medium">${escape_html(data.user.email)}</dd> <dt class="text-muted-foreground">Role</dt> <dd class="font-medium">${escape_html(data.user.is_admin ? "Administrator" : "Member")}</dd></dl>`);
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
      $$renderer3.push(` `);
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
                        $$renderer6.push(`<!---->Change password`);
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
                        $$renderer6.push(`<!---->Update the password you use to sign in.`);
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
                  FormSummaryAlert($$renderer5, { errors: fieldErrors, id: "profile-password-summary" });
                  $$renderer5.push(`<!----> `);
                  {
                    $$renderer5.push("<!--[-1-->");
                  }
                  $$renderer5.push(`<!--]--> <div class="flex flex-col gap-2">`);
                  Label($$renderer5, {
                    for: "profile-current-password",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->Current password`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> `);
                  PasswordInput($$renderer5, {
                    id: "profile-current-password",
                    name: "current_password",
                    autocomplete: "current-password",
                    disabled: submitting,
                    required: true,
                    "aria-invalid": fieldErrors["profile-current-password"] ? "true" : void 0,
                    get value() {
                      return currentPassword;
                    },
                    set value($$value) {
                      currentPassword = $$value;
                      $$settled = false;
                    }
                  });
                  $$renderer5.push(`<!----> `);
                  if (fieldErrors["profile-current-password"]) {
                    $$renderer5.push("<!--[0-->");
                    $$renderer5.push(`<p class="text-destructive text-[13px]">${escape_html(fieldErrors["profile-current-password"])}</p>`);
                  } else {
                    $$renderer5.push("<!--[-1-->");
                  }
                  $$renderer5.push(`<!--]--></div> <div class="flex flex-col gap-2">`);
                  Label($$renderer5, {
                    for: "profile-new-password",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->New password`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> `);
                  PasswordInput($$renderer5, {
                    id: "profile-new-password",
                    name: "new_password",
                    autocomplete: "new-password",
                    disabled: submitting,
                    required: true,
                    "aria-invalid": fieldErrors["profile-new-password"] ? "true" : void 0,
                    "aria-describedby": "profile-new-password-help",
                    get value() {
                      return newPassword;
                    },
                    set value($$value) {
                      newPassword = $$value;
                      $$settled = false;
                    }
                  });
                  $$renderer5.push(`<!----> `);
                  if (fieldErrors["profile-new-password"]) {
                    $$renderer5.push("<!--[0-->");
                    $$renderer5.push(`<p id="profile-new-password-help" class="text-destructive text-[13px]">${escape_html(fieldErrors["profile-new-password"])}</p>`);
                  } else {
                    $$renderer5.push("<!--[-1-->");
                    $$renderer5.push(`<p id="profile-new-password-help" class="text-muted-foreground text-[13px]">At least 12 characters.</p>`);
                  }
                  $$renderer5.push(`<!--]--></div> <div class="flex flex-col gap-2">`);
                  Label($$renderer5, {
                    for: "profile-confirm-password",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->Confirm new password`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> `);
                  PasswordInput($$renderer5, {
                    id: "profile-confirm-password",
                    name: "confirm_password",
                    autocomplete: "new-password",
                    disabled: submitting,
                    required: true,
                    "aria-invalid": fieldErrors["profile-confirm-password"] ? "true" : void 0,
                    get value() {
                      return confirmPassword;
                    },
                    set value($$value) {
                      confirmPassword = $$value;
                      $$settled = false;
                    }
                  });
                  $$renderer5.push(`<!----> `);
                  if (fieldErrors["profile-confirm-password"]) {
                    $$renderer5.push("<!--[0-->");
                    $$renderer5.push(`<p class="text-destructive text-[13px]">${escape_html(fieldErrors["profile-confirm-password"])}</p>`);
                  } else {
                    $$renderer5.push("<!--[-1-->");
                  }
                  $$renderer5.push(`<!--]--></div> <div class="flex justify-end">`);
                  Button($$renderer5, {
                    type: "submit",
                    disabled: submitting,
                    children: ($$renderer6) => {
                      {
                        $$renderer6.push("<!--[-1-->");
                        $$renderer6.push(`Update password`);
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
      $$renderer3.push(` `);
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
                        $$renderer6.push(`<!---->Appearance`);
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
                        $$renderer6.push(`<!---->Theme follows your system unless you set a preference.`);
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
                  $$renderer5.push(`<div role="radiogroup" aria-label="Theme preference" class="border-border bg-muted/50 inline-flex items-center rounded-md border p-1"><!--[-->`);
                  const each_array = ensure_array_like(themeOptions);
                  for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
                    let option = each_array[$$index];
                    const active = theme.mode === option.value;
                    $$renderer5.push(`<button type="button" role="radio"${attr("aria-checked", active)}${attr_class(`inline-flex h-8 items-center gap-1.5 rounded px-3 text-[13px] font-medium transition-colors ${stringify(active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}`)}>`);
                    if (option.icon) {
                      $$renderer5.push("<!--[-->");
                      option.icon($$renderer5, { class: "size-4", "aria-hidden": "true" });
                      $$renderer5.push("<!--]-->");
                    } else {
                      $$renderer5.push("<!--[!-->");
                      $$renderer5.push("<!--]-->");
                    }
                    $$renderer5.push(` <span>${escape_html(option.label)}</span></button>`);
                  }
                  $$renderer5.push(`<!--]--></div>`);
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
//# sourceMappingURL=_page.svelte-CLCBT_qL.js.map
