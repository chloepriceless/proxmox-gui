import { j as ensure_array_like, c as escape_html, d as derived, o as spread_props, f as store_get, p as attributes, n as unsubscribe_stores } from './renderer-mZFfBJIU.js';
import { g as goto } from './client-vbU_CWqW.js';
import { p as page } from './stores-ByWcCi85.js';
import { I as Input } from './input-Be3KOSVg.js';
import { B as Button } from './button-CE_GHowG.js';
import { D as Dropdown_menu, a as Dropdown_menu_trigger, b as Dropdown_menu_content, c as Dropdown_menu_item } from './dropdown-menu-trigger-CNd_0STl.js';
import 'clsx';
import { P as Popover, a as Popover_trigger, b as Popover_content } from './popover-trigger-CW5_3VeS.js';
import { S as Switch } from './switch-CPUtptdH.js';
import { L as Label } from './label-Cf-Bm-qJ.js';
import { F as FilterChip } from './FilterChip-CwqH4Qrr.js';
import { A as AuditTable } from './AuditTable-5GaKFkKs.js';
import { T as Tooltip_provider, a as Tooltip, b as Tooltip_trigger, c as Tooltip_content } from './tooltip-provider-C1AFzMmv.js';
import { ApiError } from './api-By_nInf4.js';
import { a as api } from './client2-FWmWn_B2.js';
import { D as Download } from './download-D-wLopDS.js';
import { a as toast } from './toast-state.svelte-Bp1lssrC.js';
import '@sveltejs/kit/internal';
import './root-C3vAr9go.js';
import './index-B0sFcY-v.js';
import '@sveltejs/kit/internal/server';
import './state.svelte-DtuilCOR.js';
import 'tailwind-merge';
import './scroll-lock-CmFP2s08.js';
import './is-DiTqhZmY.js';
import './noop-n4I-x7yK.js';
import './popper-layer-force-mount-NeUEE3xR.js';
import './hidden-input-Q3ZT26w4.js';
import './sr-only-styles-lCW8LjNz.js';
import './Icon-oF8immWv.js';
import './x-DRD3hFMZ.js';
import './table-row-CyEWIwNm.js';
import './card-xlHxCeq2.js';
import './badge-CwoKb4lT.js';

function CsvExportButton($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { total, filters } = $$props;
    const HARD_LIMIT = 5e4;
    let exporting = false;
    const disabled = derived(() => total > HARD_LIMIT || exporting);
    async function doExport() {
      if (disabled()) return;
      exporting = true;
      try {
        const blob = await api.audit.exportCsv({ filters });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const date = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
        a.download = `audit-${date}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast.success(`Exported ${total} audit entries.`);
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) {
          toast.error("Too many rows; refine your filter.");
        } else {
          toast.error("Export failed. Try again.");
        }
      } finally {
        exporting = false;
      }
    }
    if (total > HARD_LIMIT) {
      $$renderer2.push("<!--[0-->");
      if (Tooltip_provider) {
        $$renderer2.push("<!--[-->");
        Tooltip_provider($$renderer2, {
          children: ($$renderer3) => {
            if (Tooltip) {
              $$renderer3.push("<!--[-->");
              Tooltip($$renderer3, {
                children: ($$renderer4) => {
                  {
                    let child = function($$renderer5, { props }) {
                      $$renderer5.push(`<span${attributes({ ...props })}>`);
                      Button($$renderer5, {
                        variant: "outline",
                        size: "sm",
                        disabled: true,
                        children: ($$renderer6) => {
                          Download($$renderer6, { class: "size-4 mr-1", "aria-hidden": "true" });
                          $$renderer6.push(`<!----> Export filtered (${escape_html(total)} rows)`);
                        },
                        $$slots: { default: true }
                      });
                      $$renderer5.push(`<!----></span>`);
                    };
                    if (Tooltip_trigger) {
                      $$renderer4.push("<!--[-->");
                      Tooltip_trigger($$renderer4, { child, $$slots: { child: true } });
                      $$renderer4.push("<!--]-->");
                    } else {
                      $$renderer4.push("<!--[!-->");
                      $$renderer4.push("<!--]-->");
                    }
                  }
                  $$renderer4.push(` `);
                  if (Tooltip_content) {
                    $$renderer4.push("<!--[-->");
                    Tooltip_content($$renderer4, {
                      children: ($$renderer5) => {
                        $$renderer5.push(`<!---->Refine your filter — exports are capped at 50000 rows.`);
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
          },
          $$slots: { default: true }
        });
        $$renderer2.push("<!--]-->");
      } else {
        $$renderer2.push("<!--[!-->");
        $$renderer2.push("<!--]-->");
      }
    } else {
      $$renderer2.push("<!--[-1-->");
      Button($$renderer2, {
        variant: "outline",
        size: "sm",
        onclick: doExport,
        disabled: disabled(),
        children: ($$renderer3) => {
          if (exporting) {
            $$renderer3.push("<!--[0-->");
            $$renderer3.push(`<span class="size-4 mr-1 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true"></span> Exporting…`);
          } else {
            $$renderer3.push("<!--[-1-->");
            Download($$renderer3, { class: "size-4 mr-1", "aria-hidden": "true" });
            $$renderer3.push(`<!----> Export filtered (${escape_html(total)} rows)`);
          }
          $$renderer3.push(`<!--]-->`);
        },
        $$slots: { default: true }
      });
    }
    $$renderer2.push(`<!--]-->`);
  });
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let { data } = $$props;
    const filters = derived(() => data.filters);
    const isAdmin = derived(() => !!data.user?.is_admin);
    let archives = [];
    const totalArchiveBytes = derived(() => archives.reduce((sum, a) => sum + (a.size_bytes ?? 0), 0));
    function formatBytes(n) {
      if (n < 1024) return `${n} B`;
      const units = ["KB", "MB", "GB", "TB"];
      let v = n / 1024;
      let i = 0;
      while (v >= 1024 && i < units.length - 1) {
        v /= 1024;
        i++;
      }
      return `${v.toFixed(1)} ${units[i]}`;
    }
    function setParam(k, v) {
      const u = new URL(store_get($$store_subs ??= {}, "$pageStore", page).url);
      if (v === null || v === "") u.searchParams.delete(k);
      else u.searchParams.set(k, v);
      u.searchParams.delete("page");
      goto(u.pathname + u.search, {});
    }
    function setRangePreset(days) {
      const to = /* @__PURE__ */ new Date();
      const from = new Date(Date.now() - days * 864e5);
      const u = new URL(store_get($$store_subs ??= {}, "$pageStore", page).url);
      u.searchParams.set("from", from.toISOString());
      u.searchParams.set("to", to.toISOString());
      u.searchParams.delete("page");
      goto(u.pathname + u.search, {});
    }
    function changePage(p) {
      const u = new URL(store_get($$store_subs ??= {}, "$pageStore", page).url);
      u.searchParams.set("page", String(p));
      goto(u.pathname + u.search, {});
    }
    const actions = [
      "vm.create",
      "vm.update",
      "vm.delete",
      "vm.tag.add",
      "vm.tag.remove",
      "vm.tag.update",
      "vm.notes.update",
      "vm.power.start",
      "vm.power.stop",
      "vm.power.reboot",
      "quota.update",
      "auth.login",
      "auth.logout",
      "auth.password.change",
      "auth.pat.mint",
      "auth.pat.revoke",
      "auth.ssh-key.add",
      "auth.ssh-key.remove",
      "auth.session.revoke",
      "team.create",
      "team.update",
      "team.delete",
      "user.create",
      "user.update",
      "user.delete",
      "cluster.create",
      "cluster.update",
      "cluster.delete"
    ];
    const targetTypes = ["vm", "lxc", "user", "team", "cluster", "quota"];
    const activeFilters = derived(() => Object.entries({
      from: filters().from,
      to: filters().to,
      action: filters().action?.join(",") || void 0,
      type: filters().target_type?.join(",") || void 0,
      cluster_id: filters().cluster_id != null ? String(filters().cluster_id) : void 0,
      vmid: filters().vmid != null ? String(filters().vmid) : void 0,
      show_team_actions: filters().show_team_actions ? "on" : void 0,
      user_id: filters().user_id != null ? String(filters().user_id) : void 0
    }).filter(([, v]) => v !== void 0));
    $$renderer2.push(`<header class="mb-6"><h1 class="text-[28px] font-semibold tracking-tight">Audit log</h1> <p class="text-muted-foreground text-sm mt-1">Every privileged action recorded by the GUI.</p></header> <div class="sticky top-14 bg-background border-b border-border py-4 -mx-6 px-6 mb-6 flex flex-col gap-3 z-10"><div class="flex flex-wrap items-center gap-3">`);
    if (Popover) {
      $$renderer2.push("<!--[-->");
      Popover($$renderer2, {
        children: ($$renderer3) => {
          {
            let child = function($$renderer4, { props }) {
              Button($$renderer4, spread_props([
                { variant: "outline" },
                props,
                {
                  children: ($$renderer5) => {
                    $$renderer5.push(`<!---->Date range ▾`);
                  },
                  $$slots: { default: true }
                }
              ]));
            };
            if (Popover_trigger) {
              $$renderer3.push("<!--[-->");
              Popover_trigger($$renderer3, { child, $$slots: { child: true } });
              $$renderer3.push("<!--]-->");
            } else {
              $$renderer3.push("<!--[!-->");
              $$renderer3.push("<!--]-->");
            }
          }
          $$renderer3.push(` `);
          if (Popover_content) {
            $$renderer3.push("<!--[-->");
            Popover_content($$renderer3, {
              class: "p-4 w-[260px]",
              children: ($$renderer4) => {
                $$renderer4.push(`<div class="flex flex-col gap-2">`);
                Button($$renderer4, {
                  variant: "ghost",
                  size: "sm",
                  onclick: () => setRangePreset(1),
                  children: ($$renderer5) => {
                    $$renderer5.push(`<!---->Last 24 hours`);
                  },
                  $$slots: { default: true }
                });
                $$renderer4.push(`<!----> `);
                Button($$renderer4, {
                  variant: "ghost",
                  size: "sm",
                  onclick: () => setRangePreset(7),
                  children: ($$renderer5) => {
                    $$renderer5.push(`<!---->Last 7 days`);
                  },
                  $$slots: { default: true }
                });
                $$renderer4.push(`<!----> `);
                Button($$renderer4, {
                  variant: "ghost",
                  size: "sm",
                  onclick: () => setRangePreset(30),
                  children: ($$renderer5) => {
                    $$renderer5.push(`<!---->Last 30 days`);
                  },
                  $$slots: { default: true }
                });
                $$renderer4.push(`<!----> <div class="flex flex-col gap-1 mt-2">`);
                Label($$renderer4, {
                  children: ($$renderer5) => {
                    $$renderer5.push(`<!---->From`);
                  },
                  $$slots: { default: true }
                });
                $$renderer4.push(`<!----> `);
                Input($$renderer4, {
                  type: "date",
                  value: (filters().from ?? "").slice(0, 10),
                  oninput: (e) => {
                    const v = e.target.value;
                    if (v) setParam("from", new Date(v).toISOString());
                  }
                });
                $$renderer4.push(`<!----> `);
                Label($$renderer4, {
                  class: "mt-1",
                  children: ($$renderer5) => {
                    $$renderer5.push(`<!---->To`);
                  },
                  $$slots: { default: true }
                });
                $$renderer4.push(`<!----> `);
                Input($$renderer4, {
                  type: "date",
                  value: (filters().to ?? "").slice(0, 10),
                  oninput: (e) => {
                    const v = e.target.value;
                    if (v) setParam("to", new Date(v).toISOString());
                  }
                });
                $$renderer4.push(`<!----></div></div>`);
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
    $$renderer2.push(` `);
    if (Dropdown_menu) {
      $$renderer2.push("<!--[-->");
      Dropdown_menu($$renderer2, {
        children: ($$renderer3) => {
          {
            let child = function($$renderer4, { props }) {
              Button($$renderer4, spread_props([
                { variant: "outline" },
                props,
                {
                  children: ($$renderer5) => {
                    $$renderer5.push(`<!---->Action ▾`);
                  },
                  $$slots: { default: true }
                }
              ]));
            };
            if (Dropdown_menu_trigger) {
              $$renderer3.push("<!--[-->");
              Dropdown_menu_trigger($$renderer3, { child, $$slots: { child: true } });
              $$renderer3.push("<!--]-->");
            } else {
              $$renderer3.push("<!--[!-->");
              $$renderer3.push("<!--]-->");
            }
          }
          $$renderer3.push(` `);
          if (Dropdown_menu_content) {
            $$renderer3.push("<!--[-->");
            Dropdown_menu_content($$renderer3, {
              class: "max-h-80 overflow-y-auto",
              children: ($$renderer4) => {
                $$renderer4.push(`<!--[-->`);
                const each_array = ensure_array_like(actions);
                for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
                  let a = each_array[$$index];
                  if (Dropdown_menu_item) {
                    $$renderer4.push("<!--[-->");
                    Dropdown_menu_item($$renderer4, {
                      onclick: () => setParam("action", a),
                      children: ($$renderer5) => {
                        $$renderer5.push(`<!---->${escape_html(a)}`);
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
    $$renderer2.push(` `);
    if (Dropdown_menu) {
      $$renderer2.push("<!--[-->");
      Dropdown_menu($$renderer2, {
        children: ($$renderer3) => {
          {
            let child = function($$renderer4, { props }) {
              Button($$renderer4, spread_props([
                { variant: "outline" },
                props,
                {
                  children: ($$renderer5) => {
                    $$renderer5.push(`<!---->Type ▾`);
                  },
                  $$slots: { default: true }
                }
              ]));
            };
            if (Dropdown_menu_trigger) {
              $$renderer3.push("<!--[-->");
              Dropdown_menu_trigger($$renderer3, { child, $$slots: { child: true } });
              $$renderer3.push("<!--]-->");
            } else {
              $$renderer3.push("<!--[!-->");
              $$renderer3.push("<!--]-->");
            }
          }
          $$renderer3.push(` `);
          if (Dropdown_menu_content) {
            $$renderer3.push("<!--[-->");
            Dropdown_menu_content($$renderer3, {
              children: ($$renderer4) => {
                $$renderer4.push(`<!--[-->`);
                const each_array_1 = ensure_array_like(targetTypes);
                for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
                  let t = each_array_1[$$index_1];
                  if (Dropdown_menu_item) {
                    $$renderer4.push("<!--[-->");
                    Dropdown_menu_item($$renderer4, {
                      onclick: () => setParam("type", t),
                      children: ($$renderer5) => {
                        $$renderer5.push(`<!---->${escape_html(t)}`);
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
    $$renderer2.push(` `);
    if (!isAdmin()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<label class="flex items-center gap-2 text-[14px]">`);
      Switch($$renderer2, {
        checked: filters().show_team_actions ?? false,
        onCheckedChange: (v) => setParam("show_team_actions", v ? "1" : null)
      });
      $$renderer2.push(`<!----> <span title="Include actions other team members took on resources you can see.">Show team actions</span></label>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> `);
    if (activeFilters().length > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="flex flex-wrap items-center gap-2"><!--[-->`);
      const each_array_2 = ensure_array_like(activeFilters());
      for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
        let [k, v] = each_array_2[$$index_2];
        FilterChip($$renderer2, {
          label: `${k}: ${v}`,
          onRemove: () => setParam(k === "type" ? "type" : k, null)
        });
      }
      $$renderer2.push(`<!--]--> <button type="button" class="text-[13px] text-primary underline-offset-4 hover:underline">Clear all</button></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="flex items-center justify-between"><span class="text-[14px] text-muted-foreground">Showing ${escape_html(data.page.total)} entries</span> `);
    CsvExportButton($$renderer2, { total: data.page.total, filters: filters() });
    $$renderer2.push(`<!----></div></div> `);
    AuditTable($$renderer2, {
      rows: data.page.rows,
      total: data.page.total,
      page: data.page.page,
      pageSize: data.page.page_size,
      onPageChange: changePage,
      error: data.loadError ? "Couldn't load audit log." : null
    });
    $$renderer2.push(`<!----> `);
    if (isAdmin()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<section class="mt-10"><div class="mb-3 flex items-center justify-between"><div><h2 class="text-[18px] font-semibold tracking-tight">Audit archives</h2> <p class="text-muted-foreground text-[13px]">Compressed exports of entries older than the retention window. `);
      if (archives.length > 0) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<span class="tabular-nums">${escape_html(archives.length)} files · ${escape_html(formatBytes(totalArchiveBytes()))} total.</span>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></p></div></div> `);
      {
        $$renderer2.push("<!--[1-->");
        $$renderer2.push(`<p class="text-muted-foreground text-[14px]">Loading archives…</p>`);
      }
      $$renderer2.push(`<!--]--></section>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}

export { _page as default };
//# sourceMappingURL=_page.svelte-B0l0UcVP.js.map
