import { w as run, A as head, l as escape_html, d as derived, f as ensure_array_like } from './renderer-5OqEGBJa.js';
import { g as goto, i as invalidateAll } from './client-BLBuBvl1.js';
import { C as Card } from './card-BLYI87Kx.js';
import { C as Card_header, b as Card_title, c as Card_description, a as Card_content } from './card-title-B-O6SEP3.js';
import 'clsx';
import './alert-description-cFcqAgKO.js';
import { B as Badge } from './badge-TEIAL8qa.js';
import { d as Input, B as Button } from './input-QG1nZPSy.js';
import { L as Label } from './label-CnHFxire.js';
import { S as Switch } from './switch-B5RYXi6P.js';
import { C as Checkbox } from './checkbox-BU2YnSjn.js';
import { P as PasswordInput } from './PasswordInput-5u8Tb5x8.js';
import { F as FormSummaryAlert } from './FormSummaryAlert--3wUSwHp.js';
import { C as ConfirmByNameDialog } from './ConfirmByNameDialog-CZh4x1IC.js';
import { a as api } from './client2-vvZGy19D.js';
import { A as Arrow_left } from './arrow-left-DT5fBYoJ.js';
import { a as toast } from './toast-state.svelte-BaJ56aYt.js';
import '@sveltejs/kit/internal';
import './root-BZo_tL0Z.js';
import './index-Siz_BmGa.js';
import '@sveltejs/kit/internal/server';
import './state.svelte-Bqwbw8qw.js';
import 'tailwind-merge';
import './is-DeZ4WIS2.js';
import './hidden-input-DV0Crp70.js';
import './sr-only-styles-DyDinzbs.js';
import './noop-n4I-x7yK.js';
import './clone-BIspTav0.js';
import './check-mBuM5jRg.js';
import './alert-title-B4F9lIW0.js';
import './triangle-alert-CojLJBTH.js';
import './dialog-overlay-IuDKC_Od.js';
import './scroll-lock-BdvbL8bD.js';
import './dialog-description2-9nkLtBGh.js';

function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    const isSelf = derived(() => data.target.id === data.user.id);
    const assignableTeams = derived(() => data.teams.filter((t) => !t.personal));
    let email = run(() => data.target.email);
    let isAdmin = run(() => data.target.is_admin);
    let isActive = run(() => data.target.is_active);
    let selectedTeamIds = run(() => data.target.teams.filter((t) => !t.personal).map((t) => t.id));
    let editSubmitting = false;
    let editFieldErrors = {};
    function toggleTeam(teamId, checked) {
      if (checked) {
        if (!selectedTeamIds.includes(teamId)) {
          selectedTeamIds = [...selectedTeamIds, teamId];
        }
      } else {
        selectedTeamIds = selectedTeamIds.filter((id) => id !== teamId);
      }
    }
    let newPassword = "";
    let confirmPassword = "";
    let pwSubmitting = false;
    let pwFieldErrors = {};
    let disableOpen = false;
    let deleteOpen = false;
    async function handleDisable() {
      try {
        await api.users.update({ id: data.target.id, is_active: false });
        toast.success(`${data.target.username} was disabled.`);
        isActive = false;
        await invalidateAll();
      } catch {
        toast.error("Couldn't disable that user.");
      }
    }
    async function handleDelete() {
      try {
        await api.users.del({ id: data.target.id });
        toast.success(`${data.target.username} was deleted.`);
        await goto("/admin/users");
      } catch {
        toast.error("Couldn't delete that user.");
      }
    }
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      head("k8krhj", $$renderer3, ($$renderer4) => {
        $$renderer4.title(($$renderer5) => {
          $$renderer5.push(`<title>${escape_html(data.target.username)} — Users — Proxmox GUI</title>`);
        });
      });
      $$renderer3.push(`<div class="mx-auto flex w-full max-w-[720px] flex-col gap-6"><header class="flex flex-col gap-2"><a href="/admin/users" class="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-[13px]">`);
      Arrow_left($$renderer3, { class: "size-4", "aria-hidden": "true" });
      $$renderer3.push(`<!----> Back to Users</a> <div class="flex flex-row items-center gap-2"><h1 class="text-[28px] font-semibold tracking-tight">${escape_html(data.target.username)}</h1> `);
      if (data.target.is_admin) {
        $$renderer3.push("<!--[0-->");
        Badge($$renderer3, {
          variant: "default",
          children: ($$renderer4) => {
            $$renderer4.push(`<!---->Admin`);
          },
          $$slots: { default: true }
        });
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--> `);
      if (!data.target.is_active) {
        $$renderer3.push("<!--[0-->");
        Badge($$renderer3, {
          variant: "secondary",
          children: ($$renderer4) => {
            $$renderer4.push(`<!---->Disabled`);
          },
          $$slots: { default: true }
        });
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--> `);
      if (isSelf()) {
        $$renderer3.push("<!--[0-->");
        Badge($$renderer3, {
          variant: "outline",
          children: ($$renderer4) => {
            $$renderer4.push(`<!---->You`);
          },
          $$slots: { default: true }
        });
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--></div> <p class="text-muted-foreground text-sm">Edit this user's account and team membership.</p></header> `);
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
                        $$renderer6.push(`<!---->Change the user's email, role, status, and team membership.`);
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
                  FormSummaryAlert($$renderer5, { errors: editFieldErrors, id: "user-edit-summary" });
                  $$renderer5.push(`<!----> `);
                  {
                    $$renderer5.push("<!--[-1-->");
                  }
                  $$renderer5.push(`<!--]--> <div class="flex flex-col gap-2">`);
                  Label($$renderer5, {
                    for: "user-edit-email",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->Email`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> `);
                  Input($$renderer5, {
                    id: "user-edit-email",
                    type: "email",
                    autocomplete: "off",
                    disabled: editSubmitting,
                    required: true,
                    "aria-invalid": editFieldErrors["user-edit-email"] ? "true" : void 0,
                    get value() {
                      return email;
                    },
                    set value($$value) {
                      email = $$value;
                      $$settled = false;
                    }
                  });
                  $$renderer5.push(`<!----> `);
                  if (editFieldErrors["user-edit-email"]) {
                    $$renderer5.push("<!--[0-->");
                    $$renderer5.push(`<p class="text-destructive text-[13px]">${escape_html(editFieldErrors["user-edit-email"])}</p>`);
                  } else {
                    $$renderer5.push("<!--[-1-->");
                  }
                  $$renderer5.push(`<!--]--></div> <div class="flex flex-row items-start justify-between gap-4 rounded-md border border-border p-4"><div class="flex flex-col gap-1">`);
                  Label($$renderer5, {
                    for: "user-edit-is-admin",
                    class: "text-sm font-medium",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->Administrator`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> <p class="text-muted-foreground text-[13px]">`);
                  if (isSelf()) {
                    $$renderer5.push("<!--[0-->");
                    $$renderer5.push(`You cannot change your own admin status.`);
                  } else {
                    $$renderer5.push("<!--[-1-->");
                    $$renderer5.push(`Admins can manage users, teams, and clusters.`);
                  }
                  $$renderer5.push(`<!--]--></p></div> `);
                  Switch($$renderer5, {
                    id: "user-edit-is-admin",
                    disabled: isSelf(),
                    get checked() {
                      return isAdmin;
                    },
                    set checked($$value) {
                      isAdmin = $$value;
                      $$settled = false;
                    }
                  });
                  $$renderer5.push(`<!----></div> <div class="flex flex-row items-start justify-between gap-4 rounded-md border border-border p-4"><div class="flex flex-col gap-1">`);
                  Label($$renderer5, {
                    for: "user-edit-is-active",
                    class: "text-sm font-medium",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->Active`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> <p class="text-muted-foreground text-[13px]">`);
                  if (isSelf()) {
                    $$renderer5.push("<!--[0-->");
                    $$renderer5.push(`You cannot disable your own account.`);
                  } else {
                    $$renderer5.push("<!--[-1-->");
                    $$renderer5.push(`Disabled users cannot sign in and have their sessions revoked.`);
                  }
                  $$renderer5.push(`<!--]--></p></div> `);
                  Switch($$renderer5, {
                    id: "user-edit-is-active",
                    disabled: isSelf(),
                    get checked() {
                      return isActive;
                    },
                    set checked($$value) {
                      isActive = $$value;
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
                    $$renderer5.push(`<!----> <p class="text-muted-foreground text-[13px]">Select the shared teams this user belongs to. (Personal team is kept automatically.)</p> <ul class="flex flex-col gap-2 rounded-md border border-border p-3"><!--[-->`);
                    const each_array = ensure_array_like(assignableTeams());
                    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
                      let team = each_array[$$index];
                      const checked = selectedTeamIds.includes(team.id);
                      $$renderer5.push(`<li class="flex items-center gap-2">`);
                      Checkbox($$renderer5, {
                        id: `team-${team.id}`,
                        checked,
                        onCheckedChange: (v) => toggleTeam(team.id, v === true),
                        disabled: editSubmitting
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
                    disabled: editSubmitting,
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->Cancel`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> `);
                  Button($$renderer5, {
                    type: "submit",
                    disabled: editSubmitting,
                    children: ($$renderer6) => {
                      {
                        $$renderer6.push("<!--[-1-->");
                        $$renderer6.push(`Save changes`);
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
                        $$renderer6.push(`<!---->Reset password`);
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
                        $$renderer6.push(`<!---->Set a new password for this user. Their active sessions are revoked.`);
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
                  FormSummaryAlert($$renderer5, { errors: pwFieldErrors, id: "user-edit-password-summary" });
                  $$renderer5.push(`<!----> `);
                  {
                    $$renderer5.push("<!--[-1-->");
                  }
                  $$renderer5.push(`<!--]--> <div class="flex flex-col gap-2">`);
                  Label($$renderer5, {
                    for: "user-edit-new-password",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->New password`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> `);
                  PasswordInput($$renderer5, {
                    id: "user-edit-new-password",
                    name: "new_password",
                    autocomplete: "new-password",
                    disabled: pwSubmitting,
                    required: true,
                    "aria-invalid": pwFieldErrors["user-edit-new-password"] ? "true" : void 0,
                    get value() {
                      return newPassword;
                    },
                    set value($$value) {
                      newPassword = $$value;
                      $$settled = false;
                    }
                  });
                  $$renderer5.push(`<!----> `);
                  if (pwFieldErrors["user-edit-new-password"]) {
                    $$renderer5.push("<!--[0-->");
                    $$renderer5.push(`<p class="text-destructive text-[13px]">${escape_html(pwFieldErrors["user-edit-new-password"])}</p>`);
                  } else {
                    $$renderer5.push("<!--[-1-->");
                    $$renderer5.push(`<p class="text-muted-foreground text-[13px]">At least 12 characters.</p>`);
                  }
                  $$renderer5.push(`<!--]--></div> <div class="flex flex-col gap-2">`);
                  Label($$renderer5, {
                    for: "user-edit-confirm-password",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->Confirm new password`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> `);
                  PasswordInput($$renderer5, {
                    id: "user-edit-confirm-password",
                    name: "confirm_password",
                    autocomplete: "new-password",
                    disabled: pwSubmitting,
                    required: true,
                    "aria-invalid": pwFieldErrors["user-edit-confirm-password"] ? "true" : void 0,
                    get value() {
                      return confirmPassword;
                    },
                    set value($$value) {
                      confirmPassword = $$value;
                      $$settled = false;
                    }
                  });
                  $$renderer5.push(`<!----> `);
                  if (pwFieldErrors["user-edit-confirm-password"]) {
                    $$renderer5.push("<!--[0-->");
                    $$renderer5.push(`<p class="text-destructive text-[13px]">${escape_html(pwFieldErrors["user-edit-confirm-password"])}</p>`);
                  } else {
                    $$renderer5.push("<!--[-1-->");
                  }
                  $$renderer5.push(`<!--]--></div> <div class="flex justify-end">`);
                  Button($$renderer5, {
                    type: "submit",
                    disabled: pwSubmitting,
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
      if (!isSelf()) {
        $$renderer3.push("<!--[0-->");
        if (Card) {
          $$renderer3.push("<!--[-->");
          Card($$renderer3, {
            class: "border-destructive/40",
            children: ($$renderer4) => {
              if (Card_header) {
                $$renderer4.push("<!--[-->");
                Card_header($$renderer4, {
                  children: ($$renderer5) => {
                    if (Card_title) {
                      $$renderer5.push("<!--[-->");
                      Card_title($$renderer5, {
                        class: "text-destructive text-lg font-semibold tracking-tight",
                        children: ($$renderer6) => {
                          $$renderer6.push(`<!---->Danger zone`);
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
                          if (data.target.is_active) {
                            $$renderer6.push("<!--[0-->");
                            $$renderer6.push(`Disable this user to revoke their sessions immediately, or delete them permanently.`);
                          } else {
                            $$renderer6.push("<!--[-1-->");
                            $$renderer6.push(`This user is already disabled. Delete them permanently if they no longer need access.`);
                          }
                          $$renderer6.push(`<!--]-->`);
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
                    $$renderer5.push(`<div class="flex flex-wrap gap-2">`);
                    if (data.target.is_active) {
                      $$renderer5.push("<!--[0-->");
                      Button($$renderer5, {
                        variant: "outline",
                        onclick: () => disableOpen = true,
                        children: ($$renderer6) => {
                          $$renderer6.push(`<!---->Disable user`);
                        },
                        $$slots: { default: true }
                      });
                    } else {
                      $$renderer5.push("<!--[-1-->");
                    }
                    $$renderer5.push(`<!--]--> `);
                    Button($$renderer5, {
                      variant: "destructive",
                      onclick: () => deleteOpen = true,
                      children: ($$renderer6) => {
                        $$renderer6.push(`<!---->Delete user`);
                      },
                      $$slots: { default: true }
                    });
                    $$renderer5.push(`<!----></div>`);
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
      $$renderer3.push(`<!--]--></div> `);
      if (!isSelf()) {
        $$renderer3.push("<!--[0-->");
        ConfirmByNameDialog($$renderer3, {
          heading: `Disable ${data.target.username}?`,
          body: `${data.target.username} won't be able to sign in. Active sessions are revoked immediately. You can re-enable them later.`,
          targetName: data.target.username,
          confirmLabel: "Disable user",
          onConfirm: handleDisable,
          get open() {
            return disableOpen;
          },
          set open($$value) {
            disableOpen = $$value;
            $$settled = false;
          }
        });
        $$renderer3.push(`<!----> `);
        ConfirmByNameDialog($$renderer3, {
          heading: `Delete ${data.target.username}?`,
          body: `Their account is removed permanently. Their team memberships are dropped. VMs they created stay with the team. This can't be undone.`,
          targetName: data.target.username,
          confirmLabel: "Delete user",
          onConfirm: handleDelete,
          get open() {
            return deleteOpen;
          },
          set open($$value) {
            deleteOpen = $$value;
            $$settled = false;
          }
        });
        $$renderer3.push(`<!---->`);
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]-->`);
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
//# sourceMappingURL=_page.svelte-cQlhCwQJ.js.map
