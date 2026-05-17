import { h as ensure_array_like, m as escape_html, d as derived, l as stringify, k as attr_class, q as clsx } from './renderer--hvGDOOw.js';
import { T as Table, a as Table_header, c as Table_body, b as Table_row, d as Table_head, e as Table_cell } from './table-row-BX73Ixoi.js';
import 'clsx';
import { C as Card } from './card-DccFReV7.js';
import { B as Badge } from './badge-Dz1XVeQx.js';
import { B as Button } from './button-BxOVow4s.js';

function AuditTable($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      rows,
      total,
      page,
      pageSize,
      onPageChange,
      error = null,
      loading = false
    } = $$props;
    const pages = derived(() => Math.max(1, Math.ceil(total / pageSize)));
    let expanded = {};
    function toggle(id) {
      expanded = { ...expanded, [id]: !expanded[id] };
    }
    function actionBadge(action) {
      if (action.startsWith("vm.create") || action.startsWith("team.create") || action.startsWith("user.create") || action.startsWith("cluster.create")) return "bg-success/10 border-success/30 text-success";
      if (action.startsWith("vm.delete") || action.startsWith("team.delete") || action.startsWith("user.delete") || action.startsWith("cluster.delete")) return "bg-destructive/10 border-destructive/30 text-destructive";
      if (action.startsWith("vm.power.")) return "bg-warning/10 border-warning/30 text-warning";
      if (action.startsWith("auth.")) return "bg-primary/10 border-primary/30 text-primary";
      return "bg-muted border-border text-foreground";
    }
    function tryParse(s) {
      if (!s) return null;
      try {
        return JSON.parse(s);
      } catch {
        return s;
      }
    }
    if (loading) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="space-y-2"><!--[-->`);
      const each_array = ensure_array_like(Array(5));
      for (let i = 0, $$length = each_array.length; i < $$length; i++) {
        each_array[i];
        $$renderer2.push(`<div class="h-11 bg-muted animate-pulse rounded"></div>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    } else if (error) {
      $$renderer2.push("<!--[1-->");
      $$renderer2.push(`<div class="border-border bg-muted/30 flex flex-col items-center gap-3 rounded-md border border-dashed px-6 py-10 text-center"><p class="text-sm font-medium">${escape_html(error)}</p></div>`);
    } else if (rows.length === 0) {
      $$renderer2.push("<!--[2-->");
      $$renderer2.push(`<div class="border-border bg-muted/30 rounded-md border border-dashed px-6 py-10 text-center"><p class="text-sm font-medium">No audit entries match the current filters.</p></div>`);
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
                              $$renderer6.push(`<!---->Time`);
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
                              $$renderer6.push(`<!---->Actor`);
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
                              $$renderer6.push(`<!---->Action`);
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
                              $$renderer6.push(`<!---->Target`);
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
                              $$renderer6.push(`<!---->Result`);
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
                              $$renderer6.push(`<!---->IP`);
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
                  const each_array_1 = ensure_array_like(rows);
                  for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
                    let r = each_array_1[$$index_1];
                    if (Table_row) {
                      $$renderer4.push("<!--[-->");
                      Table_row($$renderer4, {
                        class: "min-h-11 hover:bg-muted/50 cursor-pointer",
                        onclick: () => toggle(r.id),
                        "aria-expanded": !!expanded[r.id],
                        children: ($$renderer5) => {
                          if (Table_cell) {
                            $$renderer5.push("<!--[-->");
                            Table_cell($$renderer5, {
                              class: "font-mono text-[13px]",
                              style: "font-variant-numeric: tabular-nums;",
                              children: ($$renderer6) => {
                                $$renderer6.push(`<!---->${escape_html(r.occurred_at)}`);
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
                              class: "text-[14px]",
                              children: ($$renderer6) => {
                                $$renderer6.push(`<!---->${escape_html(r.actor_username ?? (r.actor_pat_prefix ? `pat:${r.actor_pat_prefix}` : "system"))}`);
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
                                Badge($$renderer6, {
                                  variant: "outline",
                                  class: actionBadge(r.action),
                                  children: ($$renderer7) => {
                                    $$renderer7.push(`<!---->${escape_html(r.action)}`);
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
                          $$renderer5.push(` `);
                          if (Table_cell) {
                            $$renderer5.push("<!--[-->");
                            Table_cell($$renderer5, {
                              class: "font-mono text-[13px] truncate max-w-[200px]",
                              title: `${stringify(r.target_type)}/${stringify(r.target_id ?? "-")}`,
                              children: ($$renderer6) => {
                                $$renderer6.push(`<!---->${escape_html(r.target_type)}/${escape_html(r.target_id ?? "-")}`);
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
                                $$renderer6.push(`<span${attr_class(clsx(r.result === "success" ? "text-success" : "text-destructive"))}>${escape_html(r.result)}</span>`);
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
                              class: "font-mono text-[13px] text-muted-foreground",
                              children: ($$renderer6) => {
                                $$renderer6.push(`<!---->${escape_html(r.source_ip ?? "-")}`);
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
                    if (expanded[r.id]) {
                      $$renderer4.push("<!--[0-->");
                      if (Table_row) {
                        $$renderer4.push("<!--[-->");
                        Table_row($$renderer4, {
                          class: "bg-muted/40 border-l-2 border-l-primary",
                          children: ($$renderer5) => {
                            if (Table_cell) {
                              $$renderer5.push("<!--[-->");
                              Table_cell($$renderer5, {
                                colspan: 6,
                                children: ($$renderer6) => {
                                  $$renderer6.push(`<div class="grid grid-cols-2 gap-4 p-4">`);
                                  if (Card) {
                                    $$renderer6.push("<!--[-->");
                                    Card($$renderer6, {
                                      class: "p-4",
                                      children: ($$renderer7) => {
                                        $$renderer7.push(`<h4 class="text-[13px] font-medium mb-2">Before</h4> <pre class="font-mono text-[13px] whitespace-pre-wrap text-foreground">${escape_html(JSON.stringify(tryParse(r.payload_before), null, 2))}</pre>`);
                                      },
                                      $$slots: { default: true }
                                    });
                                    $$renderer6.push("<!--]-->");
                                  } else {
                                    $$renderer6.push("<!--[!-->");
                                    $$renderer6.push("<!--]-->");
                                  }
                                  $$renderer6.push(` `);
                                  if (Card) {
                                    $$renderer6.push("<!--[-->");
                                    Card($$renderer6, {
                                      class: "p-4",
                                      children: ($$renderer7) => {
                                        $$renderer7.push(`<h4 class="text-[13px] font-medium mb-2">After</h4> <pre class="font-mono text-[13px] whitespace-pre-wrap text-foreground">${escape_html(JSON.stringify(tryParse(r.payload_after), null, 2))}</pre>`);
                                      },
                                      $$slots: { default: true }
                                    });
                                    $$renderer6.push("<!--]-->");
                                  } else {
                                    $$renderer6.push("<!--[!-->");
                                    $$renderer6.push("<!--]-->");
                                  }
                                  $$renderer6.push(`</div> `);
                                  if (r.error) {
                                    $$renderer6.push("<!--[0-->");
                                    $$renderer6.push(`<div class="p-4 border-t border-border text-[13px] text-destructive font-mono">Error: ${escape_html(r.error)}</div>`);
                                  } else {
                                    $$renderer6.push("<!--[-1-->");
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
                    } else {
                      $$renderer4.push("<!--[-1-->");
                    }
                    $$renderer4.push(`<!--]-->`);
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
      $$renderer2.push(`</div> <div class="flex items-center justify-between mt-3 text-[13px] text-muted-foreground"><span>Page ${escape_html(page)} of ${escape_html(pages())} (${escape_html(total)} total)</span> <div class="flex gap-2">`);
      Button($$renderer2, {
        variant: "outline",
        size: "sm",
        disabled: page <= 1,
        onclick: () => onPageChange?.(page - 1),
        children: ($$renderer3) => {
          $$renderer3.push(`<!---->Prev`);
        },
        $$slots: { default: true }
      });
      $$renderer2.push(`<!----> `);
      Button($$renderer2, {
        variant: "outline",
        size: "sm",
        disabled: page >= pages(),
        onclick: () => onPageChange?.(page + 1),
        children: ($$renderer3) => {
          $$renderer3.push(`<!---->Next`);
        },
        $$slots: { default: true }
      });
      $$renderer2.push(`<!----></div></div>`);
    }
    $$renderer2.push(`<!--]-->`);
  });
}

export { AuditTable as A };
//# sourceMappingURL=AuditTable-BiaQgtW8.js.map
