import { aB as head, d as derived, h as ensure_array_like, j as attr, l as stringify, m as escape_html } from './renderer--hvGDOOw.js';
import { g as goto, i as invalidateAll } from './client-bCVElyx1.js';
import { B as Button } from './button-BxOVow4s.js';
import { B as Badge } from './badge-Dz1XVeQx.js';
import { T as Table, a as Table_header, b as Table_row, d as Table_head, c as Table_body, e as Table_cell } from './table-row-BX73Ixoi.js';
import 'clsx';
import { P as Plus } from './plus-C6mVks8w.js';
import '@sveltejs/kit/internal';
import './root-DHp9To-z.js';
import './index-B54IuS4T.js';
import '@sveltejs/kit/internal/server';
import './state.svelte-BYtSRxhp.js';
import 'tailwind-merge';

function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    const teams = derived(() => data.teams);
    function relativeTime(iso) {
      const then = new Date(iso).getTime();
      const diff = Math.max(0, Date.now() - then);
      const minutes = Math.floor(diff / 6e4);
      if (minutes < 1) return "just now";
      if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
      const days = Math.floor(hours / 24);
      if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
      const months = Math.floor(days / 30);
      if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
      return `${Math.floor(months / 12)} year${Math.floor(months / 12) === 1 ? "" : "s"} ago`;
    }
    head("x3r8st", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Teams — Proxmox GUI</title>`);
      });
    });
    $$renderer2.push(`<div class="flex w-full flex-col gap-6"><header class="flex flex-row items-start justify-between gap-4"><div class="flex flex-col gap-2"><h1 class="text-[28px] font-semibold tracking-tight">Teams</h1> <p class="text-muted-foreground text-sm">Shared teams group users and own a Proxmox pool, quota and token on every cluster.</p></div> `);
    Button($$renderer2, {
      onclick: () => goto(),
      children: ($$renderer3) => {
        Plus($$renderer3, { class: "size-4", "aria-hidden": "true" });
        $$renderer3.push(`<!----> New team`);
      },
      $$slots: { default: true }
    });
    $$renderer2.push(`<!----></header> `);
    if (data.loadError) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="border-border bg-muted/30 flex flex-col items-center gap-3 rounded-md border border-dashed px-6 py-10 text-center"><p class="text-sm font-medium">Couldn't load teams. Try again.</p> `);
      Button($$renderer2, {
        variant: "outline",
        onclick: () => invalidateAll(),
        children: ($$renderer3) => {
          $$renderer3.push(`<!---->Try again`);
        },
        $$slots: { default: true }
      });
      $$renderer2.push(`<!----></div>`);
    } else if (teams().length === 0) {
      $$renderer2.push("<!--[1-->");
      $$renderer2.push(`<div class="border-border bg-muted/30 flex flex-col items-center gap-2 rounded-md border border-dashed px-6 py-10 text-center"><p class="text-sm font-medium">No teams yet</p> <p class="text-muted-foreground text-[13px]">Click 'New team' to create the first one.</p></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="rounded-md border border-border">`);
      if (Table) {
        $$renderer2.push("<!--[-->");
        Table($$renderer2, {
          children: ($$renderer3) => {
            if (Table_header) {
              $$renderer3.push("<!--[-->");
              Table_header($$renderer3, {
                children: ($$renderer4) => {
                  if (Table_row) {
                    $$renderer4.push("<!--[-->");
                    Table_row($$renderer4, {
                      children: ($$renderer5) => {
                        if (Table_head) {
                          $$renderer5.push("<!--[-->");
                          Table_head($$renderer5, {
                            class: "text-[13px] font-medium",
                            children: ($$renderer6) => {
                              $$renderer6.push(`<!---->Name`);
                            },
                            $$slots: { default: true }
                          });
                          $$renderer5.push("<!--]-->");
                        } else {
                          $$renderer5.push("<!--[!-->");
                          $$renderer5.push("<!--]-->");
                        }
                        $$renderer5.push(` `);
                        if (Table_head) {
                          $$renderer5.push("<!--[-->");
                          Table_head($$renderer5, {
                            class: "text-[13px] font-medium",
                            style: "font-variant-numeric: tabular-nums;",
                            children: ($$renderer6) => {
                              $$renderer6.push(`<!---->Members`);
                            },
                            $$slots: { default: true }
                          });
                          $$renderer5.push("<!--]-->");
                        } else {
                          $$renderer5.push("<!--[!-->");
                          $$renderer5.push("<!--]-->");
                        }
                        $$renderer5.push(` `);
                        if (Table_head) {
                          $$renderer5.push("<!--[-->");
                          Table_head($$renderer5, {
                            class: "text-[13px] font-medium",
                            children: ($$renderer6) => {
                              $$renderer6.push(`<!---->Status`);
                            },
                            $$slots: { default: true }
                          });
                          $$renderer5.push("<!--]-->");
                        } else {
                          $$renderer5.push("<!--[!-->");
                          $$renderer5.push("<!--]-->");
                        }
                        $$renderer5.push(` `);
                        if (Table_head) {
                          $$renderer5.push("<!--[-->");
                          Table_head($$renderer5, {
                            class: "text-[13px] font-medium",
                            style: "font-variant-numeric: tabular-nums;",
                            children: ($$renderer6) => {
                              $$renderer6.push(`<!---->Created`);
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
            $$renderer3.push(` `);
            if (Table_body) {
              $$renderer3.push("<!--[-->");
              Table_body($$renderer3, {
                children: ($$renderer4) => {
                  $$renderer4.push(`<!--[-->`);
                  const each_array = ensure_array_like(teams());
                  for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
                    let t = each_array[$$index];
                    if (Table_row) {
                      $$renderer4.push("<!--[-->");
                      Table_row($$renderer4, {
                        class: "hover:bg-muted/50",
                        children: ($$renderer5) => {
                          if (Table_cell) {
                            $$renderer5.push("<!--[-->");
                            Table_cell($$renderer5, {
                              children: ($$renderer6) => {
                                $$renderer6.push(`<div class="flex items-center gap-2"><a${attr("href", `/admin/teams/${stringify(t.id)}`)} class="text-foreground hover:text-primary text-sm font-medium underline-offset-4 hover:underline">${escape_html(t.name)}</a> `);
                                if (t.personal) {
                                  $$renderer6.push("<!--[0-->");
                                  Badge($$renderer6, {
                                    variant: "secondary",
                                    children: ($$renderer7) => {
                                      $$renderer7.push(`<!---->Personal`);
                                    },
                                    $$slots: { default: true }
                                  });
                                } else {
                                  $$renderer6.push("<!--[-1-->");
                                }
                                $$renderer6.push(`<!--]--></div>`);
                              },
                              $$slots: { default: true }
                            });
                            $$renderer5.push("<!--]-->");
                          } else {
                            $$renderer5.push("<!--[!-->");
                            $$renderer5.push("<!--]-->");
                          }
                          $$renderer5.push(` `);
                          if (Table_cell) {
                            $$renderer5.push("<!--[-->");
                            Table_cell($$renderer5, {
                              class: "text-sm",
                              style: "font-variant-numeric: tabular-nums;",
                              children: ($$renderer6) => {
                                $$renderer6.push(`<!---->${escape_html(t.member_count)}`);
                              },
                              $$slots: { default: true }
                            });
                            $$renderer5.push("<!--]-->");
                          } else {
                            $$renderer5.push("<!--[!-->");
                            $$renderer5.push("<!--]-->");
                          }
                          $$renderer5.push(` `);
                          if (Table_cell) {
                            $$renderer5.push("<!--[-->");
                            Table_cell($$renderer5, {
                              children: ($$renderer6) => {
                                if (t.is_active) {
                                  $$renderer6.push("<!--[0-->");
                                  Badge($$renderer6, {
                                    variant: "outline",
                                    children: ($$renderer7) => {
                                      $$renderer7.push(`<!---->Active`);
                                    },
                                    $$slots: { default: true }
                                  });
                                } else {
                                  $$renderer6.push("<!--[-1-->");
                                  Badge($$renderer6, {
                                    variant: "secondary",
                                    children: ($$renderer7) => {
                                      $$renderer7.push(`<!---->Disabled`);
                                    },
                                    $$slots: { default: true }
                                  });
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
                          $$renderer5.push(` `);
                          if (Table_cell) {
                            $$renderer5.push("<!--[-->");
                            Table_cell($$renderer5, {
                              class: "text-muted-foreground text-sm",
                              style: "font-variant-numeric: tabular-nums;",
                              children: ($$renderer6) => {
                                $$renderer6.push(`<!---->${escape_html(relativeTime(t.created_at))}`);
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
                  }
                  $$renderer4.push(`<!--]-->`);
                },
                $$slots: { default: true }
              });
              $$renderer3.push("<!--]-->");
            } else {
              $$renderer3.push("<!--[!-->");
              $$renderer3.push("<!--]-->");
            }
          },
          $$slots: { default: true }
        });
        $$renderer2.push("<!--]-->");
      } else {
        $$renderer2.push("<!--[!-->");
        $$renderer2.push("<!--]-->");
      }
      $$renderer2.push(`</div>`);
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}

export { _page as default };
//# sourceMappingURL=_page.svelte-DfVIyipi.js.map
