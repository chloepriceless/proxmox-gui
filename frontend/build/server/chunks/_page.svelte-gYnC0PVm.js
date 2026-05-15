import { l as escape_html, d as derived, c as store_get, f as ensure_array_like, h as attr, aC as await_block, m as unsubscribe_stores, j as attr_class, k as stringify, x as attr_style, n as spread_props } from './renderer-5OqEGBJa.js';
import { i as invalidateAll, g as goto } from './client-BLBuBvl1.js';
import { p as page } from './stores-C0P6ZS0h.js';
import { T as Tabs, a as Tabs_list, c as Tabs_trigger, b as Tabs_content } from './tabs-trigger-33kDO1Y8.js';
import { C as Card } from './card-BLYI87Kx.js';
import 'clsx';
import { B as Button, I as Icon } from './input-QG1nZPSy.js';
import { T as Tooltip_provider, a as Tooltip, b as Tooltip_trigger, c as Tooltip_content, A as AuditTable } from './tooltip-provider-BlA6o5AG.js';
import { T as TagPill } from './TagPill-D3sB1Fnz.js';
import { P as Popover, a as Popover_trigger, b as Popover_content } from './popover-trigger-xV8smPjy.js';
import { C as Command, a as Command_input, b as Command_list, c as Command_empty, d as Command_group, e as Command_item } from './command-list-DgT6bxzm.js';
import { a as api, A as ApiError } from './client2-vvZGy19D.js';
import { P as Plus } from './plus-BTOfelJ0.js';
import { a as toast } from './toast-state.svelte-BaJ56aYt.js';
import { T as Textarea } from './textarea-53eBrSX_.js';
import { marked } from 'marked';
import DOMPurifyFactory from 'dompurify';
import { L as Lock } from './lock-DL53n3Lr.js';
import '@sveltejs/kit/internal';
import './root-BZo_tL0Z.js';
import './index-Siz_BmGa.js';
import '@sveltejs/kit/internal/server';
import './state.svelte-Bqwbw8qw.js';
import './noop-n4I-x7yK.js';
import './is-DeZ4WIS2.js';
import './scroll-lock-BdvbL8bD.js';
import 'tailwind-merge';
import './table-row-CMsYy_rr.js';
import './table-header-VM9fHtz5.js';
import './badge-TEIAL8qa.js';
import './popper-layer-force-mount-D47fNzjm.js';
import './check-mBuM5jRg.js';
import './clone-BIspTav0.js';
import './sr-only-styles-DyDinzbs.js';

function html(value) {
  var html2 = String(value ?? "");
  var open = "<!---->";
  return open + html2 + "<!---->";
}
function TagInput($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      clusterId,
      vmid,
      type,
      currentTags,
      suggestions = [],
      onApplied
    } = $$props;
    let open = false;
    let input = "";
    let submitting = false;
    let inlineError = null;
    const TAG_RE = /^[a-z0-9_-]+$/;
    function validate(v) {
      if (!v) return "Type a tag name.";
      if (!TAG_RE.test(v)) {
        return "Tags use lowercase letters, digits, hyphens, and underscores only.";
      }
      if (currentTags.includes(v)) return `'${v}' is already applied.`;
      return null;
    }
    async function addTag(t) {
      const trimmed = t.trim();
      const err = validate(trimmed);
      if (err) {
        inlineError = err;
        return;
      }
      submitting = true;
      inlineError = null;
      const next = Array.from(/* @__PURE__ */ new Set([...currentTags, trimmed])).sort();
      try {
        await api.inventory.setTags({ clusterId, vmid, type, tags: next });
        onApplied?.(next);
        open = false;
        input = "";
      } catch (e) {
        const msg = e instanceof ApiError && e.status === 422 ? "Couldn't add tag — server rejected the format." : "Couldn't add tag. Try again.";
        toast.error(msg);
      } finally {
        submitting = false;
      }
    }
    const availableSuggestions = derived(() => suggestions.filter((s) => !currentTags.includes(s)));
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
                  { variant: "outline", size: "sm" },
                  props,
                  {
                    disabled: submitting,
                    children: ($$renderer6) => {
                      Plus($$renderer6, { class: "size-4 mr-1", "aria-hidden": "true" });
                      $$renderer6.push(`<!----> Add tag`);
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
                class: "w-[280px] p-0",
                align: "start",
                children: ($$renderer5) => {
                  if (Command) {
                    $$renderer5.push("<!--[-->");
                    Command($$renderer5, {
                      children: ($$renderer6) => {
                        if (Command_input) {
                          $$renderer6.push("<!--[-->");
                          Command_input($$renderer6, {
                            placeholder: "Type a tag…",
                            onkeydown: (e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                addTag(input.trim());
                              }
                            },
                            get value() {
                              return input;
                            },
                            set value($$value) {
                              input = $$value;
                              $$settled = false;
                            }
                          });
                          $$renderer6.push("<!--]-->");
                        } else {
                          $$renderer6.push("<!--[!-->");
                          $$renderer6.push("<!--]-->");
                        }
                        $$renderer6.push(` `);
                        if (inlineError) {
                          $$renderer6.push("<!--[0-->");
                          $$renderer6.push(`<div role="alert" class="px-3 py-2 text-[13px] text-destructive">${escape_html(inlineError)}</div>`);
                        } else {
                          $$renderer6.push("<!--[-1-->");
                        }
                        $$renderer6.push(`<!--]--> `);
                        if (Command_list) {
                          $$renderer6.push("<!--[-->");
                          Command_list($$renderer6, {
                            children: ($$renderer7) => {
                              if (Command_empty) {
                                $$renderer7.push("<!--[-->");
                                Command_empty($$renderer7, {
                                  children: ($$renderer8) => {
                                    $$renderer8.push(`<!---->No matches. Press Enter to create.`);
                                  },
                                  $$slots: { default: true }
                                });
                                $$renderer7.push("<!--]-->");
                              } else {
                                $$renderer7.push("<!--[!-->");
                                $$renderer7.push("<!--]-->");
                              }
                              $$renderer7.push(` `);
                              if (availableSuggestions().length > 0) {
                                $$renderer7.push("<!--[0-->");
                                if (Command_group) {
                                  $$renderer7.push("<!--[-->");
                                  Command_group($$renderer7, {
                                    heading: "Existing tags",
                                    children: ($$renderer8) => {
                                      $$renderer8.push(`<!--[-->`);
                                      const each_array = ensure_array_like(availableSuggestions());
                                      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
                                        let s = each_array[$$index];
                                        if (Command_item) {
                                          $$renderer8.push("<!--[-->");
                                          Command_item($$renderer8, {
                                            value: s,
                                            onSelect: () => addTag(s),
                                            children: ($$renderer9) => {
                                              $$renderer9.push(`<!---->${escape_html(s)}`);
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
                              } else {
                                $$renderer7.push("<!--[-1-->");
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
  });
}
function Pencil($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    [
      "path",
      {
        "d": "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"
      }
    ],
    ["path", { "d": "m15 5 4 4" }]
  ];
  Icon($$renderer, spread_props([{ name: "pencil" }, props, { iconNode }]));
}
const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "ul",
  "ol",
  "li",
  "code",
  "pre",
  "blockquote",
  "a"
];
const ALLOWED_ATTR = ["href", "title"];
function resolvePurify() {
  const dp = DOMPurifyFactory;
  if (typeof dp.sanitize === "function") {
    return dp;
  }
  if (typeof window !== "undefined") {
    return dp(window);
  }
  return { sanitize: (html2) => html2 };
}
let _purify = null;
function getPurify() {
  if (!_purify) _purify = resolvePurify();
  return _purify;
}
function renderMarkdown(raw) {
  if (!raw) return "";
  const html2 = marked.parse(raw, { breaks: true, gfm: true });
  return getPurify().sanitize(html2, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false
  });
}
function MarkdownNotes($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { clusterId, vmid, type, notes, onApplied } = $$props;
    const MAX = 8e3;
    let editing = false;
    let draft = "";
    let saving = false;
    let error = null;
    function startEdit() {
      draft = notes;
      editing = true;
      error = null;
    }
    function cancelEdit() {
      editing = false;
      error = null;
    }
    async function save() {
      if (draft.length > MAX) {
        error = `Notes are limited to ${MAX} characters. Trim ${draft.length - MAX} characters to save.`;
        return;
      }
      saving = true;
      error = null;
      try {
        await api.inventory.setNotes({ clusterId, vmid, type, notes: draft });
        onApplied?.(draft);
        editing = false;
      } catch (e) {
        error = e instanceof ApiError && e.status === 422 ? "Notes exceeded server limit." : "Couldn't save notes. Try again.";
        toast.error(error);
      } finally {
        saving = false;
      }
    }
    const rendered = derived(() => notes ? renderMarkdown(notes) : "");
    const remaining = derived(() => MAX - draft.length);
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      if (editing) {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<div class="flex flex-col gap-2"><label for="vm-notes" class="text-[13px] font-medium">Notes (Markdown supported)</label> `);
        Textarea($$renderer3, {
          id: "vm-notes",
          class: "h-60 font-mono text-[13px]",
          placeholder: "Write notes in Markdown…",
          get value() {
            return draft;
          },
          set value($$value) {
            draft = $$value;
            $$settled = false;
          }
        });
        $$renderer3.push(`<!----> `);
        if (error) {
          $$renderer3.push("<!--[0-->");
          $$renderer3.push(`<div role="alert" class="text-[13px] text-destructive">${escape_html(error)}</div>`);
        } else {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]--> <div class="flex items-center justify-between text-[13px] text-muted-foreground"><span>${escape_html(remaining() < 200 ? `${remaining()} chars left` : "")}</span> <div class="flex gap-2">`);
        Button($$renderer3, {
          variant: "ghost",
          onclick: cancelEdit,
          disabled: saving,
          children: ($$renderer4) => {
            $$renderer4.push(`<!---->Cancel`);
          },
          $$slots: { default: true }
        });
        $$renderer3.push(`<!----> `);
        Button($$renderer3, {
          onclick: save,
          disabled: saving,
          children: ($$renderer4) => {
            $$renderer4.push(`<!---->${escape_html(saving ? "Saving…" : "Save notes")}`);
          },
          $$slots: { default: true }
        });
        $$renderer3.push(`<!----></div></div></div>`);
      } else if (notes) {
        $$renderer3.push("<!--[1-->");
        $$renderer3.push(`<div class="flex items-start justify-between gap-4"><div class="prose prose-sm dark:prose-invert max-w-none text-[14px] leading-relaxed" role="article">${html(rendered())}</div> `);
        Button($$renderer3, {
          variant: "ghost",
          size: "sm",
          onclick: startEdit,
          "aria-label": "Edit notes",
          children: ($$renderer4) => {
            Pencil($$renderer4, { class: "size-4 mr-1", "aria-hidden": "true" });
            $$renderer4.push(`<!----> Edit`);
          },
          $$slots: { default: true }
        });
        $$renderer3.push(`<!----></div>`);
      } else {
        $$renderer3.push("<!--[-1-->");
        $$renderer3.push(`<div class="flex flex-col items-start gap-2"><p class="text-[14px] text-muted-foreground">No notes yet.</p> `);
        Button($$renderer3, {
          variant: "outline",
          onclick: startEdit,
          children: ($$renderer4) => {
            $$renderer4.push(`<!---->+ Add notes`);
          },
          $$slots: { default: true }
        });
        $$renderer3.push(`<!----></div>`);
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
function formatUptime(seconds) {
  if (!seconds || seconds <= 0) return "—";
  const s = Math.floor(seconds);
  const d = Math.floor(s / 86400);
  const h = Math.floor(s % 86400 / 3600);
  const m = Math.floor(s % 3600 / 60);
  if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}
function formatBytes(n, fractionDigits = 1) {
  if (!n || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  const value = n / 1024 ** i;
  return `${value.toFixed(i === 0 ? 0 : fractionDigits)} ${units[i]}`;
}
function formatRate(bytesPerSecond) {
  return `${formatBytes(bytesPerSecond)}/s`;
}
function formatPercent(fraction, fractionDigits = 0) {
  if (!Number.isFinite(fraction)) return "—";
  return `${(fraction * 100).toFixed(fractionDigits)}%`;
}
function Sparkline($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      points,
      max,
      height = 80,
      class: className = "",
      label = "sparkline",
      format = (v) => String(v),
      times = []
    } = $$props;
    const W = 200;
    const H = derived(() => height);
    const yMax = derived(() => Math.max(max, 1));
    const coords = derived(() => points.map((v, i) => ({
      fx: i / Math.max(points.length - 1, 1),
      fy: 1 - Math.max(0, Math.min(1, v / yMax()))
    })));
    const polyline = derived(() => coords().map((c) => `${(c.fx * W).toFixed(2)},${(c.fy * H()).toFixed(2)}`).join(" "));
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const hover = derived(
      () => null
    );
    if (points.length === 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div${attr_class(`flex items-center justify-center text-muted-foreground text-[13px] ${stringify(className)}`)}${attr_style(`height: ${H()}px;`)}>No data</div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div${attr_class(`relative ${stringify(className)}`)}${attr_style(`height: ${H()}px;`)}><svg${attr("viewBox", `0 0 ${W} ${H()}`)} preserveAspectRatio="none" role="img"${attr("aria-label", label)} class="block h-full w-full text-primary"><polyline fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"${attr("points", polyline())}></polyline></svg> <span class="pointer-events-none absolute right-0 top-0 rounded bg-background/70 px-1 text-[10px] leading-tight text-muted-foreground">${escape_html(format(yMax()))}</span> <span class="pointer-events-none absolute bottom-0 right-0 rounded bg-background/70 px-1 text-[10px] leading-tight text-muted-foreground">${escape_html(format(0))}</span> `);
      if (hover()) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="pointer-events-none absolute bottom-0 top-0 w-px bg-border"${attr_style(`left: ${hover().leftPct}%;`)}></div> <div class="pointer-events-none absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-background"${attr_style(`left: ${hover().leftPct}%; top: ${hover().topPct}%;`)}></div> <div class="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded border border-border bg-popover px-1.5 py-0.5 text-[11px] text-popover-foreground shadow-sm"${attr_style(`left: ${clamp(hover().leftPct, 10, 90)}%; top: ${Math.max(hover().topPct - 4, 6)}%;`)}><span class="font-medium">${escape_html(hover().value)}</span> `);
        if (hover().time) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<span class="text-muted-foreground">· ${escape_html(hover().time)}</span>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div>`);
    }
    $$renderer2.push(`<!--]-->`);
  });
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let { data } = $$props;
    const detail = derived(() => data.detail);
    function toResourceKind(t) {
      return t === "lxc" ? "lxc" : "vm";
    }
    const tabValue = derived(() => store_get($$store_subs ??= {}, "$page", page).url.hash.replace("#", "") || "overview");
    function setTab(v) {
      goto("#" + v, {});
    }
    let localTags = null;
    let localNotes = null;
    const tags = derived(() => localTags ?? detail()?.tags ?? []);
    const notes = derived(() => localNotes ?? detail()?.description ?? "");
    let rrd = [];
    const GB = 1024 ** 3;
    const ramGb = derived(() => detail() ? Math.round(detail().maxmem / GB * 10) / 10 : 0);
    const diskGb = derived(() => detail() ? Math.round(detail().maxdisk / GB * 10) / 10 : 0);
    const maxDiskIO = derived(() => Math.max(...rrd.map((s) => s.diskread + s.diskwrite), 1));
    const maxNet = derived(() => Math.max(...rrd.map((s) => s.netin + s.netout), 1));
    const rrdTimes = derived(() => rrd.map((s) => s.time));
    if (!detail() || data.loadError) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="rounded-md border border-dashed border-border bg-muted/30 p-10 text-center"><p class="text-[14px] font-medium mb-3">Couldn't load VM details.</p> `);
      Button($$renderer2, {
        variant: "outline",
        onclick: () => invalidateAll(),
        children: ($$renderer3) => {
          $$renderer3.push(`<!---->Try again`);
        },
        $$slots: { default: true }
      });
      $$renderer2.push(`<!----></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<nav class="text-[13px] text-muted-foreground mb-3" aria-label="Breadcrumb"><a href="/inventory" class="hover:underline">Inventory</a> <span class="mx-1">></span> <span>${escape_html(detail().cluster_id)}</span> <span class="mx-1">></span> <span>${escape_html(detail().name ?? `VM ${detail().vmid}`)}</span></nav> <header class="mb-6 flex flex-col gap-1"><h1 class="text-[28px] font-semibold tracking-tight">${escape_html(detail().name ?? `VM ${detail().vmid}`)}</h1> <p class="font-mono text-[13px] text-muted-foreground">${escape_html(detail().vmid)} · cluster ${escape_html(detail().cluster_id)} · ${escape_html(detail().node)}</p></header> `);
      if (Tabs) {
        $$renderer2.push("<!--[-->");
        Tabs($$renderer2, {
          value: tabValue(),
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
                      value: "overview",
                      children: ($$renderer5) => {
                        $$renderer5.push(`<!---->Overview`);
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
                      value: "activity",
                      children: ($$renderer5) => {
                        $$renderer5.push(`<!---->Activity`);
                      },
                      $$slots: { default: true }
                    });
                    $$renderer4.push("<!--]-->");
                  } else {
                    $$renderer4.push("<!--[!-->");
                    $$renderer4.push("<!--]-->");
                  }
                  $$renderer4.push(` `);
                  if (Tooltip_provider) {
                    $$renderer4.push("<!--[-->");
                    Tooltip_provider($$renderer4, {
                      children: ($$renderer5) => {
                        if (Tooltip) {
                          $$renderer5.push("<!--[-->");
                          Tooltip($$renderer5, {
                            children: ($$renderer6) => {
                              {
                                let child = function($$renderer7, { props }) {
                                  if (Tabs_trigger) {
                                    $$renderer7.push("<!--[-->");
                                    Tabs_trigger($$renderer7, spread_props([
                                      { value: "snapshots", disabled: true },
                                      props,
                                      {
                                        children: ($$renderer8) => {
                                          Lock($$renderer8, { class: "size-3 mr-1", "aria-hidden": "true" });
                                          $$renderer8.push(`<!----> Snapshots`);
                                        },
                                        $$slots: { default: true }
                                      }
                                    ]));
                                    $$renderer7.push("<!--]-->");
                                  } else {
                                    $$renderer7.push("<!--[!-->");
                                    $$renderer7.push("<!--]-->");
                                  }
                                };
                                if (Tooltip_trigger) {
                                  $$renderer6.push("<!--[-->");
                                  Tooltip_trigger($$renderer6, { child, $$slots: { child: true } });
                                  $$renderer6.push("<!--]-->");
                                } else {
                                  $$renderer6.push("<!--[!-->");
                                  $$renderer6.push("<!--]-->");
                                }
                              }
                              $$renderer6.push(` `);
                              if (Tooltip_content) {
                                $$renderer6.push("<!--[-->");
                                Tooltip_content($$renderer6, {
                                  children: ($$renderer7) => {
                                    $$renderer7.push(`<!---->Snapshots ship in Phase 3`);
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
                  if (Tooltip_provider) {
                    $$renderer4.push("<!--[-->");
                    Tooltip_provider($$renderer4, {
                      children: ($$renderer5) => {
                        if (Tooltip) {
                          $$renderer5.push("<!--[-->");
                          Tooltip($$renderer5, {
                            children: ($$renderer6) => {
                              {
                                let child = function($$renderer7, { props }) {
                                  if (Tabs_trigger) {
                                    $$renderer7.push("<!--[-->");
                                    Tabs_trigger($$renderer7, spread_props([
                                      { value: "console", disabled: true },
                                      props,
                                      {
                                        children: ($$renderer8) => {
                                          Lock($$renderer8, { class: "size-3 mr-1", "aria-hidden": "true" });
                                          $$renderer8.push(`<!----> Console`);
                                        },
                                        $$slots: { default: true }
                                      }
                                    ]));
                                    $$renderer7.push("<!--]-->");
                                  } else {
                                    $$renderer7.push("<!--[!-->");
                                    $$renderer7.push("<!--]-->");
                                  }
                                };
                                if (Tooltip_trigger) {
                                  $$renderer6.push("<!--[-->");
                                  Tooltip_trigger($$renderer6, { child, $$slots: { child: true } });
                                  $$renderer6.push("<!--]-->");
                                } else {
                                  $$renderer6.push("<!--[!-->");
                                  $$renderer6.push("<!--]-->");
                                }
                              }
                              $$renderer6.push(` `);
                              if (Tooltip_content) {
                                $$renderer6.push("<!--[-->");
                                Tooltip_content($$renderer6, {
                                  children: ($$renderer7) => {
                                    $$renderer7.push(`<!---->Console ships in Phase 4`);
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
            $$renderer3.push(` `);
            if (Tabs_content) {
              $$renderer3.push("<!--[-->");
              Tabs_content($$renderer3, {
                value: "overview",
                children: ($$renderer4) => {
                  $$renderer4.push(`<div class="grid gap-6 mt-6"><div class="grid grid-cols-1 gap-6 md:grid-cols-2">`);
                  if (Card) {
                    $$renderer4.push("<!--[-->");
                    Card($$renderer4, {
                      class: "p-6",
                      children: ($$renderer5) => {
                        $$renderer5.push(`<h3 class="text-[13px] font-medium text-muted-foreground mb-3">Specs</h3> <dl class="grid grid-cols-[120px_1fr] gap-y-2 text-[13px]"><dt class="text-muted-foreground">Status</dt> <dd class="font-mono">${escape_html(detail().status)}</dd> <dt class="text-muted-foreground">vCPU</dt> <dd class="font-mono">${escape_html(detail().maxcpu)}</dd> <dt class="text-muted-foreground">RAM</dt> <dd class="font-mono">${escape_html(ramGb())} GB</dd> <dt class="text-muted-foreground">Disk</dt> <dd class="font-mono">${escape_html(diskGb())} GB</dd> <dt class="text-muted-foreground">Uptime</dt> <dd class="font-mono">${escape_html(formatUptime(detail().uptime))}</dd> <dt class="text-muted-foreground">Type</dt> <dd class="font-mono">${escape_html(detail().type === "lxc" ? "LXC" : "VM (QEMU)")}</dd></dl>`);
                      },
                      $$slots: { default: true }
                    });
                    $$renderer4.push("<!--]-->");
                  } else {
                    $$renderer4.push("<!--[!-->");
                    $$renderer4.push("<!--]-->");
                  }
                  $$renderer4.push(` `);
                  if (Card) {
                    $$renderer4.push("<!--[-->");
                    Card($$renderer4, {
                      class: "p-6",
                      children: ($$renderer5) => {
                        $$renderer5.push(`<h3 class="text-[13px] font-medium text-muted-foreground mb-3">Network</h3> <dl class="grid grid-cols-[120px_1fr] gap-y-2 text-[13px]"><dt class="text-muted-foreground">Node</dt> <dd class="font-mono">${escape_html(detail().node)}</dd> <dt class="text-muted-foreground">net0</dt> <dd class="font-mono truncate">${escape_html(String(detail().raw_config?.net0 ?? "—"))}</dd> <dt class="text-muted-foreground">net1</dt> <dd class="font-mono truncate">${escape_html(String(detail().raw_config?.net1 ?? "—"))}</dd> <dt class="text-muted-foreground">Net in</dt> <dd class="font-mono">${escape_html(formatBytes(detail().netin))} <span class="text-muted-foreground">total</span></dd> <dt class="text-muted-foreground">Net out</dt> <dd class="font-mono">${escape_html(formatBytes(detail().netout))} <span class="text-muted-foreground">total</span></dd></dl>`);
                      },
                      $$slots: { default: true }
                    });
                    $$renderer4.push("<!--]-->");
                  } else {
                    $$renderer4.push("<!--[!-->");
                    $$renderer4.push("<!--]-->");
                  }
                  $$renderer4.push(`</div> `);
                  if (Card) {
                    $$renderer4.push("<!--[-->");
                    Card($$renderer4, {
                      class: "p-6",
                      children: ($$renderer5) => {
                        $$renderer5.push(`<h3 class="text-[13px] font-medium text-muted-foreground mb-3">Metrics (last hour)</h3> `);
                        {
                          $$renderer5.push("<!--[-1-->");
                          $$renderer5.push(`<div class="grid grid-cols-2 gap-6"><div><p class="text-[13px] text-muted-foreground mb-1">CPU %</p> `);
                          Sparkline($$renderer5, {
                            points: rrd.map((s) => s.cpu),
                            max: 1,
                            format: formatPercent,
                            times: rrdTimes(),
                            label: "CPU usage over time"
                          });
                          $$renderer5.push(`<!----></div> <div><p class="text-[13px] text-muted-foreground mb-1">RAM</p> `);
                          Sparkline($$renderer5, {
                            points: rrd.map((s) => s.mem),
                            max: detail().maxmem || 1,
                            format: formatBytes,
                            times: rrdTimes(),
                            label: "RAM usage over time"
                          });
                          $$renderer5.push(`<!----></div> <div><p class="text-[13px] text-muted-foreground mb-1">Disk I/O</p> `);
                          Sparkline($$renderer5, {
                            points: rrd.map((s) => s.diskread + s.diskwrite),
                            max: maxDiskIO(),
                            format: formatRate,
                            times: rrdTimes(),
                            label: "Disk I/O over time"
                          });
                          $$renderer5.push(`<!----></div> <div><p class="text-[13px] text-muted-foreground mb-1">Network</p> `);
                          Sparkline($$renderer5, {
                            points: rrd.map((s) => s.netin + s.netout),
                            max: maxNet(),
                            format: formatRate,
                            times: rrdTimes(),
                            label: "Network throughput over time"
                          });
                          $$renderer5.push(`<!----></div></div>`);
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
                  $$renderer4.push(` `);
                  if (Card) {
                    $$renderer4.push("<!--[-->");
                    Card($$renderer4, {
                      class: "p-6",
                      children: ($$renderer5) => {
                        $$renderer5.push(`<h3 class="text-[13px] font-medium text-muted-foreground mb-3">Tags</h3> <div class="flex flex-wrap items-center gap-2"><!--[-->`);
                        const each_array_1 = ensure_array_like(tags());
                        for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
                          let t = each_array_1[$$index_1];
                          $$renderer5.push(`<span class="inline-flex items-center gap-1">`);
                          TagPill($$renderer5, { tag: t });
                          $$renderer5.push(`<!----> <button type="button" class="text-muted-foreground hover:text-destructive text-[12px] leading-none"${attr("aria-label", `Remove tag ${t}`)}>×</button></span>`);
                        }
                        $$renderer5.push(`<!--]--> `);
                        if (tags().length === 0) {
                          $$renderer5.push("<!--[0-->");
                          $$renderer5.push(`<p class="text-[13px] text-muted-foreground">No tags. Add one to organize this resource.</p>`);
                        } else {
                          $$renderer5.push("<!--[-1-->");
                        }
                        $$renderer5.push(`<!--]--> `);
                        TagInput($$renderer5, {
                          clusterId: detail().cluster_id,
                          vmid: detail().vmid,
                          type: toResourceKind(detail().type),
                          currentTags: tags(),
                          suggestions: [],
                          onApplied: (next) => {
                            localTags = next;
                            invalidateAll();
                          }
                        });
                        $$renderer5.push(`<!----></div>`);
                      },
                      $$slots: { default: true }
                    });
                    $$renderer4.push("<!--]-->");
                  } else {
                    $$renderer4.push("<!--[!-->");
                    $$renderer4.push("<!--]-->");
                  }
                  $$renderer4.push(` `);
                  if (Card) {
                    $$renderer4.push("<!--[-->");
                    Card($$renderer4, {
                      class: "p-6",
                      children: ($$renderer5) => {
                        $$renderer5.push(`<h3 class="text-[13px] font-medium text-muted-foreground mb-3">Notes</h3> `);
                        MarkdownNotes($$renderer5, {
                          clusterId: detail().cluster_id,
                          vmid: detail().vmid,
                          type: toResourceKind(detail().type),
                          notes: notes(),
                          onApplied: (n) => {
                            localNotes = n;
                            invalidateAll();
                          }
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
                  $$renderer4.push(`</div>`);
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
                value: "activity",
                children: ($$renderer4) => {
                  $$renderer4.push(`<div class="mt-6"><div class="flex items-center justify-end mb-3"><a${attr("href", `/audit?cluster_id=${detail().cluster_id}&vmid=${detail().vmid}`)} class="text-primary hover:underline text-[14px]">View in global audit log →</a></div> `);
                  await_block(
                    $$renderer4,
                    api.audit.list({
                      filters: {
                        cluster_id: detail().cluster_id,
                        vmid: detail().vmid,
                        page: 1,
                        page_size: 50
                      }
                    }),
                    () => {
                      AuditTable($$renderer4, {
                        rows: [],
                        total: 0,
                        page: 1,
                        pageSize: 50,
                        loading: true,
                        lockedFilters: { cluster_id: detail().cluster_id, vmid: detail().vmid }
                      });
                    },
                    (result) => {
                      AuditTable($$renderer4, {
                        rows: result.rows,
                        total: result.total,
                        page: result.page,
                        pageSize: result.page_size,
                        lockedFilters: { cluster_id: detail().cluster_id, vmid: detail().vmid }
                      });
                    }
                  );
                  $$renderer4.push(`<!--]--></div>`);
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
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}

export { _page as default };
//# sourceMappingURL=_page.svelte-gYnC0PVm.js.map
