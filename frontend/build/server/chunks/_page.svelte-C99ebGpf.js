import { aB as head, h as ensure_array_like, m as escape_html, j as attr, p as attributes, d as derived } from './renderer--hvGDOOw.js';
import { i as invalidateAll } from './client-bCVElyx1.js';
import { C as Card } from './card-BUGQ1elQ.js';
import { C as Card_header, b as Card_content, a as Card_title } from './card-title-DQvVyNSe.js';
import { C as Card_description } from './card-description-MliYuxx-.js';
import 'clsx';
import './alert-CDmFQdZq.js';
import { D as Dialog, a as Dialog_content, b as Dialog_header, c as Dialog_title, d as Dialog_description, e as Dialog_footer } from './dialog-description2-C1bK-doN.js';
import { D as Dropdown_menu, a as Dropdown_menu_trigger, b as Dropdown_menu_content, c as Dropdown_menu_item } from './dropdown-menu-trigger-MgfQwyFx.js';
import { B as Button } from './button-ntOmtgiY.js';
import { I as Input } from './input-Buwd_f-b.js';
import { L as Label } from './label-7gbcsuPJ.js';
import { T as Textarea } from './textarea-EAANYJCn.js';
import { F as FormSummaryAlert } from './FormSummaryAlert-Cd0-Zz2l.js';
import { C as ConfirmByNameDialog } from './ConfirmByNameDialog-97SqJ_Il.js';
import { a as api } from './client2-WJrlUD72.js';
import { K as Key_round } from './key-round-DOk9HSmX.js';
import { E as Ellipsis } from './ellipsis-Cw3YODzl.js';
import { a as toast } from './toast-state.svelte-Ckj_X06S.js';
import '@sveltejs/kit/internal';
import './root-DHp9To-z.js';
import './index-B54IuS4T.js';
import '@sveltejs/kit/internal/server';
import './state.svelte-BYtSRxhp.js';
import './dialog-content-Y751EC5K.js';
import './dialog-description-BW9UDPMx.js';
import './is-HJ-O5XFN.js';
import './scroll-lock-CGoEUeDJ.js';
import './noop-n4I-x7yK.js';
import './x-Co-kLHi3.js';
import './Icon-B86w_tDb.js';
import './popper-layer-force-mount-DL2Z2See.js';
import 'tailwind-merge';
import './alert-description-Cz6DQ4pO.js';
import './alert-title-BufPPCWl.js';
import './triangle-alert-D6NlG2tC.js';
import './alert-dialog-description-CQsrn2hX.js';

function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    let localOverride = null;
    const keys = derived(() => localOverride ?? data.keys);
    let addOpen = false;
    let newName = "";
    let newPublicKey = "";
    let addSubmitting = false;
    let addFieldErrors = {};
    let deleteOpen = false;
    let deleteTarget = null;
    function openDelete(key) {
      deleteTarget = key;
      deleteOpen = true;
    }
    async function handleDelete() {
      if (!deleteTarget) return;
      const target = deleteTarget;
      try {
        await api.me.deleteSshKey({ id: target.id });
        localOverride = keys().filter((k) => k.id !== target.id);
        toast.success("Key deleted.");
        await invalidateAll();
      } catch {
        toast.error("Couldn't delete that key.");
      } finally {
        deleteTarget = null;
      }
    }
    function relativeTime(iso) {
      const then = new Date(iso).getTime();
      const now = Date.now();
      const diff = Math.max(0, now - then);
      const minutes = Math.floor(diff / 6e4);
      if (minutes < 1) return "just now";
      if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
      const days = Math.floor(hours / 24);
      if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
      const months = Math.floor(days / 30);
      if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
      const years = Math.floor(months / 12);
      return `${years} year${years === 1 ? "" : "s"} ago`;
    }
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      head("124183s", $$renderer3, ($$renderer4) => {
        $$renderer4.title(($$renderer5) => {
          $$renderer5.push(`<title>SSH keys — Proxmox GUI</title>`);
        });
      });
      $$renderer3.push(`<div class="mx-auto flex w-full max-w-[720px] flex-col gap-6"><header class="flex flex-col gap-2"><h1 class="text-[28px] font-semibold tracking-tight">SSH keys</h1> <p class="text-muted-foreground text-sm">Public keys you can attach when creating VMs and containers.</p></header> `);
      if (Card) {
        $$renderer3.push("<!--[-->");
        Card($$renderer3, {
          children: ($$renderer4) => {
            if (Card_header) {
              $$renderer4.push("<!--[-->");
              Card_header($$renderer4, {
                class: "flex flex-row items-start justify-between gap-4 space-y-0",
                children: ($$renderer5) => {
                  $$renderer5.push(`<div class="flex flex-col gap-1.5">`);
                  if (Card_title) {
                    $$renderer5.push("<!--[-->");
                    Card_title($$renderer5, {
                      class: "text-lg font-semibold tracking-tight",
                      children: ($$renderer6) => {
                        $$renderer6.push(`<!---->SSH keys`);
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
                        $$renderer6.push(`<!---->Public keys you can attach when creating VMs and containers.`);
                      },
                      $$slots: { default: true }
                    });
                    $$renderer5.push("<!--]-->");
                  } else {
                    $$renderer5.push("<!--[!-->");
                    $$renderer5.push("<!--]-->");
                  }
                  $$renderer5.push(`</div> `);
                  Button($$renderer5, {
                    onclick: () => addOpen = true,
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->Add SSH key`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!---->`);
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
                  if (keys().length === 0) {
                    $$renderer5.push("<!--[0-->");
                    $$renderer5.push(`<div class="border-border bg-muted/30 flex flex-col items-center gap-2 rounded-md border border-dashed px-6 py-10 text-center">`);
                    Key_round($$renderer5, { class: "text-muted-foreground size-6", "aria-hidden": "true" });
                    $$renderer5.push(`<!----> <p class="text-sm font-medium">No SSH keys yet</p> <p class="text-muted-foreground text-[13px]">Add a public key to enable per-VM SSH access (used in Phase 4).</p></div>`);
                  } else {
                    $$renderer5.push("<!--[-1-->");
                    $$renderer5.push(`<ul class="divide-border divide-y"><!--[-->`);
                    const each_array = ensure_array_like(keys());
                    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
                      let key = each_array[$$index];
                      $$renderer5.push(`<li class="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"><div class="flex min-w-0 flex-1 flex-col gap-1"><span class="text-sm font-medium">${escape_html(key.name)}</span> <code class="text-muted-foreground truncate font-mono text-[13px]"${attr("title", key.fingerprint)}>${escape_html(key.fingerprint)}</code> <span class="text-muted-foreground text-[13px]">Added ${escape_html(relativeTime(key.created_at))}</span></div> `);
                      if (Dropdown_menu) {
                        $$renderer5.push("<!--[-->");
                        Dropdown_menu($$renderer5, {
                          children: ($$renderer6) => {
                            {
                              let child = function($$renderer7, { props }) {
                                $$renderer7.push(`<button${attributes({
                                  ...props,
                                  class: "text-muted-foreground hover:text-foreground hover:bg-muted inline-flex size-8 items-center justify-center rounded-md transition-colors",
                                  "aria-label": `Actions for ${key.name}`
                                })}>`);
                                Ellipsis($$renderer7, { class: "size-4", "aria-hidden": "true" });
                                $$renderer7.push(`<!----></button>`);
                              };
                              if (Dropdown_menu_trigger) {
                                $$renderer6.push("<!--[-->");
                                Dropdown_menu_trigger($$renderer6, { child, $$slots: { child: true } });
                                $$renderer6.push("<!--]-->");
                              } else {
                                $$renderer6.push("<!--[!-->");
                                $$renderer6.push("<!--]-->");
                              }
                            }
                            $$renderer6.push(` `);
                            if (Dropdown_menu_content) {
                              $$renderer6.push("<!--[-->");
                              Dropdown_menu_content($$renderer6, {
                                align: "end",
                                children: ($$renderer7) => {
                                  if (Dropdown_menu_item) {
                                    $$renderer7.push("<!--[-->");
                                    Dropdown_menu_item($$renderer7, {
                                      class: "text-destructive focus:text-destructive",
                                      onSelect: () => openDelete(key),
                                      children: ($$renderer8) => {
                                        $$renderer8.push(`<!---->Delete`);
                                      },
                                      $$slots: { default: true }
                                    });
                                    $$renderer7.push("<!--]-->");
                                  } else {
                                    $$renderer7.push("<!--[!-->");
                                    $$renderer7.push("<!--]-->");
                                  }
                                },
                                $$slots: { default: true }
                              });
                              $$renderer6.push("<!--]-->");
                            } else {
                              $$renderer6.push("<!--[!-->");
                              $$renderer6.push("<!--]-->");
                            }
                          },
                          $$slots: { default: true }
                        });
                        $$renderer5.push("<!--]-->");
                      } else {
                        $$renderer5.push("<!--[!-->");
                        $$renderer5.push("<!--]-->");
                      }
                      $$renderer5.push(`</li>`);
                    }
                    $$renderer5.push(`<!--]--></ul>`);
                  }
                  $$renderer5.push(`<!--]-->`);
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
      $$renderer3.push(`</div> `);
      if (Dialog) {
        $$renderer3.push("<!--[-->");
        Dialog($$renderer3, {
          get open() {
            return addOpen;
          },
          set open($$value) {
            addOpen = $$value;
            $$settled = false;
          },
          children: ($$renderer4) => {
            if (Dialog_content) {
              $$renderer4.push("<!--[-->");
              Dialog_content($$renderer4, {
                class: "sm:max-w-2xl",
                children: ($$renderer5) => {
                  if (Dialog_header) {
                    $$renderer5.push("<!--[-->");
                    Dialog_header($$renderer5, {
                      children: ($$renderer6) => {
                        if (Dialog_title) {
                          $$renderer6.push("<!--[-->");
                          Dialog_title($$renderer6, {
                            children: ($$renderer7) => {
                              $$renderer7.push(`<!---->Add an SSH public key`);
                            },
                            $$slots: { default: true }
                          });
                          $$renderer6.push("<!--]-->");
                        } else {
                          $$renderer6.push("<!--[!-->");
                          $$renderer6.push("<!--]-->");
                        }
                        $$renderer6.push(` `);
                        if (Dialog_description) {
                          $$renderer6.push("<!--[-->");
                          Dialog_description($$renderer6, {
                            children: ($$renderer7) => {
                              $$renderer7.push(`<!---->Paste the contents of a \`.pub\` file. We compute the fingerprint server-side.`);
                            },
                            $$slots: { default: true }
                          });
                          $$renderer6.push("<!--]-->");
                        } else {
                          $$renderer6.push("<!--[!-->");
                          $$renderer6.push("<!--]-->");
                        }
                      },
                      $$slots: { default: true }
                    });
                    $$renderer5.push("<!--]-->");
                  } else {
                    $$renderer5.push("<!--[!-->");
                    $$renderer5.push("<!--]-->");
                  }
                  $$renderer5.push(` <form class="flex flex-col gap-4" novalidate="">`);
                  FormSummaryAlert($$renderer5, { errors: addFieldErrors, id: "ssh-add-summary" });
                  $$renderer5.push(`<!----> `);
                  {
                    $$renderer5.push("<!--[-1-->");
                  }
                  $$renderer5.push(`<!--]--> <div class="flex flex-col gap-2">`);
                  Label($$renderer5, {
                    for: "ssh-add-name",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->Name`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> `);
                  Input($$renderer5, {
                    id: "ssh-add-name",
                    type: "text",
                    autocomplete: "off",
                    placeholder: "laptop",
                    disabled: addSubmitting,
                    required: true,
                    "aria-invalid": addFieldErrors["ssh-add-name"] ? "true" : void 0,
                    get value() {
                      return newName;
                    },
                    set value($$value) {
                      newName = $$value;
                      $$settled = false;
                    }
                  });
                  $$renderer5.push(`<!----> `);
                  if (addFieldErrors["ssh-add-name"]) {
                    $$renderer5.push("<!--[0-->");
                    $$renderer5.push(`<p class="text-destructive text-[13px]">${escape_html(addFieldErrors["ssh-add-name"])}</p>`);
                  } else {
                    $$renderer5.push("<!--[-1-->");
                    $$renderer5.push(`<p class="text-muted-foreground text-[13px]">A short label so you can identify this key.</p>`);
                  }
                  $$renderer5.push(`<!--]--></div> <div class="flex flex-col gap-2">`);
                  Label($$renderer5, {
                    for: "ssh-add-public-key",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->Public key`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> `);
                  Textarea($$renderer5, {
                    id: "ssh-add-public-key",
                    rows: 5,
                    wrap: "soft",
                    spellcheck: false,
                    placeholder: "ssh-ed25519 AAAA... user@host",
                    disabled: addSubmitting,
                    required: true,
                    class: "font-mono text-[13px] break-all whitespace-pre-wrap [field-sizing:fixed] w-full max-w-full",
                    "aria-invalid": addFieldErrors["ssh-add-public-key"] ? "true" : void 0,
                    get value() {
                      return newPublicKey;
                    },
                    set value($$value) {
                      newPublicKey = $$value;
                      $$settled = false;
                    }
                  });
                  $$renderer5.push(`<!----> `);
                  if (addFieldErrors["ssh-add-public-key"]) {
                    $$renderer5.push("<!--[0-->");
                    $$renderer5.push(`<p class="text-destructive text-[13px]">${escape_html(addFieldErrors["ssh-add-public-key"])}</p>`);
                  } else {
                    $$renderer5.push("<!--[-1-->");
                    $$renderer5.push(`<p class="text-muted-foreground text-[13px]">Paste the contents of your \`.pub\` file (e.g. <code>~/.ssh/id_ed25519.pub</code>).</p>`);
                  }
                  $$renderer5.push(`<!--]--></div> `);
                  if (Dialog_footer) {
                    $$renderer5.push("<!--[-->");
                    Dialog_footer($$renderer5, {
                      children: ($$renderer6) => {
                        Button($$renderer6, {
                          type: "button",
                          variant: "ghost",
                          onclick: () => addOpen = false,
                          disabled: addSubmitting,
                          children: ($$renderer7) => {
                            $$renderer7.push(`<!---->Cancel`);
                          },
                          $$slots: { default: true }
                        });
                        $$renderer6.push(`<!----> `);
                        Button($$renderer6, {
                          type: "submit",
                          disabled: addSubmitting,
                          children: ($$renderer7) => {
                            {
                              $$renderer7.push("<!--[-1-->");
                              $$renderer7.push(`Add key`);
                            }
                            $$renderer7.push(`<!--]-->`);
                          },
                          $$slots: { default: true }
                        });
                        $$renderer6.push(`<!---->`);
                      },
                      $$slots: { default: true }
                    });
                    $$renderer5.push("<!--]-->");
                  } else {
                    $$renderer5.push("<!--[!-->");
                    $$renderer5.push("<!--]-->");
                  }
                  $$renderer5.push(`</form>`);
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
      if (deleteTarget) {
        $$renderer3.push("<!--[0-->");
        ConfirmByNameDialog($$renderer3, {
          heading: `Delete '${deleteTarget.name}'?`,
          body: "This key is removed from your account. Existing VMs that already have this key keep it.",
          targetName: deleteTarget.name,
          confirmLabel: "Delete key",
          onConfirm: handleDelete,
          get open() {
            return deleteOpen;
          },
          set open($$value) {
            deleteOpen = $$value;
            $$settled = false;
          }
        });
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
//# sourceMappingURL=_page.svelte-C99ebGpf.js.map
