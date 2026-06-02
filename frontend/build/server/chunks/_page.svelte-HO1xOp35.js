import { c as escape_html, d as derived, f as store_get, o as spread_props, h as bind_props, j as ensure_array_like, p as attributes, k as attr, aC as await_block, n as unsubscribe_stores, l as attr_class, m as stringify, y as attr_style } from './renderer-mZFfBJIU.js';
import { i as invalidateAll, g as goto } from './client-vbU_CWqW.js';
import { p as page } from './stores-ByWcCi85.js';
import { T as Tabs, a as Tabs_list, c as Tabs_trigger, b as Tabs_content } from './tabs-trigger-C-XzUKLH.js';
import { C as Card } from './card-xlHxCeq2.js';
import 'clsx';
import { B as Button } from './button-CE_GHowG.js';
import { P as Play, S as Square, a as Power, T as TagPill } from './TagPill-DPDo8ZHB.js';
import { P as Popover, a as Popover_trigger, b as Popover_content } from './popover-trigger-CW5_3VeS.js';
import { C as Command, a as Command_input } from './command-input-DdpRtNko.js';
import { j as jobsStore, c as Collapsible, C as Command_list, a as Command_empty, b as Command_group, f as Command_item, d as Collapsible_trigger, e as Collapsible_content } from './collapsible-content-BOatjyk_.js';
import { a as api } from './client2-FWmWn_B2.js';
import { ApiError } from './api-By_nInf4.js';
import { P as Plus } from './plus-BJNhbNpF.js';
import { a as toast } from './toast-state.svelte-Bp1lssrC.js';
import { T as Textarea } from './textarea-CXeJA3NL.js';
import { marked } from 'marked';
import DOMPurifyFactory from 'dompurify';
import { I as Icon } from './Icon-oF8immWv.js';
import { D as Dropdown_menu, a as Dropdown_menu_trigger, b as Dropdown_menu_content, c as Dropdown_menu_item } from './dropdown-menu-trigger-CNd_0STl.js';
import { D as Dropdown_menu_separator } from './dropdown-menu-separator-DdHtbf6X.js';
import { T as Tooltip_provider, a as Tooltip, b as Tooltip_trigger, c as Tooltip_content } from './tooltip-provider-C1AFzMmv.js';
import { C as ConfirmByNameDialog } from './ConfirmByNameDialog-CPP3oltV.js';
import { A as Alert_dialog, a as Alert_dialog_content, b as Alert_dialog_header, e as Alert_dialog_footer, c as Alert_dialog_title, d as Alert_dialog_description } from './alert-dialog-description-C3hFoiPT.js';
import { D as Dialog, d as Dialog_content, e as Dialog_header, f as Dialog_title, g as Dialog_description } from './dialog-description-Bxgdum_W.js';
import { D as Dialog_footer } from './dialog-footer-CULuct0c.js';
import { I as Input } from './input-Be3KOSVg.js';
import { L as Label } from './label-Cf-Bm-qJ.js';
import { S as Switch } from './switch-CPUtptdH.js';
import { S as Select, a as Select_trigger, b as Select_content, c as Select_item } from './select-trigger-D_NqXYnx.js';
import { C as Chevron_down } from './chevron-down-DXRC0OiZ.js';
import { C as Circle_alert } from './circle-alert-Nd3JNVzs.js';
import { T as Triangle_alert } from './triangle-alert-fkzDfgmm.js';
import { R as Rotate_cw } from './rotate-cw-gZ2HsEB3.js';
import { C as Copy } from './copy-Ch3Vo_sg.js';
import { E as Ellipsis } from './ellipsis-XgxNQ-GP.js';
import { C as Card_header, a as Card_title, b as Card_content } from './card-title-D9QrKn4F.js';
import './badge-CwoKb4lT.js';
import { L as Loader_circle } from './loader-circle-CEJgqxAV.js';
import { R as Refresh_cw } from './refresh-cw-0T7GcTmA.js';
import { A as AuditTable } from './AuditTable-5GaKFkKs.js';
import { c as formatUptime, a as formatBytes, d as formatPercent, e as formatRate } from './format-Cqeoh9TR.js';
import '@sveltejs/kit/internal';
import './root-C3vAr9go.js';
import './index-B0sFcY-v.js';
import '@sveltejs/kit/internal/server';
import './state.svelte-DtuilCOR.js';
import './noop-n4I-x7yK.js';
import './is-DiTqhZmY.js';
import './scroll-lock-CmFP2s08.js';
import 'tailwind-merge';
import './popper-layer-force-mount-NeUEE3xR.js';
import './clone-WEom5mq4.js';
import './sr-only-styles-lCW8LjNz.js';
import './check-C7XRLeXa.js';
import './dialog-description2-DYXaekbV.js';
import './x-DRD3hFMZ.js';
import './hidden-input-Q3ZT26w4.js';
import './chevron-up-DMqbLdKr.js';
import './table-row-CyEWIwNm.js';

function iframeVisible(state) {
  return state === "live";
}
function isSafeRelayUrl(relayUrl) {
  if (!relayUrl) return false;
  if (relayUrl.includes(":8006")) return false;
  if (relayUrl.startsWith("/api/v1/ws/console/")) return true;
  if (relayUrl.includes("/vncwebsocket")) return false;
  return relayUrl.includes("/api/v1/ws/console/");
}
function placeholderBody(name) {
  return `Open a live console session to ${name}. The session opens in this panel.`;
}
const CONSOLE_EMBED_PREFIX = "/console/embed?ws=";
function consoleEmbedSrc(relayUrl, ticket, port) {
  if (!isSafeRelayUrl(relayUrl)) {
    throw new Error("Refusing to render a console iframe at a non-relay URL");
  }
  return CONSOLE_EMBED_PREFIX + encodeURIComponent(relayUrl) + "#t=" + encodeURIComponent(ticket) + "&p=" + encodeURIComponent(String(port));
}
function consoleIframeSrc(src) {
  if (!src.startsWith(CONSOLE_EMBED_PREFIX) || src.includes(":8006")) {
    throw new Error("Refusing to render a console iframe at a non-embed URL");
  }
  return src;
}

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
function Trash_2($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["path", { "d": "M10 11v6" }],
    ["path", { "d": "M14 11v6" }],
    ["path", { "d": "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" }],
    ["path", { "d": "M3 6h18" }],
    ["path", { "d": "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" }]
  ];
  Icon($$renderer, spread_props([{ name: "trash-2" }, props, { iconNode }]));
}
function Camera($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    [
      "path",
      {
        "d": "M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z"
      }
    ],
    ["circle", { "cx": "12", "cy": "13", "r": "3" }]
  ];
  Icon($$renderer, spread_props([{ name: "camera" }, props, { iconNode }]));
}
function Database($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["ellipse", { "cx": "12", "cy": "5", "rx": "9", "ry": "3" }],
    ["path", { "d": "M3 5V19A9 3 0 0 0 21 19V5" }],
    ["path", { "d": "M3 12A9 3 0 0 0 21 12" }]
  ];
  Icon($$renderer, spread_props([{ name: "database" }, props, { iconNode }]));
}
function Cpu($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["path", { "d": "M12 20v2" }],
    ["path", { "d": "M12 2v2" }],
    ["path", { "d": "M17 20v2" }],
    ["path", { "d": "M17 2v2" }],
    ["path", { "d": "M2 12h2" }],
    ["path", { "d": "M2 17h2" }],
    ["path", { "d": "M2 7h2" }],
    ["path", { "d": "M20 12h2" }],
    ["path", { "d": "M20 17h2" }],
    ["path", { "d": "M20 7h2" }],
    ["path", { "d": "M7 20v2" }],
    ["path", { "d": "M7 2v2" }],
    [
      "rect",
      { "x": "4", "y": "4", "width": "16", "height": "16", "rx": "2" }
    ],
    [
      "rect",
      { "x": "8", "y": "8", "width": "8", "height": "8", "rx": "1" }
    ]
  ];
  Icon($$renderer, spread_props([{ name: "cpu" }, props, { iconNode }]));
}
function Arrow_right_left($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["path", { "d": "m16 3 4 4-4 4" }],
    ["path", { "d": "M20 7H4" }],
    ["path", { "d": "m8 21-4-4 4-4" }],
    ["path", { "d": "M4 17h16" }]
  ];
  Icon($$renderer, spread_props([{ name: "arrow-right-left" }, props, { iconNode }]));
}
function File_stack($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    [
      "path",
      { "d": "M11 21a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1" }
    ],
    [
      "path",
      { "d": "M16 16a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1" }
    ],
    [
      "path",
      {
        "d": "M21 6a2 2 0 0 0-.586-1.414l-2-2A2 2 0 0 0 17 2h-3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1z"
      }
    ]
  ];
  Icon($$renderer, spread_props([{ name: "file-stack" }, props, { iconNode }]));
}
function PowerConfirmDialog($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { open = false, kind, vmName, onConfirm, onEscalateForceStop } = $$props;
    let busy = false;
    function copyFor(k, name) {
      switch (k) {
        case "stop":
          return {
            heading: `Stop ${name}?`,
            body: "Sends a graceful shutdown signal. The guest OS gets a chance to shut down cleanly.",
            cta: "Stop VM",
            destructive: false
          };
        case "reboot":
          return {
            heading: `Reboot ${name}?`,
            body: `Restarts ${name}. In-progress work inside the guest may be interrupted.`,
            cta: "Reboot VM",
            destructive: false
          };
        case "shutdown":
          return {
            heading: `Shut down ${name}?`,
            body: `Sends a graceful ACPI shutdown to ${name}.`,
            cta: "Shut down",
            destructive: false
          };
        case "force-stop":
          return {
            heading: `Force-stop ${name}?`,
            body: "This cuts power immediately — like pulling the plug. Unsaved data in the guest may be lost. Use only when a graceful stop won’t complete.",
            cta: "Force-stop",
            destructive: true
          };
      }
    }
    const copy = derived(() => copyFor(kind, vmName));
    async function handleConfirm() {
      if (busy) return;
      busy = true;
      try {
        await onConfirm();
        open = false;
      } finally {
        busy = false;
      }
    }
    function handleCancel() {
      open = false;
    }
    function handleEscalate() {
      onEscalateForceStop?.();
    }
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      if (Alert_dialog) {
        $$renderer3.push("<!--[-->");
        Alert_dialog($$renderer3, {
          get open() {
            return open;
          },
          set open($$value) {
            open = $$value;
            $$settled = false;
          },
          children: ($$renderer4) => {
            if (Alert_dialog_content) {
              $$renderer4.push("<!--[-->");
              Alert_dialog_content($$renderer4, {
                children: ($$renderer5) => {
                  if (Alert_dialog_header) {
                    $$renderer5.push("<!--[-->");
                    Alert_dialog_header($$renderer5, {
                      children: ($$renderer6) => {
                        if (Alert_dialog_title) {
                          $$renderer6.push("<!--[-->");
                          Alert_dialog_title($$renderer6, {
                            children: ($$renderer7) => {
                              $$renderer7.push(`<!---->${escape_html(copy().heading)}`);
                            },
                            $$slots: { default: true }
                          });
                          $$renderer6.push("<!--]-->");
                        } else {
                          $$renderer6.push("<!--[!-->");
                          $$renderer6.push("<!--]-->");
                        }
                        $$renderer6.push(` `);
                        if (Alert_dialog_description) {
                          $$renderer6.push("<!--[-->");
                          Alert_dialog_description($$renderer6, {
                            children: ($$renderer7) => {
                              $$renderer7.push(`<!---->${escape_html(copy().body)}`);
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
                  $$renderer5.push(` `);
                  if (Alert_dialog_footer) {
                    $$renderer5.push("<!--[-->");
                    Alert_dialog_footer($$renderer5, {
                      children: ($$renderer6) => {
                        Button($$renderer6, {
                          variant: "ghost",
                          onclick: handleCancel,
                          disabled: busy,
                          children: ($$renderer7) => {
                            $$renderer7.push(`<!---->Cancel`);
                          },
                          $$slots: { default: true }
                        });
                        $$renderer6.push(`<!----> `);
                        if (kind === "stop" && onEscalateForceStop) {
                          $$renderer6.push("<!--[0-->");
                          Button($$renderer6, {
                            variant: "outline",
                            onclick: handleEscalate,
                            disabled: busy,
                            children: ($$renderer7) => {
                              $$renderer7.push(`<!---->Force-stop instead`);
                            },
                            $$slots: { default: true }
                          });
                        } else {
                          $$renderer6.push("<!--[-1-->");
                        }
                        $$renderer6.push(`<!--]--> `);
                        Button($$renderer6, {
                          variant: copy().destructive ? "destructive" : "default",
                          onclick: handleConfirm,
                          disabled: busy,
                          children: ($$renderer7) => {
                            $$renderer7.push(`<!---->${escape_html(copy().cta)}`);
                          },
                          $$slots: { default: true }
                        });
                        $$renderer6.push(`<!---->`);
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
    bind_props($$props, { open });
  });
}
function SnapshotCreateDialog($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { open = false, vmName, onSubmit } = $$props;
    let name = "";
    let description = "";
    let vmstate = false;
    let busy = false;
    const nameValid = derived(() => name.trim().length >= 1 && name.trim().length <= 40);
    async function handleSubmit() {
      if (busy || !nameValid()) return;
      busy = true;
      try {
        await onSubmit({ name: name.trim(), description: description.trim(), vmstate });
        open = false;
      } finally {
        busy = false;
      }
    }
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      if (Dialog) {
        $$renderer3.push("<!--[-->");
        Dialog($$renderer3, {
          get open() {
            return open;
          },
          set open($$value) {
            open = $$value;
            $$settled = false;
          },
          children: ($$renderer4) => {
            if (Dialog_content) {
              $$renderer4.push("<!--[-->");
              Dialog_content($$renderer4, {
                children: ($$renderer5) => {
                  if (Dialog_header) {
                    $$renderer5.push("<!--[-->");
                    Dialog_header($$renderer5, {
                      children: ($$renderer6) => {
                        if (Dialog_title) {
                          $$renderer6.push("<!--[-->");
                          Dialog_title($$renderer6, {
                            children: ($$renderer7) => {
                              $$renderer7.push(`<!---->Create snapshot`);
                            },
                            $$slots: { default: true }
                          });
                          $$renderer6.push("<!--]-->");
                        } else {
                          $$renderer6.push("<!--[!-->");
                          $$renderer6.push("<!--]-->");
                        }
                        $$renderer6.push(` `);
                        if (Dialog_description) {
                          $$renderer6.push("<!--[-->");
                          Dialog_description($$renderer6, {
                            children: ($$renderer7) => {
                              $$renderer7.push(`<!---->Capture the current state of ${escape_html(vmName)}.`);
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
                  $$renderer5.push(` <div class="flex flex-col gap-4"><div class="flex flex-col gap-2">`);
                  Label($$renderer5, {
                    for: "snapshot-name",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->Snapshot name`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> `);
                  Input($$renderer5, {
                    id: "snapshot-name",
                    type: "text",
                    maxlength: 40,
                    placeholder: "e.g. before-upgrade",
                    autocomplete: "off",
                    get value() {
                      return name;
                    },
                    set value($$value) {
                      name = $$value;
                      $$settled = false;
                    }
                  });
                  $$renderer5.push(`<!----></div> <div class="flex flex-col gap-2">`);
                  Label($$renderer5, {
                    for: "snapshot-description",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->Description`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> `);
                  Textarea($$renderer5, {
                    id: "snapshot-description",
                    placeholder: "Optional — why you took this snapshot.",
                    rows: 3,
                    get value() {
                      return description;
                    },
                    set value($$value) {
                      description = $$value;
                      $$settled = false;
                    }
                  });
                  $$renderer5.push(`<!----></div> <div class="flex items-start justify-between gap-4"><div class="flex flex-col gap-1">`);
                  Label($$renderer5, {
                    for: "snapshot-vmstate",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->Include RAM state`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> <p class="text-[13px] text-muted-foreground">Captures the running memory; the snapshot takes longer and uses more space.</p></div> `);
                  Switch($$renderer5, {
                    id: "snapshot-vmstate",
                    get checked() {
                      return vmstate;
                    },
                    set checked($$value) {
                      vmstate = $$value;
                      $$settled = false;
                    }
                  });
                  $$renderer5.push(`<!----></div></div> `);
                  if (Dialog_footer) {
                    $$renderer5.push("<!--[-->");
                    Dialog_footer($$renderer5, {
                      children: ($$renderer6) => {
                        Button($$renderer6, {
                          variant: "ghost",
                          onclick: () => open = false,
                          disabled: busy,
                          children: ($$renderer7) => {
                            $$renderer7.push(`<!---->Cancel`);
                          },
                          $$slots: { default: true }
                        });
                        $$renderer6.push(`<!----> `);
                        Button($$renderer6, {
                          onclick: handleSubmit,
                          disabled: busy || !nameValid(),
                          children: ($$renderer7) => {
                            $$renderer7.push(`<!---->Create snapshot`);
                          },
                          $$slots: { default: true }
                        });
                        $$renderer6.push(`<!---->`);
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
    bind_props($$props, { open });
  });
}
function ResizeDialog($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { open = false, clusterId, vmid, type, vmName } = $$props;
    let busy = false;
    async function handleSubmit() {
      return;
    }
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      if (Dialog) {
        $$renderer3.push("<!--[-->");
        Dialog($$renderer3, {
          get open() {
            return open;
          },
          set open($$value) {
            open = $$value;
            $$settled = false;
          },
          children: ($$renderer4) => {
            if (Dialog_content) {
              $$renderer4.push("<!--[-->");
              Dialog_content($$renderer4, {
                children: ($$renderer5) => {
                  if (Dialog_header) {
                    $$renderer5.push("<!--[-->");
                    Dialog_header($$renderer5, {
                      children: ($$renderer6) => {
                        if (Dialog_title) {
                          $$renderer6.push("<!--[-->");
                          Dialog_title($$renderer6, {
                            children: ($$renderer7) => {
                              $$renderer7.push(`<!---->Resize ${escape_html(vmName)}`);
                            },
                            $$slots: { default: true }
                          });
                          $$renderer6.push("<!--]-->");
                        } else {
                          $$renderer6.push("<!--[!-->");
                          $$renderer6.push("<!--]-->");
                        }
                        $$renderer6.push(` `);
                        if (Dialog_description) {
                          $$renderer6.push("<!--[-->");
                          Dialog_description($$renderer6, {
                            children: ($$renderer7) => {
                              $$renderer7.push(`<!---->Adjust CPU, memory, and disk for this VM.`);
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
                  $$renderer5.push(` `);
                  {
                    $$renderer5.push("<!--[1-->");
                    $$renderer5.push(`<p class="text-[14px] text-destructive">Couldn't load the current sizing.</p>`);
                  }
                  $$renderer5.push(`<!--]--> `);
                  if (Dialog_footer) {
                    $$renderer5.push("<!--[-->");
                    Dialog_footer($$renderer5, {
                      children: ($$renderer6) => {
                        Button($$renderer6, {
                          variant: "ghost",
                          onclick: () => open = false,
                          disabled: busy,
                          children: ($$renderer7) => {
                            $$renderer7.push(`<!---->Cancel`);
                          },
                          $$slots: { default: true }
                        });
                        $$renderer6.push(`<!----> `);
                        Button($$renderer6, {
                          onclick: handleSubmit,
                          disabled: true,
                          children: ($$renderer7) => {
                            $$renderer7.push(`<!---->Resize VM`);
                          },
                          $$slots: { default: true }
                        });
                        $$renderer6.push(`<!---->`);
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
    bind_props($$props, { open });
  });
}
function CloneDialog($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { open = false, clusterId, vmid, type, vmName, currentNode } = $$props;
    let cloneName = "";
    let mode = "linked";
    let targetNode = "";
    let targetStorage = "";
    let newVmid = "";
    let busy = false;
    let nodes = [];
    const nameValid = derived(() => cloneName.trim().length >= 1);
    async function handleSubmit() {
      if (busy || !nameValid() || !targetNode) return;
      busy = true;
      try {
        const parsedVmid = newVmid.trim() === "" ? void 0 : Number(newVmid.trim());
        await api.lifecycle.clone({
          clusterId,
          vmid,
          type,
          body: {
            name: cloneName.trim(),
            full: mode === "full",
            target_node: targetNode,
            target_storage: targetStorage.trim() === "" ? null : targetStorage.trim(),
            new_vmid: parsedVmid
          }
        });
        toast(`Clone started for ${vmName}.`);
        open = false;
      } catch {
        toast.error(`Couldn’t queue the clone of ${vmName}. Try again.`);
      } finally {
        busy = false;
      }
    }
    const modeLabel = derived(() => mode === "full" ? "Full clone" : "Linked clone");
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      if (Dialog) {
        $$renderer3.push("<!--[-->");
        Dialog($$renderer3, {
          get open() {
            return open;
          },
          set open($$value) {
            open = $$value;
            $$settled = false;
          },
          children: ($$renderer4) => {
            if (Dialog_content) {
              $$renderer4.push("<!--[-->");
              Dialog_content($$renderer4, {
                children: ($$renderer5) => {
                  if (Dialog_header) {
                    $$renderer5.push("<!--[-->");
                    Dialog_header($$renderer5, {
                      children: ($$renderer6) => {
                        if (Dialog_title) {
                          $$renderer6.push("<!--[-->");
                          Dialog_title($$renderer6, {
                            children: ($$renderer7) => {
                              $$renderer7.push(`<!---->Clone ${escape_html(vmName)}`);
                            },
                            $$slots: { default: true }
                          });
                          $$renderer6.push("<!--]-->");
                        } else {
                          $$renderer6.push("<!--[!-->");
                          $$renderer6.push("<!--]-->");
                        }
                        $$renderer6.push(` `);
                        if (Dialog_description) {
                          $$renderer6.push("<!--[-->");
                          Dialog_description($$renderer6, {
                            children: ($$renderer7) => {
                              $$renderer7.push(`<!---->Create a copy of this VM on the cluster.`);
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
                  $$renderer5.push(` <div class="flex flex-col gap-4"><div class="flex flex-col gap-2">`);
                  Label($$renderer5, {
                    for: "clone-name",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->Clone name`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> `);
                  Input($$renderer5, {
                    id: "clone-name",
                    type: "text",
                    autocomplete: "off",
                    get value() {
                      return cloneName;
                    },
                    set value($$value) {
                      cloneName = $$value;
                      $$settled = false;
                    }
                  });
                  $$renderer5.push(`<!----></div> <div class="flex flex-col gap-2">`);
                  Label($$renderer5, {
                    for: "clone-mode",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->Mode`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> `);
                  if (Select) {
                    $$renderer5.push("<!--[-->");
                    Select($$renderer5, {
                      type: "single",
                      get value() {
                        return mode;
                      },
                      set value($$value) {
                        mode = $$value;
                        $$settled = false;
                      },
                      children: ($$renderer6) => {
                        if (Select_trigger) {
                          $$renderer6.push("<!--[-->");
                          Select_trigger($$renderer6, {
                            id: "clone-mode",
                            class: "w-full",
                            children: ($$renderer7) => {
                              $$renderer7.push(`<!---->${escape_html(modeLabel())}`);
                            },
                            $$slots: { default: true }
                          });
                          $$renderer6.push("<!--]-->");
                        } else {
                          $$renderer6.push("<!--[!-->");
                          $$renderer6.push("<!--]-->");
                        }
                        $$renderer6.push(` `);
                        if (Select_content) {
                          $$renderer6.push("<!--[-->");
                          Select_content($$renderer6, {
                            children: ($$renderer7) => {
                              if (Select_item) {
                                $$renderer7.push("<!--[-->");
                                Select_item($$renderer7, {
                                  value: "linked",
                                  children: ($$renderer8) => {
                                    $$renderer8.push(`<!---->Linked clone`);
                                  },
                                  $$slots: { default: true }
                                });
                                $$renderer7.push("<!--]-->");
                              } else {
                                $$renderer7.push("<!--[!-->");
                                $$renderer7.push("<!--]-->");
                              }
                              $$renderer7.push(` `);
                              if (Select_item) {
                                $$renderer7.push("<!--[-->");
                                Select_item($$renderer7, {
                                  value: "full",
                                  children: ($$renderer8) => {
                                    $$renderer8.push(`<!---->Full clone`);
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
                  $$renderer5.push(`</div> <div class="flex flex-col gap-2">`);
                  Label($$renderer5, {
                    for: "clone-node",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->Target node`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> `);
                  if (Select) {
                    $$renderer5.push("<!--[-->");
                    Select($$renderer5, {
                      type: "single",
                      get value() {
                        return targetNode;
                      },
                      set value($$value) {
                        targetNode = $$value;
                        $$settled = false;
                      },
                      children: ($$renderer6) => {
                        if (Select_trigger) {
                          $$renderer6.push("<!--[-->");
                          Select_trigger($$renderer6, {
                            id: "clone-node",
                            class: "w-full",
                            children: ($$renderer7) => {
                              $$renderer7.push(`<!---->${escape_html(targetNode || "Choose a node")}`);
                            },
                            $$slots: { default: true }
                          });
                          $$renderer6.push("<!--]-->");
                        } else {
                          $$renderer6.push("<!--[!-->");
                          $$renderer6.push("<!--]-->");
                        }
                        $$renderer6.push(` `);
                        if (Select_content) {
                          $$renderer6.push("<!--[-->");
                          Select_content($$renderer6, {
                            children: ($$renderer7) => {
                              $$renderer7.push(`<!--[-->`);
                              const each_array = ensure_array_like(nodes);
                              for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
                                let n = each_array[$$index];
                                if (Select_item) {
                                  $$renderer7.push("<!--[-->");
                                  Select_item($$renderer7, {
                                    value: n,
                                    children: ($$renderer8) => {
                                      $$renderer8.push(`<!---->${escape_html(n)}`);
                                    },
                                    $$slots: { default: true }
                                  });
                                  $$renderer7.push("<!--]-->");
                                } else {
                                  $$renderer7.push("<!--[!-->");
                                  $$renderer7.push("<!--]-->");
                                }
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
                  $$renderer5.push(`</div> <div class="flex flex-col gap-2">`);
                  Label($$renderer5, {
                    for: "clone-storage",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->Target storage`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> `);
                  Input($$renderer5, {
                    id: "clone-storage",
                    type: "text",
                    placeholder: "Optional — leave blank to use the source storage.",
                    autocomplete: "off",
                    get value() {
                      return targetStorage;
                    },
                    set value($$value) {
                      targetStorage = $$value;
                      $$settled = false;
                    }
                  });
                  $$renderer5.push(`<!----></div> <div class="flex flex-col gap-2">`);
                  Label($$renderer5, {
                    for: "clone-vmid",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->New VMID`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> `);
                  Input($$renderer5, {
                    id: "clone-vmid",
                    type: "number",
                    min: 1,
                    placeholder: "Auto-assigned",
                    get value() {
                      return newVmid;
                    },
                    set value($$value) {
                      newVmid = $$value;
                      $$settled = false;
                    }
                  });
                  $$renderer5.push(`<!----> <p class="text-[13px] text-muted-foreground">Auto-assigned. Change only if you need a specific ID.</p></div></div> `);
                  if (Dialog_footer) {
                    $$renderer5.push("<!--[-->");
                    Dialog_footer($$renderer5, {
                      children: ($$renderer6) => {
                        Button($$renderer6, {
                          variant: "ghost",
                          onclick: () => open = false,
                          disabled: busy,
                          children: ($$renderer7) => {
                            $$renderer7.push(`<!---->Cancel`);
                          },
                          $$slots: { default: true }
                        });
                        $$renderer6.push(`<!----> `);
                        Button($$renderer6, {
                          onclick: handleSubmit,
                          disabled: busy || !nameValid() || !targetNode,
                          children: ($$renderer7) => {
                            $$renderer7.push(`<!---->Clone VM`);
                          },
                          $$slots: { default: true }
                        });
                        $$renderer6.push(`<!---->`);
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
    bind_props($$props, { open });
  });
}
function MigrateDialog($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { open = false, clusterId, vmid, type, vmName, currentNode } = $$props;
    let nodes = [];
    let targetNode = "";
    let online = true;
    let bwlimit = 0;
    let busy = false;
    let preflightError = null;
    let advancedOpen = false;
    const migrationTypeLabel = derived(() => online ? "Online (live)" : "Offline");
    async function handleSubmit() {
      if (busy || !targetNode) return;
      busy = true;
      preflightError = null;
      try {
        await api.lifecycle.migrate({
          clusterId,
          vmid,
          type,
          body: { target_node: targetNode, online, bwlimit_mbps: bwlimit }
        });
        toast(`Migrate started for ${vmName}.`);
        open = false;
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          const detail = typeof err.body === "object" && err.body !== null && "detail" in err.body ? String(err.body.detail) : "This VM can’t be migrated right now.";
          preflightError = detail;
        } else {
          toast.error(`Couldn’t queue the migration for ${vmName}. Try again.`);
        }
      } finally {
        busy = false;
      }
    }
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      if (Dialog) {
        $$renderer3.push("<!--[-->");
        Dialog($$renderer3, {
          get open() {
            return open;
          },
          set open($$value) {
            open = $$value;
            $$settled = false;
          },
          children: ($$renderer4) => {
            if (Dialog_content) {
              $$renderer4.push("<!--[-->");
              Dialog_content($$renderer4, {
                children: ($$renderer5) => {
                  if (Dialog_header) {
                    $$renderer5.push("<!--[-->");
                    Dialog_header($$renderer5, {
                      children: ($$renderer6) => {
                        if (Dialog_title) {
                          $$renderer6.push("<!--[-->");
                          Dialog_title($$renderer6, {
                            children: ($$renderer7) => {
                              $$renderer7.push(`<!---->Migrate ${escape_html(vmName)}`);
                            },
                            $$slots: { default: true }
                          });
                          $$renderer6.push("<!--]-->");
                        } else {
                          $$renderer6.push("<!--[!-->");
                          $$renderer6.push("<!--]-->");
                        }
                        $$renderer6.push(` `);
                        if (Dialog_description) {
                          $$renderer6.push("<!--[-->");
                          Dialog_description($$renderer6, {
                            children: ($$renderer7) => {
                              $$renderer7.push(`<!---->Move this VM to another node in the cluster.`);
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
                  $$renderer5.push(` <div class="flex flex-col gap-4"><div class="flex flex-col gap-2">`);
                  Label($$renderer5, {
                    for: "migrate-target",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->Target node`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> `);
                  if (Select) {
                    $$renderer5.push("<!--[-->");
                    Select($$renderer5, {
                      type: "single",
                      get value() {
                        return targetNode;
                      },
                      set value($$value) {
                        targetNode = $$value;
                        $$settled = false;
                      },
                      children: ($$renderer6) => {
                        if (Select_trigger) {
                          $$renderer6.push("<!--[-->");
                          Select_trigger($$renderer6, {
                            id: "migrate-target",
                            class: "w-full",
                            children: ($$renderer7) => {
                              $$renderer7.push(`<!---->${escape_html(targetNode || "Choose a node")}`);
                            },
                            $$slots: { default: true }
                          });
                          $$renderer6.push("<!--]-->");
                        } else {
                          $$renderer6.push("<!--[!-->");
                          $$renderer6.push("<!--]-->");
                        }
                        $$renderer6.push(` `);
                        if (Select_content) {
                          $$renderer6.push("<!--[-->");
                          Select_content($$renderer6, {
                            children: ($$renderer7) => {
                              $$renderer7.push(`<!--[-->`);
                              const each_array = ensure_array_like(nodes);
                              for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
                                let n = each_array[$$index];
                                if (Select_item) {
                                  $$renderer7.push("<!--[-->");
                                  Select_item($$renderer7, {
                                    value: n,
                                    children: ($$renderer8) => {
                                      $$renderer8.push(`<!---->${escape_html(n)}`);
                                    },
                                    $$slots: { default: true }
                                  });
                                  $$renderer7.push("<!--]-->");
                                } else {
                                  $$renderer7.push("<!--[!-->");
                                  $$renderer7.push("<!--]-->");
                                }
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
                  $$renderer5.push(` `);
                  if (targetNode) {
                    $$renderer5.push("<!--[0-->");
                    $$renderer5.push(`<p class="text-[13px] text-muted-foreground">Move ${escape_html(vmName)} from ${escape_html(currentNode)} to ${escape_html(targetNode)}.</p>`);
                  } else {
                    $$renderer5.push("<!--[-1-->");
                  }
                  $$renderer5.push(`<!--]--></div> `);
                  if (Collapsible) {
                    $$renderer5.push("<!--[-->");
                    Collapsible($$renderer5, {
                      get open() {
                        return advancedOpen;
                      },
                      set open($$value) {
                        advancedOpen = $$value;
                        $$settled = false;
                      },
                      children: ($$renderer6) => {
                        if (Collapsible_trigger) {
                          $$renderer6.push("<!--[-->");
                          Collapsible_trigger($$renderer6, {
                            class: "flex items-center gap-1 text-[13px] font-medium text-muted-foreground\n                 hover:text-foreground",
                            children: ($$renderer7) => {
                              Chevron_down($$renderer7, {
                                class: `size-4 transition-transform ${stringify(advancedOpen ? "" : "-rotate-90")}`,
                                "aria-hidden": "true"
                              });
                              $$renderer7.push(`<!----> Advanced`);
                            },
                            $$slots: { default: true }
                          });
                          $$renderer6.push("<!--]-->");
                        } else {
                          $$renderer6.push("<!--[!-->");
                          $$renderer6.push("<!--]-->");
                        }
                        $$renderer6.push(` `);
                        if (Collapsible_content) {
                          $$renderer6.push("<!--[-->");
                          Collapsible_content($$renderer6, {
                            class: "flex flex-col gap-4 pt-3",
                            children: ($$renderer7) => {
                              $$renderer7.push(`<div class="flex flex-col gap-2">`);
                              Label($$renderer7, {
                                for: "migrate-type",
                                children: ($$renderer8) => {
                                  $$renderer8.push(`<!---->Migration type`);
                                },
                                $$slots: { default: true }
                              });
                              $$renderer7.push(`<!----> `);
                              if (Select) {
                                $$renderer7.push("<!--[-->");
                                Select($$renderer7, {
                                  type: "single",
                                  value: online ? "online" : "offline",
                                  onValueChange: (v) => online = v === "online",
                                  children: ($$renderer8) => {
                                    if (Select_trigger) {
                                      $$renderer8.push("<!--[-->");
                                      Select_trigger($$renderer8, {
                                        id: "migrate-type",
                                        class: "w-full",
                                        children: ($$renderer9) => {
                                          $$renderer9.push(`<!---->${escape_html(migrationTypeLabel())}`);
                                        },
                                        $$slots: { default: true }
                                      });
                                      $$renderer8.push("<!--]-->");
                                    } else {
                                      $$renderer8.push("<!--[!-->");
                                      $$renderer8.push("<!--]-->");
                                    }
                                    $$renderer8.push(` `);
                                    if (Select_content) {
                                      $$renderer8.push("<!--[-->");
                                      Select_content($$renderer8, {
                                        children: ($$renderer9) => {
                                          if (Select_item) {
                                            $$renderer9.push("<!--[-->");
                                            Select_item($$renderer9, {
                                              value: "online",
                                              children: ($$renderer10) => {
                                                $$renderer10.push(`<!---->Online (live)`);
                                              },
                                              $$slots: { default: true }
                                            });
                                            $$renderer9.push("<!--]-->");
                                          } else {
                                            $$renderer9.push("<!--[!-->");
                                            $$renderer9.push("<!--]-->");
                                          }
                                          $$renderer9.push(` `);
                                          if (Select_item) {
                                            $$renderer9.push("<!--[-->");
                                            Select_item($$renderer9, {
                                              value: "offline",
                                              children: ($$renderer10) => {
                                                $$renderer10.push(`<!---->Offline`);
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
                              $$renderer7.push(`</div> <div class="flex flex-col gap-2">`);
                              Label($$renderer7, {
                                for: "migrate-bwlimit",
                                children: ($$renderer8) => {
                                  $$renderer8.push(`<!---->Bandwidth limit (MB/s)`);
                                },
                                $$slots: { default: true }
                              });
                              $$renderer7.push(`<!----> `);
                              Input($$renderer7, {
                                id: "migrate-bwlimit",
                                type: "number",
                                min: 0,
                                get value() {
                                  return bwlimit;
                                },
                                set value($$value) {
                                  bwlimit = $$value;
                                  $$settled = false;
                                }
                              });
                              $$renderer7.push(`<!----> <p class="text-[13px] text-muted-foreground">0 = unlimited</p></div>`);
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
                  $$renderer5.push(` `);
                  if (preflightError) {
                    $$renderer5.push("<!--[0-->");
                    $$renderer5.push(`<div class="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">`);
                    Circle_alert($$renderer5, {
                      class: "mt-0.5 size-4 shrink-0 text-destructive",
                      "aria-hidden": "true"
                    });
                    $$renderer5.push(`<!----> <p class="text-[14px] text-foreground">${escape_html(preflightError)}</p></div>`);
                  } else {
                    $$renderer5.push("<!--[-1-->");
                  }
                  $$renderer5.push(`<!--]--></div> `);
                  if (Dialog_footer) {
                    $$renderer5.push("<!--[-->");
                    Dialog_footer($$renderer5, {
                      children: ($$renderer6) => {
                        Button($$renderer6, {
                          variant: "ghost",
                          onclick: () => open = false,
                          disabled: busy,
                          children: ($$renderer7) => {
                            $$renderer7.push(`<!---->Cancel`);
                          },
                          $$slots: { default: true }
                        });
                        $$renderer6.push(`<!----> `);
                        Button($$renderer6, {
                          onclick: handleSubmit,
                          disabled: busy || !targetNode || preflightError !== null,
                          children: ($$renderer7) => {
                            $$renderer7.push(`<!---->Migrate VM`);
                          },
                          $$slots: { default: true }
                        });
                        $$renderer6.push(`<!---->`);
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
    bind_props($$props, { open });
  });
}
function ConvertTemplateDialog($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { open = false, clusterId, vmid, vmName } = $$props;
    let busy = false;
    async function handleConfirm() {
      if (busy) return;
      busy = true;
      try {
        await api.lifecycle.convertTemplate({ clusterId, vmid });
        toast(`Convert to template started for ${vmName}.`);
        open = false;
      } catch {
        toast.error(`Couldn’t queue the template conversion for ${vmName}. Try again.`);
      } finally {
        busy = false;
      }
    }
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      if (Alert_dialog) {
        $$renderer3.push("<!--[-->");
        Alert_dialog($$renderer3, {
          get open() {
            return open;
          },
          set open($$value) {
            open = $$value;
            $$settled = false;
          },
          children: ($$renderer4) => {
            if (Alert_dialog_content) {
              $$renderer4.push("<!--[-->");
              Alert_dialog_content($$renderer4, {
                children: ($$renderer5) => {
                  if (Alert_dialog_header) {
                    $$renderer5.push("<!--[-->");
                    Alert_dialog_header($$renderer5, {
                      children: ($$renderer6) => {
                        $$renderer6.push(`<div class="flex items-start gap-2">`);
                        Triangle_alert($$renderer6, {
                          class: "mt-0.5 size-5 shrink-0 text-warning",
                          "aria-hidden": "true"
                        });
                        $$renderer6.push(`<!----> <div class="flex flex-col gap-1">`);
                        if (Alert_dialog_title) {
                          $$renderer6.push("<!--[-->");
                          Alert_dialog_title($$renderer6, {
                            children: ($$renderer7) => {
                              $$renderer7.push(`<!---->Convert ${escape_html(vmName)} to a template?`);
                            },
                            $$slots: { default: true }
                          });
                          $$renderer6.push("<!--]-->");
                        } else {
                          $$renderer6.push("<!--[!-->");
                          $$renderer6.push("<!--]-->");
                        }
                        $$renderer6.push(` `);
                        if (Alert_dialog_description) {
                          $$renderer6.push("<!--[-->");
                          Alert_dialog_description($$renderer6, {
                            children: ($$renderer7) => {
                              $$renderer7.push(`<!---->${escape_html(vmName)} becomes a template and can no longer be started directly. This is a
            one-way change.`);
                            },
                            $$slots: { default: true }
                          });
                          $$renderer6.push("<!--]-->");
                        } else {
                          $$renderer6.push("<!--[!-->");
                          $$renderer6.push("<!--]-->");
                        }
                        $$renderer6.push(`</div></div>`);
                      },
                      $$slots: { default: true }
                    });
                    $$renderer5.push("<!--]-->");
                  } else {
                    $$renderer5.push("<!--[!-->");
                    $$renderer5.push("<!--]-->");
                  }
                  $$renderer5.push(` `);
                  if (Alert_dialog_footer) {
                    $$renderer5.push("<!--[-->");
                    Alert_dialog_footer($$renderer5, {
                      children: ($$renderer6) => {
                        Button($$renderer6, {
                          variant: "ghost",
                          onclick: () => open = false,
                          disabled: busy,
                          children: ($$renderer7) => {
                            $$renderer7.push(`<!---->Cancel`);
                          },
                          $$slots: { default: true }
                        });
                        $$renderer6.push(`<!----> `);
                        Button($$renderer6, {
                          onclick: handleConfirm,
                          disabled: busy,
                          children: ($$renderer7) => {
                            $$renderer7.push(`<!---->Convert to template`);
                          },
                          $$slots: { default: true }
                        });
                        $$renderer6.push(`<!---->`);
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
    bind_props($$props, { open });
  });
}
function ActionToolbar($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      clusterId,
      vmid,
      type,
      status,
      vmName,
      node,
      clusterUnreachable = false,
      backupStorageConfigured = true,
      onMoreAction
    } = $$props;
    const isRunning = derived(() => status === "running");
    const isStopped = derived(() => status === "stopped");
    let jobInFlight = false;
    const toolbarDisabled = derived(() => clusterUnreachable);
    let powerDialogOpen = false;
    let powerKind = "reboot";
    let pendingAction = "reboot";
    let deleteDialogOpen = false;
    function actionFor(kind) {
      return kind === "force-stop" ? "stop" : kind;
    }
    function label(action) {
      return action.charAt(0).toUpperCase() + action.slice(1);
    }
    async function runPower(action) {
      if (jobInFlight) return;
      jobInFlight = true;
      try {
        await api.lifecycle.power({ clusterId, vmid, type, action });
        toast(`${label(action)} queued for ${vmName}.`);
      } catch {
        toast.error(`Couldn’t queue ${label(action)} for ${vmName}. Try again.`);
      } finally {
        jobInFlight = false;
      }
    }
    function onStart() {
      void runPower("start");
    }
    function openPowerConfirm(kind) {
      powerKind = kind;
      pendingAction = actionFor(kind);
      powerDialogOpen = true;
    }
    async function confirmPower() {
      await runPower(pendingAction);
    }
    function escalateForceStop() {
      powerKind = "force-stop";
      pendingAction = "stop";
    }
    async function confirmDelete() {
      if (jobInFlight) return;
      jobInFlight = true;
      try {
        await api.lifecycle.del({ clusterId, vmid, type });
        toast(`Delete queued for ${vmName}.`);
      } catch {
        toast.error(`Couldn’t queue Delete for ${vmName}. Try again.`);
      } finally {
        jobInFlight = false;
      }
    }
    let snapshotDialogOpen = false;
    let resizeDialogOpen = false;
    let cloneDialogOpen = false;
    let migrateDialogOpen = false;
    let convertDialogOpen = false;
    const isLxc = derived(() => type === "lxc");
    function more(action) {
      switch (action) {
        case "snapshot":
          snapshotDialogOpen = true;
          break;
        case "resize":
          resizeDialogOpen = true;
          break;
        case "clone":
          cloneDialogOpen = true;
          break;
        case "migrate":
          migrateDialogOpen = true;
          break;
        case "template":
          convertDialogOpen = true;
          break;
        case "backup":
          void runBackupNow();
          break;
      }
      onMoreAction?.(action);
    }
    async function runBackupNow() {
      if (jobInFlight) return;
      jobInFlight = true;
      try {
        await api.lifecycle.backupNow({ clusterId, vmid, type });
        toast(`Backup started for ${vmName}.`);
      } catch {
        toast.error(`Couldn’t queue the backup for ${vmName}. Try again.`);
      } finally {
        jobInFlight = false;
      }
    }
    async function onSnapshotCreate(d) {
      await api.lifecycle.createSnapshot({
        clusterId,
        vmid,
        type,
        name: d.name,
        description: d.description,
        vmstate: d.vmstate
      });
      toast(`Snapshot started for ${vmName}.`);
    }
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      if (Tooltip_provider) {
        $$renderer3.push("<!--[-->");
        Tooltip_provider($$renderer3, {
          children: ($$renderer4) => {
            $$renderer4.push(`<div class="flex h-11 items-center gap-2">`);
            if (toolbarDisabled()) {
              $$renderer4.push("<!--[0-->");
              if (Tooltip) {
                $$renderer4.push("<!--[-->");
                Tooltip($$renderer4, {
                  children: ($$renderer5) => {
                    {
                      let child = function($$renderer6, { props }) {
                        $$renderer6.push(`<div${attributes({ ...props, class: "flex items-center gap-2 opacity-50" })}>`);
                        Button($$renderer6, {
                          variant: "outline",
                          size: "sm",
                          class: "h-9",
                          disabled: true,
                          children: ($$renderer7) => {
                            Play($$renderer7, { class: "size-3.5", "aria-hidden": "true" });
                            $$renderer7.push(`<!----> Start`);
                          },
                          $$slots: { default: true }
                        });
                        $$renderer6.push(`<!----> `);
                        Button($$renderer6, {
                          variant: "outline",
                          size: "sm",
                          class: "h-9",
                          disabled: true,
                          children: ($$renderer7) => {
                            Square($$renderer7, { class: "size-3.5", "aria-hidden": "true" });
                            $$renderer7.push(`<!----> Stop`);
                          },
                          $$slots: { default: true }
                        });
                        $$renderer6.push(`<!----> `);
                        Button($$renderer6, {
                          variant: "outline",
                          size: "sm",
                          class: "h-9",
                          disabled: true,
                          children: ($$renderer7) => {
                            Rotate_cw($$renderer7, { class: "size-3.5", "aria-hidden": "true" });
                            $$renderer7.push(`<!----> Reboot`);
                          },
                          $$slots: { default: true }
                        });
                        $$renderer6.push(`<!----> `);
                        Button($$renderer6, {
                          variant: "outline",
                          size: "sm",
                          class: "h-9",
                          disabled: true,
                          children: ($$renderer7) => {
                            Power($$renderer7, { class: "size-3.5", "aria-hidden": "true" });
                            $$renderer7.push(`<!----> Shutdown`);
                          },
                          $$slots: { default: true }
                        });
                        $$renderer6.push(`<!----></div>`);
                      };
                      if (Tooltip_trigger) {
                        $$renderer5.push("<!--[-->");
                        Tooltip_trigger($$renderer5, { child, $$slots: { child: true } });
                        $$renderer5.push("<!--]-->");
                      } else {
                        $$renderer5.push("<!--[!-->");
                        $$renderer5.push("<!--]-->");
                      }
                    }
                    $$renderer5.push(` `);
                    if (Tooltip_content) {
                      $$renderer5.push("<!--[-->");
                      Tooltip_content($$renderer5, {
                        children: ($$renderer6) => {
                          $$renderer6.push(`<!---->This cluster is currently unreachable.`);
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
              if (Tooltip) {
                $$renderer4.push("<!--[-->");
                Tooltip($$renderer4, {
                  children: ($$renderer5) => {
                    {
                      let child = function($$renderer6, { props }) {
                        $$renderer6.push(`<div${attributes({ ...props, class: "flex items-center gap-2" })}>`);
                        Button($$renderer6, {
                          variant: "outline",
                          size: "sm",
                          class: "h-9",
                          disabled: isRunning() || jobInFlight,
                          onclick: onStart,
                          children: ($$renderer7) => {
                            Play($$renderer7, { class: "size-3.5", "aria-hidden": "true" });
                            $$renderer7.push(`<!----> Start`);
                          },
                          $$slots: { default: true }
                        });
                        $$renderer6.push(`<!----> `);
                        Button($$renderer6, {
                          variant: "outline",
                          size: "sm",
                          class: "h-9",
                          disabled: isStopped() || jobInFlight,
                          onclick: () => openPowerConfirm("stop"),
                          children: ($$renderer7) => {
                            Square($$renderer7, { class: "size-3.5", "aria-hidden": "true" });
                            $$renderer7.push(`<!----> Stop`);
                          },
                          $$slots: { default: true }
                        });
                        $$renderer6.push(`<!----> `);
                        Button($$renderer6, {
                          variant: "outline",
                          size: "sm",
                          class: "h-9",
                          disabled: isStopped() || jobInFlight,
                          onclick: () => openPowerConfirm("reboot"),
                          children: ($$renderer7) => {
                            Rotate_cw($$renderer7, { class: "size-3.5", "aria-hidden": "true" });
                            $$renderer7.push(`<!----> Reboot`);
                          },
                          $$slots: { default: true }
                        });
                        $$renderer6.push(`<!----> `);
                        Button($$renderer6, {
                          variant: "outline",
                          size: "sm",
                          class: "h-9",
                          disabled: isStopped() || jobInFlight,
                          onclick: () => openPowerConfirm("shutdown"),
                          children: ($$renderer7) => {
                            Power($$renderer7, { class: "size-3.5", "aria-hidden": "true" });
                            $$renderer7.push(`<!----> Shutdown`);
                          },
                          $$slots: { default: true }
                        });
                        $$renderer6.push(`<!----></div>`);
                      };
                      if (Tooltip_trigger) {
                        $$renderer5.push("<!--[-->");
                        Tooltip_trigger($$renderer5, { child, $$slots: { child: true } });
                        $$renderer5.push("<!--]-->");
                      } else {
                        $$renderer5.push("<!--[!-->");
                        $$renderer5.push("<!--]-->");
                      }
                    }
                    $$renderer5.push(` `);
                    if (jobInFlight) {
                      $$renderer5.push("<!--[0-->");
                      if (Tooltip_content) {
                        $$renderer5.push("<!--[-->");
                        Tooltip_content($$renderer5, {
                          children: ($$renderer6) => {
                            $$renderer6.push(`<!---->An action is already running for this resource.`);
                          },
                          $$slots: { default: true }
                        });
                        $$renderer5.push("<!--]-->");
                      } else {
                        $$renderer5.push("<!--[!-->");
                        $$renderer5.push("<!--]-->");
                      }
                    } else {
                      $$renderer5.push("<!--[-1-->");
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
              if (Dropdown_menu) {
                $$renderer4.push("<!--[-->");
                Dropdown_menu($$renderer4, {
                  children: ($$renderer5) => {
                    {
                      let child = function($$renderer6, { props }) {
                        Button($$renderer6, spread_props([
                          props,
                          {
                            variant: "outline",
                            size: "sm",
                            class: "h-9",
                            disabled: jobInFlight,
                            children: ($$renderer7) => {
                              Ellipsis($$renderer7, { class: "size-3.5", "aria-hidden": "true" });
                              $$renderer7.push(`<!----> More`);
                            },
                            $$slots: { default: true }
                          }
                        ]));
                      };
                      if (Dropdown_menu_trigger) {
                        $$renderer5.push("<!--[-->");
                        Dropdown_menu_trigger($$renderer5, { child, $$slots: { child: true } });
                        $$renderer5.push("<!--]-->");
                      } else {
                        $$renderer5.push("<!--[!-->");
                        $$renderer5.push("<!--]-->");
                      }
                    }
                    $$renderer5.push(` `);
                    if (Dropdown_menu_content) {
                      $$renderer5.push("<!--[-->");
                      Dropdown_menu_content($$renderer5, {
                        align: "start",
                        children: ($$renderer6) => {
                          if (Dropdown_menu_item) {
                            $$renderer6.push("<!--[-->");
                            Dropdown_menu_item($$renderer6, {
                              onSelect: () => more("snapshot"),
                              children: ($$renderer7) => {
                                Camera($$renderer7, { class: "size-4 mr-2", "aria-hidden": "true" });
                                $$renderer7.push(`<!----> Snapshot`);
                              },
                              $$slots: { default: true }
                            });
                            $$renderer6.push("<!--]-->");
                          } else {
                            $$renderer6.push("<!--[!-->");
                            $$renderer6.push("<!--]-->");
                          }
                          $$renderer6.push(` `);
                          if (backupStorageConfigured) {
                            $$renderer6.push("<!--[0-->");
                            if (Dropdown_menu_item) {
                              $$renderer6.push("<!--[-->");
                              Dropdown_menu_item($$renderer6, {
                                onSelect: () => more("backup"),
                                children: ($$renderer7) => {
                                  Database($$renderer7, { class: "size-4 mr-2", "aria-hidden": "true" });
                                  $$renderer7.push(`<!----> Back up now`);
                                },
                                $$slots: { default: true }
                              });
                              $$renderer6.push("<!--]-->");
                            } else {
                              $$renderer6.push("<!--[!-->");
                              $$renderer6.push("<!--]-->");
                            }
                          } else {
                            $$renderer6.push("<!--[-1-->");
                            if (Tooltip) {
                              $$renderer6.push("<!--[-->");
                              Tooltip($$renderer6, {
                                children: ($$renderer7) => {
                                  {
                                    let child = function($$renderer8, { props }) {
                                      $$renderer8.push(`<div${attributes({ ...props })}>`);
                                      if (Dropdown_menu_item) {
                                        $$renderer8.push("<!--[-->");
                                        Dropdown_menu_item($$renderer8, {
                                          disabled: true,
                                          children: ($$renderer9) => {
                                            Database($$renderer9, { class: "size-4 mr-2", "aria-hidden": "true" });
                                            $$renderer9.push(`<!----> Back up now`);
                                          },
                                          $$slots: { default: true }
                                        });
                                        $$renderer8.push("<!--]-->");
                                      } else {
                                        $$renderer8.push("<!--[!-->");
                                        $$renderer8.push("<!--]-->");
                                      }
                                      $$renderer8.push(`</div>`);
                                    };
                                    if (Tooltip_trigger) {
                                      $$renderer7.push("<!--[-->");
                                      Tooltip_trigger($$renderer7, { child, $$slots: { child: true } });
                                      $$renderer7.push("<!--]-->");
                                    } else {
                                      $$renderer7.push("<!--[!-->");
                                      $$renderer7.push("<!--]-->");
                                    }
                                  }
                                  $$renderer7.push(` `);
                                  if (Tooltip_content) {
                                    $$renderer7.push("<!--[-->");
                                    Tooltip_content($$renderer7, {
                                      children: ($$renderer8) => {
                                        $$renderer8.push(`<!---->No backup storage is configured for this cluster.`);
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
                          }
                          $$renderer6.push(`<!--]--> `);
                          if (Dropdown_menu_item) {
                            $$renderer6.push("<!--[-->");
                            Dropdown_menu_item($$renderer6, {
                              onSelect: () => more("resize"),
                              children: ($$renderer7) => {
                                Cpu($$renderer7, { class: "size-4 mr-2", "aria-hidden": "true" });
                                $$renderer7.push(`<!----> Resize`);
                              },
                              $$slots: { default: true }
                            });
                            $$renderer6.push("<!--]-->");
                          } else {
                            $$renderer6.push("<!--[!-->");
                            $$renderer6.push("<!--]-->");
                          }
                          $$renderer6.push(` `);
                          if (Dropdown_menu_separator) {
                            $$renderer6.push("<!--[-->");
                            Dropdown_menu_separator($$renderer6, {});
                            $$renderer6.push("<!--]-->");
                          } else {
                            $$renderer6.push("<!--[!-->");
                            $$renderer6.push("<!--]-->");
                          }
                          $$renderer6.push(` `);
                          if (Dropdown_menu_item) {
                            $$renderer6.push("<!--[-->");
                            Dropdown_menu_item($$renderer6, {
                              onSelect: () => more("clone"),
                              children: ($$renderer7) => {
                                Copy($$renderer7, { class: "size-4 mr-2", "aria-hidden": "true" });
                                $$renderer7.push(`<!----> Clone`);
                              },
                              $$slots: { default: true }
                            });
                            $$renderer6.push("<!--]-->");
                          } else {
                            $$renderer6.push("<!--[!-->");
                            $$renderer6.push("<!--]-->");
                          }
                          $$renderer6.push(` `);
                          if (Dropdown_menu_item) {
                            $$renderer6.push("<!--[-->");
                            Dropdown_menu_item($$renderer6, {
                              onSelect: () => more("migrate"),
                              children: ($$renderer7) => {
                                Arrow_right_left($$renderer7, { class: "size-4 mr-2", "aria-hidden": "true" });
                                $$renderer7.push(`<!----> Migrate`);
                              },
                              $$slots: { default: true }
                            });
                            $$renderer6.push("<!--]-->");
                          } else {
                            $$renderer6.push("<!--[!-->");
                            $$renderer6.push("<!--]-->");
                          }
                          $$renderer6.push(` `);
                          if (isLxc()) {
                            $$renderer6.push("<!--[0-->");
                            if (Tooltip) {
                              $$renderer6.push("<!--[-->");
                              Tooltip($$renderer6, {
                                children: ($$renderer7) => {
                                  {
                                    let child = function($$renderer8, { props }) {
                                      $$renderer8.push(`<div${attributes({ ...props })}>`);
                                      if (Dropdown_menu_item) {
                                        $$renderer8.push("<!--[-->");
                                        Dropdown_menu_item($$renderer8, {
                                          disabled: true,
                                          children: ($$renderer9) => {
                                            File_stack($$renderer9, { class: "size-4 mr-2", "aria-hidden": "true" });
                                            $$renderer9.push(`<!----> Convert to template`);
                                          },
                                          $$slots: { default: true }
                                        });
                                        $$renderer8.push("<!--]-->");
                                      } else {
                                        $$renderer8.push("<!--[!-->");
                                        $$renderer8.push("<!--]-->");
                                      }
                                      $$renderer8.push(`</div>`);
                                    };
                                    if (Tooltip_trigger) {
                                      $$renderer7.push("<!--[-->");
                                      Tooltip_trigger($$renderer7, { child, $$slots: { child: true } });
                                      $$renderer7.push("<!--]-->");
                                    } else {
                                      $$renderer7.push("<!--[!-->");
                                      $$renderer7.push("<!--]-->");
                                    }
                                  }
                                  $$renderer7.push(` `);
                                  if (Tooltip_content) {
                                    $$renderer7.push("<!--[-->");
                                    Tooltip_content($$renderer7, {
                                      children: ($$renderer8) => {
                                        $$renderer8.push(`<!---->Container-to-template conversion isn't supported here.`);
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
                          } else {
                            $$renderer6.push("<!--[-1-->");
                            if (Dropdown_menu_item) {
                              $$renderer6.push("<!--[-->");
                              Dropdown_menu_item($$renderer6, {
                                onSelect: () => more("template"),
                                children: ($$renderer7) => {
                                  File_stack($$renderer7, { class: "size-4 mr-2", "aria-hidden": "true" });
                                  $$renderer7.push(`<!----> Convert to template`);
                                },
                                $$slots: { default: true }
                              });
                              $$renderer6.push("<!--]-->");
                            } else {
                              $$renderer6.push("<!--[!-->");
                              $$renderer6.push("<!--]-->");
                            }
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
              $$renderer4.push(` <div class="flex-1"></div> <div class="h-6 w-px bg-border" aria-hidden="true"></div> `);
              Button($$renderer4, {
                variant: "destructive",
                size: "sm",
                class: "h-9",
                disabled: jobInFlight,
                onclick: () => deleteDialogOpen = true,
                children: ($$renderer5) => {
                  Trash_2($$renderer5, { class: "size-3.5", "aria-hidden": "true" });
                  $$renderer5.push(`<!----> Delete`);
                },
                $$slots: { default: true }
              });
              $$renderer4.push(`<!---->`);
            }
            $$renderer4.push(`<!--]--></div>`);
          },
          $$slots: { default: true }
        });
        $$renderer3.push("<!--]-->");
      } else {
        $$renderer3.push("<!--[!-->");
        $$renderer3.push("<!--]-->");
      }
      $$renderer3.push(` `);
      PowerConfirmDialog($$renderer3, {
        kind: powerKind,
        vmName,
        onConfirm: confirmPower,
        onEscalateForceStop: escalateForceStop,
        get open() {
          return powerDialogOpen;
        },
        set open($$value) {
          powerDialogOpen = $$value;
          $$settled = false;
        }
      });
      $$renderer3.push(`<!----> `);
      ConfirmByNameDialog($$renderer3, {
        heading: `Delete ${vmName}?`,
        body: `This permanently destroys ${vmName} and its disks on Proxmox. Snapshots and backups taken by this GUI are not automatically removed. This can't be undone.`,
        targetName: vmName,
        confirmLabel: "Delete VM",
        onConfirm: confirmDelete,
        get open() {
          return deleteDialogOpen;
        },
        set open($$value) {
          deleteDialogOpen = $$value;
          $$settled = false;
        }
      });
      $$renderer3.push(`<!----> `);
      SnapshotCreateDialog($$renderer3, {
        vmName,
        onSubmit: onSnapshotCreate,
        get open() {
          return snapshotDialogOpen;
        },
        set open($$value) {
          snapshotDialogOpen = $$value;
          $$settled = false;
        }
      });
      $$renderer3.push(`<!----> `);
      ResizeDialog($$renderer3, {
        clusterId,
        vmid,
        type,
        vmName,
        get open() {
          return resizeDialogOpen;
        },
        set open($$value) {
          resizeDialogOpen = $$value;
          $$settled = false;
        }
      });
      $$renderer3.push(`<!----> `);
      CloneDialog($$renderer3, {
        clusterId,
        vmid,
        type,
        vmName,
        currentNode: node,
        get open() {
          return cloneDialogOpen;
        },
        set open($$value) {
          cloneDialogOpen = $$value;
          $$settled = false;
        }
      });
      $$renderer3.push(`<!----> `);
      MigrateDialog($$renderer3, {
        clusterId,
        vmid,
        type,
        vmName,
        currentNode: node,
        get open() {
          return migrateDialogOpen;
        },
        set open($$value) {
          migrateDialogOpen = $$value;
          $$settled = false;
        }
      });
      $$renderer3.push(`<!----> `);
      if (!isLxc()) {
        $$renderer3.push("<!--[0-->");
        ConvertTemplateDialog($$renderer3, {
          clusterId,
          vmid,
          vmName,
          get open() {
            return convertDialogOpen;
          },
          set open($$value) {
            convertDialogOpen = $$value;
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
function SnapshotsTab($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { clusterId, vmid, type, vmName } = $$props;
    let createOpen = false;
    async function onCreateSubmit(d) {
      await api.lifecycle.createSnapshot({
        clusterId,
        vmid,
        type,
        name: d.name,
        description: d.description,
        vmstate: d.vmstate
      });
      toast(`Snapshot started for ${vmName}.`);
    }
    let restoreOpen = false;
    let restoreTarget = "";
    async function confirmRestore() {
      try {
        await api.lifecycle.rollbackSnapshot({ clusterId, vmid, type, name: restoreTarget });
        toast(`Restore started for ${vmName}.`);
      } catch {
        toast.error(`Couldn’t queue the restore for ${vmName}. Try again.`);
      }
    }
    let deleteOpen = false;
    let deleteTarget = "";
    async function confirmDelete() {
      try {
        await api.lifecycle.deleteSnapshot({ clusterId, vmid, type, name: deleteTarget });
        toast(`Delete snapshot started for ${vmName}.`);
      } catch {
        toast.error(`Couldn’t queue the snapshot delete for ${vmName}. Try again.`);
      }
    }
    const isEmpty = derived(() => false);
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      if (Card) {
        $$renderer3.push("<!--[-->");
        Card($$renderer3, {
          children: ($$renderer4) => {
            if (Card_header) {
              $$renderer4.push("<!--[-->");
              Card_header($$renderer4, {
                class: "flex flex-row items-center justify-between gap-4",
                children: ($$renderer5) => {
                  if (Card_title) {
                    $$renderer5.push("<!--[-->");
                    Card_title($$renderer5, {
                      class: "text-[18px] font-semibold",
                      children: ($$renderer6) => {
                        $$renderer6.push(`<!---->Snapshots`);
                      },
                      $$slots: { default: true }
                    });
                    $$renderer5.push("<!--]-->");
                  } else {
                    $$renderer5.push("<!--[!-->");
                    $$renderer5.push("<!--]-->");
                  }
                  $$renderer5.push(` `);
                  if (!isEmpty()) {
                    $$renderer5.push("<!--[0-->");
                    Button($$renderer5, {
                      size: "sm",
                      onclick: () => createOpen = true,
                      children: ($$renderer6) => {
                        Camera($$renderer6, { class: "size-3.5", "aria-hidden": "true" });
                        $$renderer6.push(`<!----> Create snapshot`);
                      },
                      $$slots: { default: true }
                    });
                  } else {
                    $$renderer5.push("<!--[-1-->");
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
            if (Card_content) {
              $$renderer4.push("<!--[-->");
              Card_content($$renderer4, {
                children: ($$renderer5) => {
                  {
                    $$renderer5.push("<!--[0-->");
                    $$renderer5.push(`<div class="flex flex-col gap-2" aria-hidden="true"><!--[-->`);
                    const each_array = ensure_array_like([0, 1, 2]);
                    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
                      each_array[$$index];
                      $$renderer5.push(`<div class="h-10 animate-pulse rounded bg-muted"></div>`);
                    }
                    $$renderer5.push(`<!--]--></div>`);
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
      $$renderer3.push(` `);
      SnapshotCreateDialog($$renderer3, {
        vmName,
        onSubmit: onCreateSubmit,
        get open() {
          return createOpen;
        },
        set open($$value) {
          createOpen = $$value;
          $$settled = false;
        }
      });
      $$renderer3.push(`<!----> `);
      ConfirmByNameDialog($$renderer3, {
        heading: `Restore ${vmName} to '${restoreTarget}'?`,
        body: `This rolls ${vmName} back to the '${restoreTarget}' state. Changes made since that snapshot are lost. This can't be undone.`,
        targetName: vmName,
        confirmLabel: "Restore snapshot",
        onConfirm: confirmRestore,
        get open() {
          return restoreOpen;
        },
        set open($$value) {
          restoreOpen = $$value;
          $$settled = false;
        }
      });
      $$renderer3.push(`<!----> `);
      ConfirmByNameDialog($$renderer3, {
        heading: `Delete snapshot '${deleteTarget}'?`,
        body: `The '${deleteTarget}' snapshot of ${vmName} is removed. Child snapshots that depend on it may also be affected. This can't be undone.`,
        targetName: deleteTarget,
        confirmLabel: "Delete snapshot",
        onConfirm: confirmDelete,
        get open() {
          return deleteOpen;
        },
        set open($$value) {
          deleteOpen = $$value;
          $$settled = false;
        }
      });
      $$renderer3.push(`<!---->`);
    }
    do {
      $$settled = true;
      $$inner_renderer = $$renderer2.copy();
      $$render_inner($$inner_renderer);
    } while (!$$settled);
    $$renderer2.subsume($$inner_renderer);
  });
}
function BackupScheduleCard($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      if (Card) {
        $$renderer3.push("<!--[-->");
        Card($$renderer3, {
          children: ($$renderer4) => {
            if (Card_header) {
              $$renderer4.push("<!--[-->");
              Card_header($$renderer4, {
                children: ($$renderer5) => {
                  if (Card_title) {
                    $$renderer5.push("<!--[-->");
                    Card_title($$renderer5, {
                      class: "text-[18px] font-semibold",
                      children: ($$renderer6) => {
                        $$renderer6.push(`<!---->Schedule`);
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
            if (Card_content) {
              $$renderer4.push("<!--[-->");
              Card_content($$renderer4, {
                children: ($$renderer5) => {
                  {
                    $$renderer5.push("<!--[0-->");
                    $$renderer5.push(`<div class="h-10 animate-pulse rounded bg-muted" aria-hidden="true"></div>`);
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
    }
    do {
      $$settled = true;
      $$inner_renderer = $$renderer2.copy();
      $$render_inner($$inner_renderer);
    } while (!$$settled);
    $$renderer2.subsume($$inner_renderer);
  });
}
function RestoreDialog($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      open = false,
      clusterId,
      vmid,
      type,
      vmName,
      backupFilename,
      archiveVolid
    } = $$props;
    let mode = "in_place";
    let typed = "";
    let newVmid = "";
    let newName = "";
    let busy = false;
    const matches = derived(() => typed.trim() === vmName.trim());
    const showHint = derived(() => typed.length > 0 && !matches());
    const ctaLabel = derived(() => "Restore (overwrite)");
    const canSubmit = derived(() => matches());
    function onTypedKeydown(event) {
      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
      }
    }
    async function handleSubmit() {
      if (busy || !canSubmit()) return;
      busy = true;
      try {
        await api.lifecycle.restore({
          clusterId,
          vmid,
          type,
          archive: archiveVolid,
          mode,
          ...mode === "new" ? { new_vmid: Number(newVmid.trim()), new_name: newName.trim() } : {}
        });
        toast(`Restore started for ${vmName}.`);
        open = false;
      } catch {
        toast.error(`Couldn’t queue the restore for ${vmName}. Try again.`);
      } finally {
        busy = false;
      }
    }
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      if (Dialog) {
        $$renderer3.push("<!--[-->");
        Dialog($$renderer3, {
          get open() {
            return open;
          },
          set open($$value) {
            open = $$value;
            $$settled = false;
          },
          children: ($$renderer4) => {
            if (Dialog_content) {
              $$renderer4.push("<!--[-->");
              Dialog_content($$renderer4, {
                children: ($$renderer5) => {
                  if (Dialog_header) {
                    $$renderer5.push("<!--[-->");
                    Dialog_header($$renderer5, {
                      children: ($$renderer6) => {
                        if (Dialog_title) {
                          $$renderer6.push("<!--[-->");
                          Dialog_title($$renderer6, {
                            children: ($$renderer7) => {
                              $$renderer7.push(`<!---->Restore ${escape_html(vmName)}`);
                            },
                            $$slots: { default: true }
                          });
                          $$renderer6.push("<!--]-->");
                        } else {
                          $$renderer6.push("<!--[!-->");
                          $$renderer6.push("<!--]-->");
                        }
                        $$renderer6.push(` `);
                        if (Dialog_description) {
                          $$renderer6.push("<!--[-->");
                          Dialog_description($$renderer6, {
                            children: ($$renderer7) => {
                              $$renderer7.push(`<!---->from ${escape_html(backupFilename)}`);
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
                  $$renderer5.push(` <div class="flex flex-col gap-4"><fieldset class="flex flex-col gap-2"><legend class="text-[13px] font-medium mb-1">Restore mode</legend> <label class="flex items-start gap-2 text-[14px]"><input type="radio" name="restore-mode" value="in_place" class="mt-1"${attr("checked", mode === "in_place", true)}/> <span>Overwrite this VM (in-place)</span></label> <label class="flex items-start gap-2 text-[14px]"><input type="radio" name="restore-mode" value="new" class="mt-1"${attr("checked", mode === "new", true)}/> <span>Restore as a new VM</span></label></fieldset> `);
                  {
                    $$renderer5.push("<!--[0-->");
                    $$renderer5.push(`<div class="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3">`);
                    Triangle_alert($$renderer5, {
                      class: "size-4 shrink-0 text-destructive mt-0.5",
                      "aria-hidden": "true"
                    });
                    $$renderer5.push(`<!----> <p class="text-[14px] text-foreground">This replaces the current disk contents of ${escape_html(vmName)} with the backup
            '${escape_html(backupFilename)}'. The current state is lost. This can't be undone.</p></div> <div class="flex flex-col gap-2">`);
                    Label($$renderer5, {
                      for: "restore-confirm-name",
                      children: ($$renderer6) => {
                        $$renderer6.push(`<!---->Type <code class="bg-muted rounded px-1 py-0.5 font-mono text-xs">${escape_html(vmName)}</code> to confirm`);
                      },
                      $$slots: { default: true }
                    });
                    $$renderer5.push(`<!----> `);
                    Input($$renderer5, {
                      id: "restore-confirm-name",
                      type: "text",
                      autocomplete: "off",
                      autocapitalize: "off",
                      autocorrect: "off",
                      spellcheck: false,
                      onkeydown: onTypedKeydown,
                      "aria-invalid": showHint() ? "true" : void 0,
                      "aria-describedby": showHint() ? "restore-confirm-hint" : void 0,
                      get value() {
                        return typed;
                      },
                      set value($$value) {
                        typed = $$value;
                        $$settled = false;
                      }
                    });
                    $$renderer5.push(`<!----> `);
                    if (showHint()) {
                      $$renderer5.push("<!--[0-->");
                      $$renderer5.push(`<p id="restore-confirm-hint" class="text-destructive text-[13px]">Doesn't match — type the name exactly.</p>`);
                    } else {
                      $$renderer5.push("<!--[-1-->");
                    }
                    $$renderer5.push(`<!--]--></div>`);
                  }
                  $$renderer5.push(`<!--]--></div> `);
                  if (Dialog_footer) {
                    $$renderer5.push("<!--[-->");
                    Dialog_footer($$renderer5, {
                      children: ($$renderer6) => {
                        Button($$renderer6, {
                          variant: "ghost",
                          onclick: () => open = false,
                          disabled: busy,
                          children: ($$renderer7) => {
                            $$renderer7.push(`<!---->Cancel`);
                          },
                          $$slots: { default: true }
                        });
                        $$renderer6.push(`<!----> `);
                        Button($$renderer6, {
                          variant: "destructive",
                          onclick: handleSubmit,
                          disabled: busy || !canSubmit(),
                          children: ($$renderer7) => {
                            $$renderer7.push(`<!---->${escape_html(ctaLabel())}`);
                          },
                          $$slots: { default: true }
                        });
                        $$renderer6.push(`<!---->`);
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
    bind_props($$props, { open });
  });
}
function BackupsTab($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { clusterId, vmid, type, vmName, backupStorageConfigured } = $$props;
    let backingUp = false;
    async function onBackupNow() {
      if (backingUp || !backupStorageConfigured) return;
      backingUp = true;
      try {
        await api.lifecycle.backupNow({ clusterId, vmid, type });
        toast(`Backup started for ${vmName}.`);
      } catch {
        toast.error(`Couldn’t queue the backup for ${vmName}. Try again.`);
      } finally {
        backingUp = false;
      }
    }
    let restoreOpen = false;
    let restoreVolid = "";
    let restoreFilename = "";
    let deleteOpen = false;
    let deleteVolid = "";
    let deleteFilename = "";
    async function confirmDelete() {
      try {
        await api.lifecycle.deleteBackupFile({ clusterId, vmid, type, volid: deleteVolid });
        toast(`Delete backup started for ${vmName}.`);
      } catch {
        toast.error(`Couldn’t queue the backup delete. Try again.`);
      }
    }
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      $$renderer3.push(`<div class="flex flex-col gap-6">`);
      if (!backupStorageConfigured) {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<div class="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-3" role="status">`);
        Triangle_alert($$renderer3, {
          class: "size-4 shrink-0 text-warning mt-0.5",
          "aria-hidden": "true"
        });
        $$renderer3.push(`<!----> <p class="text-[14px] text-foreground">No backup storage is configured for this cluster. Ask an administrator
        to set one.</p></div>`);
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--> `);
      BackupScheduleCard($$renderer3);
      $$renderer3.push(`<!----> `);
      if (Card) {
        $$renderer3.push("<!--[-->");
        Card($$renderer3, {
          children: ($$renderer4) => {
            if (Card_header) {
              $$renderer4.push("<!--[-->");
              Card_header($$renderer4, {
                class: "flex flex-row items-center justify-between gap-4",
                children: ($$renderer5) => {
                  if (Card_title) {
                    $$renderer5.push("<!--[-->");
                    Card_title($$renderer5, {
                      class: "text-[18px] font-semibold",
                      children: ($$renderer6) => {
                        $$renderer6.push(`<!---->Backups`);
                      },
                      $$slots: { default: true }
                    });
                    $$renderer5.push("<!--]-->");
                  } else {
                    $$renderer5.push("<!--[!-->");
                    $$renderer5.push("<!--]-->");
                  }
                  $$renderer5.push(` `);
                  Button($$renderer5, {
                    size: "sm",
                    onclick: onBackupNow,
                    disabled: !backupStorageConfigured || backingUp,
                    children: ($$renderer6) => {
                      Database($$renderer6, { class: "size-3.5", "aria-hidden": "true" });
                      $$renderer6.push(`<!----> Back up now`);
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
            $$renderer4.push(` `);
            if (Card_content) {
              $$renderer4.push("<!--[-->");
              Card_content($$renderer4, {
                children: ($$renderer5) => {
                  {
                    $$renderer5.push("<!--[0-->");
                    $$renderer5.push(`<div class="flex flex-col gap-2" aria-hidden="true"><!--[-->`);
                    const each_array = ensure_array_like([0, 1, 2]);
                    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
                      each_array[$$index];
                      $$renderer5.push(`<div class="h-12 animate-pulse rounded bg-muted"></div>`);
                    }
                    $$renderer5.push(`<!--]--></div>`);
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
      $$renderer3.push(`</div> `);
      RestoreDialog($$renderer3, {
        clusterId,
        vmid,
        type,
        vmName,
        backupFilename: restoreFilename,
        archiveVolid: restoreVolid,
        get open() {
          return restoreOpen;
        },
        set open($$value) {
          restoreOpen = $$value;
          $$settled = false;
        }
      });
      $$renderer3.push(`<!----> `);
      ConfirmByNameDialog($$renderer3, {
        heading: `Delete backup '${deleteFilename}'?`,
        body: `This backup file is permanently removed from storage. This can't be undone.`,
        targetName: deleteFilename,
        confirmLabel: "Delete backup",
        onConfirm: confirmDelete,
        get open() {
          return deleteOpen;
        },
        set open($$value) {
          deleteOpen = $$value;
          $$settled = false;
        }
      });
      $$renderer3.push(`<!---->`);
    }
    do {
      $$settled = true;
      $$inner_renderer = $$renderer2.copy();
      $$render_inner($$inner_renderer);
    } while (!$$settled);
    $$renderer2.subsume($$inner_renderer);
  });
}
function Monitor_play($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    [
      "path",
      {
        "d": "M15.033 9.44a.647.647 0 0 1 0 1.12l-4.065 2.352a.645.645 0 0 1-.968-.56V7.648a.645.645 0 0 1 .967-.56z"
      }
    ],
    ["path", { "d": "M12 17v4" }],
    ["path", { "d": "M8 21h8" }],
    [
      "rect",
      { "x": "2", "y": "3", "width": "20", "height": "14", "rx": "2" }
    ]
  ];
  Icon($$renderer, spread_props([{ name: "monitor-play" }, props, { iconNode }]));
}
function Maximize_2($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["path", { "d": "M15 3h6v6" }],
    ["path", { "d": "m21 3-7 7" }],
    ["path", { "d": "m3 21 7-7" }],
    ["path", { "d": "M9 21H3v-6" }]
  ];
  Icon($$renderer, spread_props([{ name: "maximize-2" }, props, { iconNode }]));
}
function ConsoleTab($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { clusterId, vmid, kind, name } = $$props;
    let phase = "placeholder";
    let iframeSrc = null;
    let errorMessage = null;
    let iframeKey = 0;
    const showIframe = derived(() => iframeVisible(phase));
    const bodyCopy = derived(() => placeholderBody(name));
    async function openConsole() {
      phase = "connecting";
      errorMessage = null;
      try {
        const res = await api.console.mintVncProxy({ clusterId, vmid, kind });
        iframeSrc = consoleIframeSrc(consoleEmbedSrc(res.relay_url, res.ticket, res.port));
        iframeKey += 1;
        phase = "live";
      } catch {
        iframeSrc = null;
        errorMessage = "Couldn't open the console. Try again.";
        phase = "error";
      }
    }
    if (phase === "placeholder" || phase === "connecting" || phase === "error") {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="flex min-h-[480px] flex-col items-center justify-center rounded-md border border-border bg-muted/20 px-6 py-12 text-center">`);
      Monitor_play($$renderer2, { class: "size-6 text-muted-foreground", "aria-hidden": "true" });
      $$renderer2.push(`<!----> <h3 class="mt-4 text-[18px] font-semibold">Console</h3> <p class="mt-1 max-w-md text-[14px] text-muted-foreground">${escape_html(bodyCopy())}</p> `);
      if (phase === "error" && errorMessage) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<p class="mt-3 inline-flex items-center gap-1.5 text-[13px] text-destructive">`);
        Circle_alert($$renderer2, { class: "size-4", "aria-hidden": "true" });
        $$renderer2.push(`<!----> ${escape_html(errorMessage)}</p>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (phase === "connecting") {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<p class="mt-6 inline-flex items-center gap-2 text-[14px] text-muted-foreground">`);
        Loader_circle($$renderer2, { class: "size-4 animate-spin", "aria-hidden": "true" });
        $$renderer2.push(`<!----> Connecting to console…</p>`);
      } else {
        $$renderer2.push("<!--[-1-->");
        Button($$renderer2, {
          class: "mt-6",
          onclick: openConsole,
          children: ($$renderer3) => {
            Monitor_play($$renderer3, { class: "size-4", "aria-hidden": "true" });
            $$renderer3.push(`<!----> Open console`);
          },
          $$slots: { default: true }
        });
      }
      $$renderer2.push(`<!--]--></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="flex min-h-[480px] flex-col overflow-hidden rounded-md border border-border bg-background"><div class="flex items-center justify-between border-b border-border px-3 py-2"><span class="text-[13px] font-medium text-muted-foreground">Console — ${escape_html(name)}</span> <div class="flex items-center gap-1">`);
      Button($$renderer2, {
        variant: "ghost",
        size: "sm",
        onclick: openConsole,
        children: ($$renderer3) => {
          Refresh_cw($$renderer3, { class: "size-4", "aria-hidden": "true" });
          $$renderer3.push(`<!----> Reconnect`);
        },
        $$slots: { default: true }
      });
      $$renderer2.push(`<!----> <button type="button" class="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Fullscreen" title="Fullscreen">`);
      Maximize_2($$renderer2, { class: "size-4", "aria-hidden": "true" });
      $$renderer2.push(`<!----></button></div></div> `);
      if (phase === "disconnected") {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="flex items-center gap-2 bg-warning/10 px-3 py-2 text-[13px] text-foreground">`);
        Circle_alert($$renderer2, { class: "size-4 text-warning", "aria-hidden": "true" });
        $$renderer2.push(`<!----> Console session ended. `);
        Button($$renderer2, {
          variant: "link",
          size: "sm",
          class: "h-auto p-0",
          onclick: openConsole,
          children: ($$renderer3) => {
            $$renderer3.push(`<!---->Reconnect`);
          },
          $$slots: { default: true }
        });
        $$renderer2.push(`<!----></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (showIframe() && iframeSrc) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<!---->`);
        {
          $$renderer2.push(`<iframe${attr("src", iframeSrc)}${attr("title", `Console — ${name}`)} sandbox="allow-scripts allow-same-origin" class="aspect-[16/10] min-h-[480px] w-full flex-1 border-0" onerror="this.__e=event"></iframe>`);
        }
        $$renderer2.push(`<!---->`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div>`);
    }
    $$renderer2.push(`<!--]-->`);
  });
}
const CREATE_KINDS = /* @__PURE__ */ new Set(["vm.create", "vm.create.qemu", "lxc.create"]);
const IN_FLIGHT = /* @__PURE__ */ new Set(["pending", "claimed", "running"]);
function findCreateJob(jobs, clusterId) {
  const candidates = jobs.filter((j) => CREATE_KINDS.has(j.kind) && j.cluster_id === clusterId).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  return candidates[0] ?? null;
}
function bannerState(job) {
  if (job === null) return "none";
  if (IN_FLIGHT.has(job.state)) return "running";
  if (job.state === "failed") return "failed";
  return "none";
}
function provisioningRunningText(name) {
  return `Provisioning ${name}… This page updates automatically.`;
}
function provisioningFailureText(job) {
  return job?.friendly_error ?? job?.error ?? "Provisioning failed.";
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let { data } = $$props;
    const detail = derived(() => data.detail);
    const backupStorageConfigured = derived(() => data.backupStorageConfigured ?? true);
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
    const createJob = derived(() => detail() ? findCreateJob(jobsStore.jobs, detail().cluster_id) : null);
    const provisioningState = derived(() => bannerState(createJob()));
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
      if (provisioningState() === "running") {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="mb-6 flex h-12 items-center gap-2 rounded-md bg-primary/10 px-4 text-[14px]">`);
        Loader_circle($$renderer2, {
          class: "size-4 animate-spin text-primary",
          "aria-hidden": "true"
        });
        $$renderer2.push(`<!----> <span>${escape_html(provisioningRunningText(detail().name ?? `VM ${detail().vmid}`))}</span></div>`);
      } else if (provisioningState() === "failed") {
        $$renderer2.push("<!--[1-->");
        $$renderer2.push(`<div class="mb-6 flex h-12 items-center gap-2 rounded-md bg-destructive/10 px-4 text-[14px]">`);
        Circle_alert($$renderer2, { class: "size-4 text-destructive", "aria-hidden": "true" });
        $$renderer2.push(`<!----> <span class="text-foreground">${escape_html(provisioningFailureText(createJob()))}</span> <button type="button" class="text-primary ml-auto hover:underline">View in Tasks</button></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <div class="mb-8">`);
      ActionToolbar($$renderer2, {
        clusterId: detail().cluster_id,
        vmid: detail().vmid,
        type: toResourceKind(detail().type),
        status: detail().status,
        vmName: detail().name ?? `VM ${detail().vmid}`,
        node: detail().node,
        backupStorageConfigured: backupStorageConfigured()
      });
      $$renderer2.push(`<!----></div> `);
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
                  if (Tabs_trigger) {
                    $$renderer4.push("<!--[-->");
                    Tabs_trigger($$renderer4, {
                      value: "snapshots",
                      children: ($$renderer5) => {
                        $$renderer5.push(`<!---->Snapshots`);
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
                      value: "backups",
                      children: ($$renderer5) => {
                        $$renderer5.push(`<!---->Backups`);
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
                      value: "console",
                      children: ($$renderer5) => {
                        $$renderer5.push(`<!---->Console`);
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
            $$renderer3.push(` `);
            if (Tabs_content) {
              $$renderer3.push("<!--[-->");
              Tabs_content($$renderer3, {
                value: "snapshots",
                children: ($$renderer4) => {
                  $$renderer4.push(`<div class="mt-6">`);
                  SnapshotsTab($$renderer4, {
                    clusterId: detail().cluster_id,
                    vmid: detail().vmid,
                    type: toResourceKind(detail().type),
                    vmName: detail().name ?? `VM ${detail().vmid}`
                  });
                  $$renderer4.push(`<!----></div>`);
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
                value: "backups",
                children: ($$renderer4) => {
                  $$renderer4.push(`<div class="mt-6">`);
                  BackupsTab($$renderer4, {
                    clusterId: detail().cluster_id,
                    vmid: detail().vmid,
                    type: toResourceKind(detail().type),
                    vmName: detail().name ?? `VM ${detail().vmid}`,
                    backupStorageConfigured: backupStorageConfigured()
                  });
                  $$renderer4.push(`<!----></div>`);
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
                value: "console",
                children: ($$renderer4) => {
                  $$renderer4.push(`<div class="mt-6">`);
                  ConsoleTab($$renderer4, {
                    clusterId: detail().cluster_id,
                    vmid: detail().vmid,
                    kind: toResourceKind(detail().type),
                    name: detail().name ?? `VM ${detail().vmid}`
                  });
                  $$renderer4.push(`<!----></div>`);
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
//# sourceMappingURL=_page.svelte-HO1xOp35.js.map
