import { aB as head, f as bind_props, m as escape_html, h as ensure_array_like, p as attributes, d as derived } from './renderer--hvGDOOw.js';
import { i as invalidateAll } from './client-bCVElyx1.js';
import { C as Card } from './card-DccFReV7.js';
import { C as Card_header, b as Card_content, a as Card_title } from './card-title-BuO3I2CK.js';
import { C as Card_description } from './card-description-D_QwGK7A.js';
import 'clsx';
import './alert-B0yY0jmz.js';
import { D as Dialog, a as Dialog_content, b as Dialog_header, c as Dialog_title, d as Dialog_description, e as Dialog_footer } from './dialog-description2-CLhP5NOy.js';
import { D as Dropdown_menu, a as Dropdown_menu_trigger, b as Dropdown_menu_content, c as Dropdown_menu_item } from './dropdown-menu-trigger-Besrkwc0.js';
import { B as Badge } from './badge-Dz1XVeQx.js';
import { B as Button } from './button-BxOVow4s.js';
import { I as Input } from './input-CMvV7SCO.js';
import { L as Label } from './label-BUMhVN7M.js';
import { F as FormSummaryAlert } from './FormSummaryAlert-DEDFSQi2.js';
import { C as ConfirmByNameDialog } from './ConfirmByNameDialog-DcsDqmns.js';
import { T as Triangle_alert } from './triangle-alert-DVCT9OKF.js';
import { C as Copy } from './copy-B5NSqEUg.js';
import { C as Check } from './check-CxOYdq6i.js';
import { a as api } from './client2-WJrlUD72.js';
import { K as Key } from './key-BjKegBoQ.js';
import { E as Ellipsis } from './ellipsis-FFWdzM6Y.js';
import { a as toast } from './toast-state.svelte-Ckj_X06S.js';
import '@sveltejs/kit/internal';
import './root-DHp9To-z.js';
import './index-B54IuS4T.js';
import '@sveltejs/kit/internal/server';
import './state.svelte-BYtSRxhp.js';
import './dialog-content-Kgc_0O3C.js';
import './dialog-description-CXGZftSR.js';
import './is-D4jTQp0x.js';
import './scroll-lock-JQotfuy1.js';
import './noop-n4I-x7yK.js';
import './x-DTS6EtQK.js';
import './popper-layer-force-mount-CIW-3I3q.js';
import 'tailwind-merge';
import './alert-description-BlBkGLZQ.js';
import './alert-title-DlRvsmMg.js';
import './alert-dialog-description-BITV1g79.js';

function SecretRevealDialog($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      open = false,
      secret = "",
      label = "Save this token now.",
      body = "You won't see it again. Store it somewhere safe.",
      onDismissed,
      confirmLabel = "I've saved it"
    } = $$props;
    let copied = false;
    let copyTimer = null;
    async function copyToClipboard() {
      if (!secret) return;
      try {
        await navigator.clipboard.writeText(secret);
        copied = true;
        if (copyTimer !== null) clearTimeout(copyTimer);
        copyTimer = setTimeout(
          () => {
            copied = false;
            copyTimer = null;
          },
          2e3
        );
      } catch {
      }
    }
    function dismiss() {
      secret = "";
      open = false;
      onDismissed?.();
    }
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      if (Dialog) {
        $$renderer3.push("<!--[-->");
        Dialog($$renderer3, {
          get open() {
            return open;
          },
          set open($$value) {
            open = $$value;
            $$settled = false;
          },
          children: ($$renderer4) => {
            if (Dialog_content) {
              $$renderer4.push("<!--[-->");
              Dialog_content($$renderer4, {
                showCloseButton: false,
                escapeKeydownBehavior: "ignore",
                interactOutsideBehavior: "ignore",
                children: ($$renderer5) => {
                  if (Dialog_header) {
                    $$renderer5.push("<!--[-->");
                    Dialog_header($$renderer5, {
                      children: ($$renderer6) => {
                        $$renderer6.push(`<div class="bg-warning/10 border-warning/30 text-warning flex items-start gap-3 rounded-md border p-3">`);
                        Triangle_alert($$renderer6, { class: "size-5 shrink-0", "aria-hidden": "true" });
                        $$renderer6.push(`<!----> <div class="flex flex-col gap-1">`);
                        if (Dialog_title) {
                          $$renderer6.push("<!--[-->");
                          Dialog_title($$renderer6, {
                            class: "text-warning text-base font-semibold",
                            children: ($$renderer7) => {
                              $$renderer7.push(`<!---->${escape_html(label)}`);
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
                            class: "text-foreground text-[13px]",
                            children: ($$renderer7) => {
                              $$renderer7.push(`<!---->${escape_html(body)}`);
                            },
                            $$slots: { default: true }
                          });
                          $$renderer6.push("<!--]-->");
                        } else {
                          $$renderer6.push("<!--[!-->");
                          $$renderer6.push("<!--]-->");
                        }
                        $$renderer6.push(`</div></div>`);
                      },
                      $$slots: { default: true }
                    });
                    $$renderer5.push("<!--]-->");
                  } else {
                    $$renderer5.push("<!--[!-->");
                    $$renderer5.push("<!--]-->");
                  }
                  $$renderer5.push(` <div class="flex items-center gap-2"><code class="bg-muted block flex-1 overflow-x-auto rounded px-3 py-2 font-mono text-[13px] leading-normal">${escape_html(secret)}</code> `);
                  Button($$renderer5, {
                    variant: "outline",
                    size: "icon",
                    onclick: copyToClipboard,
                    "aria-label": copied ? "Copied" : "Copy to clipboard",
                    children: ($$renderer6) => {
                      if (copied) {
                        $$renderer6.push("<!--[0-->");
                        Check($$renderer6, { class: "size-4", "aria-hidden": "true" });
                      } else {
                        $$renderer6.push("<!--[-1-->");
                        Copy($$renderer6, { class: "size-4", "aria-hidden": "true" });
                      }
                      $$renderer6.push(`<!--]-->`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----></div> `);
                  if (Dialog_footer) {
                    $$renderer5.push("<!--[-->");
                    Dialog_footer($$renderer5, {
                      children: ($$renderer6) => {
                        Button($$renderer6, {
                          onclick: dismiss,
                          children: ($$renderer7) => {
                            $$renderer7.push(`<!---->${escape_html(confirmLabel)}`);
                          },
                          $$slots: { default: true }
                        });
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
          },
          $$slots: { default: true }
        });
        $$renderer3.push("<!--]-->");
      } else {
        $$renderer3.push("<!--[!-->");
        $$renderer3.push("<!--]-->");
      }
    }
    do {
      $$settled = true;
      $$inner_renderer = $$renderer2.copy();
      $$render_inner($$inner_renderer);
    } while (!$$settled);
    $$renderer2.subsume($$inner_renderer);
    bind_props($$props, { open, secret });
  });
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    let localOverride = null;
    const tokens = derived(() => localOverride ?? data.tokens);
    let createOpen = false;
    let newName = "";
    let newExpiresAt = "";
    let createSubmitting = false;
    let createFieldErrors = {};
    let revealOpen = false;
    let revealedSecret = "";
    function handleRevealDismissed() {
      revealedSecret = "";
    }
    let revokeOpen = false;
    let revokeTarget = null;
    function openRevoke(token) {
      revokeTarget = token;
      revokeOpen = true;
    }
    async function handleRevoke() {
      if (!revokeTarget) return;
      const target = revokeTarget;
      try {
        await api.me.revokeToken({ id: target.id });
        const fresh = await api.me.listTokens();
        localOverride = fresh;
        toast.success("Token revoked.");
        await invalidateAll();
      } catch {
        toast.error("Couldn't revoke that token.");
      } finally {
        revokeTarget = null;
      }
    }
    function statusOf(token) {
      if (token.revoked_at) return "revoked";
      if (token.expires_at && Date.parse(token.expires_at) <= Date.now()) return "expired";
      return "active";
    }
    function relativeTime(iso) {
      if (!iso) return "never";
      const then = new Date(iso).getTime();
      const now = Date.now();
      const future = then > now;
      const diff = Math.abs(now - then);
      const minutes = Math.floor(diff / 6e4);
      if (minutes < 1) return future ? "in less than a minute" : "just now";
      if (minutes < 60) return future ? `in ${minutes} minute${minutes === 1 ? "" : "s"}` : `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return future ? `in ${hours} hour${hours === 1 ? "" : "s"}` : `${hours} hour${hours === 1 ? "" : "s"} ago`;
      const days = Math.floor(hours / 24);
      if (days < 30) return future ? `in ${days} day${days === 1 ? "" : "s"}` : `${days} day${days === 1 ? "" : "s"} ago`;
      const months = Math.floor(days / 30);
      if (months < 12) return future ? `in ${months} month${months === 1 ? "" : "s"}` : `${months} month${months === 1 ? "" : "s"} ago`;
      const years = Math.floor(months / 12);
      return future ? `in ${years} year${years === 1 ? "" : "s"}` : `${years} year${years === 1 ? "" : "s"} ago`;
    }
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      head("114zzjd", $$renderer3, ($$renderer4) => {
        $$renderer4.title(($$renderer5) => {
          $$renderer5.push(`<title>Personal Access Tokens — Proxmox GUI</title>`);
        });
      });
      $$renderer3.push(`<div class="mx-auto flex w-full max-w-[720px] flex-col gap-6"><header class="flex flex-col gap-2"><h1 class="text-[28px] font-semibold tracking-tight">Personal Access Tokens</h1> <p class="text-muted-foreground text-sm">Authenticate the REST API with the same permissions as your account.</p></header> `);
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
                        $$renderer6.push(`<!---->Personal Access Tokens`);
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
                        $$renderer6.push(`<!---->Authenticate the REST API with the same permissions as your account.`);
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
                    onclick: () => createOpen = true,
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->Create token`);
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
                  if (tokens().length === 0) {
                    $$renderer5.push("<!--[0-->");
                    $$renderer5.push(`<div class="border-border bg-muted/30 flex flex-col items-center gap-2 rounded-md border border-dashed px-6 py-10 text-center">`);
                    Key($$renderer5, { class: "text-muted-foreground size-6", "aria-hidden": "true" });
                    $$renderer5.push(`<!----> <p class="text-sm font-medium">No tokens yet</p> <p class="text-muted-foreground text-[13px]">Create a Personal Access Token to use the REST API.</p></div>`);
                  } else {
                    $$renderer5.push("<!--[-1-->");
                    $$renderer5.push(`<ul class="divide-border divide-y"><!--[-->`);
                    const each_array = ensure_array_like(tokens());
                    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
                      let token = each_array[$$index];
                      const status = statusOf(token);
                      $$renderer5.push(`<li class="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"><div class="flex min-w-0 flex-1 flex-col gap-1"><div class="flex items-center gap-2"><span class="text-sm font-medium">${escape_html(token.name)}</span> `);
                      if (status === "active") {
                        $$renderer5.push("<!--[0-->");
                        Badge($$renderer5, {
                          variant: "secondary",
                          children: ($$renderer6) => {
                            $$renderer6.push(`<!---->Active`);
                          },
                          $$slots: { default: true }
                        });
                      } else if (status === "revoked") {
                        $$renderer5.push("<!--[1-->");
                        Badge($$renderer5, {
                          variant: "destructive",
                          children: ($$renderer6) => {
                            $$renderer6.push(`<!---->Revoked`);
                          },
                          $$slots: { default: true }
                        });
                      } else {
                        $$renderer5.push("<!--[-1-->");
                        Badge($$renderer5, {
                          variant: "outline",
                          children: ($$renderer6) => {
                            $$renderer6.push(`<!---->Expired`);
                          },
                          $$slots: { default: true }
                        });
                      }
                      $$renderer5.push(`<!--]--></div> <code class="text-muted-foreground truncate font-mono text-[13px]">${escape_html(token.prefix_preview)}</code> <span class="text-muted-foreground text-[13px]">Expires ${escape_html(relativeTime(token.expires_at))} · Last used ${escape_html(relativeTime(token.last_used_at))}</span></div> `);
                      if (status === "active") {
                        $$renderer5.push("<!--[0-->");
                        if (Dropdown_menu) {
                          $$renderer5.push("<!--[-->");
                          Dropdown_menu($$renderer5, {
                            children: ($$renderer6) => {
                              {
                                let child = function($$renderer7, { props }) {
                                  $$renderer7.push(`<button${attributes({
                                    ...props,
                                    class: "text-muted-foreground hover:text-foreground hover:bg-muted inline-flex size-8 items-center justify-center rounded-md transition-colors",
                                    "aria-label": `Actions for ${token.name}`
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
                                        onSelect: () => openRevoke(token),
                                        children: ($$renderer8) => {
                                          $$renderer8.push(`<!---->Revoke`);
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
                      } else {
                        $$renderer5.push("<!--[-1-->");
                      }
                      $$renderer5.push(`<!--]--></li>`);
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
            return createOpen;
          },
          set open($$value) {
            createOpen = $$value;
            $$settled = false;
          },
          children: ($$renderer4) => {
            if (Dialog_content) {
              $$renderer4.push("<!--[-->");
              Dialog_content($$renderer4, {
                children: ($$renderer5) => {
                  if (Dialog_header) {
                    $$renderer5.push("<!--[-->");
                    Dialog_header($$renderer5, {
                      children: ($$renderer6) => {
                        if (Dialog_title) {
                          $$renderer6.push("<!--[-->");
                          Dialog_title($$renderer6, {
                            children: ($$renderer7) => {
                              $$renderer7.push(`<!---->Create a Personal Access Token`);
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
                              $$renderer7.push(`<!---->Tokens authenticate the REST API with the same permissions as your account.`);
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
                  FormSummaryAlert($$renderer5, { errors: createFieldErrors, id: "pat-create-summary" });
                  $$renderer5.push(`<!----> `);
                  {
                    $$renderer5.push("<!--[-1-->");
                  }
                  $$renderer5.push(`<!--]--> <div class="flex flex-col gap-2">`);
                  Label($$renderer5, {
                    for: "pat-create-name",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->Name`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> `);
                  Input($$renderer5, {
                    id: "pat-create-name",
                    type: "text",
                    autocomplete: "off",
                    placeholder: "ci-deploy",
                    disabled: createSubmitting,
                    required: true,
                    "aria-invalid": createFieldErrors["pat-create-name"] ? "true" : void 0,
                    get value() {
                      return newName;
                    },
                    set value($$value) {
                      newName = $$value;
                      $$settled = false;
                    }
                  });
                  $$renderer5.push(`<!----> `);
                  if (createFieldErrors["pat-create-name"]) {
                    $$renderer5.push("<!--[0-->");
                    $$renderer5.push(`<p class="text-destructive text-[13px]">${escape_html(createFieldErrors["pat-create-name"])}</p>`);
                  } else {
                    $$renderer5.push("<!--[-1-->");
                    $$renderer5.push(`<p class="text-muted-foreground text-[13px]">A short label so you can identify this token.</p>`);
                  }
                  $$renderer5.push(`<!--]--></div> <div class="flex flex-col gap-2">`);
                  Label($$renderer5, {
                    for: "pat-create-expires",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->Expires (optional)`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> `);
                  Input($$renderer5, {
                    id: "pat-create-expires",
                    type: "date",
                    disabled: createSubmitting,
                    "aria-invalid": createFieldErrors["pat-create-expires"] ? "true" : void 0,
                    get value() {
                      return newExpiresAt;
                    },
                    set value($$value) {
                      newExpiresAt = $$value;
                      $$settled = false;
                    }
                  });
                  $$renderer5.push(`<!----> `);
                  if (createFieldErrors["pat-create-expires"]) {
                    $$renderer5.push("<!--[0-->");
                    $$renderer5.push(`<p class="text-destructive text-[13px]">${escape_html(createFieldErrors["pat-create-expires"])}</p>`);
                  } else {
                    $$renderer5.push("<!--[-1-->");
                    $$renderer5.push(`<p class="text-muted-foreground text-[13px]">Leave empty for a token that never expires.</p>`);
                  }
                  $$renderer5.push(`<!--]--></div> `);
                  if (Dialog_footer) {
                    $$renderer5.push("<!--[-->");
                    Dialog_footer($$renderer5, {
                      children: ($$renderer6) => {
                        Button($$renderer6, {
                          type: "button",
                          variant: "ghost",
                          onclick: () => createOpen = false,
                          disabled: createSubmitting,
                          children: ($$renderer7) => {
                            $$renderer7.push(`<!---->Cancel`);
                          },
                          $$slots: { default: true }
                        });
                        $$renderer6.push(`<!----> `);
                        Button($$renderer6, {
                          type: "submit",
                          disabled: createSubmitting,
                          children: ($$renderer7) => {
                            {
                              $$renderer7.push("<!--[-1-->");
                              $$renderer7.push(`Create token`);
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
      SecretRevealDialog($$renderer3, {
        onDismissed: handleRevealDismissed,
        get open() {
          return revealOpen;
        },
        set open($$value) {
          revealOpen = $$value;
          $$settled = false;
        },
        get secret() {
          return revealedSecret;
        },
        set secret($$value) {
          revealedSecret = $$value;
          $$settled = false;
        }
      });
      $$renderer3.push(`<!----> `);
      if (revokeTarget) {
        $$renderer3.push("<!--[0-->");
        ConfirmByNameDialog($$renderer3, {
          heading: `Revoke '${revokeTarget.name}'?`,
          body: "Any application using this token loses access immediately. This can't be undone.",
          targetName: revokeTarget.name,
          confirmLabel: "Revoke token",
          onConfirm: handleRevoke,
          get open() {
            return revokeOpen;
          },
          set open($$value) {
            revokeOpen = $$value;
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
//# sourceMappingURL=_page.svelte-CR5dNhHM.js.map
