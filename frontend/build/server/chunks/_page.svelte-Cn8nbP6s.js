import { l as escape_html, d as derived, c as store_get, m as unsubscribe_stores, w as run, f as ensure_array_like, j as attr_class } from './renderer-5OqEGBJa.js';
import { g as goto } from './client-BLBuBvl1.js';
import { p as page } from './stores-C0P6ZS0h.js';
import { T as Tabs, a as Tabs_list, b as Tabs_content, c as Tabs_trigger } from './tabs-trigger-DiDNjauC.js';
import { B as Button } from './button-B5bCAdGN.js';
import { I as Input } from './input-CVUkBx6i.js';
import { D as Dialog, a as Dialog_content, b as Dialog_header, c as Dialog_title, d as Dialog_description, e as Dialog_footer } from './dialog-description-R8PRa1Nu.js';
import 'clsx';
import { A as Alert } from './alert-DKR6l6LD.js';
import { A as Alert_description } from './alert-description-BLye52mR.js';
import { a as api, A as ApiError } from './client2-vvZGy19D.js';
import { a as toast } from './toast-state.svelte-BaJ56aYt.js';
import '@sveltejs/kit/internal';
import './root-BZo_tL0Z.js';
import './index-Siz_BmGa.js';
import '@sveltejs/kit/internal/server';
import './state.svelte-Bqwbw8qw.js';
import './noop-n4I-x7yK.js';
import './is-DeZ4WIS2.js';
import './scroll-lock-BXSbnLUA.js';
import 'tailwind-merge';
import './dialog-content-BmZR8ATi.js';
import './dialog-overlay-CKQuveke.js';
import './x-hAU9CgJu.js';
import './dialog-description2-CRb016Lx.js';

function QuotaTab($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { teamId, initial, onSaved } = $$props;
    let rows = run(() => initial.rows.map((r) => ({
      cluster_id: r.cluster_id,
      cluster_name: r.cluster_name,
      cpu_cores: r.limit.cpu_cores,
      ram_gb: r.limit.ram_gb,
      disk_gb: r.limit.disk_gb,
      vm_count: r.limit.vm_count,
      usage_cpu: r.usage.cpu_cores,
      usage_ram_gb: r.usage.ram_gb,
      usage_disk_gb: r.usage.disk_gb,
      usage_vms: r.usage.vm_count + r.usage.lxc_count
    })));
    let saving = false;
    let formError = null;
    let conflict = null;
    function pct(used, limit) {
      if (!limit || limit <= 0) return 0;
      return Math.round(used / limit * 100);
    }
    function pctClass(p) {
      if (p >= 95) return "text-destructive";
      if (p >= 80) return "text-warning";
      return "text-muted-foreground";
    }
    function buildPayload() {
      return rows.map((r) => ({
        cluster_id: r.cluster_id,
        cpu_cores: r.cpu_cores,
        ram_gb: r.ram_gb,
        disk_gb: r.disk_gb,
        vm_count: r.vm_count
      }));
    }
    async function save(allowOver = false) {
      saving = true;
      formError = null;
      try {
        const page2 = await api.quotas.setTeamQuotas({ teamId, rows: buildPayload(), allowOver });
        onSaved?.(page2);
        conflict = null;
        toast.success("Quotas updated.");
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) {
          const body = e.body ?? {};
          const detail = body.detail ?? {};
          conflict = {
            cluster_id: detail.cluster_id,
            usage: detail.usage,
            requested_limit: detail.requested_limit,
            message: detail.message ?? "Current usage exceeds the new limit."
          };
        } else {
          formError = "Couldn't save quotas. Try again.";
          toast.error(formError);
        }
      } finally {
        saving = false;
      }
    }
    function clusterName(id) {
      return rows.find((r) => r.cluster_id === id)?.cluster_name ?? `Cluster ${id}`;
    }
    function sumOrNull(arr) {
      let total = 0;
      for (const v of arr) {
        if (v == null) return null;
        total += v;
      }
      return total;
    }
    const aggCpu = derived(() => sumOrNull(rows.map((r) => r.cpu_cores)));
    const aggRam = derived(() => sumOrNull(rows.map((r) => r.ram_gb)));
    const aggDisk = derived(() => sumOrNull(rows.map((r) => r.disk_gb)));
    const aggCount = derived(() => sumOrNull(rows.map((r) => r.vm_count)));
    if (formError) {
      $$renderer2.push("<!--[0-->");
      if (Alert) {
        $$renderer2.push("<!--[-->");
        Alert($$renderer2, {
          variant: "destructive",
          class: "mb-4",
          children: ($$renderer3) => {
            if (Alert_description) {
              $$renderer3.push("<!--[-->");
              Alert_description($$renderer3, {
                children: ($$renderer4) => {
                  $$renderer4.push(`<!---->${escape_html(formError)}`);
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
    }
    $$renderer2.push(`<!--]--> `);
    if (rows.length === 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="border-border bg-muted/30 rounded-md border border-dashed px-6 py-10 text-center"><p class="text-sm font-medium">This team has no cluster bindings — bind one in the Members tab first.</p></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="rounded-md border border-border overflow-hidden"><table class="w-full text-[13px]"><thead class="bg-muted/40"><tr><th class="text-left px-4 py-2 font-medium">Cluster</th><th class="px-2 py-2 font-medium">vCPU</th><th class="px-2 py-2 font-medium">RAM (GB)</th><th class="px-2 py-2 font-medium">Disk (GB)</th><th class="px-2 py-2 font-medium">VM count</th></tr></thead><tbody><!--[-->`);
      const each_array = ensure_array_like(rows);
      for (let i = 0, $$length = each_array.length; i < $$length; i++) {
        let r = each_array[i];
        $$renderer2.push(`<tr class="border-t border-border"><td class="px-4 py-3"><div class="font-medium">${escape_html(r.cluster_name)}</div> <div${attr_class(`text-[12px] ${pctClass(Math.max(pct(r.usage_cpu, r.cpu_cores), pct(r.usage_ram_gb, r.ram_gb), pct(r.usage_disk_gb, r.disk_gb), pct(r.usage_vms, r.vm_count)))}`)}>current usage: ${escape_html(r.usage_cpu)} / ${escape_html(r.cpu_cores ?? "∞")} vCPU, ${escape_html(r.usage_ram_gb)} / ${escape_html(r.ram_gb ?? "∞")} GB</div></td><td class="px-2 py-3">`);
        Input($$renderer2, {
          type: "number",
          min: "0",
          value: r.cpu_cores ?? "",
          oninput: (e) => {
            const v = e.target.value;
            rows[i].cpu_cores = v === "" ? null : Number(v);
          },
          class: "w-20"
        });
        $$renderer2.push(`<!----></td><td class="px-2 py-3">`);
        Input($$renderer2, {
          type: "number",
          min: "0",
          value: r.ram_gb ?? "",
          oninput: (e) => {
            const v = e.target.value;
            rows[i].ram_gb = v === "" ? null : Number(v);
          },
          class: "w-20"
        });
        $$renderer2.push(`<!----></td><td class="px-2 py-3">`);
        Input($$renderer2, {
          type: "number",
          min: "0",
          value: r.disk_gb ?? "",
          oninput: (e) => {
            const v = e.target.value;
            rows[i].disk_gb = v === "" ? null : Number(v);
          },
          class: "w-20"
        });
        $$renderer2.push(`<!----></td><td class="px-2 py-3">`);
        Input($$renderer2, {
          type: "number",
          min: "0",
          value: r.vm_count ?? "",
          oninput: (e) => {
            const v = e.target.value;
            rows[i].vm_count = v === "" ? null : Number(v);
          },
          class: "w-20"
        });
        $$renderer2.push(`<!----></td></tr>`);
      }
      $$renderer2.push(`<!--]--></tbody><tfoot class="bg-muted/30 border-t border-border"><tr><td class="px-4 py-3 font-medium">Aggregate (auto)</td><td class="px-2 py-3 font-mono">${escape_html(aggCpu() ?? "∞")}</td><td class="px-2 py-3 font-mono">${escape_html(aggRam() ?? "∞")}</td><td class="px-2 py-3 font-mono">${escape_html(aggDisk() ?? "∞")}</td><td class="px-2 py-3 font-mono">${escape_html(aggCount() ?? "∞")}</td></tr></tfoot></table></div> <div class="flex justify-end gap-2 mt-4">`);
      Button($$renderer2, {
        onclick: () => save(false),
        disabled: saving,
        children: ($$renderer3) => {
          $$renderer3.push(`<!---->Save changes`);
        },
        $$slots: { default: true }
      });
      $$renderer2.push(`<!----></div>`);
    }
    $$renderer2.push(`<!--]--> `);
    if (Dialog) {
      $$renderer2.push("<!--[-->");
      Dialog($$renderer2, {
        open: conflict !== null,
        onOpenChange: (o) => {
          if (!o) conflict = null;
        },
        children: ($$renderer3) => {
          if (Dialog_content) {
            $$renderer3.push("<!--[-->");
            Dialog_content($$renderer3, {
              children: ($$renderer4) => {
                if (Dialog_header) {
                  $$renderer4.push("<!--[-->");
                  Dialog_header($$renderer4, {
                    children: ($$renderer5) => {
                      if (Dialog_title) {
                        $$renderer5.push("<!--[-->");
                        Dialog_title($$renderer5, {
                          children: ($$renderer6) => {
                            $$renderer6.push(`<!---->Lower quota limit on ${escape_html(initial.team_name)}?`);
                          },
                          $$slots: { default: true }
                        });
                        $$renderer5.push("<!--]-->");
                      } else {
                        $$renderer5.push("<!--[!-->");
                        $$renderer5.push("<!--]-->");
                      }
                      $$renderer5.push(` `);
                      if (Dialog_description) {
                        $$renderer5.push("<!--[-->");
                        Dialog_description($$renderer5, {
                          children: ($$renderer6) => {
                            if (conflict) {
                              $$renderer6.push("<!--[0-->");
                              $$renderer6.push(`Current usage on ${escape_html(clusterName(conflict.cluster_id))} (${escape_html(conflict.usage.cpu_cores)} vCPU,
          ${escape_html(conflict.usage.ram_gb)} GB RAM, ${escape_html(conflict.usage.vm_count)} VMs) exceeds the new limit
          (${escape_html(conflict.requested_limit.cpu_cores ?? "∞")} vCPU,
          ${escape_html(conflict.requested_limit.ram_gb ?? "∞")} GB,
          ${escape_html(conflict.requested_limit.vm_count ?? "∞")} VMs). Saving will leave the team over-quota
          until usage drops. New creates will be blocked.`);
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
                $$renderer4.push(` `);
                if (Dialog_footer) {
                  $$renderer4.push("<!--[-->");
                  Dialog_footer($$renderer4, {
                    children: ($$renderer5) => {
                      Button($$renderer5, {
                        variant: "ghost",
                        onclick: () => conflict = null,
                        children: ($$renderer6) => {
                          $$renderer6.push(`<!---->Cancel`);
                        },
                        $$slots: { default: true }
                      });
                      $$renderer5.push(`<!----> `);
                      Button($$renderer5, {
                        variant: "destructive",
                        onclick: () => save(true),
                        disabled: saving,
                        children: ($$renderer6) => {
                          $$renderer6.push(`<!---->Lower limit anyway`);
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
  });
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let { data } = $$props;
    const tab = derived(() => store_get($$store_subs ??= {}, "$pageStore", page).url.hash.replace("#", "") || "members");
    function setTab(v) {
      goto("#" + v, {});
    }
    $$renderer2.push(`<header class="mb-6"><h1 class="text-[28px] font-semibold tracking-tight">Team: ${escape_html(data.quotas.team_name)}</h1></header> `);
    if (Tabs) {
      $$renderer2.push("<!--[-->");
      Tabs($$renderer2, {
        value: tab(),
        onValueChange: setTab,
        children: ($$renderer3) => {
          if (Tabs_list) {
            $$renderer3.push("<!--[-->");
            Tabs_list($$renderer3, {
              class: "h-9",
              children: ($$renderer4) => {
                if (Tabs_trigger) {
                  $$renderer4.push("<!--[-->");
                  Tabs_trigger($$renderer4, {
                    value: "members",
                    children: ($$renderer5) => {
                      $$renderer5.push(`<!---->Members`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer4.push("<!--]-->");
                } else {
                  $$renderer4.push("<!--[!-->");
                  $$renderer4.push("<!--]-->");
                }
                $$renderer4.push(` `);
                if (Tabs_trigger) {
                  $$renderer4.push("<!--[-->");
                  Tabs_trigger($$renderer4, {
                    value: "quotas",
                    children: ($$renderer5) => {
                      $$renderer5.push(`<!---->Quotas`);
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
          if (Tabs_content) {
            $$renderer3.push("<!--[-->");
            Tabs_content($$renderer3, {
              value: "members",
              children: ($$renderer4) => {
                $$renderer4.push(`<p class="text-muted-foreground text-[14px] mt-6">Member management ships in Phase 1 admin shell — Phase 2 adds the Quotas tab to this same page.</p>`);
              },
              $$slots: { default: true }
            });
            $$renderer3.push("<!--]-->");
          } else {
            $$renderer3.push("<!--[!-->");
            $$renderer3.push("<!--]-->");
          }
          $$renderer3.push(` `);
          if (Tabs_content) {
            $$renderer3.push("<!--[-->");
            Tabs_content($$renderer3, {
              value: "quotas",
              children: ($$renderer4) => {
                $$renderer4.push(`<p class="text-muted-foreground text-[13px] mt-4 mb-4">Per-cluster limits enforced on every create or resize.</p> `);
                if (data.loadError) {
                  $$renderer4.push("<!--[0-->");
                  $$renderer4.push(`<p class="text-destructive text-[14px]">Couldn't load quota data. Refresh the page to retry.</p>`);
                } else {
                  $$renderer4.push("<!--[-1-->");
                  QuotaTab($$renderer4, {
                    teamId: data.teamId,
                    initial: data.quotas,
                    onSaved: () => location.reload()
                  });
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
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}

export { _page as default };
//# sourceMappingURL=_page.svelte-Cn8nbP6s.js.map
