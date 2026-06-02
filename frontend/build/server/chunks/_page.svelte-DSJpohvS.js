import { aB as head, d as derived, h as ensure_array_like, j as attr, l as stringify, m as escape_html, p as attributes } from './renderer--hvGDOOw.js';
import { g as goto, i as invalidateAll } from './client-bCVElyx1.js';
import { B as Button } from './button-ntOmtgiY.js';
import { B as Badge } from './badge-yr7sVO8Y.js';
import { T as Table, a as Table_header, b as Table_row, c as Table_head, d as Table_body, e as Table_cell } from './table-row-Bxxa4BOD.js';
import 'clsx';
import { D as Dropdown_menu, a as Dropdown_menu_trigger, b as Dropdown_menu_content, c as Dropdown_menu_item } from './dropdown-menu-trigger-MgfQwyFx.js';
import { D as Dropdown_menu_separator } from './dropdown-menu-separator-BxXcq_P_.js';
import { C as ConfirmByNameDialog } from './ConfirmByNameDialog-97SqJ_Il.js';
import { C as ClusterStatusPill } from './ClusterStatusPill-CFkkKC5-.js';
import { a as api, A as ApiError } from './client2-WJrlUD72.js';
import { P as Plus } from './plus-CQ7kMicV.js';
import { E as Ellipsis } from './ellipsis-Cw3YODzl.js';
import { a as toast } from './toast-state.svelte-Ckj_X06S.js';
import '@sveltejs/kit/internal';
import './root-DHp9To-z.js';
import './index-B54IuS4T.js';
import '@sveltejs/kit/internal/server';
import './state.svelte-BYtSRxhp.js';
import 'tailwind-merge';
import './scroll-lock-CGoEUeDJ.js';
import './is-HJ-O5XFN.js';
import './input-Buwd_f-b.js';
import './noop-n4I-x7yK.js';
import './popper-layer-force-mount-DL2Z2See.js';
import './alert-dialog-description-CQsrn2hX.js';
import './dialog-description-BW9UDPMx.js';
import './label-7gbcsuPJ.js';
import './shield-alert-C6UufUOa.js';
import './Icon-B86w_tDb.js';
import './clock-D1v6CFWO.js';

function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    let localOverride = null;
    const clusters = derived(() => localOverride ?? data.clusters);
    let rowStatus = {};
    let rowLabel = {};
    let testingId = null;
    async function refreshList() {
      try {
        const fresh = await api.clusters.list();
        localOverride = fresh;
      } catch {
        toast.error("Couldn't refresh clusters.");
      }
    }
    async function handleTest(c) {
      testingId = c.id;
      try {
        const res = await api.clusters.testExisting({ id: c.id });
        if (res.ok) {
          rowStatus = { ...rowStatus, [c.id]: "ok" };
          rowLabel = {
            ...rowLabel,
            [c.id]: res.version ? `Connection OK (${res.version})` : "Connection OK"
          };
          toast.success(`${c.name} is reachable.`);
        } else {
          rowStatus = { ...rowStatus, [c.id]: "failed" };
          rowLabel = { ...rowLabel, [c.id]: void 0 };
          toast.error(`${c.name}: ${res.error ?? "Couldn't connect."}`);
        }
      } catch {
        rowStatus = { ...rowStatus, [c.id]: "failed" };
        rowLabel = { ...rowLabel, [c.id]: void 0 };
        toast.error("Couldn't reach that cluster.");
      } finally {
        testingId = null;
      }
    }
    let deleteOpen = false;
    let deleteTarget = null;
    function openDelete(c) {
      deleteTarget = c;
      deleteOpen = true;
    }
    async function handleDelete() {
      if (!deleteTarget) return;
      const target = deleteTarget;
      try {
        await api.clusters.del({ id: target.id });
        localOverride = clusters().filter((c) => c.id !== target.id);
        toast.success(`${target.name} was deleted.`);
        await invalidateAll();
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          const detail = String(err.body?.detail ?? "");
          toast.error(detail || "Couldn't delete: cluster has active team bindings.");
        } else {
          toast.error("Couldn't delete that cluster.");
        }
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
    function statusFor(c) {
      return rowStatus[c.id] ?? "untested";
    }
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      head("ch59g8", $$renderer3, ($$renderer4) => {
        $$renderer4.title(($$renderer5) => {
          $$renderer5.push(`<title>Clusters — Proxmox GUI</title>`);
        });
      });
      $$renderer3.push(`<div class="flex w-full flex-col gap-6"><header class="flex flex-row items-start justify-between gap-4"><div class="flex flex-col gap-2"><h1 class="text-[28px] font-semibold tracking-tight">Clusters</h1> <p class="text-muted-foreground text-sm">Proxmox VE clusters this installation can manage.</p></div> `);
      Button($$renderer3, {
        onclick: () => goto(),
        children: ($$renderer4) => {
          Plus($$renderer4, { class: "size-4", "aria-hidden": "true" });
          $$renderer4.push(`<!----> Register cluster`);
        },
        $$slots: { default: true }
      });
      $$renderer3.push(`<!----></header> `);
      if (data.loadError) {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<div class="border-border bg-muted/30 flex flex-col items-center gap-3 rounded-md border border-dashed px-6 py-10 text-center"><p class="text-sm font-medium">Couldn't load clusters.</p> `);
        Button($$renderer3, {
          variant: "outline",
          onclick: refreshList,
          children: ($$renderer4) => {
            $$renderer4.push(`<!---->Try again`);
          },
          $$slots: { default: true }
        });
        $$renderer3.push(`<!----></div>`);
      } else if (clusters().length === 0) {
        $$renderer3.push("<!--[1-->");
        $$renderer3.push(`<div class="border-border bg-muted/30 flex flex-col items-center gap-3 rounded-md border border-dashed px-6 py-12 text-center"><p class="text-sm font-medium">No clusters registered</p> <p class="text-muted-foreground text-[13px]">Register a Proxmox cluster to get started.</p> `);
        Button($$renderer3, {
          onclick: () => goto(),
          children: ($$renderer4) => {
            Plus($$renderer4, { class: "size-4", "aria-hidden": "true" });
            $$renderer4.push(`<!----> Register cluster`);
          },
          $$slots: { default: true }
        });
        $$renderer3.push(`<!----></div>`);
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
                                $$renderer7.push(`<!---->Name`);
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
                                $$renderer7.push(`<!---->Host`);
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
                                $$renderer7.push(`<!---->Port`);
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
                              children: ($$renderer7) => {
                                $$renderer7.push(`<!---->TLS`);
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
                    const each_array = ensure_array_like(clusters());
                    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
                      let c = each_array[$$index];
                      if (Table_row) {
                        $$renderer5.push("<!--[-->");
                        Table_row($$renderer5, {
                          class: "hover:bg-muted/50",
                          children: ($$renderer6) => {
                            if (Table_cell) {
                              $$renderer6.push("<!--[-->");
                              Table_cell($$renderer6, {
                                children: ($$renderer7) => {
                                  $$renderer7.push(`<a${attr("href", `/admin/clusters/${stringify(c.id)}`)} class="text-foreground hover:text-primary text-sm font-medium underline-offset-4 hover:underline">${escape_html(c.name)}</a>`);
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
                                class: "text-muted-foreground font-mono text-[13px]",
                                children: ($$renderer7) => {
                                  $$renderer7.push(`<!---->${escape_html(c.host)}`);
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
                                  $$renderer7.push(`<!---->${escape_html(c.port)}`);
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
                                  ClusterStatusPill($$renderer7, { status: statusFor(c), label: rowLabel[c.id] });
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
                                  if (c.verify_ssl) {
                                    $$renderer7.push("<!--[0-->");
                                    Badge($$renderer7, {
                                      variant: "outline",
                                      children: ($$renderer8) => {
                                        $$renderer8.push(`<!---->Verified`);
                                      },
                                      $$slots: { default: true }
                                    });
                                  } else if (c.tls_fingerprint) {
                                    $$renderer7.push("<!--[1-->");
                                    Badge($$renderer7, {
                                      variant: "outline",
                                      children: ($$renderer8) => {
                                        $$renderer8.push(`<!---->Pinned`);
                                      },
                                      $$slots: { default: true }
                                    });
                                  } else {
                                    $$renderer7.push("<!--[-1-->");
                                    Badge($$renderer7, {
                                      variant: "secondary",
                                      children: ($$renderer8) => {
                                        $$renderer8.push(`<!---->Skipped`);
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
                                class: "text-muted-foreground text-sm",
                                style: "font-variant-numeric: tabular-nums;",
                                children: ($$renderer7) => {
                                  $$renderer7.push(`<!---->${escape_html(relativeTime(c.created_at))}`);
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
                                              "aria-label": `Actions for ${c.name}`
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
                                                  onSelect: () => goto(`/admin/clusters/${c.id}`),
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
                                              if (Dropdown_menu_item) {
                                                $$renderer9.push("<!--[-->");
                                                Dropdown_menu_item($$renderer9, {
                                                  onSelect: () => handleTest(c),
                                                  disabled: testingId === c.id,
                                                  children: ($$renderer10) => {
                                                    $$renderer10.push(`<!---->${escape_html(testingId === c.id ? "Testing..." : "Test connection")}`);
                                                  },
                                                  $$slots: { default: true }
                                                });
                                                $$renderer9.push("<!--]-->");
                                              } else {
                                                $$renderer9.push("<!--[!-->");
                                                $$renderer9.push("<!--]-->");
                                              }
                                              $$renderer9.push(` `);
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
                                                  onSelect: () => openDelete(c),
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
      if (deleteTarget) {
        $$renderer3.push("<!--[0-->");
        ConfirmByNameDialog($$renderer3, {
          heading: `Delete ${deleteTarget.name}?`,
          body: `This GUI will stop managing this cluster. The Proxmox cluster itself is not affected. Encrypted tokens stored here are destroyed.`,
          targetName: deleteTarget.name,
          confirmLabel: "Delete cluster",
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
//# sourceMappingURL=_page.svelte-DSJpohvS.js.map
