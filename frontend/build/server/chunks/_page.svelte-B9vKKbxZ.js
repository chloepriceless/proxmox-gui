import { A as head, d as derived, f as ensure_array_like, h as attr, k as stringify, l as escape_html, o as attributes } from './renderer-5OqEGBJa.js';
import { g as goto, i as invalidateAll } from './client-BLBuBvl1.js';
import { B as Button } from './button-B5bCAdGN.js';
import { B as Badge } from './badge-ohCh8OUw.js';
import { T as Table, b as Table_body, a as Table_row, c as Table_cell } from './table-row-CHObHOSI.js';
import 'clsx';
import { T as Table_header, a as Table_head } from './table-header-DckvTEzE.js';
import { D as Dropdown_menu, a as Dropdown_menu_trigger, b as Dropdown_menu_content, c as Dropdown_menu_item } from './dropdown-menu-trigger-D8Q6pE1W.js';
import { D as Dropdown_menu_separator } from './dropdown-menu-separator-vPMSiDH6.js';
import { C as ConfirmByNameDialog } from './ConfirmByNameDialog-hAB2W_E3.js';
import { a as api, A as ApiError } from './client2-vvZGy19D.js';
import { P as Plus } from './plus-CI38lqX5.js';
import { E as Ellipsis } from './ellipsis-CMN_ktWR.js';
import { a as toast } from './toast-state.svelte-BaJ56aYt.js';
import '@sveltejs/kit/internal';
import './root-BZo_tL0Z.js';
import './index-Siz_BmGa.js';
import '@sveltejs/kit/internal/server';
import './state.svelte-Bqwbw8qw.js';
import 'tailwind-merge';
import './scroll-lock-BXSbnLUA.js';
import './is-DeZ4WIS2.js';
import './input-CVUkBx6i.js';
import './noop-n4I-x7yK.js';
import './popper-layer-force-mount-DItOXSN8.js';
import './dialog-overlay-CKQuveke.js';
import './dialog-description2-CRb016Lx.js';
import './label-DVSPNLFi.js';

function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    let localOverride = null;
    const users = derived(() => localOverride ?? data.users);
    const currentUserId = derived(() => data.user.id);
    async function refreshList() {
      try {
        const fresh = await api.users.list();
        localOverride = fresh;
      } catch {
        toast.error("Couldn't refresh users.");
      }
    }
    let disableOpen = false;
    let disableTarget = null;
    function openDisable(u) {
      disableTarget = u;
      disableOpen = true;
    }
    async function handleDisable() {
      if (!disableTarget) return;
      const target = disableTarget;
      try {
        await api.users.update({ id: target.id, is_active: false });
        await refreshList();
        toast.success(`${target.username} was disabled.`);
        await invalidateAll();
      } catch (err) {
        const msg = err instanceof ApiError && err.status === 422 ? "Cannot modify your own active state." : "Couldn't disable that user.";
        toast.error(msg);
      } finally {
        disableTarget = null;
      }
    }
    async function handleEnable(u) {
      try {
        await api.users.update({ id: u.id, is_active: true });
        await refreshList();
        toast.success(`${u.username} was enabled.`);
        await invalidateAll();
      } catch {
        toast.error("Couldn't enable that user.");
      }
    }
    let deleteOpen = false;
    let deleteTarget = null;
    function openDelete(u) {
      deleteTarget = u;
      deleteOpen = true;
    }
    async function handleDelete() {
      if (!deleteTarget) return;
      const target = deleteTarget;
      try {
        await api.users.del({ id: target.id });
        localOverride = users().filter((u) => u.id !== target.id);
        toast.success(`${target.username} was deleted.`);
        await invalidateAll();
      } catch (err) {
        const msg = err instanceof ApiError && err.status === 422 ? "Cannot delete yourself." : "Couldn't delete that user.";
        toast.error(msg);
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
    function nonPersonalTeamCount(u) {
      return u.teams.filter((t) => !t.personal).length;
    }
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      head("1p497kv", $$renderer3, ($$renderer4) => {
        $$renderer4.title(($$renderer5) => {
          $$renderer5.push(`<title>Users — Proxmox GUI</title>`);
        });
      });
      $$renderer3.push(`<div class="flex w-full flex-col gap-6"><header class="flex flex-row items-start justify-between gap-4"><div class="flex flex-col gap-2"><h1 class="text-[28px] font-semibold tracking-tight">Users</h1> <p class="text-muted-foreground text-sm">Manage who can sign in and which teams they belong to.</p></div> `);
      Button($$renderer3, {
        onclick: () => goto(),
        children: ($$renderer4) => {
          Plus($$renderer4, { class: "size-4", "aria-hidden": "true" });
          $$renderer4.push(`<!----> New user`);
        },
        $$slots: { default: true }
      });
      $$renderer3.push(`<!----></header> `);
      if (data.loadError) {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<div class="border-border bg-muted/30 flex flex-col items-center gap-3 rounded-md border border-dashed px-6 py-10 text-center"><p class="text-sm font-medium">Couldn't load users. Try again.</p> `);
        Button($$renderer3, {
          variant: "outline",
          onclick: refreshList,
          children: ($$renderer4) => {
            $$renderer4.push(`<!---->Try again`);
          },
          $$slots: { default: true }
        });
        $$renderer3.push(`<!----></div>`);
      } else if (users().length === 0) {
        $$renderer3.push("<!--[1-->");
        $$renderer3.push(`<div class="border-border bg-muted/30 flex flex-col items-center gap-2 rounded-md border border-dashed px-6 py-10 text-center"><p class="text-sm font-medium">No users yet</p> <p class="text-muted-foreground text-[13px]">Click 'New user' to create the first one.</p></div>`);
      } else {
        $$renderer3.push("<!--[-1-->");
        $$renderer3.push(`<div class="rounded-md border border-border">`);
        if (Table) {
          $$renderer3.push("<!--[-->");
          Table($$renderer3, {
            children: ($$renderer4) => {
              if (Table_header) {
                $$renderer4.push("<!--[-->");
                Table_header($$renderer4, {
                  children: ($$renderer5) => {
                    if (Table_row) {
                      $$renderer5.push("<!--[-->");
                      Table_row($$renderer5, {
                        children: ($$renderer6) => {
                          if (Table_head) {
                            $$renderer6.push("<!--[-->");
                            Table_head($$renderer6, {
                              class: "text-[13px] font-medium",
                              children: ($$renderer7) => {
                                $$renderer7.push(`<!---->Username`);
                              },
                              $$slots: { default: true }
                            });
                            $$renderer6.push("<!--]-->");
                          } else {
                            $$renderer6.push("<!--[!-->");
                            $$renderer6.push("<!--]-->");
                          }
                          $$renderer6.push(` `);
                          if (Table_head) {
                            $$renderer6.push("<!--[-->");
                            Table_head($$renderer6, {
                              class: "text-[13px] font-medium",
                              children: ($$renderer7) => {
                                $$renderer7.push(`<!---->Email`);
                              },
                              $$slots: { default: true }
                            });
                            $$renderer6.push("<!--]-->");
                          } else {
                            $$renderer6.push("<!--[!-->");
                            $$renderer6.push("<!--]-->");
                          }
                          $$renderer6.push(` `);
                          if (Table_head) {
                            $$renderer6.push("<!--[-->");
                            Table_head($$renderer6, {
                              class: "text-[13px] font-medium",
                              children: ($$renderer7) => {
                                $$renderer7.push(`<!---->Role`);
                              },
                              $$slots: { default: true }
                            });
                            $$renderer6.push("<!--]-->");
                          } else {
                            $$renderer6.push("<!--[!-->");
                            $$renderer6.push("<!--]-->");
                          }
                          $$renderer6.push(` `);
                          if (Table_head) {
                            $$renderer6.push("<!--[-->");
                            Table_head($$renderer6, {
                              class: "text-[13px] font-medium",
                              children: ($$renderer7) => {
                                $$renderer7.push(`<!---->Status`);
                              },
                              $$slots: { default: true }
                            });
                            $$renderer6.push("<!--]-->");
                          } else {
                            $$renderer6.push("<!--[!-->");
                            $$renderer6.push("<!--]-->");
                          }
                          $$renderer6.push(` `);
                          if (Table_head) {
                            $$renderer6.push("<!--[-->");
                            Table_head($$renderer6, {
                              class: "text-[13px] font-medium",
                              style: "font-variant-numeric: tabular-nums;",
                              children: ($$renderer7) => {
                                $$renderer7.push(`<!---->Teams`);
                              },
                              $$slots: { default: true }
                            });
                            $$renderer6.push("<!--]-->");
                          } else {
                            $$renderer6.push("<!--[!-->");
                            $$renderer6.push("<!--]-->");
                          }
                          $$renderer6.push(` `);
                          if (Table_head) {
                            $$renderer6.push("<!--[-->");
                            Table_head($$renderer6, {
                              class: "text-[13px] font-medium",
                              style: "font-variant-numeric: tabular-nums;",
                              children: ($$renderer7) => {
                                $$renderer7.push(`<!---->Created`);
                              },
                              $$slots: { default: true }
                            });
                            $$renderer6.push("<!--]-->");
                          } else {
                            $$renderer6.push("<!--[!-->");
                            $$renderer6.push("<!--]-->");
                          }
                          $$renderer6.push(` `);
                          if (Table_head) {
                            $$renderer6.push("<!--[-->");
                            Table_head($$renderer6, {
                              children: ($$renderer7) => {
                                $$renderer7.push(`<span class="sr-only">Actions</span>`);
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
                  },
                  $$slots: { default: true }
                });
                $$renderer4.push("<!--]-->");
              } else {
                $$renderer4.push("<!--[!-->");
                $$renderer4.push("<!--]-->");
              }
              $$renderer4.push(` `);
              if (Table_body) {
                $$renderer4.push("<!--[-->");
                Table_body($$renderer4, {
                  children: ($$renderer5) => {
                    $$renderer5.push(`<!--[-->`);
                    const each_array = ensure_array_like(users());
                    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
                      let u = each_array[$$index];
                      const isSelf = u.id === currentUserId();
                      if (Table_row) {
                        $$renderer5.push("<!--[-->");
                        Table_row($$renderer5, {
                          class: "hover:bg-muted/50",
                          children: ($$renderer6) => {
                            if (Table_cell) {
                              $$renderer6.push("<!--[-->");
                              Table_cell($$renderer6, {
                                children: ($$renderer7) => {
                                  $$renderer7.push(`<a${attr("href", `/admin/users/${stringify(u.id)}`)} class="text-foreground hover:text-primary text-sm font-medium underline-offset-4 hover:underline">${escape_html(u.username)}</a>`);
                                },
                                $$slots: { default: true }
                              });
                              $$renderer6.push("<!--]-->");
                            } else {
                              $$renderer6.push("<!--[!-->");
                              $$renderer6.push("<!--]-->");
                            }
                            $$renderer6.push(` `);
                            if (Table_cell) {
                              $$renderer6.push("<!--[-->");
                              Table_cell($$renderer6, {
                                class: "text-muted-foreground text-sm",
                                children: ($$renderer7) => {
                                  $$renderer7.push(`<!---->${escape_html(u.email)}`);
                                },
                                $$slots: { default: true }
                              });
                              $$renderer6.push("<!--]-->");
                            } else {
                              $$renderer6.push("<!--[!-->");
                              $$renderer6.push("<!--]-->");
                            }
                            $$renderer6.push(` `);
                            if (Table_cell) {
                              $$renderer6.push("<!--[-->");
                              Table_cell($$renderer6, {
                                children: ($$renderer7) => {
                                  if (u.is_admin) {
                                    $$renderer7.push("<!--[0-->");
                                    Badge($$renderer7, {
                                      variant: "default",
                                      children: ($$renderer8) => {
                                        $$renderer8.push(`<!---->Admin`);
                                      },
                                      $$slots: { default: true }
                                    });
                                  } else {
                                    $$renderer7.push("<!--[-1-->");
                                    Badge($$renderer7, {
                                      variant: "outline",
                                      children: ($$renderer8) => {
                                        $$renderer8.push(`<!---->User`);
                                      },
                                      $$slots: { default: true }
                                    });
                                  }
                                  $$renderer7.push(`<!--]-->`);
                                },
                                $$slots: { default: true }
                              });
                              $$renderer6.push("<!--]-->");
                            } else {
                              $$renderer6.push("<!--[!-->");
                              $$renderer6.push("<!--]-->");
                            }
                            $$renderer6.push(` `);
                            if (Table_cell) {
                              $$renderer6.push("<!--[-->");
                              Table_cell($$renderer6, {
                                children: ($$renderer7) => {
                                  if (u.is_active) {
                                    $$renderer7.push("<!--[0-->");
                                    Badge($$renderer7, {
                                      variant: "outline",
                                      children: ($$renderer8) => {
                                        $$renderer8.push(`<!---->Active`);
                                      },
                                      $$slots: { default: true }
                                    });
                                  } else {
                                    $$renderer7.push("<!--[-1-->");
                                    Badge($$renderer7, {
                                      variant: "secondary",
                                      children: ($$renderer8) => {
                                        $$renderer8.push(`<!---->Disabled`);
                                      },
                                      $$slots: { default: true }
                                    });
                                  }
                                  $$renderer7.push(`<!--]-->`);
                                },
                                $$slots: { default: true }
                              });
                              $$renderer6.push("<!--]-->");
                            } else {
                              $$renderer6.push("<!--[!-->");
                              $$renderer6.push("<!--]-->");
                            }
                            $$renderer6.push(` `);
                            if (Table_cell) {
                              $$renderer6.push("<!--[-->");
                              Table_cell($$renderer6, {
                                class: "text-sm",
                                style: "font-variant-numeric: tabular-nums;",
                                children: ($$renderer7) => {
                                  $$renderer7.push(`<!---->${escape_html(nonPersonalTeamCount(u))}`);
                                },
                                $$slots: { default: true }
                              });
                              $$renderer6.push("<!--]-->");
                            } else {
                              $$renderer6.push("<!--[!-->");
                              $$renderer6.push("<!--]-->");
                            }
                            $$renderer6.push(` `);
                            if (Table_cell) {
                              $$renderer6.push("<!--[-->");
                              Table_cell($$renderer6, {
                                class: "text-muted-foreground text-sm",
                                style: "font-variant-numeric: tabular-nums;",
                                children: ($$renderer7) => {
                                  $$renderer7.push(`<!---->${escape_html(relativeTime(u.created_at))}`);
                                },
                                $$slots: { default: true }
                              });
                              $$renderer6.push("<!--]-->");
                            } else {
                              $$renderer6.push("<!--[!-->");
                              $$renderer6.push("<!--]-->");
                            }
                            $$renderer6.push(` `);
                            if (Table_cell) {
                              $$renderer6.push("<!--[-->");
                              Table_cell($$renderer6, {
                                class: "text-right",
                                children: ($$renderer7) => {
                                  if (Dropdown_menu) {
                                    $$renderer7.push("<!--[-->");
                                    Dropdown_menu($$renderer7, {
                                      children: ($$renderer8) => {
                                        {
                                          let child = function($$renderer9, { props }) {
                                            $$renderer9.push(`<button${attributes({
                                              ...props,
                                              class: "text-muted-foreground hover:text-foreground hover:bg-muted inline-flex size-8 items-center justify-center rounded-md transition-colors",
                                              "aria-label": `Actions for ${u.username}`
                                            })}>`);
                                            Ellipsis($$renderer9, { class: "size-4", "aria-hidden": "true" });
                                            $$renderer9.push(`<!----></button>`);
                                          };
                                          if (Dropdown_menu_trigger) {
                                            $$renderer8.push("<!--[-->");
                                            Dropdown_menu_trigger($$renderer8, { child, $$slots: { child: true } });
                                            $$renderer8.push("<!--]-->");
                                          } else {
                                            $$renderer8.push("<!--[!-->");
                                            $$renderer8.push("<!--]-->");
                                          }
                                        }
                                        $$renderer8.push(` `);
                                        if (Dropdown_menu_content) {
                                          $$renderer8.push("<!--[-->");
                                          Dropdown_menu_content($$renderer8, {
                                            align: "end",
                                            children: ($$renderer9) => {
                                              if (Dropdown_menu_item) {
                                                $$renderer9.push("<!--[-->");
                                                Dropdown_menu_item($$renderer9, {
                                                  onSelect: () => goto(`/admin/users/${u.id}`),
                                                  children: ($$renderer10) => {
                                                    $$renderer10.push(`<!---->Edit`);
                                                  },
                                                  $$slots: { default: true }
                                                });
                                                $$renderer9.push("<!--]-->");
                                              } else {
                                                $$renderer9.push("<!--[!-->");
                                                $$renderer9.push("<!--]-->");
                                              }
                                              $$renderer9.push(` `);
                                              if (!isSelf) {
                                                $$renderer9.push("<!--[0-->");
                                                if (u.is_active) {
                                                  $$renderer9.push("<!--[0-->");
                                                  if (Dropdown_menu_item) {
                                                    $$renderer9.push("<!--[-->");
                                                    Dropdown_menu_item($$renderer9, {
                                                      onSelect: () => openDisable(u),
                                                      children: ($$renderer10) => {
                                                        $$renderer10.push(`<!---->Disable`);
                                                      },
                                                      $$slots: { default: true }
                                                    });
                                                    $$renderer9.push("<!--]-->");
                                                  } else {
                                                    $$renderer9.push("<!--[!-->");
                                                    $$renderer9.push("<!--]-->");
                                                  }
                                                } else {
                                                  $$renderer9.push("<!--[-1-->");
                                                  if (Dropdown_menu_item) {
                                                    $$renderer9.push("<!--[-->");
                                                    Dropdown_menu_item($$renderer9, {
                                                      onSelect: () => handleEnable(u),
                                                      children: ($$renderer10) => {
                                                        $$renderer10.push(`<!---->Enable`);
                                                      },
                                                      $$slots: { default: true }
                                                    });
                                                    $$renderer9.push("<!--]-->");
                                                  } else {
                                                    $$renderer9.push("<!--[!-->");
                                                    $$renderer9.push("<!--]-->");
                                                  }
                                                }
                                                $$renderer9.push(`<!--]--> `);
                                                if (Dropdown_menu_separator) {
                                                  $$renderer9.push("<!--[-->");
                                                  Dropdown_menu_separator($$renderer9, {});
                                                  $$renderer9.push("<!--]-->");
                                                } else {
                                                  $$renderer9.push("<!--[!-->");
                                                  $$renderer9.push("<!--]-->");
                                                }
                                                $$renderer9.push(` `);
                                                if (Dropdown_menu_item) {
                                                  $$renderer9.push("<!--[-->");
                                                  Dropdown_menu_item($$renderer9, {
                                                    class: "text-destructive focus:text-destructive",
                                                    onSelect: () => openDelete(u),
                                                    children: ($$renderer10) => {
                                                      $$renderer10.push(`<!---->Delete`);
                                                    },
                                                    $$slots: { default: true }
                                                  });
                                                  $$renderer9.push("<!--]-->");
                                                } else {
                                                  $$renderer9.push("<!--[!-->");
                                                  $$renderer9.push("<!--]-->");
                                                }
                                              } else {
                                                $$renderer9.push("<!--[-1-->");
                                              }
                                              $$renderer9.push(`<!--]-->`);
                                            },
                                            $$slots: { default: true }
                                          });
                                          $$renderer8.push("<!--]-->");
                                        } else {
                                          $$renderer8.push("<!--[!-->");
                                          $$renderer8.push("<!--]-->");
                                        }
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
        $$renderer3.push(`</div>`);
      }
      $$renderer3.push(`<!--]--></div> `);
      if (disableTarget) {
        $$renderer3.push("<!--[0-->");
        ConfirmByNameDialog($$renderer3, {
          heading: `Disable ${disableTarget.username}?`,
          body: `${disableTarget.username} won't be able to sign in. Active sessions are revoked immediately. You can re-enable them later.`,
          targetName: disableTarget.username,
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
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--> `);
      if (deleteTarget) {
        $$renderer3.push("<!--[0-->");
        ConfirmByNameDialog($$renderer3, {
          heading: `Delete ${deleteTarget.username}?`,
          body: `Their account is removed permanently. Their team memberships are dropped. VMs they created stay with the team. This can't be undone.`,
          targetName: deleteTarget.username,
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
//# sourceMappingURL=_page.svelte-B9vKKbxZ.js.map
