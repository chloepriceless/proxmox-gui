import { m as escape_html, d as derived, c as store_get, n as unsubscribe_stores, x as run, h as ensure_array_like, k as attr_class, o as spread_props } from './renderer--hvGDOOw.js';
import { g as goto } from './client-bCVElyx1.js';
import { p as page } from './stores-CCN9TkGO.js';
import { T as Tabs, a as Tabs_list, b as Tabs_content, c as Tabs_trigger } from './tabs-trigger-Ckvy88bB.js';
import { B as Button } from './button-ntOmtgiY.js';
import { I as Input } from './input-Buwd_f-b.js';
import { D as Dialog, a as Dialog_content, b as Dialog_header, c as Dialog_title, d as Dialog_description, e as Dialog_footer } from './dialog-description2-C1bK-doN.js';
import 'clsx';
import { A as Alert } from './alert-CDmFQdZq.js';
import { A as Alert_description } from './alert-description-Cz6DQ4pO.js';
import { a as api, A as ApiError } from './client2-WJrlUD72.js';
import { a as toast } from './toast-state.svelte-Ckj_X06S.js';
import { C as Checkbox } from './checkbox-BaIm7C4I.js';
import { L as Label } from './label-7gbcsuPJ.js';
import { C as Card } from './card-BUGQ1elQ.js';
import { I as Icon } from './Icon-B86w_tDb.js';
import '@sveltejs/kit/internal';
import './root-DHp9To-z.js';
import './index-B54IuS4T.js';
import '@sveltejs/kit/internal/server';
import './state.svelte-BYtSRxhp.js';
import './noop-n4I-x7yK.js';
import './is-HJ-O5XFN.js';
import './scroll-lock-CGoEUeDJ.js';
import 'tailwind-merge';
import './dialog-content-Y751EC5K.js';
import './dialog-description-BW9UDPMx.js';
import './x-Co-kLHi3.js';
import './clone-BTaVLdQ_.js';
import './hidden-input-C4DjPWyi.js';
import './sr-only-styles-BFTOatBw.js';
import './check-Czpunie5.js';

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
function Network($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    [
      "rect",
      { "x": "16", "y": "16", "width": "6", "height": "6", "rx": "1" }
    ],
    [
      "rect",
      { "x": "2", "y": "16", "width": "6", "height": "6", "rx": "1" }
    ],
    [
      "rect",
      { "x": "9", "y": "2", "width": "6", "height": "6", "rx": "1" }
    ],
    ["path", { "d": "M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3" }],
    ["path", { "d": "M12 12V8" }]
  ];
  Icon($$renderer, spread_props([{ name: "network" }, props, { iconNode }]));
}
function sdnGrantRows(scope) {
  const grantedSet = new Set(scope.granted.sdn_vnets);
  return scope.available_sdn_vnets.map((opt) => ({
    network_id: opt.network_id,
    display_name: opt.display_name,
    kind: opt.kind,
    granted: grantedSet.has(opt.network_id),
    applied: opt.applied
  }));
}
function bridgeGrantRows(scope) {
  const hasSavedBridges = scope.granted.bridges.length > 0;
  const grantedSet = new Set(scope.granted.bridges);
  return scope.available_bridges.map((opt) => ({
    network_id: opt.network_id,
    display_name: opt.display_name,
    kind: opt.kind,
    // No saved set yet → default-visible (D-19); otherwise honour the save.
    granted: hasSavedBridges ? grantedSet.has(opt.network_id) : true,
    applied: opt.applied
  }));
}
function buildScopeUpdate(sdnRows, bridgeRows) {
  return {
    sdn_vnets: sdnRows.filter((r) => r.granted).map((r) => r.network_id),
    bridges: bridgeRows.filter((r) => r.granted).map((r) => r.network_id)
  };
}
function NetworksTab($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { teamId, clusters } = $$props;
    let byCluster = {};
    let saving = false;
    let formError = null;
    async function save() {
      saving = true;
      formError = null;
      try {
        for (const c of clusters) {
          const st = byCluster[c.cluster_id];
          if (!st || st.scope === null) continue;
          const body = buildScopeUpdate(st.sdnRows, st.bridgeRows);
          const refreshed = await api.networks.setTeamNetworkScope({ teamId, clusterId: c.cluster_id, body });
          byCluster[c.cluster_id] = {
            loading: false,
            loadError: false,
            scope: refreshed,
            sdnRows: sdnGrantRows(refreshed),
            bridgeRows: bridgeGrantRows(refreshed)
          };
        }
        toast.success("Network scope updated.");
      } catch {
        formError = "Couldn't save the network scope. Try again.";
        toast.error(formError);
      } finally {
        saving = false;
      }
    }
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
    if (clusters.length === 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="border-border bg-muted/30 rounded-md border border-dashed px-6 py-10 text-center"><p class="text-sm font-medium">This team has no cluster bindings — bind one in the Members tab first.</p></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="flex flex-col gap-6"><!--[-->`);
      const each_array = ensure_array_like(clusters);
      for (let $$index_2 = 0, $$length = each_array.length; $$index_2 < $$length; $$index_2++) {
        let c = each_array[$$index_2];
        const st = byCluster[c.cluster_id];
        if (Card) {
          $$renderer2.push("<!--[-->");
          Card($$renderer2, {
            class: "p-6",
            children: ($$renderer3) => {
              $$renderer3.push(`<h3 class="mb-1 flex items-center gap-2 text-[14px] font-semibold">`);
              Network($$renderer3, { class: "size-4 text-muted-foreground", "aria-hidden": "true" });
              $$renderer3.push(`<!----> ${escape_html(c.cluster_name)}</h3> `);
              if (!st || st.loading) {
                $$renderer3.push("<!--[0-->");
                $$renderer3.push(`<div class="mt-3 h-20 w-full animate-pulse rounded bg-muted"></div>`);
              } else if (st.loadError) {
                $$renderer3.push("<!--[1-->");
                $$renderer3.push(`<p class="mt-3 text-[13px] text-destructive">Couldn't load cluster networks. <button type="button" class="text-primary ml-1 hover:underline">Retry</button></p>`);
              } else {
                $$renderer3.push("<!--[-1-->");
                $$renderer3.push(`<div class="mt-4"><p class="text-[13px] font-medium text-muted-foreground">SDN VNets</p> `);
                if (st.sdnRows.length === 0) {
                  $$renderer3.push("<!--[0-->");
                  $$renderer3.push(`<p class="mt-1 text-[13px] text-muted-foreground">${escape_html(st.scope?.sdn_capable ? "No SDN VNets on this cluster." : "This cluster is not SDN-capable.")}</p>`);
                } else {
                  $$renderer3.push("<!--[-1-->");
                  $$renderer3.push(`<div class="mt-2 flex flex-col gap-2"><!--[-->`);
                  const each_array_1 = ensure_array_like(st.sdnRows);
                  for (let i = 0, $$length2 = each_array_1.length; i < $$length2; i++) {
                    let row = each_array_1[i];
                    $$renderer3.push(`<div class="flex items-center gap-2">`);
                    Checkbox($$renderer3, {
                      id: `net-${c.cluster_id}-sdn-${row.network_id}`,
                      checked: row.granted,
                      disabled: !row.applied,
                      onCheckedChange: (v) => {
                        st.sdnRows[i].granted = v === true;
                      }
                    });
                    $$renderer3.push(`<!----> `);
                    Label($$renderer3, {
                      for: `net-${c.cluster_id}-sdn-${row.network_id}`,
                      class: "font-normal",
                      children: ($$renderer4) => {
                        $$renderer4.push(`<!---->${escape_html(row.display_name)} `);
                        if (!row.applied) {
                          $$renderer4.push("<!--[0-->");
                          $$renderer4.push(`<span class="text-[12px] text-muted-foreground">(pending)</span>`);
                        } else {
                          $$renderer4.push("<!--[-1-->");
                        }
                        $$renderer4.push(`<!--]-->`);
                      },
                      $$slots: { default: true }
                    });
                    $$renderer3.push(`<!----></div>`);
                  }
                  $$renderer3.push(`<!--]--></div>`);
                }
                $$renderer3.push(`<!--]--></div> <div class="mt-5"><p class="text-[13px] font-medium text-muted-foreground">Legacy bridges</p> `);
                if (st.bridgeRows.length === 0) {
                  $$renderer3.push("<!--[0-->");
                  $$renderer3.push(`<p class="mt-1 text-[13px] text-muted-foreground">No legacy bridges on this cluster.</p>`);
                } else {
                  $$renderer3.push("<!--[-1-->");
                  $$renderer3.push(`<div class="mt-2 flex flex-col gap-2"><!--[-->`);
                  const each_array_2 = ensure_array_like(st.bridgeRows);
                  for (let i = 0, $$length2 = each_array_2.length; i < $$length2; i++) {
                    let row = each_array_2[i];
                    $$renderer3.push(`<div class="flex items-center gap-2">`);
                    Checkbox($$renderer3, {
                      id: `net-${c.cluster_id}-br-${row.network_id}`,
                      checked: row.granted,
                      onCheckedChange: (v) => {
                        st.bridgeRows[i].granted = v === true;
                      }
                    });
                    $$renderer3.push(`<!----> `);
                    Label($$renderer3, {
                      for: `net-${c.cluster_id}-br-${row.network_id}`,
                      class: "font-normal",
                      children: ($$renderer4) => {
                        $$renderer4.push(`<!---->${escape_html(row.display_name)}`);
                      },
                      $$slots: { default: true }
                    });
                    $$renderer3.push(`<!----></div>`);
                  }
                  $$renderer3.push(`<!--]--></div>`);
                }
                $$renderer3.push(`<!--]--></div>`);
              }
              $$renderer3.push(`<!--]-->`);
            },
            $$slots: { default: true }
          });
          $$renderer2.push("<!--]-->");
        } else {
          $$renderer2.push("<!--[!-->");
          $$renderer2.push("<!--]-->");
        }
      }
      $$renderer2.push(`<!--]--></div> <div class="mt-4 flex justify-end gap-2">`);
      Button($$renderer2, {
        onclick: save,
        disabled: saving,
        children: ($$renderer3) => {
          $$renderer3.push(`<!---->Save changes`);
        },
        $$slots: { default: true }
      });
      $$renderer2.push(`<!----></div>`);
    }
    $$renderer2.push(`<!--]-->`);
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
    const teamClusters = derived(() => data.quotas.rows.map((r) => ({ cluster_id: r.cluster_id, cluster_name: r.cluster_name })));
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
                $$renderer4.push(` `);
                if (Tabs_trigger) {
                  $$renderer4.push("<!--[-->");
                  Tabs_trigger($$renderer4, {
                    value: "networks",
                    children: ($$renderer5) => {
                      $$renderer5.push(`<!---->Networks`);
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
          $$renderer3.push(` `);
          if (Tabs_content) {
            $$renderer3.push("<!--[-->");
            Tabs_content($$renderer3, {
              value: "networks",
              children: ($$renderer4) => {
                $$renderer4.push(`<p class="text-muted-foreground text-[13px] mt-4 mb-4">Per-cluster SDN VNet and legacy-bridge visibility for this team. Legacy
      bridges are granted by default; SDN VNets must be granted explicitly.</p> `);
                if (data.loadError) {
                  $$renderer4.push("<!--[0-->");
                  $$renderer4.push(`<p class="text-destructive text-[14px]">Couldn't load cluster data. Refresh the page to retry.</p>`);
                } else {
                  $$renderer4.push("<!--[-1-->");
                  NetworksTab($$renderer4, { teamId: data.teamId, clusters: teamClusters() });
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
//# sourceMappingURL=_page.svelte-Cz9bfPrq.js.map
