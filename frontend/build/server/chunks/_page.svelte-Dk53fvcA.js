import { aB as head, d as derived, j as ensure_array_like, k as attr, c as escape_html } from './renderer-mZFfBJIU.js';
import { i as invalidateAll } from './client-vbU_CWqW.js';
import { T as Table, a as Table_header, b as Table_row, c as Table_head, d as Table_body, e as Table_cell } from './table-row-CyEWIwNm.js';
import 'clsx';
import { B as Button } from './button-CE_GHowG.js';
import { f as formatClock } from './format-Cqeoh9TR.js';
import { C as Calendar_clock, a as Circle_check } from './circle-check-BPthTFpF.js';
import { C as Circle_alert } from './circle-alert-Nd3JNVzs.js';
import '@sveltejs/kit/internal';
import './root-C3vAr9go.js';
import './index-B0sFcY-v.js';
import '@sveltejs/kit/internal/server';
import './state.svelte-DtuilCOR.js';
import 'tailwind-merge';
import './Icon-oF8immWv.js';

function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    const schedules = derived(() => data.schedules);
    const loadError = derived(() => data.loadError);
    const isEmpty = derived(() => !loadError() && schedules().length === 0);
    function resourceHref(clusterId, vmid) {
      return `/inventory/${clusterId}/${vmid}#backups`;
    }
    function freqLabel(f) {
      return f ? f.charAt(0).toUpperCase() + f.slice(1) : "—";
    }
    function nextRunLabel(frequency) {
      if (frequency === "daily") return "Within 24h";
      if (frequency === "weekly") return "Within 7d";
      return "—";
    }
    head("1sak9bk", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Backups — Proxmox GUI</title>`);
      });
    });
    $$renderer2.push(`<header class="mb-6"><h1 class="text-[28px] font-semibold tracking-tight">Backups</h1> <p class="text-muted-foreground text-sm mt-1">Scheduled backup jobs and retention across your VMs and LXCs.</p></header> `);
    if (loadError()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="rounded-md border border-dashed border-border bg-muted/30 p-10 text-center"><p class="text-[14px] font-medium mb-3">Couldn't load scheduled backups.</p> `);
      Button($$renderer2, {
        variant: "outline",
        onclick: () => invalidateAll(),
        children: ($$renderer3) => {
          $$renderer3.push(`<!---->Try again`);
        },
        $$slots: { default: true }
      });
      $$renderer2.push(`<!----></div>`);
    } else if (isEmpty()) {
      $$renderer2.push("<!--[1-->");
      $$renderer2.push(`<div class="mt-16 flex flex-col items-center gap-2 text-center">`);
      Calendar_clock($$renderer2, { class: "size-6 text-muted-foreground", "aria-hidden": "true" });
      $$renderer2.push(`<!----> <p class="text-[14px] font-medium">No scheduled backups</p> <p class="text-[14px] text-muted-foreground">Open a VM's Backups tab to set up a schedule.</p></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
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
                            children: ($$renderer6) => {
                              $$renderer6.push(`<!---->Resource`);
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
                            children: ($$renderer6) => {
                              $$renderer6.push(`<!---->Cluster`);
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
                            children: ($$renderer6) => {
                              $$renderer6.push(`<!---->Frequency`);
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
                            children: ($$renderer6) => {
                              $$renderer6.push(`<!---->Keep-last`);
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
                            children: ($$renderer6) => {
                              $$renderer6.push(`<!---->Last run`);
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
                            children: ($$renderer6) => {
                              $$renderer6.push(`<!---->Next run`);
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
                  const each_array = ensure_array_like(schedules());
                  for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
                    let row = each_array[$$index];
                    if (Table_row) {
                      $$renderer4.push("<!--[-->");
                      Table_row($$renderer4, {
                        children: ($$renderer5) => {
                          if (Table_cell) {
                            $$renderer5.push("<!--[-->");
                            Table_cell($$renderer5, {
                              children: ($$renderer6) => {
                                $$renderer6.push(`<a${attr("href", resourceHref(row.cluster_id, row.vmid))} class="text-primary hover:underline font-mono text-[13px]">${escape_html(row.is_lxc ? "CT" : "VM")} ${escape_html(row.vmid)}</a>`);
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
                                $$renderer6.push(`<!---->${escape_html(row.cluster_id)}`);
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
                                $$renderer6.push(`<!---->${escape_html(freqLabel(row.frequency))}`);
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
                              style: "font-variant-numeric: tabular-nums;",
                              children: ($$renderer6) => {
                                $$renderer6.push(`<!---->${escape_html(row.keep_last)}`);
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
                                if (row.last_run_at) {
                                  $$renderer6.push("<!--[0-->");
                                  $$renderer6.push(`<span class="inline-flex items-center gap-1">`);
                                  if (row.last_run_state === "fail") {
                                    $$renderer6.push("<!--[0-->");
                                    Circle_alert($$renderer6, { class: "size-3.5 text-destructive", "aria-hidden": "true" });
                                    $$renderer6.push(`<!----> <span class="text-[14px]">Failed</span>`);
                                  } else {
                                    $$renderer6.push("<!--[-1-->");
                                    Circle_check($$renderer6, { class: "size-3.5 text-success", "aria-hidden": "true" });
                                    $$renderer6.push(`<!----> <span class="text-[14px]">OK</span>`);
                                  }
                                  $$renderer6.push(`<!--]--> <span class="text-[13px] text-muted-foreground">${escape_html(formatClock(Math.floor(new Date(row.last_run_at).getTime() / 1e3)))}</span></span>`);
                                } else {
                                  $$renderer6.push("<!--[-1-->");
                                  $$renderer6.push(`<span class="text-[13px] text-muted-foreground">Never run</span>`);
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
                              class: "text-[13px] text-muted-foreground",
                              children: ($$renderer6) => {
                                $$renderer6.push(`<!---->${escape_html(nextRunLabel(row.frequency))}`);
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
    }
    $$renderer2.push(`<!--]-->`);
  });
}

export { _page as default };
//# sourceMappingURL=_page.svelte-Dk53fvcA.js.map
