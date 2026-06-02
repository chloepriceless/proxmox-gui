import { d as derived, c as escape_html, f as store_get, h as bind_props, j as ensure_array_like, k as attr, l as attr_class, m as stringify, n as unsubscribe_stores, o as spread_props, p as attributes, q as clsx, r as hasContext, t as getContext, w as setContext, x as run, y as attr_style, z as props_id } from './renderer-mZFfBJIU.js';
import { p as page } from './stores-ByWcCi85.js';
import { g as getSettings, k as keepalive } from './settings-B0AyWnlD.js';
import 'clsx';
import '@sveltejs/kit/internal';
import './root-C3vAr9go.js';
import '@sveltejs/kit/internal/server';
import './state.svelte-DtuilCOR.js';
import { E as External_link } from './external-link-BTa_-afj.js';
import { L as List_checks, C as Chevron_right } from './chevron-right-D98xiGGY.js';
import { I as Icon } from './Icon-oF8immWv.js';
import { C as Calendar_clock, a as Circle_check } from './circle-check-BPthTFpF.js';
import { K as Key_round } from './key-round-CHoscgZB.js';
import { K as Key } from './key-GAISSaQn.js';
import { U as Users, a as Users_round, S as Server } from './server-U2Ef_m38.js';
import { i as invalidateAll, g as goto } from './client-vbU_CWqW.js';
import { D as Dropdown_menu, a as Dropdown_menu_trigger, b as Dropdown_menu_content, c as Dropdown_menu_item } from './dropdown-menu-trigger-CNd_0STl.js';
import { D as Dropdown_menu_separator } from './dropdown-menu-separator-DdHtbf6X.js';
import { D as Dialog, a as Dialog$1, b as Dialog_content$1, c as Dialog_close, d as Dialog_content, e as Dialog_header, f as Dialog_title, g as Dialog_description } from './dialog-description-Bxgdum_W.js';
import { D as DialogTriggerState, a as Dialog_overlay, b as Dialog_title$1, c as Dialog_description$1 } from './dialog-description2-DYXaekbV.js';
import { c as createId, b as boxWith$1, m as mergeProps, a as createBitsAttrs, I as Input, d as attachRef, s as simpleBox } from './input-Be3KOSVg.js';
import { P as Portal, D as DOMContext, u as useId, A as AnimationsComplete } from './scroll-lock-CmFP2s08.js';
import { B as Button, c as cn$1 } from './button-CE_GHowG.js';
import { X } from './x-DRD3hFMZ.js';
import { S as Sun, t as theme, M as Moon } from './moon-CC63rhkw.js';
import { M as Monitor } from './monitor-CcjG5ZXJ.js';
import { P as Popover, a as Popover_trigger, b as Popover_content } from './popover-trigger-CW5_3VeS.js';
import { C as Command, a as Command_input } from './command-input-DdpRtNko.js';
import { j as jobsStore, C as Command_list, a as Command_empty, b as Command_group, c as Collapsible, d as Collapsible_trigger, e as Collapsible_content, f as Command_item } from './collapsible-content-BOatjyk_.js';
import { M as MediaQuery, c as createSubscriber, C as Context$1, w as watch } from './is-DiTqhZmY.js';
import { i as isFunction$1 } from './popper-layer-force-mount-NeUEE3xR.js';
import { a as api } from './client2-FWmWn_B2.js';
import { C as Circle_alert } from './circle-alert-Nd3JNVzs.js';
import { C as Chevron_down } from './chevron-down-DXRC0OiZ.js';
import { L as Loader_circle } from './loader-circle-CEJgqxAV.js';
import { C as Clock } from './clock-6Ru2SlY1.js';
import { T as Triangle_alert } from './triangle-alert-fkzDfgmm.js';
import { R as Refresh_cw } from './refresh-cw-0T7GcTmA.js';
import { R as Rotate_cw } from './rotate-cw-gZ2HsEB3.js';
import { S as SonnerState, t as toastState, c as cn } from './toast-state.svelte-Bp1lssrC.js';
import { L as Label } from './label-Cf-Bm-qJ.js';
import './api-By_nInf4.js';
import './index-B0sFcY-v.js';
import './noop-n4I-x7yK.js';
import 'tailwind-merge';
import './clone-WEom5mq4.js';
import './sr-only-styles-lCW8LjNz.js';
import './check-C7XRLeXa.js';

const DEFAULT_IDLE_MINUTES = 30;
const WARN_LEAD_MS = 2 * 60 * 1e3;
const ACTIVITY_THROTTLE_MS = 1e3;
const ACTIVITY_EVENTS = ["mousemove", "keydown", "click", "scroll", "touchstart"];
class IdleStore {
  /** Last observed user activity (epoch ms). */
  lastActivity = Date.now();
  /** The configured idle window in ms (default 30 min until init() loads it). */
  idleTimeoutMs = DEFAULT_IDLE_MINUTES * 60 * 1e3;
  /** Ticked once per second by init()'s interval so the deriveds recompute. */
  now = Date.now();
  /** True once the session has idle-expired (locally or per the server). */
  expired = false;
  started = false;
  #msUntilIdle = derived(() => Math.max(0, this.idleTimeoutMs - (this.now - this.lastActivity)));
  get msUntilIdle() {
    return this.#msUntilIdle();
  }
  set msUntilIdle($$value) {
    return this.#msUntilIdle($$value);
  }
  #secondsRemaining = derived(() => Math.ceil(this.msUntilIdle / 1e3));
  get secondsRemaining() {
    return this.#secondsRemaining();
  }
  set secondsRemaining($$value) {
    return this.#secondsRemaining($$value);
  }
  #showCountdown = derived(() => !this.expired && this.msUntilIdle > 0 && this.msUntilIdle <= WARN_LEAD_MS);
  get showCountdown() {
    return this.#showCountdown();
  }
  set showCountdown($$value) {
    return this.#showCountdown($$value);
  }
  #showExpired = derived(() => this.expired);
  get showExpired() {
    return this.#showExpired();
  }
  set showExpired($$value) {
    return this.#showExpired($$value);
  }
  async init() {
    if (typeof window === "undefined" || this.started) return;
    this.started = true;
    try {
      const s = await getSettings();
      if (s?.idle_timeout_minutes && s.idle_timeout_minutes > 0) {
        this.idleTimeoutMs = s.idle_timeout_minutes * 60 * 1e3;
      }
    } catch {
    }
    let lastBump = 0;
    const onActivity = () => {
      const t = Date.now();
      if (t - lastBump < ACTIVITY_THROTTLE_MS) return;
      lastBump = t;
      if (!this.expired) this.lastActivity = t;
    };
    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, onActivity, { passive: true });
    }
    setInterval(
      () => {
        this.now = Date.now();
        if (!this.expired && this.msUntilIdle <= 0) this.expired = true;
      },
      1e3
    );
  }
  /** "Stay signed in" — the cheap no-rotation keepalive; resets the timer. */
  async staySignedIn() {
    try {
      await keepalive();
    } catch {
    }
    this.lastActivity = Date.now();
    this.now = Date.now();
  }
  /** Let the API layer drive the modal when the SERVER reports expiry first. */
  markExpired() {
    this.expired = true;
  }
  /** Called after a successful re-auth in SessionExpiredModal. */
  resume() {
    this.expired = false;
    this.lastActivity = Date.now();
    this.now = Date.now();
  }
}
const idle = new IdleStore();
function User($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["path", { "d": "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" }],
    ["circle", { "cx": "12", "cy": "7", "r": "4" }]
  ];
  Icon($$renderer, spread_props([{ name: "user" }, props, { iconNode }]));
}
function Settings($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    [
      "path",
      {
        "d": "M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"
      }
    ],
    ["circle", { "cx": "12", "cy": "12", "r": "3" }]
  ];
  Icon($$renderer, spread_props([{ name: "settings" }, props, { iconNode }]));
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
const resourceItems = [
  { href: "/inventory", label: "Inventory", icon: List_checks },
  { href: "/audit", label: "Audit log", icon: History },
  { href: "/backups", label: "Backups", icon: Calendar_clock }
];
const accountItems = [
  { href: "/profile", label: "Profile", icon: User },
  { href: "/profile/ssh-keys", label: "SSH keys", icon: Key_round },
  { href: "/profile/tokens", label: "API tokens", icon: Key }
];
const adminItems = [
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/teams", label: "Teams", icon: Users_round },
  { href: "/admin/clusters", label: "Clusters", icon: Server },
  { href: "/admin/settings", label: "Settings", icon: Settings }
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
function Sidebar($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let { user } = $$props;
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
function extract(value, defaultValue) {
  if (isFunction$1(value)) {
    const getter = value;
    const gotten = getter();
    if (gotten === void 0) return defaultValue;
    return gotten;
  }
  if (value === void 0) return defaultValue;
  return value;
}
function useDebounce(callback, wait) {
  let context = null;
  const wait$ = derived(() => extract(wait, 250));
  function debounced(...args) {
    if (context) {
      if (context.timeout) {
        clearTimeout(context.timeout);
      }
    } else {
      let resolve;
      let reject;
      const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
      });
      context = { timeout: null, runner: null, promise, resolve, reject };
    }
    context.runner = async () => {
      if (!context) return;
      const ctx = context;
      context = null;
      try {
        ctx.resolve(await callback.apply(this, args));
      } catch (error) {
        ctx.reject(error);
      }
    };
    context.timeout = setTimeout(context.runner, wait$());
    return context.promise;
  }
  debounced.cancel = async () => {
    if (!context || context.timeout === null) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (!context || context.timeout === null) return;
    }
    clearTimeout(context.timeout);
    context.reject("Cancelled");
    context = null;
  };
  debounced.runScheduledNow = async () => {
    if (!context || !context.timeout) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (!context || !context.timeout) return;
    }
    clearTimeout(context.timeout);
    context.timeout = null;
    await context.runner?.();
  };
  Object.defineProperty(debounced, "pending", {
    enumerable: true,
    get() {
      return !!context?.timeout;
    }
  });
  return debounced;
}
class IsMounted {
  #isMounted = false;
  constructor() {
  }
  get current() {
    return this.#isMounted;
  }
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
class SvelteResizeObserver {
  #node;
  #onResize;
  constructor(node, onResize) {
    this.#node = node;
    this.#onResize = onResize;
    this.handler = this.handler.bind(this);
  }
  handler() {
    let rAF = 0;
    const _node = this.#node();
    if (!_node) return;
    const resizeObserver = new ResizeObserver(() => {
      cancelAnimationFrame(rAF);
      rAF = window.requestAnimationFrame(this.#onResize);
    });
    resizeObserver.observe(_node);
    return () => {
      window.cancelAnimationFrame(rAF);
      resizeObserver.unobserve(_node);
    };
  }
}
class Presence {
  opts;
  present;
  #afterAnimations;
  #isPresent = false;
  #hasMounted = false;
  #transitionStatus = void 0;
  #transitionFrame = null;
  constructor(opts) {
    this.opts = opts;
    this.present = this.opts.open;
    this.#isPresent = opts.open.current;
    this.#afterAnimations = new AnimationsComplete({ ref: this.opts.ref, afterTick: this.opts.open });
    watch(() => this.present.current, (isOpen) => {
      if (!this.#hasMounted) {
        this.#hasMounted = true;
        return;
      }
      this.#clearTransitionFrame();
      if (isOpen) {
        this.#isPresent = true;
      }
      this.#transitionStatus = isOpen ? "starting" : "ending";
      if (isOpen) {
        this.#transitionFrame = window.requestAnimationFrame(() => {
          this.#transitionFrame = null;
          if (this.present.current) {
            this.#transitionStatus = void 0;
          }
        });
      }
      this.#afterAnimations.run(() => {
        if (isOpen !== this.present.current) return;
        if (!isOpen) {
          this.#isPresent = false;
        }
        this.#transitionStatus = void 0;
      });
    });
  }
  #_isPresent = derived(() => {
    return this.#isPresent;
  });
  get isPresent() {
    return this.#_isPresent();
  }
  set isPresent($$value) {
    return this.#_isPresent($$value);
  }
  get transitionStatus() {
    return this.#transitionStatus;
  }
  #clearTransitionFrame() {
    if (this.#transitionFrame === null) return;
    window.cancelAnimationFrame(this.#transitionFrame);
    this.#transitionFrame = null;
  }
}
function Presence_layer($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { open, forceMount, presence, ref } = $$props;
    const presenceState = new Presence({ open: boxWith$1(() => open), ref });
    if (forceMount || open || presenceState.isPresent) {
      $$renderer2.push("<!--[0-->");
      presence?.($$renderer2, {
        present: presenceState.isPresent,
        transitionStatus: presenceState.transitionStatus
      });
      $$renderer2.push(`<!---->`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}
class StateMachine {
  state;
  #machine;
  constructor(initialState, machine) {
    this.state = simpleBox(initialState);
    this.#machine = machine;
    this.dispatch = this.dispatch.bind(this);
  }
  #reducer(event) {
    const nextState = this.#machine[this.state.current][event];
    return nextState ?? this.state.current;
  }
  dispatch(event) {
    this.state.current = this.#reducer(event);
  }
}
const scrollAreaAttrs = createBitsAttrs({
  component: "scroll-area",
  parts: ["root", "viewport", "corner", "thumb", "scrollbar"]
});
const ScrollAreaRootContext = new Context$1("ScrollArea.Root");
const ScrollAreaScrollbarContext = new Context$1("ScrollArea.Scrollbar");
const ScrollAreaScrollbarVisibleContext = new Context$1("ScrollArea.ScrollbarVisible");
const ScrollAreaScrollbarAxisContext = new Context$1("ScrollArea.ScrollbarAxis");
const ScrollAreaScrollbarSharedContext = new Context$1("ScrollArea.ScrollbarShared");
class ScrollAreaRootState {
  static create(opts) {
    return ScrollAreaRootContext.set(new ScrollAreaRootState(opts));
  }
  opts;
  attachment;
  scrollAreaNode = null;
  viewportNode = null;
  contentNode = null;
  scrollbarXNode = null;
  scrollbarYNode = null;
  cornerWidth = 0;
  cornerHeight = 0;
  scrollbarXEnabled = false;
  scrollbarYEnabled = false;
  domContext;
  constructor(opts) {
    this.opts = opts;
    this.attachment = attachRef(opts.ref, (v) => this.scrollAreaNode = v);
    this.domContext = new DOMContext(opts.ref);
  }
  #props = derived(() => ({
    id: this.opts.id.current,
    dir: this.opts.dir.current,
    style: {
      position: "relative",
      "--bits-scroll-area-corner-height": `${this.cornerHeight}px`,
      "--bits-scroll-area-corner-width": `${this.cornerWidth}px`
    },
    [scrollAreaAttrs.root]: "",
    ...this.attachment
  }));
  get props() {
    return this.#props();
  }
  set props($$value) {
    return this.#props($$value);
  }
}
class ScrollAreaViewportState {
  static create(opts) {
    return new ScrollAreaViewportState(opts, ScrollAreaRootContext.get());
  }
  opts;
  root;
  attachment;
  #contentId = simpleBox(useId());
  #contentRef = simpleBox(null);
  contentAttachment = attachRef(this.#contentRef, (v) => this.root.contentNode = v);
  constructor(opts, root) {
    this.opts = opts;
    this.root = root;
    this.attachment = attachRef(opts.ref, (v) => this.root.viewportNode = v);
  }
  #props = derived(() => ({
    id: this.opts.id.current,
    style: {
      overflowX: this.root.scrollbarXEnabled ? "scroll" : "hidden",
      overflowY: this.root.scrollbarYEnabled ? "scroll" : "hidden"
    },
    [scrollAreaAttrs.viewport]: "",
    ...this.attachment
  }));
  get props() {
    return this.#props();
  }
  set props($$value) {
    return this.#props($$value);
  }
  #contentProps = derived(() => ({
    id: this.#contentId.current,
    "data-scroll-area-content": "",
    style: {
      minWidth: this.root.scrollbarXEnabled ? "fit-content" : void 0
    },
    ...this.contentAttachment
  }));
  get contentProps() {
    return this.#contentProps();
  }
  set contentProps($$value) {
    return this.#contentProps($$value);
  }
}
class ScrollAreaScrollbarState {
  static create(opts) {
    return ScrollAreaScrollbarContext.set(new ScrollAreaScrollbarState(opts, ScrollAreaRootContext.get()));
  }
  opts;
  root;
  #isHorizontal = derived(() => this.opts.orientation.current === "horizontal");
  get isHorizontal() {
    return this.#isHorizontal();
  }
  set isHorizontal($$value) {
    return this.#isHorizontal($$value);
  }
  hasThumb = false;
  constructor(opts, root) {
    this.opts = opts;
    this.root = root;
    watch(() => this.isHorizontal, (isHorizontal) => {
      if (isHorizontal) {
        this.root.scrollbarXEnabled = true;
        return () => {
          this.root.scrollbarXEnabled = false;
        };
      } else {
        this.root.scrollbarYEnabled = true;
        return () => {
          this.root.scrollbarYEnabled = false;
        };
      }
    });
  }
}
class ScrollAreaScrollbarHoverState {
  static create() {
    return new ScrollAreaScrollbarHoverState(ScrollAreaScrollbarContext.get());
  }
  scrollbar;
  root;
  isVisible = false;
  constructor(scrollbar) {
    this.scrollbar = scrollbar;
    this.root = scrollbar.root;
  }
  #props = derived(() => ({ "data-state": this.isVisible ? "visible" : "hidden" }));
  get props() {
    return this.#props();
  }
  set props($$value) {
    return this.#props($$value);
  }
}
class ScrollAreaScrollbarScrollState {
  static create() {
    return new ScrollAreaScrollbarScrollState(ScrollAreaScrollbarContext.get());
  }
  scrollbar;
  root;
  machine = new StateMachine("hidden", {
    hidden: { SCROLL: "scrolling" },
    scrolling: { SCROLL_END: "idle", POINTER_ENTER: "interacting" },
    interacting: { SCROLL: "interacting", POINTER_LEAVE: "idle" },
    idle: {
      HIDE: "hidden",
      SCROLL: "scrolling",
      POINTER_ENTER: "interacting"
    }
  });
  #isHidden = derived(() => this.machine.state.current === "hidden");
  get isHidden() {
    return this.#isHidden();
  }
  set isHidden($$value) {
    return this.#isHidden($$value);
  }
  constructor(scrollbar) {
    this.scrollbar = scrollbar;
    this.root = scrollbar.root;
    useDebounce(() => this.machine.dispatch("SCROLL_END"), 100);
    this.onpointerenter = this.onpointerenter.bind(this);
    this.onpointerleave = this.onpointerleave.bind(this);
  }
  onpointerenter(_) {
    this.machine.dispatch("POINTER_ENTER");
  }
  onpointerleave(_) {
    this.machine.dispatch("POINTER_LEAVE");
  }
  #props = derived(() => ({
    "data-state": this.machine.state.current === "hidden" ? "hidden" : "visible",
    onpointerenter: this.onpointerenter,
    onpointerleave: this.onpointerleave
  }));
  get props() {
    return this.#props();
  }
  set props($$value) {
    return this.#props($$value);
  }
}
class ScrollAreaScrollbarAutoState {
  static create() {
    return new ScrollAreaScrollbarAutoState(ScrollAreaScrollbarContext.get());
  }
  scrollbar;
  root;
  isVisible = false;
  constructor(scrollbar) {
    this.scrollbar = scrollbar;
    this.root = scrollbar.root;
    const handleResize = useDebounce(
      () => {
        const viewportNode = this.root.viewportNode;
        if (!viewportNode) return;
        const isOverflowX = viewportNode.offsetWidth < viewportNode.scrollWidth;
        const isOverflowY = viewportNode.offsetHeight < viewportNode.scrollHeight;
        this.isVisible = this.scrollbar.isHorizontal ? isOverflowX : isOverflowY;
      },
      10
    );
    new SvelteResizeObserver(() => this.root.viewportNode, handleResize);
    new SvelteResizeObserver(() => this.root.contentNode, handleResize);
  }
  #props = derived(() => ({ "data-state": this.isVisible ? "visible" : "hidden" }));
  get props() {
    return this.#props();
  }
  set props($$value) {
    return this.#props($$value);
  }
}
class ScrollAreaScrollbarVisibleState {
  static create() {
    return ScrollAreaScrollbarVisibleContext.set(new ScrollAreaScrollbarVisibleState(ScrollAreaScrollbarContext.get()));
  }
  scrollbar;
  root;
  thumbNode = null;
  pointerOffset = 0;
  sizes = {
    content: 0,
    viewport: 0,
    scrollbar: { size: 0, paddingStart: 0, paddingEnd: 0 }
  };
  #thumbRatio = derived(() => getThumbRatio(this.sizes.viewport, this.sizes.content));
  get thumbRatio() {
    return this.#thumbRatio();
  }
  set thumbRatio($$value) {
    return this.#thumbRatio($$value);
  }
  #hasThumb = derived(() => Boolean(this.thumbRatio > 0 && this.thumbRatio < 1));
  get hasThumb() {
    return this.#hasThumb();
  }
  set hasThumb($$value) {
    return this.#hasThumb($$value);
  }
  prevTransformStyle = "";
  constructor(scrollbar) {
    this.scrollbar = scrollbar;
    this.root = scrollbar.root;
  }
  setSizes(sizes) {
    this.sizes = sizes;
  }
  getScrollPosition(pointerPos, dir) {
    return getScrollPositionFromPointer({
      pointerPos,
      pointerOffset: this.pointerOffset,
      sizes: this.sizes,
      dir
    });
  }
  onThumbPointerUp() {
    this.pointerOffset = 0;
  }
  onThumbPointerDown(pointerPos) {
    this.pointerOffset = pointerPos;
  }
  xOnThumbPositionChange() {
    if (!(this.root.viewportNode && this.thumbNode)) return;
    const scrollPos = this.root.viewportNode.scrollLeft;
    const offset = getThumbOffsetFromScroll({
      scrollPos,
      sizes: this.sizes,
      dir: this.root.opts.dir.current
    });
    const transformStyle = `translate3d(${offset}px, 0, 0)`;
    this.thumbNode.style.transform = transformStyle;
    this.prevTransformStyle = transformStyle;
  }
  xOnWheelScroll(scrollPos) {
    if (!this.root.viewportNode) return;
    this.root.viewportNode.scrollLeft = scrollPos;
  }
  xOnDragScroll(pointerPos) {
    if (!this.root.viewportNode) return;
    this.root.viewportNode.scrollLeft = this.getScrollPosition(pointerPos, this.root.opts.dir.current);
  }
  yOnThumbPositionChange() {
    if (!(this.root.viewportNode && this.thumbNode)) return;
    const scrollPos = this.root.viewportNode.scrollTop;
    const offset = getThumbOffsetFromScroll({ scrollPos, sizes: this.sizes });
    const transformStyle = `translate3d(0, ${offset}px, 0)`;
    this.thumbNode.style.transform = transformStyle;
    this.prevTransformStyle = transformStyle;
  }
  yOnWheelScroll(scrollPos) {
    if (!this.root.viewportNode) return;
    this.root.viewportNode.scrollTop = scrollPos;
  }
  yOnDragScroll(pointerPos) {
    if (!this.root.viewportNode) return;
    this.root.viewportNode.scrollTop = this.getScrollPosition(pointerPos, this.root.opts.dir.current);
  }
}
class ScrollAreaScrollbarXState {
  static create(opts) {
    return ScrollAreaScrollbarAxisContext.set(new ScrollAreaScrollbarXState(opts, ScrollAreaScrollbarVisibleContext.get()));
  }
  opts;
  scrollbarVis;
  root;
  scrollbar;
  attachment;
  computedStyle;
  constructor(opts, scrollbarVis) {
    this.opts = opts;
    this.scrollbarVis = scrollbarVis;
    this.root = scrollbarVis.root;
    this.scrollbar = scrollbarVis.scrollbar;
    this.attachment = attachRef(this.scrollbar.opts.ref, (v) => this.root.scrollbarXNode = v);
  }
  onThumbPointerDown = (pointerPos) => {
    this.scrollbarVis.onThumbPointerDown(pointerPos.x);
  };
  onDragScroll = (pointerPos) => {
    this.scrollbarVis.xOnDragScroll(pointerPos.x);
  };
  onThumbPointerUp = () => {
    this.scrollbarVis.onThumbPointerUp();
  };
  onThumbPositionChange = () => {
    this.scrollbarVis.xOnThumbPositionChange();
  };
  onWheelScroll = (e, maxScrollPos) => {
    if (!this.root.viewportNode) return;
    const scrollPos = this.root.viewportNode.scrollLeft + e.deltaX;
    this.scrollbarVis.xOnWheelScroll(scrollPos);
    if (isScrollingWithinScrollbarBounds(scrollPos, maxScrollPos)) {
      e.preventDefault();
    }
  };
  onResize = () => {
    if (!(this.scrollbar.opts.ref.current && this.root.viewportNode && this.computedStyle)) return;
    this.scrollbarVis.setSizes({
      content: this.root.viewportNode.scrollWidth,
      viewport: this.root.viewportNode.offsetWidth,
      scrollbar: {
        size: this.scrollbar.opts.ref.current.clientWidth,
        paddingStart: toInt(this.computedStyle.paddingLeft),
        paddingEnd: toInt(this.computedStyle.paddingRight)
      }
    });
  };
  #thumbSize = derived(() => {
    return getThumbSize(this.scrollbarVis.sizes);
  });
  get thumbSize() {
    return this.#thumbSize();
  }
  set thumbSize($$value) {
    return this.#thumbSize($$value);
  }
  #props = derived(() => ({
    id: this.scrollbar.opts.id.current,
    "data-orientation": "horizontal",
    style: {
      bottom: 0,
      left: this.root.opts.dir.current === "rtl" ? "var(--bits-scroll-area-corner-width)" : 0,
      right: this.root.opts.dir.current === "ltr" ? "var(--bits-scroll-area-corner-width)" : 0,
      "--bits-scroll-area-thumb-width": `${this.thumbSize}px`
    },
    ...this.attachment
  }));
  get props() {
    return this.#props();
  }
  set props($$value) {
    return this.#props($$value);
  }
}
class ScrollAreaScrollbarYState {
  static create(opts) {
    return ScrollAreaScrollbarAxisContext.set(new ScrollAreaScrollbarYState(opts, ScrollAreaScrollbarVisibleContext.get()));
  }
  opts;
  scrollbarVis;
  root;
  scrollbar;
  attachment;
  computedStyle;
  constructor(opts, scrollbarVis) {
    this.opts = opts;
    this.scrollbarVis = scrollbarVis;
    this.root = scrollbarVis.root;
    this.scrollbar = scrollbarVis.scrollbar;
    this.attachment = attachRef(this.scrollbar.opts.ref, (v) => this.root.scrollbarYNode = v);
    this.onThumbPointerDown = this.onThumbPointerDown.bind(this);
    this.onDragScroll = this.onDragScroll.bind(this);
    this.onThumbPointerUp = this.onThumbPointerUp.bind(this);
    this.onThumbPositionChange = this.onThumbPositionChange.bind(this);
    this.onWheelScroll = this.onWheelScroll.bind(this);
    this.onResize = this.onResize.bind(this);
  }
  onThumbPointerDown(pointerPos) {
    this.scrollbarVis.onThumbPointerDown(pointerPos.y);
  }
  onDragScroll(pointerPos) {
    this.scrollbarVis.yOnDragScroll(pointerPos.y);
  }
  onThumbPointerUp() {
    this.scrollbarVis.onThumbPointerUp();
  }
  onThumbPositionChange() {
    this.scrollbarVis.yOnThumbPositionChange();
  }
  onWheelScroll(e, maxScrollPos) {
    if (!this.root.viewportNode) return;
    const scrollPos = this.root.viewportNode.scrollTop + e.deltaY;
    this.scrollbarVis.yOnWheelScroll(scrollPos);
    if (isScrollingWithinScrollbarBounds(scrollPos, maxScrollPos)) {
      e.preventDefault();
    }
  }
  onResize() {
    if (!(this.scrollbar.opts.ref.current && this.root.viewportNode && this.computedStyle)) return;
    this.scrollbarVis.setSizes({
      content: this.root.viewportNode.scrollHeight,
      viewport: this.root.viewportNode.offsetHeight,
      scrollbar: {
        size: this.scrollbar.opts.ref.current.clientHeight,
        paddingStart: toInt(this.computedStyle.paddingTop),
        paddingEnd: toInt(this.computedStyle.paddingBottom)
      }
    });
  }
  #thumbSize = derived(() => {
    return getThumbSize(this.scrollbarVis.sizes);
  });
  get thumbSize() {
    return this.#thumbSize();
  }
  set thumbSize($$value) {
    return this.#thumbSize($$value);
  }
  #props = derived(() => ({
    id: this.scrollbar.opts.id.current,
    "data-orientation": "vertical",
    style: {
      top: 0,
      right: this.root.opts.dir.current === "ltr" ? 0 : void 0,
      left: this.root.opts.dir.current === "rtl" ? 0 : void 0,
      bottom: "var(--bits-scroll-area-corner-height)",
      "--bits-scroll-area-thumb-height": `${this.thumbSize}px`
    },
    ...this.attachment
  }));
  get props() {
    return this.#props();
  }
  set props($$value) {
    return this.#props($$value);
  }
}
class ScrollAreaScrollbarSharedState {
  static create() {
    return ScrollAreaScrollbarSharedContext.set(new ScrollAreaScrollbarSharedState(ScrollAreaScrollbarAxisContext.get()));
  }
  scrollbarState;
  root;
  scrollbarVis;
  scrollbar;
  rect = null;
  prevWebkitUserSelect = "";
  handleResize;
  handleThumbPositionChange;
  handleWheelScroll;
  handleThumbPointerDown;
  handleThumbPointerUp;
  #maxScrollPos = derived(() => this.scrollbarVis.sizes.content - this.scrollbarVis.sizes.viewport);
  get maxScrollPos() {
    return this.#maxScrollPos();
  }
  set maxScrollPos($$value) {
    return this.#maxScrollPos($$value);
  }
  constructor(scrollbarState) {
    this.scrollbarState = scrollbarState;
    this.root = scrollbarState.root;
    this.scrollbarVis = scrollbarState.scrollbarVis;
    this.scrollbar = scrollbarState.scrollbarVis.scrollbar;
    this.handleResize = useDebounce(() => this.scrollbarState.onResize(), 10);
    this.handleThumbPositionChange = this.scrollbarState.onThumbPositionChange;
    this.handleWheelScroll = this.scrollbarState.onWheelScroll;
    this.handleThumbPointerDown = this.scrollbarState.onThumbPointerDown;
    this.handleThumbPointerUp = this.scrollbarState.onThumbPointerUp;
    new SvelteResizeObserver(() => this.scrollbar.opts.ref.current, this.handleResize);
    new SvelteResizeObserver(() => this.root.contentNode, this.handleResize);
    this.onpointerdown = this.onpointerdown.bind(this);
    this.onpointermove = this.onpointermove.bind(this);
    this.onpointerup = this.onpointerup.bind(this);
    this.onlostpointercapture = this.onlostpointercapture.bind(this);
  }
  handleDragScroll(e) {
    if (!this.rect) return;
    const x = e.clientX - this.rect.left;
    const y = e.clientY - this.rect.top;
    this.scrollbarState.onDragScroll({ x, y });
  }
  #cleanupPointerState() {
    if (this.rect === null) return;
    this.root.domContext.getDocument().body.style.webkitUserSelect = this.prevWebkitUserSelect;
    if (this.root.viewportNode) this.root.viewportNode.style.scrollBehavior = "";
    this.rect = null;
  }
  onpointerdown(e) {
    if (e.button !== 0) return;
    const target = e.target;
    target.setPointerCapture(e.pointerId);
    this.rect = this.scrollbar.opts.ref.current?.getBoundingClientRect() ?? null;
    this.prevWebkitUserSelect = this.root.domContext.getDocument().body.style.webkitUserSelect;
    this.root.domContext.getDocument().body.style.webkitUserSelect = "none";
    if (this.root.viewportNode) this.root.viewportNode.style.scrollBehavior = "auto";
    this.handleDragScroll(e);
  }
  onpointermove(e) {
    this.handleDragScroll(e);
  }
  onpointerup(e) {
    const target = e.target;
    if (target.hasPointerCapture(e.pointerId)) {
      target.releasePointerCapture(e.pointerId);
    }
    this.#cleanupPointerState();
  }
  onlostpointercapture(_) {
    this.#cleanupPointerState();
  }
  #props = derived(() => mergeProps({
    ...this.scrollbarState.props,
    style: { position: "absolute", ...this.scrollbarState.props.style },
    [scrollAreaAttrs.scrollbar]: "",
    onpointerdown: this.onpointerdown,
    onpointermove: this.onpointermove,
    onpointerup: this.onpointerup,
    onlostpointercapture: this.onlostpointercapture
  }));
  get props() {
    return this.#props();
  }
  set props($$value) {
    return this.#props($$value);
  }
}
class ScrollAreaThumbImplState {
  static create(opts) {
    return new ScrollAreaThumbImplState(opts, ScrollAreaScrollbarSharedContext.get());
  }
  opts;
  scrollbarState;
  attachment;
  #root;
  #removeUnlinkedScrollListener;
  #debounceScrollEnd = useDebounce(
    () => {
      if (this.#removeUnlinkedScrollListener) {
        this.#removeUnlinkedScrollListener();
        this.#removeUnlinkedScrollListener = void 0;
      }
    },
    100
  );
  constructor(opts, scrollbarState) {
    this.opts = opts;
    this.scrollbarState = scrollbarState;
    this.#root = scrollbarState.root;
    this.attachment = attachRef(this.opts.ref, (v) => this.scrollbarState.scrollbarVis.thumbNode = v);
    this.onpointerdowncapture = this.onpointerdowncapture.bind(this);
    this.onpointerup = this.onpointerup.bind(this);
  }
  onpointerdowncapture(e) {
    const thumb = e.target;
    if (!thumb) return;
    const thumbRect = thumb.getBoundingClientRect();
    const x = e.clientX - thumbRect.left;
    const y = e.clientY - thumbRect.top;
    this.scrollbarState.handleThumbPointerDown({ x, y });
  }
  onpointerup(_) {
    this.scrollbarState.handleThumbPointerUp();
  }
  #props = derived(() => ({
    id: this.opts.id.current,
    "data-state": this.scrollbarState.scrollbarVis.hasThumb ? "visible" : "hidden",
    style: {
      width: "var(--bits-scroll-area-thumb-width)",
      height: "var(--bits-scroll-area-thumb-height)",
      transform: this.scrollbarState.scrollbarVis.prevTransformStyle
    },
    onpointerdowncapture: this.onpointerdowncapture,
    onpointerup: this.onpointerup,
    [scrollAreaAttrs.thumb]: "",
    ...this.attachment
  }));
  get props() {
    return this.#props();
  }
  set props($$value) {
    return this.#props($$value);
  }
}
class ScrollAreaCornerImplState {
  static create(opts) {
    return new ScrollAreaCornerImplState(opts, ScrollAreaRootContext.get());
  }
  opts;
  root;
  attachment;
  #width = 0;
  #height = 0;
  #hasSize = derived(() => Boolean(this.#width && this.#height));
  get hasSize() {
    return this.#hasSize();
  }
  set hasSize($$value) {
    return this.#hasSize($$value);
  }
  constructor(opts, root) {
    this.opts = opts;
    this.root = root;
    this.attachment = attachRef(this.opts.ref);
    new SvelteResizeObserver(() => this.root.scrollbarXNode, () => {
      const height = this.root.scrollbarXNode?.offsetHeight || 0;
      this.root.cornerHeight = height;
      this.#height = height;
    });
    new SvelteResizeObserver(() => this.root.scrollbarYNode, () => {
      const width = this.root.scrollbarYNode?.offsetWidth || 0;
      this.root.cornerWidth = width;
      this.#width = width;
    });
  }
  #props = derived(() => ({
    id: this.opts.id.current,
    style: {
      width: this.#width,
      height: this.#height,
      position: "absolute",
      right: this.root.opts.dir.current === "ltr" ? 0 : void 0,
      left: this.root.opts.dir.current === "rtl" ? 0 : void 0,
      bottom: 0
    },
    [scrollAreaAttrs.corner]: "",
    ...this.attachment
  }));
  get props() {
    return this.#props();
  }
  set props($$value) {
    return this.#props($$value);
  }
}
function toInt(value) {
  return value ? Number.parseInt(value, 10) : 0;
}
function getThumbRatio(viewportSize, contentSize) {
  const ratio = viewportSize / contentSize;
  return Number.isNaN(ratio) ? 0 : ratio;
}
function getThumbSize(sizes) {
  const ratio = getThumbRatio(sizes.viewport, sizes.content);
  const scrollbarPadding = sizes.scrollbar.paddingStart + sizes.scrollbar.paddingEnd;
  const thumbSize = (sizes.scrollbar.size - scrollbarPadding) * ratio;
  return Math.max(thumbSize, 18);
}
function getScrollPositionFromPointer({ pointerPos, pointerOffset, sizes, dir = "ltr" }) {
  const thumbSizePx = getThumbSize(sizes);
  const thumbCenter = thumbSizePx / 2;
  const offset = pointerOffset || thumbCenter;
  const thumbOffsetFromEnd = thumbSizePx - offset;
  const minPointerPos = sizes.scrollbar.paddingStart + offset;
  const maxPointerPos = sizes.scrollbar.size - sizes.scrollbar.paddingEnd - thumbOffsetFromEnd;
  const maxScrollPos = sizes.content - sizes.viewport;
  const scrollRange = dir === "ltr" ? [0, maxScrollPos] : [maxScrollPos * -1, 0];
  const interpolate = linearScale([minPointerPos, maxPointerPos], scrollRange);
  return interpolate(pointerPos);
}
function getThumbOffsetFromScroll({ scrollPos, sizes, dir = "ltr" }) {
  const thumbSizePx = getThumbSize(sizes);
  const scrollbarPadding = sizes.scrollbar.paddingStart + sizes.scrollbar.paddingEnd;
  const scrollbar = sizes.scrollbar.size - scrollbarPadding;
  const maxScrollPos = sizes.content - sizes.viewport;
  const maxThumbPos = scrollbar - thumbSizePx;
  const scrollClampRange = dir === "ltr" ? [0, maxScrollPos] : [maxScrollPos * -1, 0];
  const scrollWithoutMomentum = clamp(scrollPos, scrollClampRange[0], scrollClampRange[1]);
  const interpolate = linearScale([0, maxScrollPos], [0, maxThumbPos]);
  return interpolate(scrollWithoutMomentum);
}
function linearScale(input, output) {
  return (value) => {
    if (input[0] === input[1] || output[0] === output[1]) return output[0];
    const ratio = (output[1] - output[0]) / (input[1] - input[0]);
    return output[0] + ratio * (value - input[0]);
  };
}
function isScrollingWithinScrollbarBounds(scrollPos, maxScrollPos) {
  return scrollPos > 0 && scrollPos < maxScrollPos;
}
function Scroll_area$1($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const uid = props_id($$renderer2);
    let {
      ref = null,
      id = createId(uid),
      type = "hover",
      dir = "ltr",
      scrollHideDelay = 600,
      children,
      child,
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    const rootState = ScrollAreaRootState.create({
      type: boxWith$1(() => type),
      dir: boxWith$1(() => dir),
      scrollHideDelay: boxWith$1(() => scrollHideDelay),
      id: boxWith$1(() => id),
      ref: boxWith$1(() => ref, (v) => ref = v)
    });
    const mergedProps = derived(() => mergeProps(restProps, rootState.props));
    if (child) {
      $$renderer2.push("<!--[0-->");
      child($$renderer2, { props: mergedProps() });
      $$renderer2.push(`<!---->`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div${attributes({ ...mergedProps() })}>`);
      children?.($$renderer2);
      $$renderer2.push(`<!----></div>`);
    }
    $$renderer2.push(`<!--]-->`);
    bind_props($$props, { ref });
  });
}
function Scroll_area_viewport($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const uid = props_id($$renderer2);
    let {
      ref = null,
      id = createId(uid),
      children,
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    const viewportState = ScrollAreaViewportState.create({
      id: boxWith$1(() => id),
      ref: boxWith$1(() => ref, (v) => ref = v)
    });
    const mergedProps = derived(() => mergeProps(restProps, viewportState.props));
    const mergedContentProps = derived(() => mergeProps({}, viewportState.contentProps));
    $$renderer2.push(`<div${attributes({ ...mergedProps() })}><div${attributes({ ...mergedContentProps() })}>`);
    children?.($$renderer2);
    $$renderer2.push(`<!----></div></div>`);
    bind_props($$props, { ref });
  });
}
function Scroll_area_scrollbar_shared($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { child, children, $$slots, $$events, ...restProps } = $$props;
    const scrollbarSharedState = ScrollAreaScrollbarSharedState.create();
    const mergedProps = derived(() => mergeProps(restProps, scrollbarSharedState.props));
    if (child) {
      $$renderer2.push("<!--[0-->");
      child($$renderer2, { props: mergedProps() });
      $$renderer2.push(`<!---->`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div${attributes({ ...mergedProps() })}>`);
      children?.($$renderer2);
      $$renderer2.push(`<!----></div>`);
    }
    $$renderer2.push(`<!--]-->`);
  });
}
function Scroll_area_scrollbar_x($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { $$slots, $$events, ...restProps } = $$props;
    const isMounted = new IsMounted();
    const scrollbarXState = ScrollAreaScrollbarXState.create({ mounted: boxWith$1(() => isMounted.current) });
    const mergedProps = derived(() => mergeProps(restProps, scrollbarXState.props));
    Scroll_area_scrollbar_shared($$renderer2, spread_props([mergedProps()]));
  });
}
function Scroll_area_scrollbar_y($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { $$slots, $$events, ...restProps } = $$props;
    const isMounted = new IsMounted();
    const scrollbarYState = ScrollAreaScrollbarYState.create({ mounted: boxWith$1(() => isMounted.current) });
    const mergedProps = derived(() => mergeProps(restProps, scrollbarYState.props));
    Scroll_area_scrollbar_shared($$renderer2, spread_props([mergedProps()]));
  });
}
function Scroll_area_scrollbar_visible($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { $$slots, $$events, ...restProps } = $$props;
    const scrollbarVisibleState = ScrollAreaScrollbarVisibleState.create();
    if (scrollbarVisibleState.scrollbar.opts.orientation.current === "horizontal") {
      $$renderer2.push("<!--[0-->");
      Scroll_area_scrollbar_x($$renderer2, spread_props([restProps]));
    } else {
      $$renderer2.push("<!--[-1-->");
      Scroll_area_scrollbar_y($$renderer2, spread_props([restProps]));
    }
    $$renderer2.push(`<!--]-->`);
  });
}
function Scroll_area_scrollbar_auto($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { forceMount = false, $$slots, $$events, ...restProps } = $$props;
    const scrollbarAutoState = ScrollAreaScrollbarAutoState.create();
    const mergedProps = derived(() => mergeProps(restProps, scrollbarAutoState.props));
    {
      let presence = function($$renderer3) {
        Scroll_area_scrollbar_visible($$renderer3, spread_props([mergedProps()]));
      };
      Presence_layer($$renderer2, {
        open: forceMount || scrollbarAutoState.isVisible,
        ref: scrollbarAutoState.scrollbar.opts.ref,
        presence
      });
    }
  });
}
function Scroll_area_scrollbar_scroll($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { forceMount = false, $$slots, $$events, ...restProps } = $$props;
    const scrollbarScrollState = ScrollAreaScrollbarScrollState.create();
    const mergedProps = derived(() => mergeProps(restProps, scrollbarScrollState.props));
    {
      let presence = function($$renderer3) {
        Scroll_area_scrollbar_visible($$renderer3, spread_props([mergedProps()]));
      };
      Presence_layer($$renderer2, spread_props([
        mergedProps(),
        {
          open: forceMount || !scrollbarScrollState.isHidden,
          ref: scrollbarScrollState.scrollbar.opts.ref,
          presence,
          $$slots: { presence: true }
        }
      ]));
    }
  });
}
function Scroll_area_scrollbar_hover($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { forceMount = false, $$slots, $$events, ...restProps } = $$props;
    const scrollbarHoverState = ScrollAreaScrollbarHoverState.create();
    const scrollbarAutoState = ScrollAreaScrollbarAutoState.create();
    const mergedProps = derived(() => mergeProps(restProps, scrollbarHoverState.props, scrollbarAutoState.props, {
      "data-state": scrollbarHoverState.isVisible ? "visible" : "hidden"
    }));
    const open = derived(() => forceMount || scrollbarHoverState.isVisible && scrollbarAutoState.isVisible);
    {
      let presence = function($$renderer3) {
        Scroll_area_scrollbar_visible($$renderer3, spread_props([mergedProps()]));
      };
      Presence_layer($$renderer2, {
        open: open(),
        ref: scrollbarAutoState.scrollbar.opts.ref,
        presence
      });
    }
  });
}
function Scroll_area_scrollbar$1($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const uid = props_id($$renderer2);
    let {
      ref = null,
      id = createId(uid),
      orientation,
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    const scrollbarState = ScrollAreaScrollbarState.create({
      orientation: boxWith$1(() => orientation),
      id: boxWith$1(() => id),
      ref: boxWith$1(() => ref, (v) => ref = v)
    });
    const type = derived(() => scrollbarState.root.opts.type.current);
    if (type() === "hover") {
      $$renderer2.push("<!--[0-->");
      Scroll_area_scrollbar_hover($$renderer2, spread_props([restProps, { id }]));
    } else if (type() === "scroll") {
      $$renderer2.push("<!--[1-->");
      Scroll_area_scrollbar_scroll($$renderer2, spread_props([restProps, { id }]));
    } else if (type() === "auto") {
      $$renderer2.push("<!--[2-->");
      Scroll_area_scrollbar_auto($$renderer2, spread_props([restProps, { id }]));
    } else if (type() === "always") {
      $$renderer2.push("<!--[3-->");
      Scroll_area_scrollbar_visible($$renderer2, spread_props([restProps, { id }]));
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
    bind_props($$props, { ref });
  });
}
function Scroll_area_thumb_impl($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      ref = null,
      id,
      child,
      children,
      present,
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    const isMounted = new IsMounted();
    const thumbState = ScrollAreaThumbImplState.create({
      id: boxWith$1(() => id),
      ref: boxWith$1(() => ref, (v) => ref = v),
      mounted: boxWith$1(() => isMounted.current)
    });
    const mergedProps = derived(() => mergeProps(restProps, thumbState.props, { style: { hidden: !present } }));
    if (child) {
      $$renderer2.push("<!--[0-->");
      child($$renderer2, { props: mergedProps() });
      $$renderer2.push(`<!---->`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div${attributes({ ...mergedProps() })}>`);
      children?.($$renderer2);
      $$renderer2.push(`<!----></div>`);
    }
    $$renderer2.push(`<!--]-->`);
    bind_props($$props, { ref });
  });
}
function Scroll_area_thumb($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const uid = props_id($$renderer2);
    let {
      id = createId(uid),
      ref = null,
      forceMount = false,
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    const scrollbarState = ScrollAreaScrollbarVisibleContext.get();
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      {
        let presence = function($$renderer4, { present }) {
          Scroll_area_thumb_impl($$renderer4, spread_props([
            restProps,
            {
              id,
              present,
              get ref() {
                return ref;
              },
              set ref($$value) {
                ref = $$value;
                $$settled = false;
              }
            }
          ]));
        };
        Presence_layer($$renderer3, {
          open: forceMount || scrollbarState.hasThumb,
          ref: scrollbarState.scrollbar.opts.ref,
          presence
        });
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
function Scroll_area_corner_impl($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      ref = null,
      id,
      children,
      child,
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    const cornerState = ScrollAreaCornerImplState.create({
      id: boxWith$1(() => id),
      ref: boxWith$1(() => ref, (v) => ref = v)
    });
    const mergedProps = derived(() => mergeProps(restProps, cornerState.props));
    if (child) {
      $$renderer2.push("<!--[0-->");
      child($$renderer2, { props: mergedProps() });
      $$renderer2.push(`<!---->`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div${attributes({ ...mergedProps() })}>`);
      children?.($$renderer2);
      $$renderer2.push(`<!----></div>`);
    }
    $$renderer2.push(`<!--]-->`);
    bind_props($$props, { ref });
  });
}
function Scroll_area_corner($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const uid = props_id($$renderer2);
    let {
      ref = null,
      id = createId(uid),
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    const scrollAreaState = ScrollAreaRootContext.get();
    const hasBothScrollbarsVisible = derived(() => Boolean(scrollAreaState.scrollbarXNode && scrollAreaState.scrollbarYNode));
    const hasCorner = derived(() => scrollAreaState.opts.type.current !== "scroll" && hasBothScrollbarsVisible());
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      if (hasCorner()) {
        $$renderer3.push("<!--[0-->");
        Scroll_area_corner_impl($$renderer3, spread_props([
          restProps,
          {
            id,
            get ref() {
              return ref;
            },
            set ref($$value) {
              ref = $$value;
              $$settled = false;
            }
          }
        ]));
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
    bind_props($$props, { ref });
  });
}
function Menu($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["path", { "d": "M4 5h16" }],
    ["path", { "d": "M4 12h16" }],
    ["path", { "d": "M4 19h16" }]
  ];
  Icon($$renderer, spread_props([{ name: "menu" }, props, { iconNode }]));
}
function Sheet($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { open = false, $$slots, $$events, ...restProps } = $$props;
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      if (Dialog$1) {
        $$renderer3.push("<!--[-->");
        Dialog$1($$renderer3, spread_props([
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
            if (Dialog_content$1) {
              $$renderer4.push("<!--[-->");
              Dialog_content$1($$renderer4, spread_props([
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
      if (Dialog_title$1) {
        $$renderer3.push("<!--[-->");
        Dialog_title$1($$renderer3, spread_props([
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
function Sheet_description($$renderer, $$props) {
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
      if (Dialog_description$1) {
        $$renderer3.push("<!--[-->");
        Dialog_description$1($$renderer3, spread_props([
          {
            "data-slot": "sheet-description",
            class: cn$1("text-muted-foreground text-sm", className)
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
function MobileNav($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let { user } = $$props;
    let open = false;
    const linkClass = "flex h-10 items-center gap-3 rounded-md px-3 text-[14px] font-medium transition-colors";
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
                Button($$renderer5, spread_props([
                  props,
                  {
                    variant: "ghost",
                    size: "icon",
                    class: "lg:hidden",
                    "aria-label": "Open navigation menu",
                    children: ($$renderer6) => {
                      Menu($$renderer6, { class: "size-5", "aria-hidden": "true" });
                    },
                    $$slots: { default: true }
                  }
                ]));
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
                side: "left",
                class: "w-72 sm:w-72",
                children: ($$renderer5) => {
                  if (Sheet_header) {
                    $$renderer5.push("<!--[-->");
                    Sheet_header($$renderer5, {
                      children: ($$renderer6) => {
                        if (Sheet_title) {
                          $$renderer6.push("<!--[-->");
                          Sheet_title($$renderer6, {
                            children: ($$renderer7) => {
                              $$renderer7.push(`<!---->Navigation`);
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
                  $$renderer5.push(` <nav class="flex flex-col gap-6 overflow-y-auto px-2 pb-6" aria-label="Primary"><div><h2 class="text-muted-foreground mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider">Resources</h2> <ul class="flex flex-col gap-0.5"><!--[-->`);
                  const each_array = ensure_array_like(resourceItems);
                  for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
                    let item = each_array[$$index];
                    const active = isActive(item.href, store_get($$store_subs ??= {}, "$page", page).url.pathname);
                    $$renderer5.push(`<li><a${attr("href", item.href)}${attr_class(`${stringify(linkClass)} ${stringify(active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}`)}${attr("aria-current", active ? "page" : void 0)}>`);
                    if (item.icon) {
                      $$renderer5.push("<!--[-->");
                      item.icon($$renderer5, {
                        class: `size-4 shrink-0 ${stringify(active ? "text-primary" : "")}`,
                        "aria-hidden": "true"
                      });
                      $$renderer5.push("<!--]-->");
                    } else {
                      $$renderer5.push("<!--[!-->");
                      $$renderer5.push("<!--]-->");
                    }
                    $$renderer5.push(` <span>${escape_html(item.label)}</span></a></li>`);
                  }
                  $$renderer5.push(`<!--]--></ul></div> <div><h2 class="text-muted-foreground mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider">Account</h2> <ul class="flex flex-col gap-0.5"><!--[-->`);
                  const each_array_1 = ensure_array_like(accountItems);
                  for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
                    let item = each_array_1[$$index_1];
                    const active = isActive(item.href, store_get($$store_subs ??= {}, "$page", page).url.pathname);
                    $$renderer5.push(`<li><a${attr("href", item.href)}${attr_class(`${stringify(linkClass)} ${stringify(active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}`)}${attr("aria-current", active ? "page" : void 0)}>`);
                    if (item.icon) {
                      $$renderer5.push("<!--[-->");
                      item.icon($$renderer5, {
                        class: `size-4 shrink-0 ${stringify(active ? "text-primary" : "")}`,
                        "aria-hidden": "true"
                      });
                      $$renderer5.push("<!--]-->");
                    } else {
                      $$renderer5.push("<!--[!-->");
                      $$renderer5.push("<!--]-->");
                    }
                    $$renderer5.push(` <span>${escape_html(item.label)}</span></a></li>`);
                  }
                  $$renderer5.push(`<!--]--> <li><a${attr("href", docsItem.href)} target="_blank" rel="noopener noreferrer"${attr_class(`${stringify(linkClass)} text-muted-foreground hover:bg-muted hover:text-foreground`)}>`);
                  if (docsItem.icon) {
                    $$renderer5.push("<!--[-->");
                    docsItem.icon($$renderer5, { class: "size-4 shrink-0", "aria-hidden": "true" });
                    $$renderer5.push("<!--]-->");
                  } else {
                    $$renderer5.push("<!--[!-->");
                    $$renderer5.push("<!--]-->");
                  }
                  $$renderer5.push(` <span>${escape_html(docsItem.label)}</span></a></li></ul></div> `);
                  if (user?.is_admin) {
                    $$renderer5.push("<!--[0-->");
                    $$renderer5.push(`<div><h2 class="text-muted-foreground mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider">Admin</h2> <ul class="flex flex-col gap-0.5"><!--[-->`);
                    const each_array_2 = ensure_array_like(adminItems);
                    for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
                      let item = each_array_2[$$index_2];
                      const active = isActive(item.href, store_get($$store_subs ??= {}, "$page", page).url.pathname);
                      $$renderer5.push(`<li><a${attr("href", item.href)}${attr_class(`${stringify(linkClass)} ${stringify(active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}`)}${attr("aria-current", active ? "page" : void 0)}>`);
                      if (item.icon) {
                        $$renderer5.push("<!--[-->");
                        item.icon($$renderer5, {
                          class: `size-4 shrink-0 ${stringify(active ? "text-primary" : "")}`,
                          "aria-hidden": "true"
                        });
                        $$renderer5.push("<!--]-->");
                      } else {
                        $$renderer5.push("<!--[!-->");
                        $$renderer5.push("<!--]-->");
                      }
                      $$renderer5.push(` <span>${escape_html(item.label)}</span></a></li>`);
                    }
                    $$renderer5.push(`<!--]--></ul></div>`);
                  } else {
                    $$renderer5.push("<!--[-1-->");
                  }
                  $$renderer5.push(`<!--]--></nav>`);
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
    let { open = false } = $$props;
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
    bind_props($$props, { open });
  });
}
function Scroll_area_scrollbar($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      ref = null,
      class: className,
      orientation = "vertical",
      children,
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      if (Scroll_area_scrollbar$1) {
        $$renderer3.push("<!--[-->");
        Scroll_area_scrollbar$1($$renderer3, spread_props([
          {
            "data-slot": "scroll-area-scrollbar",
            "data-orientation": orientation,
            orientation,
            class: cn$1("data-horizontal:h-2.5 data-horizontal:flex-col data-horizontal:border-t data-horizontal:border-t-transparent data-vertical:h-full data-vertical:w-2.5 data-vertical:border-l data-vertical:border-l-transparent flex touch-none p-px transition-colors select-none", className)
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
            children: ($$renderer4) => {
              children?.($$renderer4);
              $$renderer4.push(`<!----> `);
              if (Scroll_area_thumb) {
                $$renderer4.push("<!--[-->");
                Scroll_area_thumb($$renderer4, {
                  "data-slot": "scroll-area-thumb",
                  class: "rounded-full bg-border relative flex-1"
                });
                $$renderer4.push("<!--]-->");
              } else {
                $$renderer4.push("<!--[!-->");
                $$renderer4.push("<!--]-->");
              }
            },
            $$slots: { default: true }
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
function Scroll_area($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      ref = null,
      viewportRef = null,
      class: className,
      orientation = "vertical",
      scrollbarXClasses = "",
      scrollbarYClasses = "",
      children,
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      if (Scroll_area$1) {
        $$renderer3.push("<!--[-->");
        Scroll_area$1($$renderer3, spread_props([
          { "data-slot": "scroll-area", class: cn$1("relative", className) },
          restProps,
          {
            get ref() {
              return ref;
            },
            set ref($$value) {
              ref = $$value;
              $$settled = false;
            },
            children: ($$renderer4) => {
              if (Scroll_area_viewport) {
                $$renderer4.push("<!--[-->");
                Scroll_area_viewport($$renderer4, {
                  "data-slot": "scroll-area-viewport",
                  class: "cn-scroll-area-viewport focus-visible:ring-ring/50 size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:outline-1",
                  get ref() {
                    return viewportRef;
                  },
                  set ref($$value) {
                    viewportRef = $$value;
                    $$settled = false;
                  },
                  children: ($$renderer5) => {
                    children?.($$renderer5);
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
              if (orientation === "vertical" || orientation === "both") {
                $$renderer4.push("<!--[0-->");
                Scroll_area_scrollbar($$renderer4, { orientation: "vertical", class: scrollbarYClasses });
              } else {
                $$renderer4.push("<!--[-1-->");
              }
              $$renderer4.push(`<!--]--> `);
              if (orientation === "horizontal" || orientation === "both") {
                $$renderer4.push("<!--[0-->");
                Scroll_area_scrollbar($$renderer4, { orientation: "horizontal", class: scrollbarXClasses });
              } else {
                $$renderer4.push("<!--[-1-->");
              }
              $$renderer4.push(`<!--]--> `);
              if (Scroll_area_corner) {
                $$renderer4.push("<!--[-->");
                Scroll_area_corner($$renderer4, {});
                $$renderer4.push("<!--]-->");
              } else {
                $$renderer4.push("<!--[!-->");
                $$renderer4.push("<!--]-->");
              }
            },
            $$slots: { default: true }
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
    bind_props($$props, { ref, viewportRef });
  });
}
function Bell($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["path", { "d": "M10.268 21a2 2 0 0 0 3.464 0" }],
    [
      "path",
      {
        "d": "M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"
      }
    ]
  ];
  Icon($$renderer, spread_props([{ name: "bell" }, props, { iconNode }]));
}
function Bell_ring($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["path", { "d": "M10.268 21a2 2 0 0 0 3.464 0" }],
    ["path", { "d": "M22 8c0-2.3-.8-4.3-2-6" }],
    [
      "path",
      {
        "d": "M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"
      }
    ],
    ["path", { "d": "M4 2C2.8 3.7 2 5.7 2 8" }]
  ];
  Icon($$renderer, spread_props([{ name: "bell-ring" }, props, { iconNode }]));
}
function Bell_off($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["path", { "d": "M10.268 21a2 2 0 0 0 3.464 0" }],
    [
      "path",
      {
        "d": "M17 17H4a1 1 0 0 1-.74-1.673C4.59 13.956 6 12.499 6 8a6 6 0 0 1 .258-1.742"
      }
    ],
    ["path", { "d": "m2 2 20 20" }],
    [
      "path",
      {
        "d": "M8.668 3.01A6 6 0 0 1 18 8c0 2.687.77 4.653 1.707 6.05"
      }
    ]
  ];
  Icon($$renderer, spread_props([{ name: "bell-off" }, props, { iconNode }]));
}
const BADGE_OVERFLOW = 9;
const TERMINAL = /* @__PURE__ */ new Set(["succeeded", "failed"]);
function badgeLabel(unreadCount) {
  if (unreadCount > BADGE_OVERFLOW) return `${BADGE_OVERFLOW}+`;
  return String(unreadCount);
}
function badgeVisible(unreadCount) {
  return unreadCount > 0;
}
function badgeClass(items, unreadCount) {
  const unread = items.slice(0, Math.max(0, unreadCount));
  const anyFailed = unread.some((it) => it.state === "failed");
  return anyFailed ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground";
}
function bellAriaLabel(unreadCount) {
  return `Notifications: ${unreadCount} unread. Open notifications.`;
}
function notificationTitle(item) {
  const parts = item.kind.split(".");
  const verb = parts.slice(1).join(" ") || item.kind;
  const pretty = verb.charAt(0).toUpperCase() + verb.slice(1);
  if (item.state === "failed") {
    return item.friendly_error ? `${pretty} failed` : `${pretty} failed`;
  }
  return pretty;
}
function rowAccentClass(item) {
  return item.state === "failed" ? "border-l-2 border-destructive" : "border-l-2 border-success";
}
function reconcileFeed(restItems, liveItems, limit = 50) {
  const byId = /* @__PURE__ */ new Map();
  for (const it of restItems) byId.set(it.id, it);
  for (const it of liveItems) byId.set(it.id, it);
  const merged = [...byId.values()].filter((it) => TERMINAL.has(it.state));
  merged.sort((a, b) => {
    const ta = a.created_at ? Date.parse(a.created_at) : 0;
    const tb = b.created_at ? Date.parse(b.created_at) : 0;
    return tb - ta;
  });
  return merged.slice(0, limit);
}
function NotificationBell($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let restItems = [];
    let restUnread = 0;
    let loadError = false;
    let open = false;
    const liveItems = derived(() => jobsStore.jobs.filter((j) => j.state === "succeeded" || j.state === "failed").map((j) => ({
      id: j.id,
      kind: j.kind,
      state: j.state,
      cluster_id: j.cluster_id,
      team_id: j.team_id,
      friendly_error: j.friendly_error,
      created_at: j.created_at,
      finished_at: j.finished_at
    })));
    const items = derived(() => reconcileFeed(restItems, liveItems()));
    const unreadCount = derived(() => open ? 0 : restUnread);
    const showBadge = derived(() => badgeVisible(unreadCount()));
    const label = derived(() => badgeLabel(unreadCount()));
    const badgeColor = derived(() => badgeClass(items(), unreadCount()));
    async function onOpenChange(next) {
      open = next;
      if (next) {
        try {
          const feed = await api.notifications.markSeen();
          restItems = feed.items;
          restUnread = feed.unread_count;
          loadError = false;
        } catch {
        }
      }
    }
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      if (Popover) {
        $$renderer3.push("<!--[-->");
        Popover($$renderer3, {
          onOpenChange,
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
                  class: "relative inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  "aria-label": bellAriaLabel(unreadCount())
                })}>`);
                if (showBadge()) {
                  $$renderer5.push("<!--[0-->");
                  Bell_ring($$renderer5, { class: "size-4", "aria-hidden": "true" });
                } else {
                  $$renderer5.push("<!--[-1-->");
                  Bell($$renderer5, { class: "size-4", "aria-hidden": "true" });
                }
                $$renderer5.push(`<!--]--> `);
                if (showBadge()) {
                  $$renderer5.push("<!--[0-->");
                  $$renderer5.push(`<span${attr_class(`absolute -right-1 -top-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 text-[11px] font-semibold ${badgeColor()}`)} aria-hidden="true">${escape_html(label())}</span>`);
                } else {
                  $$renderer5.push("<!--[-1-->");
                }
                $$renderer5.push(`<!--]--></button>`);
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
                align: "end",
                class: "w-[380px] p-0",
                children: ($$renderer5) => {
                  $$renderer5.push(`<div class="border-b border-border px-4 py-3"><p class="text-[14px] font-semibold">Notifications</p></div> `);
                  if (loadError) {
                    $$renderer5.push("<!--[0-->");
                    $$renderer5.push(`<div class="px-4 py-10 text-center"><p class="text-[14px] text-destructive">Couldn't load notifications.</p> <button type="button" class="text-primary mt-2 text-[13px] hover:underline">Try again</button></div>`);
                  } else if (items().length === 0) {
                    $$renderer5.push("<!--[1-->");
                    $$renderer5.push(`<div class="flex flex-col items-center px-4 py-12 text-center">`);
                    Bell_off($$renderer5, { class: "size-6 text-muted-foreground", "aria-hidden": "true" });
                    $$renderer5.push(`<!----> <p class="mt-3 text-[14px] font-medium">No notifications</p> <p class="mt-1 text-[14px] text-muted-foreground">Completed tasks will show up here.</p></div>`);
                  } else {
                    $$renderer5.push("<!--[-1-->");
                    Scroll_area($$renderer5, {
                      class: "max-h-[360px]",
                      children: ($$renderer6) => {
                        $$renderer6.push(`<ul><!--[-->`);
                        const each_array = ensure_array_like(items());
                        for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
                          let item = each_array[$$index];
                          $$renderer6.push(`<li><button type="button"${attr_class(`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted ${rowAccentClass(item)}`)}>`);
                          if (item.state === "failed") {
                            $$renderer6.push("<!--[0-->");
                            Circle_alert($$renderer6, {
                              class: "mt-0.5 size-4 shrink-0 text-destructive",
                              "aria-hidden": "true"
                            });
                          } else {
                            $$renderer6.push("<!--[-1-->");
                            Circle_check($$renderer6, {
                              class: "mt-0.5 size-4 shrink-0 text-success",
                              "aria-hidden": "true"
                            });
                          }
                          $$renderer6.push(`<!--]--> <span class="min-w-0 flex-1"><span class="block text-[14px]">${escape_html(notificationTitle(item))}</span> `);
                          if (item.state === "failed" && item.friendly_error) {
                            $$renderer6.push("<!--[0-->");
                            $$renderer6.push(`<span class="block truncate text-[13px] text-muted-foreground">${escape_html(item.friendly_error)}</span>`);
                          } else {
                            $$renderer6.push("<!--[-1-->");
                          }
                          $$renderer6.push(`<!--]--> `);
                          if (item.created_at) {
                            $$renderer6.push("<!--[0-->");
                            $$renderer6.push(`<span class="block text-[13px] font-medium text-muted-foreground">${escape_html(new Date(item.created_at).toLocaleString())}</span>`);
                          } else {
                            $$renderer6.push("<!--[-1-->");
                          }
                          $$renderer6.push(`<!--]--></span></button></li>`);
                        }
                        $$renderer6.push(`<!--]--></ul>`);
                      },
                      $$slots: { default: true }
                    });
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
function Topbar($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { user, clusters = [], quotaOpen = false } = $$props;
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
    const taskCount = derived(() => jobsStore.inFlightCount);
    const hasUnackedFailure = derived(() => jobsStore.failedCount > 0 && !jobsStore.failuresAcknowledged);
    const badgeVisible2 = derived(() => taskCount() > 0 || hasUnackedFailure());
    const badgeLabel2 = derived(() => taskCount() > 9 ? "9+" : String(taskCount()));
    const badgeClass2 = derived(() => hasUnackedFailure() ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground");
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      $$renderer3.push(`<header class="bg-background flex h-14 items-center justify-between gap-4 border-b border-border px-4 lg:px-6"><div class="flex items-center gap-2">`);
      MobileNav($$renderer3, { user });
      $$renderer3.push(`<!----> <svg viewBox="0 0 24 24" class="size-6 text-primary" role="img" aria-label="Proxmox GUI logo" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="3" width="7" height="7" rx="1.5"></rect><rect x="3" y="14" width="7" height="7" rx="1.5"></rect><rect x="14" y="14" width="7" height="7" rx="1.5"></rect></svg> <span class="text-lg font-semibold tracking-tight">Proxmox GUI</span></div> <div class="hidden md:block">`);
      ClusterContextPicker($$renderer3, { clusters });
      $$renderer3.push(`<!----></div> <div class="flex items-center gap-2">`);
      NotificationBell($$renderer3);
      $$renderer3.push(`<!----> <button type="button" class="relative inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"${attr("aria-label", `Tasks: ${jobsStore.runningCount} running, ${jobsStore.failedCount} failed. Open task drawer.`)}>`);
      List_checks($$renderer3, { class: "size-4", "aria-hidden": "true" });
      $$renderer3.push(`<!----> `);
      if (badgeVisible2()) {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<span${attr_class(`absolute -right-1 -top-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-semibold ${badgeClass2()}`)} aria-hidden="true">${escape_html(badgeLabel2())}</span>`);
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--></button> `);
      QuotaIndicator($$renderer3, {
        get open() {
          return quotaOpen;
        },
        set open($$value) {
          quotaOpen = $$value;
          $$settled = false;
        }
      });
      $$renderer3.push(`<!----> `);
      ThemeToggle($$renderer3);
      $$renderer3.push(`<!----> `);
      if (Dropdown_menu) {
        $$renderer3.push("<!--[-->");
        Dropdown_menu($$renderer3, {
          children: ($$renderer4) => {
            {
              let child = function($$renderer5, { props }) {
                $$renderer5.push(`<button${attributes({
                  ...props,
                  class: "bg-muted text-muted-foreground hover:text-foreground inline-flex size-7 items-center justify-center rounded-full border border-border text-[11px] font-semibold transition-colors",
                  "aria-label": "Open user menu"
                })}>${escape_html(user ? initials(user) : "?")}</button>`);
              };
              if (Dropdown_menu_trigger) {
                $$renderer4.push("<!--[-->");
                Dropdown_menu_trigger($$renderer4, { child, $$slots: { child: true } });
                $$renderer4.push("<!--]-->");
              } else {
                $$renderer4.push("<!--[!-->");
                $$renderer4.push("<!--]-->");
              }
            }
            $$renderer4.push(` `);
            if (Dropdown_menu_content) {
              $$renderer4.push("<!--[-->");
              Dropdown_menu_content($$renderer4, {
                align: "end",
                children: ($$renderer5) => {
                  {
                    let child = function($$renderer6, { props }) {
                      $$renderer6.push(`<a${attributes({ href: "/profile", ...props })}>Profile</a>`);
                    };
                    if (Dropdown_menu_item) {
                      $$renderer5.push("<!--[-->");
                      Dropdown_menu_item($$renderer5, { child, $$slots: { child: true } });
                      $$renderer5.push("<!--]-->");
                    } else {
                      $$renderer5.push("<!--[!-->");
                      $$renderer5.push("<!--]-->");
                    }
                  }
                  $$renderer5.push(` `);
                  {
                    let child = function($$renderer6, { props }) {
                      $$renderer6.push(`<a${attributes({ href: "/profile/ssh-keys", ...props })}>SSH keys</a>`);
                    };
                    if (Dropdown_menu_item) {
                      $$renderer5.push("<!--[-->");
                      Dropdown_menu_item($$renderer5, { child, $$slots: { child: true } });
                      $$renderer5.push("<!--]-->");
                    } else {
                      $$renderer5.push("<!--[!-->");
                      $$renderer5.push("<!--]-->");
                    }
                  }
                  $$renderer5.push(` `);
                  {
                    let child = function($$renderer6, { props }) {
                      $$renderer6.push(`<a${attributes({ href: "/profile/tokens", ...props })}>API tokens</a>`);
                    };
                    if (Dropdown_menu_item) {
                      $$renderer5.push("<!--[-->");
                      Dropdown_menu_item($$renderer5, { child, $$slots: { child: true } });
                      $$renderer5.push("<!--]-->");
                    } else {
                      $$renderer5.push("<!--[!-->");
                      $$renderer5.push("<!--]-->");
                    }
                  }
                  $$renderer5.push(` `);
                  if (Dropdown_menu_separator) {
                    $$renderer5.push("<!--[-->");
                    Dropdown_menu_separator($$renderer5, {});
                    $$renderer5.push("<!--]-->");
                  } else {
                    $$renderer5.push("<!--[!-->");
                    $$renderer5.push("<!--]-->");
                  }
                  $$renderer5.push(` `);
                  if (Dropdown_menu_item) {
                    $$renderer5.push("<!--[-->");
                    Dropdown_menu_item($$renderer5, {
                      onSelect: logout,
                      children: ($$renderer6) => {
                        $$renderer6.push(`<!---->Log out`);
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
      $$renderer3.push(`</div></header>`);
    }
    do {
      $$settled = true;
      $$inner_renderer = $$renderer2.copy();
      $$render_inner($$inner_renderer);
    } while (!$$settled);
    $$renderer2.subsume($$inner_renderer);
    bind_props($$props, { quotaOpen });
  });
}
function Activity($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    [
      "path",
      {
        "d": "M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"
      }
    ]
  ];
  Icon($$renderer, spread_props([{ name: "activity" }, props, { iconNode }]));
}
function Circle_slash($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["circle", { "cx": "12", "cy": "12", "r": "10" }],
    ["line", { "x1": "9", "x2": "15", "y1": "15", "y2": "9" }]
  ];
  Icon($$renderer, spread_props([{ name: "circle-slash" }, props, { iconNode }]));
}
function JobErrorDetail($$renderer, $$props) {
  let { friendly, raw, upid, log } = $$props;
  let expanded = false;
  const hasDetail = derived(() => Boolean(raw || upid || log));
  let $$settled = true;
  let $$inner_renderer;
  function $$render_inner($$renderer2) {
    $$renderer2.push(`<div class="flex flex-col gap-2"><p class="text-[14px] text-foreground">${escape_html(friendly)}</p> `);
    if (hasDetail()) {
      $$renderer2.push("<!--[0-->");
      if (Collapsible) {
        $$renderer2.push("<!--[-->");
        Collapsible($$renderer2, {
          get open() {
            return expanded;
          },
          set open($$value) {
            expanded = $$value;
            $$settled = false;
          },
          children: ($$renderer3) => {
            {
              let child = function($$renderer4, { props }) {
                $$renderer4.push(`<button${attributes({
                  ...props,
                  type: "button",
                  class: "inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                })}>`);
                if (expanded) {
                  $$renderer4.push("<!--[0-->");
                  Chevron_down($$renderer4, { class: "size-3.5", "aria-hidden": "true" });
                  $$renderer4.push(`<!----> Hide technical details`);
                } else {
                  $$renderer4.push("<!--[-1-->");
                  Chevron_right($$renderer4, { class: "size-3.5", "aria-hidden": "true" });
                  $$renderer4.push(`<!----> Show technical details`);
                }
                $$renderer4.push(`<!--]--></button>`);
              };
              if (Collapsible_trigger) {
                $$renderer3.push("<!--[-->");
                Collapsible_trigger($$renderer3, { child, $$slots: { child: true } });
                $$renderer3.push("<!--]-->");
              } else {
                $$renderer3.push("<!--[!-->");
                $$renderer3.push("<!--]-->");
              }
            }
            $$renderer3.push(` `);
            if (Collapsible_content) {
              $$renderer3.push("<!--[-->");
              Collapsible_content($$renderer3, {
                children: ($$renderer4) => {
                  $$renderer4.push(`<div class="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-border bg-muted p-3 font-mono text-[13px] text-foreground">`);
                  if (upid) {
                    $$renderer4.push("<!--[0-->");
                    $$renderer4.push(`<div class="text-muted-foreground">UPID: ${escape_html(upid)}</div>`);
                  } else {
                    $$renderer4.push("<!--[-1-->");
                  }
                  $$renderer4.push(`<!--]--> `);
                  if (raw) {
                    $$renderer4.push("<!--[0-->");
                    $$renderer4.push(`<div class="mt-1">${escape_html(raw)}</div>`);
                  } else {
                    $$renderer4.push("<!--[-1-->");
                  }
                  $$renderer4.push(`<!--]--> `);
                  {
                    $$renderer4.push("<!--[-1-->");
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
    $$renderer2.push(`<!--]--></div>`);
  }
  do {
    $$settled = true;
    $$inner_renderer = $$renderer.copy();
    $$render_inner($$inner_renderer);
  } while (!$$settled);
  $$renderer.subsume($$inner_renderer);
}
function formatElapsed(fromISO, nowMs) {
  const now = nowMs ?? Date.now();
  const startMs = Date.parse(fromISO);
  if (Number.isNaN(startMs)) return "0s";
  const totalSec = Math.max(0, Math.floor((now - startMs) / 1e3));
  if (totalSec < 60) return `${totalSec}s`;
  if (totalSec < 3600) {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}m ${s}s`;
  }
  const h = Math.floor(totalSec / 3600);
  const mm = Math.floor(totalSec % 3600 / 60);
  return `${h}h ${String(mm).padStart(2, "0")}m`;
}
function JobRow($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { job, nowMs } = $$props;
    const IDEMPOTENT = /* @__PURE__ */ new Set(["vm.power", "vm.snapshot.delete", "vm.resize", "vm.backup"]);
    function meta(state) {
      switch (state) {
        case "pending":
        case "claimed":
          return {
            word: state,
            bar: "border-l-border",
            fg: "text-muted-foreground",
            spin: false
          };
        case "running":
          return {
            word: "running",
            bar: "border-l-border",
            fg: "text-foreground",
            spin: true
          };
        case "succeeded":
          return {
            word: "done",
            bar: "border-l-success",
            fg: "text-success",
            spin: false
          };
        case "failed":
          return {
            word: "failed",
            bar: "border-l-destructive",
            fg: "text-destructive",
            spin: false
          };
        case "orphaned":
          return {
            word: "orphaned",
            bar: "border-l-warning",
            fg: "text-warning",
            spin: false
          };
        case "needs_review":
          return {
            word: "needs review",
            bar: "border-l-warning",
            fg: "text-warning",
            spin: false
          };
      }
    }
    const m = derived(() => meta(job.state));
    const elapsed = derived(() => formatElapsed(job.created_at, nowMs));
    const isRetryable = derived(() => job.state === "failed" && IDEMPOTENT.has(job.kind));
    const label = derived(() => prettyLabel(job.kind));
    function prettyLabel(kind) {
      const tail = kind.split(".").slice(1).join(" ") || kind;
      return tail.charAt(0).toUpperCase() + tail.slice(1);
    }
    let retrying = false;
    async function onRetry() {
      if (retrying) return;
      retrying = true;
      try {
        await jobsStore.retry(job.id);
      } finally {
        retrying = false;
      }
    }
    $$renderer2.push(`<div${attr_class(`flex min-h-14 flex-col gap-1 border-l-2 ${m().bar} bg-background py-3 pl-3 pr-2`)}><div class="flex items-center gap-2">`);
    if (m().spin) {
      $$renderer2.push("<!--[0-->");
      Loader_circle($$renderer2, {
        class: `size-4 shrink-0 animate-spin ${m().fg}`,
        "aria-hidden": "true"
      });
    } else if (job.state === "pending" || job.state === "claimed") {
      $$renderer2.push("<!--[1-->");
      Clock($$renderer2, { class: `size-4 shrink-0 ${m().fg}`, "aria-hidden": "true" });
    } else if (job.state === "succeeded") {
      $$renderer2.push("<!--[2-->");
      Circle_check($$renderer2, { class: `size-4 shrink-0 ${m().fg}`, "aria-hidden": "true" });
    } else if (job.state === "failed") {
      $$renderer2.push("<!--[3-->");
      Circle_alert($$renderer2, { class: `size-4 shrink-0 ${m().fg}`, "aria-hidden": "true" });
    } else if (job.state === "orphaned") {
      $$renderer2.push("<!--[4-->");
      Triangle_alert($$renderer2, { class: `size-4 shrink-0 ${m().fg}`, "aria-hidden": "true" });
    } else {
      $$renderer2.push("<!--[-1-->");
      Circle_slash($$renderer2, { class: `size-4 shrink-0 ${m().fg}`, "aria-hidden": "true" });
    }
    $$renderer2.push(`<!--]--> <span class="flex-1 truncate text-[14px] text-foreground">${escape_html(label())}</span> <span${attr_class(`text-[13px] font-medium ${m().fg}`)} aria-live="polite">${escape_html(m().word)}</span> <span class="font-mono text-[13px] tabular-nums text-muted-foreground" aria-hidden="true">${escape_html(elapsed())}</span></div> `);
    if (job.upid) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="truncate font-mono text-[13px] text-muted-foreground"${attr("title", job.upid)}>${escape_html(job.upid)}</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (job.state === "orphaned") {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="flex items-center gap-1 text-[13px] text-warning">`);
      Refresh_cw($$renderer2, { class: "size-3.5", "aria-hidden": "true" });
      $$renderer2.push(`<!----> Re-attached after a restart</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (job.state === "failed") {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="mt-1">`);
      JobErrorDetail($$renderer2, {
        friendly: job.friendly_error ?? job.error ?? "The task failed. See technical details below.",
        raw: job.error,
        upid: job.upid,
        log: null
      });
      $$renderer2.push(`<!----></div> `);
      if (isRetryable()) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="mt-2">`);
        Button($$renderer2, {
          variant: "outline",
          size: "sm",
          onclick: onRetry,
          disabled: retrying,
          children: ($$renderer3) => {
            if (retrying) {
              $$renderer3.push("<!--[0-->");
              Loader_circle($$renderer3, { class: "size-3.5 mr-1 animate-spin", "aria-hidden": "true" });
              $$renderer3.push(`<!----> Retrying…`);
            } else {
              $$renderer3.push("<!--[-1-->");
              Rotate_cw($$renderer3, { class: "size-3.5 mr-1", "aria-hidden": "true" });
              $$renderer3.push(`<!----> Retry job`);
            }
            $$renderer3.push(`<!--]-->`);
          },
          $$slots: { default: true }
        });
        $$renderer2.push(`<!----></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]-->`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
function TasksDrawer($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let nowMs = Date.now();
    const groups = derived(() => buildGroups(jobsStore.jobs));
    function buildGroups(jobs) {
      const out = [];
      const batchIndex = /* @__PURE__ */ new Map();
      for (const job of jobs) {
        if (job.batch_id) {
          const existing = batchIndex.get(job.batch_id);
          if (existing === void 0) {
            batchIndex.set(job.batch_id, out.length);
            out.push({ kind: "batch", batchId: job.batch_id, jobs: [job] });
          } else {
            out[existing].jobs.push(job);
          }
        } else {
          out.push({ kind: "single", job });
        }
      }
      return out;
    }
    function batchTally(jobs) {
      const done = jobs.filter((j) => j.state === "succeeded").length;
      const failed = jobs.filter((j) => j.state === "failed").length;
      const running = jobs.filter((j) => j.state === "running" || j.state === "pending" || j.state === "claimed").length;
      const parts = [];
      if (done > 0) parts.push(`${done} done`);
      if (running > 0) parts.push(`${running} running`);
      if (failed > 0) parts.push(`${failed} failed`);
      return parts.length ? parts.join(" · ") : `${jobs.length} done`;
    }
    function batchLabel(jobs) {
      const kind = jobs[0]?.kind ?? "job";
      const action = kind.split(".").slice(1).join(" ") || kind;
      return `Bulk ${action} ×${jobs.length}`;
    }
    function batchHasRunning(jobs) {
      return jobs.some((j) => j.state === "running" || j.state === "pending" || j.state === "claimed");
    }
    const summary = derived(() => jobsStore.runningCount === 0 && jobsStore.failedCount === 0 ? "No active tasks" : `${jobsStore.runningCount} running · ${jobsStore.failedCount} failed`);
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      if (Sheet) {
        $$renderer3.push("<!--[-->");
        Sheet($$renderer3, {
          get open() {
            return jobsStore.drawerOpen;
          },
          set open($$value) {
            jobsStore.drawerOpen = $$value;
            $$settled = false;
          },
          children: ($$renderer4) => {
            if (Sheet_content) {
              $$renderer4.push("<!--[-->");
              Sheet_content($$renderer4, {
                side: "right",
                class: "w-[420px] sm:w-[420px]",
                children: ($$renderer5) => {
                  if (Sheet_header) {
                    $$renderer5.push("<!--[-->");
                    Sheet_header($$renderer5, {
                      children: ($$renderer6) => {
                        if (Sheet_title) {
                          $$renderer6.push("<!--[-->");
                          Sheet_title($$renderer6, {
                            children: ($$renderer7) => {
                              $$renderer7.push(`<!---->Tasks`);
                            },
                            $$slots: { default: true }
                          });
                          $$renderer6.push("<!--]-->");
                        } else {
                          $$renderer6.push("<!--[!-->");
                          $$renderer6.push("<!--]-->");
                        }
                        $$renderer6.push(` `);
                        if (Sheet_description) {
                          $$renderer6.push("<!--[-->");
                          Sheet_description($$renderer6, {
                            children: ($$renderer7) => {
                              $$renderer7.push(`<!---->${escape_html(summary())}`);
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
                  $$renderer5.push(` <div class="mt-4 flex flex-col gap-2" style="max-height: calc(100vh - 9rem);">`);
                  if (!jobsStore.connected) {
                    $$renderer5.push("<!--[0-->");
                    $$renderer5.push(`<div role="status" class="flex items-center gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-[13px] text-warning">`);
                    Loader_circle($$renderer5, { class: "size-3.5 animate-spin", "aria-hidden": "true" });
                    $$renderer5.push(`<!----> Reconnecting to live updates…</div>`);
                  } else {
                    $$renderer5.push("<!--[-1-->");
                  }
                  $$renderer5.push(`<!--]--> `);
                  if (jobsStore.jobs.length === 0) {
                    $$renderer5.push("<!--[0-->");
                    $$renderer5.push(`<div class="flex flex-col items-center gap-2 py-12 text-center">`);
                    Activity($$renderer5, { class: "size-6 text-muted-foreground", "aria-hidden": "true" });
                    $$renderer5.push(`<!----> <p class="text-[18px] font-semibold tracking-tight">No tasks yet</p> <p class="text-[14px] text-muted-foreground">Lifecycle actions you run will show their progress here.</p></div>`);
                  } else {
                    $$renderer5.push("<!--[-1-->");
                    Scroll_area($$renderer5, {
                      class: "flex-1",
                      style: "max-height: calc(100vh - 11rem);",
                      children: ($$renderer6) => {
                        $$renderer6.push(`<div class="flex flex-col divide-y divide-border"><!--[-->`);
                        const each_array = ensure_array_like(groups());
                        for (let $$index_1 = 0, $$length = each_array.length; $$index_1 < $$length; $$index_1++) {
                          let group = each_array[$$index_1];
                          if (group.kind === "single") {
                            $$renderer6.push("<!--[0-->");
                            JobRow($$renderer6, { job: group.job, nowMs });
                          } else {
                            $$renderer6.push("<!--[-1-->");
                            if (Collapsible) {
                              $$renderer6.push("<!--[-->");
                              Collapsible($$renderer6, {
                                open: batchHasRunning(group.jobs),
                                children: ($$renderer7) => {
                                  {
                                    let child = function($$renderer8, { props }) {
                                      $$renderer8.push(`<button${attributes({
                                        ...props,
                                        type: "button",
                                        class: "flex h-10 w-full items-center gap-2 bg-muted/40 px-3 text-[13px] font-medium text-foreground"
                                      })}>`);
                                      if (batchHasRunning(group.jobs)) {
                                        $$renderer8.push("<!--[0-->");
                                        Chevron_down($$renderer8, { class: "size-3.5", "aria-hidden": "true" });
                                      } else {
                                        $$renderer8.push("<!--[-1-->");
                                        Chevron_right($$renderer8, { class: "size-3.5", "aria-hidden": "true" });
                                      }
                                      $$renderer8.push(`<!--]--> <span class="flex-1 text-left">${escape_html(batchLabel(group.jobs))}</span> <span class="text-muted-foreground">${escape_html(batchTally(group.jobs))}</span></button>`);
                                    };
                                    if (Collapsible_trigger) {
                                      $$renderer7.push("<!--[-->");
                                      Collapsible_trigger($$renderer7, { child, $$slots: { child: true } });
                                      $$renderer7.push("<!--]-->");
                                    } else {
                                      $$renderer7.push("<!--[!-->");
                                      $$renderer7.push("<!--]-->");
                                    }
                                  }
                                  $$renderer7.push(` `);
                                  if (Collapsible_content) {
                                    $$renderer7.push("<!--[-->");
                                    Collapsible_content($$renderer7, {
                                      children: ($$renderer8) => {
                                        $$renderer8.push(`<div class="flex flex-col divide-y divide-border pl-4"><!--[-->`);
                                        const each_array_1 = ensure_array_like(group.jobs);
                                        for (let $$index = 0, $$length2 = each_array_1.length; $$index < $$length2; $$index++) {
                                          let job = each_array_1[$$index];
                                          JobRow($$renderer8, { job, nowMs });
                                        }
                                        $$renderer8.push(`<!--]--></div>`);
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
                          $$renderer6.push(`<!--]-->`);
                        }
                        $$renderer6.push(`<!--]--></div>`);
                      },
                      $$slots: { default: true }
                    });
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
  $$renderer.component(($$renderer2) => {
    let { user, clusters = [], children } = $$props;
    let quotaOpen = false;
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      $$renderer3.push(`<a href="#main-content" class="bg-primary text-primary-foreground sr-only z-50 rounded px-3 py-2 focus:not-sr-only focus:absolute focus:left-3 focus:top-3">Skip to content</a> <div class="bg-background flex min-h-screen flex-col text-foreground">`);
      Topbar($$renderer3, {
        user,
        clusters,
        get quotaOpen() {
          return quotaOpen;
        },
        set quotaOpen($$value) {
          quotaOpen = $$value;
          $$settled = false;
        }
      });
      $$renderer3.push(`<!----> <div class="flex flex-1 overflow-hidden">`);
      Sidebar($$renderer3, { user });
      $$renderer3.push(`<!----> <main id="main-content" class="flex-1 overflow-y-auto"><div class="mx-auto w-full max-w-screen-xl px-6 py-8">`);
      children($$renderer3);
      $$renderer3.push(`<!----></div></main></div></div> `);
      TasksDrawer($$renderer3);
      $$renderer3.push(`<!----> `);
      Sonner_1($$renderer3, {
        position: "bottom-right",
        richColors: true,
        closeButton: true
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
function SessionExpiredModal($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let username = "";
    let password = "";
    let busy = false;
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      if (Dialog) {
        $$renderer3.push("<!--[-->");
        Dialog($$renderer3, {
          open: idle.showExpired,
          children: ($$renderer4) => {
            if (Dialog_content) {
              $$renderer4.push("<!--[-->");
              Dialog_content($$renderer4, {
                class: "sm:max-w-sm",
                showCloseButton: false,
                onInteractOutside: (e) => e.preventDefault(),
                onEscapeKeydown: (e) => e.preventDefault(),
                children: ($$renderer5) => {
                  if (Dialog_header) {
                    $$renderer5.push("<!--[-->");
                    Dialog_header($$renderer5, {
                      children: ($$renderer6) => {
                        if (Dialog_title) {
                          $$renderer6.push("<!--[-->");
                          Dialog_title($$renderer6, {
                            children: ($$renderer7) => {
                              $$renderer7.push(`<!---->Session expired`);
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
                              $$renderer7.push(`<!---->You were signed out after a period of inactivity. Sign back in to
        continue where you left off.`);
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
                  $$renderer5.push(` <form class="flex flex-col gap-3"><div class="flex flex-col gap-1.5">`);
                  Label($$renderer5, {
                    for: "reauth-username",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->Username`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> `);
                  Input($$renderer5, {
                    id: "reauth-username",
                    autocomplete: "username",
                    required: true,
                    get value() {
                      return username;
                    },
                    set value($$value) {
                      username = $$value;
                      $$settled = false;
                    }
                  });
                  $$renderer5.push(`<!----></div> <div class="flex flex-col gap-1.5">`);
                  Label($$renderer5, {
                    for: "reauth-password",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->Password`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> `);
                  Input($$renderer5, {
                    id: "reauth-password",
                    type: "password",
                    autocomplete: "current-password",
                    required: true,
                    get value() {
                      return password;
                    },
                    set value($$value) {
                      password = $$value;
                      $$settled = false;
                    }
                  });
                  $$renderer5.push(`<!----></div> `);
                  {
                    $$renderer5.push("<!--[-1-->");
                  }
                  $$renderer5.push(`<!--]--> <div class="flex justify-end">`);
                  Button($$renderer5, {
                    type: "submit",
                    disabled: busy,
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->${escape_html("Sign in")}`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----></div></form>`);
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
function IdleCountdownToast($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const seconds = derived(() => Math.max(0, idle.secondsRemaining));
    const mm = derived(() => Math.floor(seconds() / 60));
    const ss = derived(() => seconds() % 60);
    const label = derived(() => `${mm()}:${ss().toString().padStart(2, "0")}`);
    $$renderer2.push(`<div class="bg-popover text-popover-foreground fixed bottom-4 right-4 z-50 w-80 rounded-md border border-border p-4 shadow-lg" role="status" aria-live="polite"><p class="text-[14px] font-medium">Session about to expire</p> <p class="text-muted-foreground mt-1 text-[13px]">You'll be signed out in <span class="tabular-nums font-medium">${escape_html(label())}</span> due to inactivity.</p> <div class="mt-3 flex justify-end">`);
    Button($$renderer2, {
      size: "sm",
      onclick: () => idle.staySignedIn(),
      children: ($$renderer3) => {
        $$renderer3.push(`<!---->Stay signed in`);
      },
      $$slots: { default: true }
    });
    $$renderer2.push(`<!----></div></div>`);
  });
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
      $$renderer2.push(`<!----> `);
      if (idle.showCountdown) {
        $$renderer2.push("<!--[0-->");
        IdleCountdownToast($$renderer2);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      SessionExpiredModal($$renderer2);
      $$renderer2.push(`<!---->`);
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
//# sourceMappingURL=_layout.svelte-B7VNHKZ4.js.map
