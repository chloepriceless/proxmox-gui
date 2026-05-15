import { f as ensure_array_like, l as escape_html, d as derived, n as spread_props, c as store_get, o as attributes, m as unsubscribe_stores } from './renderer-5OqEGBJa.js';
import { g as goto } from './client-BLBuBvl1.js';
import { p as page } from './stores-C0P6ZS0h.js';
import { I as Input } from './input-CVUkBx6i.js';
import { B as Button, I as Icon } from './button-B5bCAdGN.js';
import { D as Dropdown_menu, a as Dropdown_menu_trigger, b as Dropdown_menu_content, c as Dropdown_menu_item } from './dropdown-menu-trigger-D8Q6pE1W.js';
import 'clsx';
import { P as Popover, a as Popover_trigger, b as Popover_content } from './popover-trigger-Ddu4tViI.js';
import { S as Switch } from './switch-D56V_-5B.js';
import { L as Label } from './label-DVSPNLFi.js';
import { F as FilterChip } from './FilterChip-DiymKOIO.js';
import { A as AuditTable, T as Tooltip_provider, a as Tooltip, b as Tooltip_trigger, c as Tooltip_content } from './tooltip-provider-vEBj39gO.js';
import { a as api, A as ApiError } from './client2-vvZGy19D.js';
import { a as toast } from './toast-state.svelte-BaJ56aYt.js';
import '@sveltejs/kit/internal';
import './root-BZo_tL0Z.js';
import './index-Siz_BmGa.js';
import '@sveltejs/kit/internal/server';
import './state.svelte-Bqwbw8qw.js';
import 'tailwind-merge';
import './scroll-lock-BXSbnLUA.js';
import './is-DeZ4WIS2.js';
import './noop-n4I-x7yK.js';
import './popper-layer-force-mount-DItOXSN8.js';
import './hidden-input-BgYWG1Tz.js';
import './sr-only-styles-BPX-4PGe.js';
import './lock-7RFs808g.js';
import './x-hAU9CgJu.js';
import './table-row-CHObHOSI.js';
import './table-header-DckvTEzE.js';
import './card-d0K3O0_w.js';
import './badge-ohCh8OUw.js';

function Download($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["path", { "d": "M12 15V3" }],
    ["path", { "d": "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }],
    ["path", { "d": "m7 10 5 5 5-5" }]
  ];
  Icon($$renderer, spread_props([{ name: "download" }, props, { iconNode }]));
}
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
    $$renderer2.push(`<!---->`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}

export { _page as default };
//# sourceMappingURL=_page.svelte-Bs3NIJ78.js.map
