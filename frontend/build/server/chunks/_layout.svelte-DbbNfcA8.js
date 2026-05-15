import { d as derived, c as store_get, f as ensure_array_like, h as attr, j as attr_class, k as stringify, l as escape_html, m as unsubscribe_stores, n as spread_props, o as attributes, p as clsx, q as hasContext, r as getContext, t as setContext, w as run, x as attr_style, y as bind_props, z as props_id } from './renderer-5OqEGBJa.js';
import { p as page } from './stores-C0P6ZS0h.js';
import 'clsx';
import { I as Icon, B as Button, c as cn$1 } from './button-B5bCAdGN.js';
import { K as Key_round } from './key-round-DOkjH07J.js';
import { K as Key } from './key-DpZvoJoP.js';
import { i as invalidateAll, g as goto } from './client-BLBuBvl1.js';
import { D as Dropdown_menu, a as Dropdown_menu_trigger, b as Dropdown_menu_content, c as Dropdown_menu_item } from './dropdown-menu-trigger-D8Q6pE1W.js';
import { D as Dropdown_menu_separator } from './dropdown-menu-separator-vPMSiDH6.js';
import { t as theme, S as Sun, M as Moon, a as Monitor } from './monitor-BN7RWZma.js';
import { P as Popover, a as Popover_trigger, b as Popover_content } from './popover-trigger-Ddu4tViI.js';
import { C as Command, a as Command_input, b as Command_list, c as Command_empty, d as Command_group, e as Command_item } from './command-list-DGKf3chc.js';
import '@sveltejs/kit/internal';
import './root-BZo_tL0Z.js';
import '@sveltejs/kit/internal/server';
import './state.svelte-Bqwbw8qw.js';
import { D as Dialog, a as Dialog_content, b as Dialog_close } from './dialog-content-BmZR8ATi.js';
import { D as DialogTriggerState, a as Dialog_overlay, b as Dialog_title } from './dialog-overlay-CKQuveke.js';
import { c as createId, b as boxWith$1, m as mergeProps } from './input-CVUkBx6i.js';
import { P as Portal } from './scroll-lock-BXSbnLUA.js';
import { X } from './x-hAU9CgJu.js';
import { a as api } from './client2-vvZGy19D.js';
import { S as SonnerState, t as toastState, c as cn } from './toast-state.svelte-BaJ56aYt.js';
import { M as MediaQuery, c as createSubscriber } from './is-DeZ4WIS2.js';
import { L as Loader_circle } from './loader-circle-DbKsF1vv.js';
import { T as Triangle_alert } from './triangle-alert-BZ_xtVFE.js';
import 'tailwind-merge';
import './index-Siz_BmGa.js';
import './noop-n4I-x7yK.js';
import './popper-layer-force-mount-DItOXSN8.js';
import './check-DYbUlAJR.js';
import './clone-BIspTav0.js';
import './sr-only-styles-BPX-4PGe.js';

function User($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["path", { "d": "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" }],
    ["circle", { "cx": "12", "cy": "7", "r": "4" }]
  ];
  Icon($$renderer, spread_props([{ name: "user" }, props, { iconNode }]));
}
function External_link($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["path", { "d": "M15 3h6v6" }],
    ["path", { "d": "M10 14 21 3" }],
    [
      "path",
      {
        "d": "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"
      }
    ]
  ];
  Icon($$renderer, spread_props([{ name: "external-link" }, props, { iconNode }]));
}
function Users($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["path", { "d": "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" }],
    ["path", { "d": "M16 3.128a4 4 0 0 1 0 7.744" }],
    ["path", { "d": "M22 21v-2a4 4 0 0 0-3-3.87" }],
    ["circle", { "cx": "9", "cy": "7", "r": "4" }]
  ];
  Icon($$renderer, spread_props([{ name: "users" }, props, { iconNode }]));
}
function Users_round($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["path", { "d": "M18 21a8 8 0 0 0-16 0" }],
    ["circle", { "cx": "10", "cy": "8", "r": "5" }],
    ["path", { "d": "M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3" }]
  ];
  Icon($$renderer, spread_props([{ name: "users-round" }, props, { iconNode }]));
}
function Server($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    [
      "rect",
      {
        "width": "20",
        "height": "8",
        "x": "2",
        "y": "2",
        "rx": "2",
        "ry": "2"
      }
    ],
    [
      "rect",
      {
        "width": "20",
        "height": "8",
        "x": "2",
        "y": "14",
        "rx": "2",
        "ry": "2"
      }
    ],
    ["line", { "x1": "6", "x2": "6.01", "y1": "6", "y2": "6" }],
    ["line", { "x1": "6", "x2": "6.01", "y1": "18", "y2": "18" }]
  ];
  Icon($$renderer, spread_props([{ name: "server" }, props, { iconNode }]));
}
function List_checks($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["path", { "d": "M13 5h8" }],
    ["path", { "d": "M13 12h8" }],
    ["path", { "d": "M13 19h8" }],
    ["path", { "d": "m3 17 2 2 4-4" }],
    ["path", { "d": "m3 7 2 2 4-4" }]
  ];
  Icon($$renderer, spread_props([{ name: "list-checks" }, props, { iconNode }]));
}
function History($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    [
      "path",
      { "d": "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" }
    ],
    ["path", { "d": "M3 3v5h5" }],
    ["path", { "d": "M12 7v5l4 2" }]
  ];
  Icon($$renderer, spread_props([{ name: "history" }, props, { iconNode }]));
}
function Sidebar($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let { user } = $$props;
    const resourceItems = [
      { href: "/inventory", label: "Inventory", icon: List_checks },
      { href: "/audit", label: "Audit log", icon: History }
    ];
    const accountItems = [
      { href: "/profile", label: "Profile", icon: User },
      { href: "/profile/ssh-keys", label: "SSH keys", icon: Key_round },
      { href: "/profile/tokens", label: "API tokens", icon: Key }
    ];
    const adminItems = [
      { href: "/admin/users", label: "Users", icon: Users },
      { href: "/admin/teams", label: "Teams", icon: Users_round },
      { href: "/admin/clusters", label: "Clusters", icon: Server }
    ];
    const docsItem = {
      href: "/api/v1/docs",
      label: "API docs",
      icon: External_link,
      external: true
    };
    function isActive(href, pathname) {
      if (href === pathname) return true;
      return pathname.startsWith(href + "/");
    }
    $$renderer2.push(`<aside class="bg-muted/40 hidden h-full w-14 shrink-0 border-r border-border lg:flex lg:w-60 lg:flex-col" aria-label="Primary navigation"><nav class="flex flex-1 flex-col gap-6 px-2 py-4 lg:px-3"><div><h2 class="text-muted-foreground mb-1 hidden px-3 text-[11px] font-semibold uppercase tracking-wider lg:block">Resources</h2> <ul class="flex flex-col gap-0.5"><!--[-->`);
    const each_array = ensure_array_like(resourceItems);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let item = each_array[$$index];
      const active = isActive(item.href, store_get($$store_subs ??= {}, "$page", page).url.pathname);
      $$renderer2.push(`<li class="relative">`);
      if (active) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<span aria-hidden="true" class="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-primary"></span>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <a${attr("href", item.href)}${attr_class(`flex h-9 items-center gap-2 rounded-md px-3 text-[13px] font-medium transition-colors hover:bg-muted ${stringify(active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}`)}${attr("aria-current", active ? "page" : void 0)}>`);
      if (item.icon) {
        $$renderer2.push("<!--[-->");
        item.icon($$renderer2, {
          class: `size-4 shrink-0 ${stringify(active ? "text-primary" : "")}`,
          "aria-hidden": "true"
        });
        $$renderer2.push("<!--]-->");
      } else {
        $$renderer2.push("<!--[!-->");
        $$renderer2.push("<!--]-->");
      }
      $$renderer2.push(` <span class="hidden lg:inline">${escape_html(item.label)}</span></a></li>`);
    }
    $$renderer2.push(`<!--]--></ul></div> <div><h2 class="text-muted-foreground mb-1 hidden px-3 text-[11px] font-semibold uppercase tracking-wider lg:block">Account</h2> <ul class="flex flex-col gap-0.5"><!--[-->`);
    const each_array_1 = ensure_array_like(accountItems);
    for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
      let item = each_array_1[$$index_1];
      const active = isActive(item.href, store_get($$store_subs ??= {}, "$page", page).url.pathname);
      $$renderer2.push(`<li class="relative">`);
      if (active) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<span aria-hidden="true" class="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-primary"></span>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <a${attr("href", item.href)}${attr_class(`flex h-9 items-center gap-2 rounded-md px-3 text-[13px] font-medium transition-colors hover:bg-muted ${stringify(active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}`)}${attr("aria-current", active ? "page" : void 0)}>`);
      if (item.icon) {
        $$renderer2.push("<!--[-->");
        item.icon($$renderer2, {
          class: `size-4 shrink-0 ${stringify(active ? "text-primary" : "")}`,
          "aria-hidden": "true"
        });
        $$renderer2.push("<!--]-->");
      } else {
        $$renderer2.push("<!--[!-->");
        $$renderer2.push("<!--]-->");
      }
      $$renderer2.push(` <span class="hidden lg:inline">${escape_html(item.label)}</span></a></li>`);
    }
    $$renderer2.push(`<!--]--> <li class="relative"><a${attr("href", docsItem.href)} target="_blank" rel="noopener noreferrer" class="flex h-9 items-center gap-2 rounded-md px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">`);
    if (docsItem.icon) {
      $$renderer2.push("<!--[-->");
      docsItem.icon($$renderer2, { class: "size-4 shrink-0", "aria-hidden": "true" });
      $$renderer2.push("<!--]-->");
    } else {
      $$renderer2.push("<!--[!-->");
      $$renderer2.push("<!--]-->");
    }
    $$renderer2.push(` <span class="hidden lg:inline">${escape_html(docsItem.label)}</span></a></li></ul></div> `);
    if (user?.is_admin) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div><h2 class="text-muted-foreground mb-1 hidden px-3 text-[11px] font-semibold uppercase tracking-wider lg:block">Admin</h2> <ul class="flex flex-col gap-0.5"><!--[-->`);
      const each_array_2 = ensure_array_like(adminItems);
      for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
        let item = each_array_2[$$index_2];
        const active = isActive(item.href, store_get($$store_subs ??= {}, "$page", page).url.pathname);
        $$renderer2.push(`<li class="relative">`);
        if (active) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<span aria-hidden="true" class="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-primary"></span>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> <a${attr("href", item.href)}${attr_class(`flex h-9 items-center gap-2 rounded-md px-3 text-[13px] font-medium transition-colors hover:bg-muted ${stringify(active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}`)}${attr("aria-current", active ? "page" : void 0)}>`);
        if (item.icon) {
          $$renderer2.push("<!--[-->");
          item.icon($$renderer2, {
            class: `size-4 shrink-0 ${stringify(active ? "text-primary" : "")}`,
            "aria-hidden": "true"
          });
          $$renderer2.push("<!--]-->");
        } else {
          $$renderer2.push("<!--[!-->");
          $$renderer2.push("<!--]-->");
        }
        $$renderer2.push(` <span class="hidden lg:inline">${escape_html(item.label)}</span></a></li>`);
      }
      $$renderer2.push(`<!--]--></ul></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></nav></aside>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
function Dialog_trigger($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const uid = props_id($$renderer2);
    let {
      id = createId(uid),
      ref = null,
      children,
      child,
      disabled = false,
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    const triggerState = DialogTriggerState.create({
      id: boxWith$1(() => id),
      ref: boxWith$1(() => ref, (v) => ref = v),
      disabled: boxWith$1(() => Boolean(disabled))
    });
    const mergedProps = derived(() => mergeProps(restProps, triggerState.props));
    if (child) {
      $$renderer2.push("<!--[0-->");
      child($$renderer2, { props: mergedProps() });
      $$renderer2.push(`<!---->`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<button${attributes({ ...mergedProps() })}>`);
      children?.($$renderer2);
      $$renderer2.push(`<!----></button>`);
    }
    $$renderer2.push(`<!--]-->`);
    bind_props($$props, { ref });
  });
}
function ThemeToggle($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    Dropdown_menu($$renderer2, {
      children: ($$renderer3) => {
        {
          let child = function($$renderer4, { props }) {
            Button($$renderer4, spread_props([
              props,
              {
                variant: "ghost",
                size: "icon",
                "aria-label": "Toggle theme",
                children: ($$renderer5) => {
                  if (theme.mode === "light") {
                    $$renderer5.push("<!--[0-->");
                    Sun($$renderer5, { "aria-hidden": "true" });
                  } else if (theme.mode === "dark") {
                    $$renderer5.push("<!--[1-->");
                    Moon($$renderer5, { "aria-hidden": "true" });
                  } else {
                    $$renderer5.push("<!--[-1-->");
                    Monitor($$renderer5, { "aria-hidden": "true" });
                  }
                  $$renderer5.push(`<!--]-->`);
                },
                $$slots: { default: true }
              }
            ]));
          };
          Dropdown_menu_trigger($$renderer3, { child, $$slots: { child: true } });
        }
        $$renderer3.push(`<!----> `);
        Dropdown_menu_content($$renderer3, {
          align: "end",
          children: ($$renderer4) => {
            Dropdown_menu_item($$renderer4, {
              onSelect: () => theme.setMode("light"),
              children: ($$renderer5) => {
                Sun($$renderer5, { "aria-hidden": "true" });
                $$renderer5.push(`<!----> Light`);
              },
              $$slots: { default: true }
            });
            $$renderer4.push(`<!----> `);
            Dropdown_menu_item($$renderer4, {
              onSelect: () => theme.setMode("dark"),
              children: ($$renderer5) => {
                Moon($$renderer5, { "aria-hidden": "true" });
                $$renderer5.push(`<!----> Dark`);
              },
              $$slots: { default: true }
            });
            $$renderer4.push(`<!----> `);
            Dropdown_menu_item($$renderer4, {
              onSelect: () => theme.setMode("system"),
              children: ($$renderer5) => {
                Monitor($$renderer5, { "aria-hidden": "true" });
                $$renderer5.push(`<!----> System`);
              },
              $$slots: { default: true }
            });
            $$renderer4.push(`<!---->`);
          },
          $$slots: { default: true }
        });
        $$renderer3.push(`<!---->`);
      },
      $$slots: { default: true }
    });
  });
}
function Chevrons_up_down($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["path", { "d": "m7 15 5 5 5-5" }],
    ["path", { "d": "m7 9 5-5 5 5" }]
  ];
  Icon($$renderer, spread_props([{ name: "chevrons-up-down" }, props, { iconNode }]));
}
const KEY = "proxmox-gui:cluster-context";
const ALL_CLUSTERS = "all";
function setClusterContext(v) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, v === ALL_CLUSTERS ? ALL_CLUSTERS : String(v));
}
function ClusterContextPicker($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let { clusters, class: className = "" } = $$props;
    let open = false;
    let value = ALL_CLUSTERS;
    const label = derived(() => value === ALL_CLUSTERS ? "All clusters" : clusters.find((c) => c.id === value)?.name ?? `Cluster ${value}`);
    function choose(v) {
      value = v;
      setClusterContext(v);
      open = false;
      const url = new URL(store_get($$store_subs ??= {}, "$page", page).url);
      if (v === ALL_CLUSTERS) {
        url.searchParams.delete("cluster");
      } else {
        url.searchParams.set("cluster", String(v));
      }
      goto(url.pathname + url.search, {});
    }
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      if (Popover) {
        $$renderer3.push("<!--[-->");
        Popover($$renderer3, {
          get open() {
            return open;
          },
          set open($$value) {
            open = $$value;
            $$settled = false;
          },
          children: ($$renderer4) => {
            {
              let child = function($$renderer5, { props }) {
                Button($$renderer5, spread_props([
                  {
                    variant: "outline",
                    class: `w-[220px] justify-between h-9 ${stringify(className)}`
                  },
                  props,
                  {
                    "aria-label": "Cluster context",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<span class="truncate text-[14px]">${escape_html(label())}</span> `);
                      Chevrons_up_down($$renderer6, {
                        class: "size-4 text-muted-foreground shrink-0",
                        "aria-hidden": "true"
                      });
                      $$renderer6.push(`<!---->`);
                    },
                    $$slots: { default: true }
                  }
                ]));
              };
              if (Popover_trigger) {
                $$renderer4.push("<!--[-->");
                Popover_trigger($$renderer4, { child, $$slots: { child: true } });
                $$renderer4.push("<!--]-->");
              } else {
                $$renderer4.push("<!--[!-->");
                $$renderer4.push("<!--]-->");
              }
            }
            $$renderer4.push(` `);
            if (Popover_content) {
              $$renderer4.push("<!--[-->");
              Popover_content($$renderer4, {
                class: "w-[260px] p-0",
                align: "start",
                children: ($$renderer5) => {
                  if (Command) {
                    $$renderer5.push("<!--[-->");
                    Command($$renderer5, {
                      children: ($$renderer6) => {
                        if (Command_input) {
                          $$renderer6.push("<!--[-->");
                          Command_input($$renderer6, { placeholder: "Filter clusters…" });
                          $$renderer6.push("<!--]-->");
                        } else {
                          $$renderer6.push("<!--[!-->");
                          $$renderer6.push("<!--]-->");
                        }
                        $$renderer6.push(` `);
                        if (Command_list) {
                          $$renderer6.push("<!--[-->");
                          Command_list($$renderer6, {
                            children: ($$renderer7) => {
                              if (Command_empty) {
                                $$renderer7.push("<!--[-->");
                                Command_empty($$renderer7, {
                                  children: ($$renderer8) => {
                                    $$renderer8.push(`<!---->No clusters registered. Ask your administrator.`);
                                  },
                                  $$slots: { default: true }
                                });
                                $$renderer7.push("<!--]-->");
                              } else {
                                $$renderer7.push("<!--[!-->");
                                $$renderer7.push("<!--]-->");
                              }
                              $$renderer7.push(` `);
                              if (Command_group) {
                                $$renderer7.push("<!--[-->");
                                Command_group($$renderer7, {
                                  children: ($$renderer8) => {
                                    if (Command_item) {
                                      $$renderer8.push("<!--[-->");
                                      Command_item($$renderer8, {
                                        value: ALL_CLUSTERS,
                                        onSelect: () => choose(ALL_CLUSTERS),
                                        children: ($$renderer9) => {
                                          $$renderer9.push(`<!---->All clusters`);
                                        },
                                        $$slots: { default: true }
                                      });
                                      $$renderer8.push("<!--]-->");
                                    } else {
                                      $$renderer8.push("<!--[!-->");
                                      $$renderer8.push("<!--]-->");
                                    }
                                    $$renderer8.push(` <!--[-->`);
                                    const each_array = ensure_array_like(clusters);
                                    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
                                      let c = each_array[$$index];
                                      if (Command_item) {
                                        $$renderer8.push("<!--[-->");
                                        Command_item($$renderer8, {
                                          value: String(c.id),
                                          onSelect: () => choose(c.id),
                                          children: ($$renderer9) => {
                                            $$renderer9.push(`<!---->${escape_html(c.name)}`);
                                          },
                                          $$slots: { default: true }
                                        });
                                        $$renderer8.push("<!--]-->");
                                      } else {
                                        $$renderer8.push("<!--[!-->");
                                        $$renderer8.push("<!--]-->");
                                      }
                                    }
                                    $$renderer8.push(`<!--]-->`);
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
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
function Sheet($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { open = false, $$slots, $$events, ...restProps } = $$props;
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      if (Dialog) {
        $$renderer3.push("<!--[-->");
        Dialog($$renderer3, spread_props([
          restProps,
          {
            get open() {
              return open;
            },
            set open($$value) {
              open = $$value;
              $$settled = false;
            }
          }
        ]));
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
    bind_props($$props, { open });
  });
}
function Sheet_portal($$renderer, $$props) {
  let { $$slots, $$events, ...restProps } = $$props;
  if (Portal) {
    $$renderer.push("<!--[-->");
    Portal($$renderer, spread_props([restProps]));
    $$renderer.push("<!--]-->");
  } else {
    $$renderer.push("<!--[!-->");
    $$renderer.push("<!--]-->");
  }
}
function Sheet_trigger($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { ref = null, $$slots, $$events, ...restProps } = $$props;
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      if (Dialog_trigger) {
        $$renderer3.push("<!--[-->");
        Dialog_trigger($$renderer3, spread_props([
          { "data-slot": "sheet-trigger" },
          restProps,
          {
            get ref() {
              return ref;
            },
            set ref($$value) {
              ref = $$value;
              $$settled = false;
            }
          }
        ]));
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
    bind_props($$props, { ref });
  });
}
function Sheet_overlay($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      ref = null,
      class: className,
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      if (Dialog_overlay) {
        $$renderer3.push("<!--[-->");
        Dialog_overlay($$renderer3, spread_props([
          {
            "data-slot": "sheet-overlay",
            class: cn$1("bg-black/10 supports-backdrop-filter:backdrop-blur-xs fixed inset-0 z-50", className)
          },
          restProps,
          {
            get ref() {
              return ref;
            },
            set ref($$value) {
              ref = $$value;
              $$settled = false;
            }
          }
        ]));
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
    bind_props($$props, { ref });
  });
}
function Sheet_content($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      ref = null,
      class: className,
      side = "right",
      showCloseButton = true,
      portalProps,
      children,
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      Sheet_portal($$renderer3, spread_props([
        portalProps,
        {
          children: ($$renderer4) => {
            Sheet_overlay($$renderer4, {});
            $$renderer4.push(`<!----> `);
            if (Dialog_content) {
              $$renderer4.push("<!--[-->");
              Dialog_content($$renderer4, spread_props([
                {
                  "data-slot": "sheet-content",
                  "data-side": side,
                  class: cn$1("bg-popover text-popover-foreground fixed z-50 flex flex-col gap-4 bg-clip-padding text-sm shadow-lg transition duration-200 ease-in-out data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:border-t data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-r data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-l data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-[side=bottom]:data-open:slide-in-from-bottom-10 data-[side=left]:data-open:slide-in-from-left-10 data-[side=right]:data-open:slide-in-from-right-10 data-[side=top]:data-open:slide-in-from-top-10 data-closed:animate-out data-closed:fade-out-0 data-[side=bottom]:data-closed:slide-out-to-bottom-10 data-[side=left]:data-closed:slide-out-to-left-10 data-[side=right]:data-closed:slide-out-to-right-10 data-[side=top]:data-closed:slide-out-to-top-10", className)
                },
                restProps,
                {
                  get ref() {
                    return ref;
                  },
                  set ref($$value) {
                    ref = $$value;
                    $$settled = false;
                  },
                  children: ($$renderer5) => {
                    children?.($$renderer5);
                    $$renderer5.push(`<!----> `);
                    if (showCloseButton) {
                      $$renderer5.push("<!--[0-->");
                      {
                        let child = function($$renderer6, { props }) {
                          Button($$renderer6, spread_props([
                            {
                              variant: "ghost",
                              class: "absolute top-3 right-3",
                              size: "icon-sm"
                            },
                            props,
                            {
                              children: ($$renderer7) => {
                                X($$renderer7, {});
                                $$renderer7.push(`<!----> <span class="sr-only">Close</span>`);
                              },
                              $$slots: { default: true }
                            }
                          ]));
                        };
                        if (Dialog_close) {
                          $$renderer5.push("<!--[-->");
                          Dialog_close($$renderer5, { "data-slot": "sheet-close", child, $$slots: { child: true } });
                          $$renderer5.push("<!--]-->");
                        } else {
                          $$renderer5.push("<!--[!-->");
                          $$renderer5.push("<!--]-->");
                        }
                      }
                    } else {
                      $$renderer5.push("<!--[-1-->");
                    }
                    $$renderer5.push(`<!--]-->`);
                  },
                  $$slots: { default: true }
                }
              ]));
              $$renderer4.push("<!--]-->");
            } else {
              $$renderer4.push("<!--[!-->");
              $$renderer4.push("<!--]-->");
            }
          },
          $$slots: { default: true }
        }
      ]));
    }
    do {
      $$settled = true;
      $$inner_renderer = $$renderer2.copy();
      $$render_inner($$inner_renderer);
    } while (!$$settled);
    $$renderer2.subsume($$inner_renderer);
    bind_props($$props, { ref });
  });
}
function Sheet_header($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      ref = null,
      class: className,
      children,
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    $$renderer2.push(`<div${attributes({
      "data-slot": "sheet-header",
      class: clsx(cn$1("gap-0.5 p-4 flex flex-col", className)),
      ...restProps
    })}>`);
    children?.($$renderer2);
    $$renderer2.push(`<!----></div>`);
    bind_props($$props, { ref });
  });
}
function Sheet_title($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      ref = null,
      class: className,
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      if (Dialog_title) {
        $$renderer3.push("<!--[-->");
        Dialog_title($$renderer3, spread_props([
          {
            "data-slot": "sheet-title",
            class: cn$1("text-foreground text-base font-medium", className)
          },
          restProps,
          {
            get ref() {
              return ref;
            },
            set ref($$value) {
              ref = $$value;
              $$settled = false;
            }
          }
        ]));
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
    bind_props($$props, { ref });
  });
}
const bars = Array(12).fill(0);
function Loader($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { visible, class: className } = $$props;
    $$renderer2.push(`<div${attr_class(clsx(["sonner-loading-wrapper", className].filter(Boolean).join(" ")))}${attr("data-visible", visible)}><div class="sonner-spinner"><!--[-->`);
    const each_array = ensure_array_like(bars);
    for (let i = 0, $$length = each_array.length; i < $$length; i++) {
      each_array[i];
      $$renderer2.push(`<div class="sonner-loading-bar"></div>`);
    }
    $$renderer2.push(`<!--]--></div></div>`);
  });
}
const defaultWindow$2 = void 0;
function getActiveElement$2(document2) {
  let activeElement = document2.activeElement;
  while (activeElement?.shadowRoot) {
    const node = activeElement.shadowRoot.activeElement;
    if (node === activeElement)
      break;
    else
      activeElement = node;
  }
  return activeElement;
}
let ActiveElement$2 = class ActiveElement {
  #document;
  #subscribe;
  constructor(options = {}) {
    const { window: window2 = defaultWindow$2, document: document2 = window2?.document } = options;
    if (window2 === void 0) return;
    this.#document = document2;
    this.#subscribe = createSubscriber();
  }
  get current() {
    this.#subscribe?.();
    if (!this.#document) return null;
    return getActiveElement$2(this.#document);
  }
};
new ActiveElement$2();
class Context {
  #name;
  #key;
  /**
   * @param name The name of the context.
   * This is used for generating the context key and error messages.
   */
  constructor(name) {
    this.#name = name;
    this.#key = Symbol(name);
  }
  /**
   * The key used to get and set the context.
   *
   * It is not recommended to use this value directly.
   * Instead, use the methods provided by this class.
   */
  get key() {
    return this.#key;
  }
  /**
   * Checks whether this has been set in the context of a parent component.
   *
   * Must be called during component initialisation.
   */
  exists() {
    return hasContext(this.#key);
  }
  /**
   * Retrieves the context that belongs to the closest parent component.
   *
   * Must be called during component initialisation.
   *
   * @throws An error if the context does not exist.
   */
  get() {
    const context = getContext(this.#key);
    if (context === void 0) {
      throw new Error(`Context "${this.#name}" not found`);
    }
    return context;
  }
  /**
   * Retrieves the context that belongs to the closest parent component,
   * or the given fallback value if the context does not exist.
   *
   * Must be called during component initialisation.
   */
  getOr(fallback) {
    const context = getContext(this.#key);
    if (context === void 0) {
      return fallback;
    }
    return context;
  }
  /**
   * Associates the given value with the current component and returns it.
   *
   * Must be called during component initialisation.
   */
  set(context) {
    return setContext(this.#key, context);
  }
}
const sonnerContext = new Context("<Toaster/>");
function isAction(action) {
  return action.label !== void 0;
}
const TOAST_LIFETIME$1 = 4e3;
const GAP$1 = 14;
const TIME_BEFORE_UNMOUNT = 200;
const DEFAULT_TOAST_CLASSES = {
  toast: "",
  title: "",
  description: "",
  loader: "",
  closeButton: "",
  cancelButton: "",
  actionButton: "",
  action: "",
  warning: "",
  error: "",
  success: "",
  default: "",
  info: "",
  loading: ""
};
function Toast($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      toast,
      index,
      expanded,
      invert: invertFromToaster,
      position,
      visibleToasts,
      expandByDefault,
      closeButton: closeButtonFromToaster,
      interacting,
      cancelButtonStyle = "",
      actionButtonStyle = "",
      duration: durationFromToaster,
      descriptionClass = "",
      classes: classesProp,
      unstyled = false,
      loadingIcon,
      successIcon,
      errorIcon,
      warningIcon,
      closeIcon,
      infoIcon,
      defaultRichColors = false,
      swipeDirections: swipeDirectionsProp,
      closeButtonAriaLabel,
      pauseWhenPageIsHidden,
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    const defaultClasses = { ...DEFAULT_TOAST_CLASSES };
    let mounted = false;
    let removed = false;
    let swiping = false;
    let swipeOut = false;
    let isSwiped = false;
    let offsetBeforeRemove = 0;
    let initialHeight = 0;
    toast.duration || durationFromToaster || TOAST_LIFETIME$1;
    let swipeOutDirection = null;
    const isFront = derived(() => index === 0);
    const isVisible = derived(() => index + 1 <= visibleToasts);
    const toastType = derived(() => toast.type);
    const dismissible = derived(() => toast.dismissible !== void 0 ? toast.dismissible !== false : toast.dismissable !== false);
    const toastClass = derived(() => toast.class || "");
    const toastDescriptionClass = derived(() => toast.descriptionClass || "");
    const heightIndex = derived(() => toastState.heights.findIndex((height) => height.toastId === toast.id) || 0);
    const closeButton = derived(() => toast.closeButton ?? closeButtonFromToaster);
    const coords = derived(() => position.split("-"));
    const toastsHeightBefore = derived(() => toastState.heights.reduce(
      (prev, curr, reducerIndex) => {
        if (reducerIndex >= heightIndex()) return prev;
        return prev + curr.height;
      },
      0
    ));
    const invert = derived(() => toast.invert || invertFromToaster);
    const disabled = derived(() => toastType() === "loading");
    const classes = derived(() => ({ ...defaultClasses, ...classesProp }));
    const offset = derived(() => Math.round(heightIndex() * GAP$1 + toastsHeightBefore()));
    function deleteToast() {
      removed = true;
      offsetBeforeRemove = offset();
      toastState.removeHeight(toast.id);
      setTimeout(
        () => {
          toastState.remove(toast.id);
        },
        TIME_BEFORE_UNMOUNT
      );
    }
    const icon = derived(() => {
      if (toast.icon) return toast.icon;
      if (toastType() === "success") return successIcon;
      if (toastType() === "error") return errorIcon;
      if (toastType() === "warning") return warningIcon;
      if (toastType() === "info") return infoIcon;
      if (toastType() === "loading") return loadingIcon;
      return null;
    });
    function LoadingIcon($$renderer3) {
      if (loadingIcon) {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<div${attr_class(clsx(cn(classes()?.loader, toast?.classes?.loader, "sonner-loader")))}${attr("data-visible", toastType() === "loading")}>`);
        loadingIcon($$renderer3);
        $$renderer3.push(`<!----></div>`);
      } else {
        $$renderer3.push("<!--[-1-->");
        Loader($$renderer3, {
          class: cn(classes()?.loader, toast.classes?.loader),
          visible: toastType() === "loading"
        });
      }
      $$renderer3.push(`<!--]-->`);
    }
    $$renderer2.push(`<li${attr("tabindex", 0)}${attr_class(clsx(cn(restProps.class, toastClass(), classes()?.toast, toast?.classes?.toast, classes()?.[toastType()], toast?.classes?.[toastType()])))}${attr("aria-live", toast.important ? "assertive" : "polite")} aria-atomic="true" data-sonner-toast=""${attr("data-rich-colors", toast.richColors ?? defaultRichColors)}${attr("data-styled", !(toast.component || toast.unstyled || unstyled))}${attr("data-mounted", mounted)}${attr("data-promise", Boolean(toast.promise))}${attr("data-swiped", isSwiped)}${attr("data-removed", removed)}${attr("data-visible", isVisible())}${attr("data-y-position", coords()[0])}${attr("data-x-position", coords()[1])}${attr("data-index", index)}${attr("data-front", isFront())}${attr("data-swiping", swiping)}${attr("data-dismissible", dismissible())}${attr("data-type", toastType())}${attr("data-invert", invert())}${attr("data-swipe-out", swipeOut)}${attr("data-swipe-direction", swipeOutDirection)}${attr("data-expanded", Boolean(expanded || expandByDefault && mounted))}${attr_style(`${restProps.style} ${toast.style}`, {
      "--index": index,
      "--toasts-before": index,
      "--z-index": toastState.toasts.length - index,
      "--offset": `${removed ? offsetBeforeRemove : offset()}px`,
      "--initial-height": expandByDefault ? "auto" : `${initialHeight}px`
    })}>`);
    if (closeButton() && !toast.component && toastType() !== "loading" && closeIcon !== null) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<button${attr("aria-label", closeButtonAriaLabel)}${attr("data-disabled", disabled())} data-close-button=""${attr_class(clsx(cn(classes()?.closeButton, toast?.classes?.closeButton)))}>`);
      closeIcon?.($$renderer2);
      $$renderer2.push(`<!----></button>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (toast.component) {
      $$renderer2.push("<!--[0-->");
      const Component = toast.component;
      if (Component) {
        $$renderer2.push("<!--[-->");
        Component($$renderer2, spread_props([toast.componentProps, { closeToast: deleteToast }]));
        $$renderer2.push("<!--]-->");
      } else {
        $$renderer2.push("<!--[!-->");
        $$renderer2.push("<!--]-->");
      }
    } else {
      $$renderer2.push("<!--[-1-->");
      if ((toastType() || toast.icon || toast.promise) && toast.icon !== null && (icon() !== null || toast.icon)) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div data-icon=""${attr_class(clsx(cn(classes()?.icon, toast?.classes?.icon)))}>`);
        if (toast.promise || toastType() === "loading") {
          $$renderer2.push("<!--[0-->");
          if (toast.icon) {
            $$renderer2.push("<!--[0-->");
            if (toast.icon) {
              $$renderer2.push("<!--[-->");
              toast.icon($$renderer2, {});
              $$renderer2.push("<!--]-->");
            } else {
              $$renderer2.push("<!--[!-->");
              $$renderer2.push("<!--]-->");
            }
          } else {
            $$renderer2.push("<!--[-1-->");
            LoadingIcon($$renderer2);
          }
          $$renderer2.push(`<!--]-->`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> `);
        if (toast.type !== "loading") {
          $$renderer2.push("<!--[0-->");
          if (toast.icon) {
            $$renderer2.push("<!--[0-->");
            if (toast.icon) {
              $$renderer2.push("<!--[-->");
              toast.icon($$renderer2, {});
              $$renderer2.push("<!--]-->");
            } else {
              $$renderer2.push("<!--[!-->");
              $$renderer2.push("<!--]-->");
            }
          } else if (toastType() === "success") {
            $$renderer2.push("<!--[1-->");
            successIcon?.($$renderer2);
            $$renderer2.push(`<!---->`);
          } else if (toastType() === "error") {
            $$renderer2.push("<!--[2-->");
            errorIcon?.($$renderer2);
            $$renderer2.push(`<!---->`);
          } else if (toastType() === "warning") {
            $$renderer2.push("<!--[3-->");
            warningIcon?.($$renderer2);
            $$renderer2.push(`<!---->`);
          } else if (toastType() === "info") {
            $$renderer2.push("<!--[4-->");
            infoIcon?.($$renderer2);
            $$renderer2.push(`<!---->`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]-->`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <div data-content=""${attr_class(clsx(cn(classes()?.content, toast?.classes?.content)))}><div data-title=""${attr_class(clsx(cn(classes()?.title, toast?.classes?.title)))}>`);
      if (toast.title) {
        $$renderer2.push("<!--[0-->");
        if (typeof toast.title !== "string") {
          $$renderer2.push("<!--[0-->");
          const Title = toast.title;
          if (Title) {
            $$renderer2.push("<!--[-->");
            Title($$renderer2, spread_props([toast.componentProps]));
            $$renderer2.push("<!--]-->");
          } else {
            $$renderer2.push("<!--[!-->");
            $$renderer2.push("<!--]-->");
          }
        } else {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`${escape_html(toast.title)}`);
        }
        $$renderer2.push(`<!--]-->`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div> `);
      if (toast.description) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div data-description=""${attr_class(clsx(cn(descriptionClass, toastDescriptionClass(), classes()?.description, toast.classes?.description)))}>`);
        if (typeof toast.description !== "string") {
          $$renderer2.push("<!--[0-->");
          const Description = toast.description;
          if (Description) {
            $$renderer2.push("<!--[-->");
            Description($$renderer2, spread_props([toast.componentProps]));
            $$renderer2.push("<!--]-->");
          } else {
            $$renderer2.push("<!--[!-->");
            $$renderer2.push("<!--]-->");
          }
        } else {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`${escape_html(toast.description)}`);
        }
        $$renderer2.push(`<!--]--></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div> `);
      if (toast.cancel) {
        $$renderer2.push("<!--[0-->");
        if (typeof toast.cancel === "function") {
          $$renderer2.push("<!--[0-->");
          if (toast.cancel) {
            $$renderer2.push("<!--[-->");
            toast.cancel($$renderer2, {});
            $$renderer2.push("<!--]-->");
          } else {
            $$renderer2.push("<!--[!-->");
            $$renderer2.push("<!--]-->");
          }
        } else if (isAction(toast.cancel)) {
          $$renderer2.push("<!--[1-->");
          $$renderer2.push(`<button data-button="" data-cancel=""${attr_style(toast.cancelButtonStyle ?? cancelButtonStyle)}${attr_class(clsx(cn(classes()?.cancelButton, toast?.classes?.cancelButton)))}>${escape_html(toast.cancel.label)}</button>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]-->`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (toast.action) {
        $$renderer2.push("<!--[0-->");
        if (typeof toast.action === "function") {
          $$renderer2.push("<!--[0-->");
          if (toast.action) {
            $$renderer2.push("<!--[-->");
            toast.action($$renderer2, {});
            $$renderer2.push("<!--]-->");
          } else {
            $$renderer2.push("<!--[!-->");
            $$renderer2.push("<!--]-->");
          }
        } else if (isAction(toast.action)) {
          $$renderer2.push("<!--[1-->");
          $$renderer2.push(`<button data-button=""${attr_style(toast.actionButtonStyle ?? actionButtonStyle)}${attr_class(clsx(cn(classes()?.actionButton, toast?.classes?.actionButton)))}>${escape_html(toast.action.label)}</button>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]-->`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]-->`);
    }
    $$renderer2.push(`<!--]--></li>`);
  });
}
function SuccessIcon($$renderer) {
  $$renderer.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" height="20" width="20" data-sonner-success-icon=""><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd"></path></svg>`);
}
function ErrorIcon($$renderer) {
  $$renderer.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" height="20" width="20" data-sonner-error-icon=""><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"></path></svg>`);
}
function WarningIcon($$renderer) {
  $$renderer.push(`<svg viewBox="0 0 64 64" fill="currentColor" height="20" width="20" data-sonner-warning-icon="" xmlns="http://www.w3.org/2000/svg"><path d="M32.427,7.987c2.183,0.124 4,1.165 5.096,3.281l17.936,36.208c1.739,3.66 -0.954,8.585 -5.373,8.656l-36.119,0c-4.022,-0.064 -7.322,-4.631 -5.352,-8.696l18.271,-36.207c0.342,-0.65 0.498,-0.838 0.793,-1.179c1.186,-1.375 2.483,-2.111 4.748,-2.063Zm-0.295,3.997c-0.687,0.034 -1.316,0.419 -1.659,1.017c-6.312,11.979 -12.397,24.081 -18.301,36.267c-0.546,1.225 0.391,2.797 1.762,2.863c12.06,0.195 24.125,0.195 36.185,0c1.325,-0.064 2.321,-1.584 1.769,-2.85c-5.793,-12.184 -11.765,-24.286 -17.966,-36.267c-0.366,-0.651 -0.903,-1.042 -1.79,-1.03Z"></path><path d="M33.631,40.581l-3.348,0l-0.368,-16.449l4.1,0l-0.384,16.449Zm-3.828,5.03c0,-0.609 0.197,-1.113 0.592,-1.514c0.396,-0.4 0.935,-0.601 1.618,-0.601c0.684,0 1.223,0.201 1.618,0.601c0.395,0.401 0.593,0.905 0.593,1.514c0,0.587 -0.193,1.078 -0.577,1.473c-0.385,0.395 -0.929,0.593 -1.634,0.593c-0.705,0 -1.249,-0.198 -1.634,-0.593c-0.384,-0.395 -0.576,-0.886 -0.576,-1.473Z"></path></svg>`);
}
function InfoIcon($$renderer) {
  $$renderer.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" height="20" width="20" data-sonner-info-icon=""><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clip-rule="evenodd"></path></svg>`);
}
function CloseIcon($$renderer) {
  $$renderer.push(`<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" data-sonner-close-icon=""><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`);
}
const VISIBLE_TOASTS_AMOUNT = 3;
const VIEWPORT_OFFSET = "24px";
const MOBILE_VIEWPORT_OFFSET = "16px";
const TOAST_LIFETIME = 4e3;
const TOAST_WIDTH = 356;
const GAP = 14;
const DARK = "dark";
const LIGHT = "light";
function getOffsetObject(defaultOffset, mobileOffset) {
  const styles = {};
  [defaultOffset, mobileOffset].forEach((offset, index) => {
    const isMobile = index === 1;
    const prefix = isMobile ? "--mobile-offset" : "--offset";
    const defaultValue = isMobile ? MOBILE_VIEWPORT_OFFSET : VIEWPORT_OFFSET;
    function assignAll(offset2) {
      ["top", "right", "bottom", "left"].forEach((key) => {
        styles[`${prefix}-${key}`] = typeof offset2 === "number" ? `${offset2}px` : offset2;
      });
    }
    if (typeof offset === "number" || typeof offset === "string") {
      assignAll(offset);
    } else if (typeof offset === "object") {
      ["top", "right", "bottom", "left"].forEach((key) => {
        const value = offset[key];
        if (value === void 0) {
          styles[`${prefix}-${key}`] = defaultValue;
        } else {
          styles[`${prefix}-${key}`] = typeof value === "number" ? `${value}px` : value;
        }
      });
    } else {
      assignAll(defaultValue);
    }
  });
  return styles;
}
function Toaster($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    function getInitialTheme(t) {
      if (t !== "system") return t;
      if (typeof window !== "undefined") {
        if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
          return DARK;
        }
        return LIGHT;
      }
      return LIGHT;
    }
    let {
      invert = false,
      position = "bottom-right",
      hotkey = ["altKey", "KeyT"],
      expand = false,
      closeButton = false,
      offset = VIEWPORT_OFFSET,
      mobileOffset = MOBILE_VIEWPORT_OFFSET,
      theme: theme2 = "light",
      richColors = false,
      duration = TOAST_LIFETIME,
      visibleToasts = VISIBLE_TOASTS_AMOUNT,
      toastOptions = {},
      dir = "auto",
      gap = GAP,
      pauseWhenPageIsHidden = false,
      loadingIcon: loadingIconProp,
      successIcon: successIconProp,
      errorIcon: errorIconProp,
      warningIcon: warningIconProp,
      closeIcon: closeIconProp,
      infoIcon: infoIconProp,
      containerAriaLabel = "Notifications",
      class: className,
      closeButtonAriaLabel = "Close toast",
      onblur,
      onfocus,
      onmouseenter,
      onmousemove,
      onmouseleave,
      ondragend,
      onpointerdown,
      onpointerup,
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    function getDocumentDirection() {
      if (dir !== "auto") return dir;
      if (typeof window === "undefined") return "ltr";
      if (typeof document === "undefined") return "ltr";
      const dirAttribute = document.documentElement.getAttribute("dir");
      if (dirAttribute === "auto" || !dirAttribute) {
        run(() => dir = window.getComputedStyle(document.documentElement).direction ?? "ltr");
        return dir;
      }
      run(() => dir = dirAttribute);
      return dirAttribute;
    }
    const possiblePositions = derived(() => Array.from(new Set([
      position,
      ...toastState.toasts.filter((toast) => toast.position).map((toast) => toast.position)
    ].filter(Boolean))));
    let expanded = false;
    let interacting = false;
    let actualTheme = getInitialTheme(theme2);
    const hotkeyLabel = derived(() => hotkey.join("+").replace(/Key/g, "").replace(/Digit/g, ""));
    sonnerContext.set(new SonnerState());
    $$renderer2.push(`<section${attr("aria-label", `${stringify(containerAriaLabel)} ${stringify(hotkeyLabel())}`)}${attr("tabindex", -1)} aria-live="polite" aria-relevant="additions text" aria-atomic="false" class="svelte-1ru3sv4">`);
    if (toastState.toasts.length > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<!--[-->`);
      const each_array = ensure_array_like(possiblePositions());
      for (let index = 0, $$length = each_array.length; index < $$length; index++) {
        let position2 = each_array[index];
        const [y, x] = position2.split("-");
        const offsetObject = getOffsetObject(offset, mobileOffset);
        $$renderer2.push(`<ol${attributes(
          {
            tabindex: -1,
            dir: getDocumentDirection(),
            class: clsx(className),
            "data-sonner-toaster": true,
            "data-sonner-theme": actualTheme,
            "data-y-position": y,
            "data-x-position": x,
            style: restProps.style,
            ...restProps
          },
          "svelte-1ru3sv4",
          void 0,
          {
            "--front-toast-height": `${toastState.heights[0]?.height}px`,
            "--width": `${TOAST_WIDTH}px`,
            "--gap": `${gap}px`,
            "--offset-top": offsetObject["--offset-top"],
            "--offset-right": offsetObject["--offset-right"],
            "--offset-bottom": offsetObject["--offset-bottom"],
            "--offset-left": offsetObject["--offset-left"],
            "--mobile-offset-top": offsetObject["--mobile-offset-top"],
            "--mobile-offset-right": offsetObject["--mobile-offset-right"],
            "--mobile-offset-bottom": offsetObject["--mobile-offset-bottom"],
            "--mobile-offset-left": offsetObject["--mobile-offset-left"]
          }
        )}><!--[-->`);
        const each_array_1 = ensure_array_like(toastState.toasts.filter((toast) => !toast.position && index === 0 || toast.position === position2));
        for (let index2 = 0, $$length2 = each_array_1.length; index2 < $$length2; index2++) {
          let toast = each_array_1[index2];
          {
            let successIcon = function($$renderer3) {
              if (successIconProp) {
                $$renderer3.push("<!--[0-->");
                successIconProp?.($$renderer3);
                $$renderer3.push(`<!---->`);
              } else if (successIconProp !== null) {
                $$renderer3.push("<!--[1-->");
                SuccessIcon($$renderer3);
              } else {
                $$renderer3.push("<!--[-1-->");
              }
              $$renderer3.push(`<!--]-->`);
            }, errorIcon = function($$renderer3) {
              if (errorIconProp) {
                $$renderer3.push("<!--[0-->");
                errorIconProp?.($$renderer3);
                $$renderer3.push(`<!---->`);
              } else if (errorIconProp !== null) {
                $$renderer3.push("<!--[1-->");
                ErrorIcon($$renderer3);
              } else {
                $$renderer3.push("<!--[-1-->");
              }
              $$renderer3.push(`<!--]-->`);
            }, warningIcon = function($$renderer3) {
              if (warningIconProp) {
                $$renderer3.push("<!--[0-->");
                warningIconProp?.($$renderer3);
                $$renderer3.push(`<!---->`);
              } else if (warningIconProp !== null) {
                $$renderer3.push("<!--[1-->");
                WarningIcon($$renderer3);
              } else {
                $$renderer3.push("<!--[-1-->");
              }
              $$renderer3.push(`<!--]-->`);
            }, infoIcon = function($$renderer3) {
              if (infoIconProp) {
                $$renderer3.push("<!--[0-->");
                infoIconProp?.($$renderer3);
                $$renderer3.push(`<!---->`);
              } else if (infoIconProp !== null) {
                $$renderer3.push("<!--[1-->");
                InfoIcon($$renderer3);
              } else {
                $$renderer3.push("<!--[-1-->");
              }
              $$renderer3.push(`<!--]-->`);
            }, closeIcon = function($$renderer3) {
              if (closeIconProp) {
                $$renderer3.push("<!--[0-->");
                closeIconProp?.($$renderer3);
                $$renderer3.push(`<!---->`);
              } else if (closeIconProp !== null) {
                $$renderer3.push("<!--[1-->");
                CloseIcon($$renderer3);
              } else {
                $$renderer3.push("<!--[-1-->");
              }
              $$renderer3.push(`<!--]-->`);
            };
            Toast($$renderer2, {
              index: index2,
              toast,
              defaultRichColors: richColors,
              duration: toastOptions?.duration ?? duration,
              class: toastOptions?.class ?? "",
              descriptionClass: toastOptions?.descriptionClass || "",
              invert,
              visibleToasts,
              closeButton,
              interacting,
              position: position2,
              style: toastOptions?.style ?? "",
              classes: toastOptions.classes || {},
              unstyled: toastOptions.unstyled ?? false,
              cancelButtonStyle: toastOptions?.cancelButtonStyle ?? "",
              actionButtonStyle: toastOptions?.actionButtonStyle ?? "",
              closeButtonAriaLabel: toastOptions?.closeButtonAriaLabel ?? closeButtonAriaLabel,
              expandByDefault: expand,
              expanded,
              pauseWhenPageIsHidden,
              loadingIcon: loadingIconProp,
              successIcon,
              errorIcon,
              warningIcon,
              infoIcon,
              closeIcon,
              $$slots: {
                successIcon: true,
                errorIcon: true,
                warningIcon: true,
                infoIcon: true,
                closeIcon: true
              }
            });
          }
        }
        $$renderer2.push(`<!--]--></ol>`);
      }
      $$renderer2.push(`<!--]-->`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></section>`);
  });
}
function QuotaIndicator($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let open = false;
    function maxUtilization(rows) {
      let u = 0;
      for (const r of rows) {
        const l = r.limit;
        if (l.cpu_cores) u = Math.max(u, r.usage.cpu_cores / l.cpu_cores);
        if (l.ram_gb) u = Math.max(u, r.usage.ram_gb / l.ram_gb);
        if (l.disk_gb) u = Math.max(u, r.usage.disk_gb / l.disk_gb);
        if (l.vm_count) u = Math.max(u, (r.usage.vm_count + r.usage.lxc_count) / l.vm_count);
      }
      return u;
    }
    const primaryTeam = derived(() => null);
    const utilization = derived(() => primaryTeam() ? maxUtilization(primaryTeam().clusters) : 0);
    const blockClasses = derived(() => utilization() >= 0.95 ? "bg-destructive/10 border-destructive/30 text-destructive" : utilization() >= 0.8 ? "bg-warning/10 border-warning/30 text-warning" : "bg-muted border-border text-foreground");
    const compactCpu = derived(() => primaryTeam() ? `${primaryTeam().aggregate_usage.cpu_cores}/${primaryTeam().aggregate_limit.cpu_cores ?? "∞"}` : "--/--");
    const compactRam = derived(() => primaryTeam() ? `${primaryTeam().aggregate_usage.ram_gb}/${primaryTeam().aggregate_limit.ram_gb ?? "∞"}GB` : "--/--");
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      if (Sheet) {
        $$renderer3.push("<!--[-->");
        Sheet($$renderer3, {
          get open() {
            return open;
          },
          set open($$value) {
            open = $$value;
            $$settled = false;
          },
          children: ($$renderer4) => {
            {
              let child = function($$renderer5, { props }) {
                $$renderer5.push(`<button${attributes({
                  ...props,
                  type: "button",
                  class: `inline-flex items-center gap-2 h-7 px-3 rounded-md border text-[13px] font-medium transition-colors hover:opacity-80 ${stringify(blockClasses())}`,
                  "aria-label": `Quota: ${compactCpu()} CPU, ${compactRam()} RAM. Click for details.`,
                  "aria-live": "polite"
                })}><span class="text-muted-foreground font-medium">CPU</span> <span class="font-mono tabular-nums">${escape_html(compactCpu())}</span> <span class="text-muted-foreground">·</span> <span class="text-muted-foreground font-medium">RAM</span> <span class="font-mono tabular-nums">${escape_html(compactRam())}</span></button>`);
              };
              if (Sheet_trigger) {
                $$renderer4.push("<!--[-->");
                Sheet_trigger($$renderer4, { child, $$slots: { child: true } });
                $$renderer4.push("<!--]-->");
              } else {
                $$renderer4.push("<!--[!-->");
                $$renderer4.push("<!--]-->");
              }
            }
            $$renderer4.push(` `);
            if (Sheet_content) {
              $$renderer4.push("<!--[-->");
              Sheet_content($$renderer4, {
                side: "right",
                class: "w-[400px] sm:w-[480px]",
                children: ($$renderer5) => {
                  if (Sheet_header) {
                    $$renderer5.push("<!--[-->");
                    Sheet_header($$renderer5, {
                      children: ($$renderer6) => {
                        if (Sheet_title) {
                          $$renderer6.push("<!--[-->");
                          Sheet_title($$renderer6, {
                            children: ($$renderer7) => {
                              $$renderer7.push(`<!---->Quota usage`);
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
                  $$renderer5.push(` <div class="flex flex-col gap-6 mt-6 overflow-y-auto" style="max-height: calc(100vh - 12rem);">`);
                  {
                    $$renderer5.push("<!--[1-->");
                    $$renderer5.push(`<p class="text-[13px] text-muted-foreground">You have no quotas configured. Contact your administrator.</p>`);
                  }
                  $$renderer5.push(`<!--]--></div>`);
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
  });
}
function Topbar($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { user, clusters = [] } = $$props;
    function initials(u) {
      const name = u.username || u.email || "?";
      const parts = name.split(/[\s._-]+/).filter(Boolean);
      if (parts.length === 0) return "?";
      if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    async function logout() {
      await api.auth.logout();
      await invalidateAll();
      await goto();
    }
    $$renderer2.push(`<header class="bg-background flex h-14 items-center justify-between gap-4 border-b border-border px-4 lg:px-6"><div class="flex items-center gap-2"><svg viewBox="0 0 24 24" class="size-6 text-primary" role="img" aria-label="Proxmox GUI logo" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="3" width="7" height="7" rx="1.5"></rect><rect x="3" y="14" width="7" height="7" rx="1.5"></rect><rect x="14" y="14" width="7" height="7" rx="1.5"></rect></svg> <span class="text-lg font-semibold tracking-tight">Proxmox GUI</span></div> <div class="hidden md:block">`);
    ClusterContextPicker($$renderer2, { clusters });
    $$renderer2.push(`<!----></div> <div class="flex items-center gap-2">`);
    QuotaIndicator($$renderer2);
    $$renderer2.push(`<!----> `);
    ThemeToggle($$renderer2);
    $$renderer2.push(`<!----> `);
    if (Dropdown_menu) {
      $$renderer2.push("<!--[-->");
      Dropdown_menu($$renderer2, {
        children: ($$renderer3) => {
          {
            let child = function($$renderer4, { props }) {
              $$renderer4.push(`<button${attributes({
                ...props,
                class: "bg-muted text-muted-foreground hover:text-foreground inline-flex size-7 items-center justify-center rounded-full border border-border text-[11px] font-semibold transition-colors",
                "aria-label": "Open user menu"
              })}>${escape_html(user ? initials(user) : "?")}</button>`);
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
              align: "end",
              children: ($$renderer4) => {
                {
                  let child = function($$renderer5, { props }) {
                    $$renderer5.push(`<a${attributes({ href: "/profile", ...props })}>Profile</a>`);
                  };
                  if (Dropdown_menu_item) {
                    $$renderer4.push("<!--[-->");
                    Dropdown_menu_item($$renderer4, { child, $$slots: { child: true } });
                    $$renderer4.push("<!--]-->");
                  } else {
                    $$renderer4.push("<!--[!-->");
                    $$renderer4.push("<!--]-->");
                  }
                }
                $$renderer4.push(` `);
                {
                  let child = function($$renderer5, { props }) {
                    $$renderer5.push(`<a${attributes({ href: "/profile/ssh-keys", ...props })}>SSH keys</a>`);
                  };
                  if (Dropdown_menu_item) {
                    $$renderer4.push("<!--[-->");
                    Dropdown_menu_item($$renderer4, { child, $$slots: { child: true } });
                    $$renderer4.push("<!--]-->");
                  } else {
                    $$renderer4.push("<!--[!-->");
                    $$renderer4.push("<!--]-->");
                  }
                }
                $$renderer4.push(` `);
                {
                  let child = function($$renderer5, { props }) {
                    $$renderer5.push(`<a${attributes({ href: "/profile/tokens", ...props })}>API tokens</a>`);
                  };
                  if (Dropdown_menu_item) {
                    $$renderer4.push("<!--[-->");
                    Dropdown_menu_item($$renderer4, { child, $$slots: { child: true } });
                    $$renderer4.push("<!--]-->");
                  } else {
                    $$renderer4.push("<!--[!-->");
                    $$renderer4.push("<!--]-->");
                  }
                }
                $$renderer4.push(` `);
                if (Dropdown_menu_separator) {
                  $$renderer4.push("<!--[-->");
                  Dropdown_menu_separator($$renderer4, {});
                  $$renderer4.push("<!--]-->");
                } else {
                  $$renderer4.push("<!--[!-->");
                  $$renderer4.push("<!--]-->");
                }
                $$renderer4.push(` `);
                if (Dropdown_menu_item) {
                  $$renderer4.push("<!--[-->");
                  Dropdown_menu_item($$renderer4, {
                    onSelect: logout,
                    children: ($$renderer5) => {
                      $$renderer5.push(`<!---->Log out`);
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
    $$renderer2.push(`</div></header>`);
  });
}
const defaultWindow$1 = void 0;
function getActiveElement$1(document2) {
  let activeElement = document2.activeElement;
  while (activeElement?.shadowRoot) {
    const node = activeElement.shadowRoot.activeElement;
    if (node === activeElement)
      break;
    else
      activeElement = node;
  }
  return activeElement;
}
let ActiveElement$1 = class ActiveElement2 {
  #document;
  #subscribe;
  constructor(options = {}) {
    const { window: window2 = defaultWindow$1, document: document2 = window2?.document } = options;
    if (window2 === void 0) return;
    this.#document = document2;
    this.#subscribe = createSubscriber();
  }
  get current() {
    this.#subscribe?.();
    if (!this.#document) return null;
    return getActiveElement$1(this.#document);
  }
};
new ActiveElement$1();
function getStorage(storageType, window2) {
  switch (storageType) {
    case "local":
      return window2.localStorage;
    case "session":
      return window2.sessionStorage;
  }
}
class PersistedState {
  #current;
  #key;
  #serializer;
  #storage;
  #subscribe;
  #version = 0;
  constructor(key, initialValue, options = {}) {
    const {
      storage: storageType = "local",
      serializer = { serialize: JSON.stringify, deserialize: JSON.parse },
      syncTabs = true,
      window: window2 = defaultWindow$1
    } = options;
    this.#current = initialValue;
    this.#key = key;
    this.#serializer = serializer;
    if (window2 === void 0) return;
    const storage = getStorage(storageType, window2);
    this.#storage = storage;
    const existingValue = storage.getItem(key);
    if (existingValue !== null) {
      this.#current = this.#deserialize(existingValue);
    } else {
      this.#serialize(initialValue);
    }
    if (syncTabs && storageType === "local") {
      this.#subscribe = createSubscriber();
    }
  }
  get current() {
    this.#subscribe?.();
    this.#version;
    const root = this.#deserialize(this.#storage?.getItem(this.#key)) ?? this.#current;
    const proxies = /* @__PURE__ */ new WeakMap();
    const proxy = (value) => {
      if (value === null || value?.constructor.name === "Date" || typeof value !== "object") {
        return value;
      }
      let p = proxies.get(value);
      if (!p) {
        p = new Proxy(value, {
          get: (target, property) => {
            this.#version;
            return proxy(Reflect.get(target, property));
          },
          set: (target, property, value2) => {
            this.#version += 1;
            Reflect.set(target, property, value2);
            this.#serialize(root);
            return true;
          }
        });
        proxies.set(value, p);
      }
      return p;
    };
    return proxy(root);
  }
  set current(newValue) {
    this.#serialize(newValue);
    this.#version += 1;
  }
  #handleStorageEvent = (event) => {
    if (event.key !== this.#key || event.newValue === null) return;
    this.#current = this.#deserialize(event.newValue);
    this.#version += 1;
  };
  #deserialize(value) {
    try {
      return this.#serializer.deserialize(value);
    } catch (error) {
      console.error(`Error when parsing "${value}" from persisted store "${this.#key}"`, error);
      return;
    }
  }
  #serialize(value) {
    try {
      if (value != void 0) {
        this.#storage?.setItem(this.#key, this.#serializer.serialize(value));
      }
    } catch (error) {
      console.error(`Error when writing value from persisted store "${this.#key}" to ${this.#storage}`, error);
    }
  }
}
function sanitizeClassNames(classNames) {
  return classNames.filter((className) => className.length > 0);
}
const noopStorage = {
  getItem: (_key) => null,
  setItem: (_key, _value) => {
  }
};
const isBrowser = typeof document !== "undefined";
function isFunction(value) {
  return typeof value === "function";
}
function isObject(value) {
  return value !== null && typeof value === "object";
}
const BoxSymbol = Symbol("box");
const isWritableSymbol = Symbol("is-writable");
function isBox(value) {
  return isObject(value) && BoxSymbol in value;
}
function isWritableBox(value) {
  return box.isBox(value) && isWritableSymbol in value;
}
function box(initialValue) {
  let current = initialValue;
  return {
    [BoxSymbol]: true,
    [isWritableSymbol]: true,
    get current() {
      return current;
    },
    set current(v) {
      current = v;
    }
  };
}
function boxWith(getter, setter) {
  const derived$1 = derived(getter);
  if (setter) {
    return {
      [BoxSymbol]: true,
      [isWritableSymbol]: true,
      get current() {
        return derived$1();
      },
      set current(v) {
        setter(v);
      }
    };
  }
  return {
    [BoxSymbol]: true,
    get current() {
      return getter();
    }
  };
}
function boxFrom(value) {
  if (box.isBox(value)) return value;
  if (isFunction(value)) return box.with(value);
  return box(value);
}
function boxFlatten(boxes) {
  return Object.entries(boxes).reduce(
    (acc, [key, b]) => {
      if (!box.isBox(b)) {
        return Object.assign(acc, { [key]: b });
      }
      if (box.isWritableBox(b)) {
        Object.defineProperty(acc, key, {
          get() {
            return b.current;
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          set(v) {
            b.current = v;
          }
        });
      } else {
        Object.defineProperty(acc, key, {
          get() {
            return b.current;
          }
        });
      }
      return acc;
    },
    {}
  );
}
function toReadonlyBox(b) {
  if (!box.isWritableBox(b)) return b;
  return {
    [BoxSymbol]: true,
    get current() {
      return b.current;
    }
  };
}
box.from = boxFrom;
box.with = boxWith;
box.flatten = boxFlatten;
box.readonly = toReadonlyBox;
box.isBox = isBox;
box.isWritableBox = isWritableBox;
function createParser(matcher, replacer) {
  const regex = RegExp(matcher, "g");
  return (str) => {
    if (typeof str !== "string") {
      throw new TypeError(`expected an argument of type string, but got ${typeof str}`);
    }
    if (!str.match(regex))
      return str;
    return str.replace(regex, replacer);
  };
}
const camelToKebab = createParser(/[A-Z]/, (match) => `-${match.toLowerCase()}`);
function styleToCSS(styleObj) {
  if (!styleObj || typeof styleObj !== "object" || Array.isArray(styleObj)) {
    throw new TypeError(`expected an argument of type object, but got ${typeof styleObj}`);
  }
  return Object.keys(styleObj).map((property) => `${camelToKebab(property)}: ${styleObj[property]};`).join("\n");
}
function styleToString(style = {}) {
  return styleToCSS(style).replace("\n", " ");
}
const srOnlyStyles = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: "0",
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  borderWidth: "0",
  transform: "translateX(-100%)"
};
styleToString(srOnlyStyles);
const defaultWindow = void 0;
function getActiveElement(document2) {
  let activeElement = document2.activeElement;
  while (activeElement?.shadowRoot) {
    const node = activeElement.shadowRoot.activeElement;
    if (node === activeElement)
      break;
    else
      activeElement = node;
  }
  return activeElement;
}
class ActiveElement3 {
  #document;
  #subscribe;
  constructor(options = {}) {
    const { window: window2 = defaultWindow, document: document2 = window2?.document } = options;
    if (window2 === void 0) return;
    this.#document = document2;
    this.#subscribe = createSubscriber();
  }
  get current() {
    this.#subscribe?.();
    if (!this.#document) return null;
    return getActiveElement(this.#document);
  }
}
new ActiveElement3();
const modeStorageKey = box("mode-watcher-mode");
const modes = ["dark", "light", "system"];
function isValidMode(value) {
  if (typeof value !== "string")
    return false;
  return modes.includes(value);
}
class UserPrefersMode {
  #defaultValue = "system";
  #storage = isBrowser ? localStorage : noopStorage;
  #initialValue = this.#storage.getItem(modeStorageKey.current);
  #value = isValidMode(this.#initialValue) ? this.#initialValue : this.#defaultValue;
  #persisted = this.#makePersisted();
  #makePersisted(value = this.#value) {
    return new PersistedState(modeStorageKey.current, value, {
      serializer: {
        serialize: (v) => v,
        deserialize: (v) => {
          if (isValidMode(v)) return v;
          return this.#defaultValue;
        }
      }
    });
  }
  constructor() {
  }
  get current() {
    return this.#persisted.current;
  }
  set current(newValue) {
    this.#persisted.current = newValue;
  }
}
class SystemPrefersMode {
  #defaultValue = void 0;
  #track = true;
  #current = this.#defaultValue;
  #mediaQueryState = typeof window !== "undefined" && typeof window.matchMedia === "function" ? new MediaQuery("prefers-color-scheme: light") : { current: false };
  query() {
    if (!isBrowser) return;
    this.#current = this.#mediaQueryState.current ? "light" : "dark";
  }
  tracking(active) {
    this.#track = active;
  }
  constructor() {
    this.query = this.query.bind(this);
    this.tracking = this.tracking.bind(this);
  }
  get current() {
    return this.#current;
  }
}
const userPrefersMode = new UserPrefersMode();
const systemPrefersMode = new SystemPrefersMode();
let timeoutAction;
let timeoutEnable;
let hasLoaded = false;
let styleElement = null;
function getStyleElement() {
  if (styleElement)
    return styleElement;
  styleElement = document.createElement("style");
  styleElement.appendChild(document.createTextNode(`* {
		-webkit-transition: none !important;
		-moz-transition: none !important;
		-o-transition: none !important;
		-ms-transition: none !important;
		transition: none !important;
	}`));
  return styleElement;
}
function withoutTransition(action, synchronous = false) {
  if (typeof document === "undefined")
    return;
  if (!hasLoaded) {
    hasLoaded = true;
    action();
    return;
  }
  const isTest = typeof process !== "undefined" && process.env?.NODE_ENV === "test" || typeof window !== "undefined" && window.__vitest_worker__;
  if (isTest) {
    action();
    return;
  }
  clearTimeout(timeoutAction);
  clearTimeout(timeoutEnable);
  const style = getStyleElement();
  const disable = () => document.head.appendChild(style);
  const enable = () => {
    if (style.parentNode) {
      document.head.removeChild(style);
    }
  };
  function executeAction() {
    action();
    window.requestAnimationFrame(enable);
  }
  if (typeof window.requestAnimationFrame !== "undefined") {
    disable();
    if (synchronous) {
      executeAction();
    } else {
      window.requestAnimationFrame(() => {
        executeAction();
      });
    }
    return;
  }
  disable();
  timeoutAction = window.setTimeout(() => {
    action();
    timeoutEnable = window.setTimeout(enable, 16);
  }, 16);
}
const themeColors = box(void 0);
const disableTransitions = box(true);
const synchronousModeChanges = box(false);
const darkClassNames = box([]);
const lightClassNames = box([]);
function createDerivedMode() {
  const current = derived(() => {
    if (!isBrowser) return void 0;
    const derivedMode2 = userPrefersMode.current === "system" ? systemPrefersMode.current : userPrefersMode.current;
    const sanitizedDarkClassNames = sanitizeClassNames(darkClassNames.current);
    const sanitizedLightClassNames = sanitizeClassNames(lightClassNames.current);
    function update() {
      const htmlEl = document.documentElement;
      const themeColorEl = document.querySelector('meta[name="theme-color"]');
      if (derivedMode2 === "light") {
        if (sanitizedDarkClassNames.length) htmlEl.classList.remove(...sanitizedDarkClassNames);
        if (sanitizedLightClassNames.length) htmlEl.classList.add(...sanitizedLightClassNames);
        htmlEl.style.colorScheme = "light";
        if (themeColorEl && themeColors.current) {
          themeColorEl.setAttribute("content", themeColors.current.light);
        }
      } else {
        if (sanitizedLightClassNames.length) htmlEl.classList.remove(...sanitizedLightClassNames);
        if (sanitizedDarkClassNames.length) htmlEl.classList.add(...sanitizedDarkClassNames);
        htmlEl.style.colorScheme = "dark";
        if (themeColorEl && themeColors.current) {
          themeColorEl.setAttribute("content", themeColors.current.dark);
        }
      }
    }
    if (disableTransitions.current) {
      withoutTransition(update, synchronousModeChanges.current);
    } else {
      update();
    }
    return derivedMode2;
  });
  return {
    get current() {
      return current();
    }
  };
}
const derivedMode = createDerivedMode();
function Circle_check($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["circle", { "cx": "12", "cy": "12", "r": "10" }],
    ["path", { "d": "m9 12 2 2 4-4" }]
  ];
  Icon($$renderer, spread_props([{ name: "circle-check" }, props, { iconNode }]));
}
function Octagon_x($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["path", { "d": "m15 9-6 6" }],
    [
      "path",
      {
        "d": "M2.586 16.726A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2h6.624a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586z"
      }
    ],
    ["path", { "d": "m9 9 6 6" }]
  ];
  Icon($$renderer, spread_props([{ name: "octagon-x" }, props, { iconNode }]));
}
function Info($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["circle", { "cx": "12", "cy": "12", "r": "10" }],
    ["path", { "d": "M12 16v-4" }],
    ["path", { "d": "M12 8h.01" }]
  ];
  Icon($$renderer, spread_props([{ name: "info" }, props, { iconNode }]));
}
function Sonner_1($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { $$slots, $$events, ...restProps } = $$props;
    {
      let loadingIcon = function($$renderer3) {
        Loader_circle($$renderer3, { class: "size-4 animate-spin" });
      }, successIcon = function($$renderer3) {
        Circle_check($$renderer3, { class: "size-4" });
      }, errorIcon = function($$renderer3) {
        Octagon_x($$renderer3, { class: "size-4" });
      }, infoIcon = function($$renderer3) {
        Info($$renderer3, { class: "size-4" });
      }, warningIcon = function($$renderer3) {
        Triangle_alert($$renderer3, { class: "size-4" });
      };
      Toaster($$renderer2, spread_props([
        {
          theme: derivedMode.current,
          class: "toaster group",
          style: "--normal-bg: var(--color-popover); --normal-text: var(--color-popover-foreground); --normal-border: var(--color-border);"
        },
        restProps,
        {
          loadingIcon,
          successIcon,
          errorIcon,
          infoIcon,
          warningIcon,
          $$slots: {
            loadingIcon: true,
            successIcon: true,
            errorIcon: true,
            infoIcon: true,
            warningIcon: true
          }
        }
      ]));
    }
  });
}
function AppShell($$renderer, $$props) {
  let { user, clusters = [], children } = $$props;
  $$renderer.push(`<a href="#main-content" class="bg-primary text-primary-foreground sr-only z-50 rounded px-3 py-2 focus:not-sr-only focus:absolute focus:left-3 focus:top-3">Skip to content</a> <div class="bg-background flex min-h-screen flex-col text-foreground">`);
  Topbar($$renderer, { user, clusters });
  $$renderer.push(`<!----> <div class="flex flex-1 overflow-hidden">`);
  Sidebar($$renderer, { user });
  $$renderer.push(`<!----> <main id="main-content" class="flex-1 overflow-y-auto"><div class="mx-auto w-full max-w-screen-xl px-6 py-8">`);
  children($$renderer);
  $$renderer.push(`<!----></div></main></div></div> `);
  Sonner_1($$renderer, {
    position: "bottom-right",
    richColors: true,
    closeButton: true
  });
  $$renderer.push(`<!---->`);
}
function _layout($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let { data, children } = $$props;
    const pathname = derived(() => store_get($$store_subs ??= {}, "$page", page).url.pathname);
    const isPublic = derived(() => pathname() === "/login" || pathname().startsWith("/login/") || pathname() === "/setup" || pathname().startsWith("/setup/"));
    if (data.user && !isPublic()) {
      $$renderer2.push("<!--[0-->");
      AppShell($$renderer2, {
        user: data.user,
        clusters: data.clusters ?? [],
        children: ($$renderer3) => {
          children($$renderer3);
          $$renderer3.push(`<!---->`);
        }
      });
    } else {
      $$renderer2.push("<!--[-1-->");
      children($$renderer2);
      $$renderer2.push(`<!---->`);
    }
    $$renderer2.push(`<!--]-->`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}

export { _layout as default };
//# sourceMappingURL=_layout.svelte-DbbNfcA8.js.map
