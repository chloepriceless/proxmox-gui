import { aB as head, m as escape_html, h as ensure_array_like, d as derived } from './renderer--hvGDOOw.js';
import { g as goto } from './client-bCVElyx1.js';
import { C as Card } from './card-DccFReV7.js';
import { C as Card_header, b as Card_content, a as Card_title } from './card-title-BuO3I2CK.js';
import { C as Card_description } from './card-description-D_QwGK7A.js';
import 'clsx';
import './alert-B0yY0jmz.js';
import { B as Button } from './button-BxOVow4s.js';
import { I as Input } from './input-CMvV7SCO.js';
import { L as Label } from './label-BUMhVN7M.js';
import { S as Switch } from './switch-CRJ7RhrZ.js';
import { C as Checkbox } from './checkbox-CjBRbzCR.js';
import { P as PasswordInput } from './PasswordInput-MnyzC-O5.js';
import { F as FormSummaryAlert } from './FormSummaryAlert-DEDFSQi2.js';
import { A as Arrow_left } from './arrow-left-BtEwqgZ2.js';
import '@sveltejs/kit/internal';
import './root-DHp9To-z.js';
import './index-B54IuS4T.js';
import '@sveltejs/kit/internal/server';
import './state.svelte-BYtSRxhp.js';
import 'tailwind-merge';
import './is-D4jTQp0x.js';
import './hidden-input-nqMA6MkO.js';
import './sr-only-styles-Cqf-HEXV.js';
import './noop-n4I-x7yK.js';
import './clone-BTaVLdQ_.js';
import './check-CxOYdq6i.js';
import './alert-description-BlBkGLZQ.js';
import './alert-title-DlRvsmMg.js';
import './triangle-alert-DVCT9OKF.js';

function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    let username = "";
    let email = "";
    let password = "";
    let confirmPassword = "";
    let isAdmin = false;
    let selectedTeamIds = [];
    let submitting = false;
    let fieldErrors = {};
    const assignableTeams = derived(() => data.teams.filter((t) => !t.personal));
    function toggleTeam(teamId, checked) {
      if (checked) {
        if (!selectedTeamIds.includes(teamId)) {
          selectedTeamIds = [...selectedTeamIds, teamId];
        }
      } else {
        selectedTeamIds = selectedTeamIds.filter((id) => id !== teamId);
      }
    }
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      head("h7y5ei", $$renderer3, ($$renderer4) => {
        $$renderer4.title(($$renderer5) => {
          $$renderer5.push(`<title>New user — Proxmox GUI</title>`);
        });
      });
      $$renderer3.push(`<div class="mx-auto flex w-full max-w-[720px] flex-col gap-6"><header class="flex flex-col gap-2"><a href="/admin/users" class="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-[13px]">`);
      Arrow_left($$renderer3, { class: "size-4", "aria-hidden": "true" });
      $$renderer3.push(`<!----> Back to Users</a> <h1 class="text-[28px] font-semibold tracking-tight">New user</h1> <p class="text-muted-foreground text-sm">Create an account and assign team membership.</p></header> `);
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
                        $$renderer6.push(`<!---->Account details`);
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
                        $$renderer6.push(`<!---->The user signs in with these credentials.`);
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
                  FormSummaryAlert($$renderer5, { errors: fieldErrors, id: "user-new-summary" });
                  $$renderer5.push(`<!----> `);
                  {
                    $$renderer5.push("<!--[-1-->");
                  }
                  $$renderer5.push(`<!--]--> <div class="flex flex-col gap-2">`);
                  Label($$renderer5, {
                    for: "user-new-username",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->Username`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> `);
                  Input($$renderer5, {
                    id: "user-new-username",
                    type: "text",
                    autocomplete: "off",
                    autocapitalize: "off",
                    spellcheck: false,
                    disabled: submitting,
                    required: true,
                    "aria-invalid": fieldErrors["user-new-username"] ? "true" : void 0,
                    get value() {
                      return username;
                    },
                    set value($$value) {
                      username = $$value;
                      $$settled = false;
                    }
                  });
                  $$renderer5.push(`<!----> `);
                  if (fieldErrors["user-new-username"]) {
                    $$renderer5.push("<!--[0-->");
                    $$renderer5.push(`<p class="text-destructive text-[13px]">${escape_html(fieldErrors["user-new-username"])}</p>`);
                  } else {
                    $$renderer5.push("<!--[-1-->");
                    $$renderer5.push(`<p class="text-muted-foreground text-[13px]">Letters, numbers, dots, dashes, underscores.</p>`);
                  }
                  $$renderer5.push(`<!--]--></div> <div class="flex flex-col gap-2">`);
                  Label($$renderer5, {
                    for: "user-new-email",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->Email`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> `);
                  Input($$renderer5, {
                    id: "user-new-email",
                    type: "email",
                    autocomplete: "off",
                    disabled: submitting,
                    required: true,
                    "aria-invalid": fieldErrors["user-new-email"] ? "true" : void 0,
                    get value() {
                      return email;
                    },
                    set value($$value) {
                      email = $$value;
                      $$settled = false;
                    }
                  });
                  $$renderer5.push(`<!----> `);
                  if (fieldErrors["user-new-email"]) {
                    $$renderer5.push("<!--[0-->");
                    $$renderer5.push(`<p class="text-destructive text-[13px]">${escape_html(fieldErrors["user-new-email"])}</p>`);
                  } else {
                    $$renderer5.push("<!--[-1-->");
                  }
                  $$renderer5.push(`<!--]--></div> <div class="flex flex-col gap-2">`);
                  Label($$renderer5, {
                    for: "user-new-password",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->Initial password`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> `);
                  PasswordInput($$renderer5, {
                    id: "user-new-password",
                    name: "password",
                    autocomplete: "new-password",
                    disabled: submitting,
                    required: true,
                    "aria-invalid": fieldErrors["user-new-password"] ? "true" : void 0,
                    get value() {
                      return password;
                    },
                    set value($$value) {
                      password = $$value;
                      $$settled = false;
                    }
                  });
                  $$renderer5.push(`<!----> `);
                  if (fieldErrors["user-new-password"]) {
                    $$renderer5.push("<!--[0-->");
                    $$renderer5.push(`<p class="text-destructive text-[13px]">${escape_html(fieldErrors["user-new-password"])}</p>`);
                  } else {
                    $$renderer5.push("<!--[-1-->");
                    $$renderer5.push(`<p class="text-muted-foreground text-[13px]">At least 12 characters.</p>`);
                  }
                  $$renderer5.push(`<!--]--></div> <div class="flex flex-col gap-2">`);
                  Label($$renderer5, {
                    for: "user-new-confirm-password",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->Confirm password`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> `);
                  PasswordInput($$renderer5, {
                    id: "user-new-confirm-password",
                    name: "confirm_password",
                    autocomplete: "new-password",
                    disabled: submitting,
                    required: true,
                    "aria-invalid": fieldErrors["user-new-confirm-password"] ? "true" : void 0,
                    get value() {
                      return confirmPassword;
                    },
                    set value($$value) {
                      confirmPassword = $$value;
                      $$settled = false;
                    }
                  });
                  $$renderer5.push(`<!----> `);
                  if (fieldErrors["user-new-confirm-password"]) {
                    $$renderer5.push("<!--[0-->");
                    $$renderer5.push(`<p class="text-destructive text-[13px]">${escape_html(fieldErrors["user-new-confirm-password"])}</p>`);
                  } else {
                    $$renderer5.push("<!--[-1-->");
                  }
                  $$renderer5.push(`<!--]--></div> <div class="flex flex-row items-start justify-between gap-4 rounded-md border border-border p-4"><div class="flex flex-col gap-1">`);
                  Label($$renderer5, {
                    for: "user-new-is-admin",
                    class: "text-sm font-medium",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->Administrator`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> <p class="text-muted-foreground text-[13px]">Admins can manage users, teams, and clusters.</p></div> `);
                  Switch($$renderer5, {
                    id: "user-new-is-admin",
                    disabled: submitting,
                    get checked() {
                      return isAdmin;
                    },
                    set checked($$value) {
                      isAdmin = $$value;
                      $$settled = false;
                    }
                  });
                  $$renderer5.push(`<!----></div> `);
                  if (assignableTeams().length > 0) {
                    $$renderer5.push("<!--[0-->");
                    $$renderer5.push(`<div class="flex flex-col gap-2">`);
                    Label($$renderer5, {
                      children: ($$renderer6) => {
                        $$renderer6.push(`<!---->Teams`);
                      },
                      $$slots: { default: true }
                    });
                    $$renderer5.push(`<!----> <p class="text-muted-foreground text-[13px]">Add the user to one or more shared teams. They automatically get a personal team.</p> <ul class="flex flex-col gap-2 rounded-md border border-border p-3"><!--[-->`);
                    const each_array = ensure_array_like(assignableTeams());
                    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
                      let team = each_array[$$index];
                      const checked = selectedTeamIds.includes(team.id);
                      $$renderer5.push(`<li class="flex items-center gap-2">`);
                      Checkbox($$renderer5, {
                        id: `team-${team.id}`,
                        checked,
                        onCheckedChange: (v) => toggleTeam(team.id, v === true),
                        disabled: submitting
                      });
                      $$renderer5.push(`<!----> `);
                      Label($$renderer5, {
                        for: `team-${team.id}`,
                        class: "text-sm font-normal",
                        children: ($$renderer6) => {
                          $$renderer6.push(`<!---->${escape_html(team.name)}`);
                        },
                        $$slots: { default: true }
                      });
                      $$renderer5.push(`<!----></li>`);
                    }
                    $$renderer5.push(`<!--]--></ul></div>`);
                  } else {
                    $$renderer5.push("<!--[-1-->");
                  }
                  $$renderer5.push(`<!--]--> <div class="flex justify-end gap-2">`);
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
                        $$renderer6.push(`Create user`);
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
//# sourceMappingURL=_page.svelte-DwoYep-X.js.map
