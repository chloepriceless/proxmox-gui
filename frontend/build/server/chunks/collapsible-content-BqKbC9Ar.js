import { d as derived, f as bind_props, o as spread_props, z as props_id, p as attributes, j as attr, m as escape_html } from './renderer--hvGDOOw.js';
import { c as cn } from './button-BxOVow4s.js';
import { b as CommandListState, c as CommandEmptyState, d as CommandGroupContainerState, e as CommandGroupHeadingState, f as CommandGroupItemsState, g as CommandItemState } from './command-input-DT6qMHju.js';
import { a as createBitsAttrs, c as createId, b as boxWith, d as attachRef, h as boolToEmptyStrOrUndef, g as getDataOpenClosed, m as mergeProps, e as boolToStr, f as getDataTransitionAttrs } from './input-CMvV7SCO.js';
import { f as PresenceManager, u as useId, h as afterTick } from './scroll-lock-JQotfuy1.js';
import { n as noop } from './noop-n4I-x7yK.js';
import { C as Check } from './check-CxOYdq6i.js';
import { a as api } from './client2-WJrlUD72.js';
import { a as toast } from './toast-state.svelte-Ckj_X06S.js';
import { C as Context, S as SPACE, E as ENTER, w as watch } from './is-D4jTQp0x.js';
import { o as on } from './root-DHp9To-z.js';

const collapsibleAttrs = createBitsAttrs({
  component: "collapsible",
  parts: ["root", "content", "trigger"]
});
const CollapsibleRootContext = new Context("Collapsible.Root");
class CollapsibleRootState {
  static create(opts) {
    return CollapsibleRootContext.set(new CollapsibleRootState(opts));
  }
  opts;
  attachment;
  contentNode = null;
  contentPresence;
  contentId = void 0;
  constructor(opts) {
    this.opts = opts;
    this.toggleOpen = this.toggleOpen.bind(this);
    this.attachment = attachRef(this.opts.ref);
    this.contentPresence = new PresenceManager({
      ref: boxWith(() => this.contentNode),
      open: this.opts.open,
      onComplete: () => {
        this.opts.onOpenChangeComplete.current(this.opts.open.current);
      }
    });
  }
  toggleOpen() {
    this.opts.open.current = !this.opts.open.current;
  }
  #props = derived(() => ({
    id: this.opts.id.current,
    "data-state": getDataOpenClosed(this.opts.open.current),
    "data-disabled": boolToEmptyStrOrUndef(this.opts.disabled.current),
    [collapsibleAttrs.root]: "",
    ...this.attachment
  }));
  get props() {
    return this.#props();
  }
  set props($$value) {
    return this.#props($$value);
  }
}
class CollapsibleContentState {
  static create(opts) {
    return new CollapsibleContentState(opts, CollapsibleRootContext.get());
  }
  opts;
  root;
  attachment;
  #present = derived(() => {
    if (this.opts.hiddenUntilFound.current) return this.root.opts.open.current;
    return this.opts.forceMount.current || this.root.opts.open.current;
  });
  get present() {
    return this.#present();
  }
  set present($$value) {
    return this.#present($$value);
  }
  #originalStyles;
  #isMountAnimationPrevented = false;
  #width = 0;
  #height = 0;
  constructor(opts, root) {
    this.opts = opts;
    this.root = root;
    this.#isMountAnimationPrevented = root.opts.open.current;
    this.root.contentId = this.opts.id.current;
    this.attachment = attachRef(this.opts.ref, (v) => this.root.contentNode = v);
    watch.pre(() => this.opts.id.current, (id) => {
      this.root.contentId = id;
    });
    watch.pre(
      [
        () => this.opts.ref.current,
        () => this.opts.hiddenUntilFound.current
      ],
      ([node, hiddenUntilFound]) => {
        if (!node || !hiddenUntilFound) return;
        const handleBeforeMatch = () => {
          if (this.root.opts.open.current) return;
          requestAnimationFrame(() => {
            this.root.opts.open.current = true;
          });
        };
        return on(node, "beforematch", handleBeforeMatch);
      }
    );
    watch([() => this.opts.ref.current, () => this.present], ([node]) => {
      if (!node) return;
      afterTick(() => {
        if (!this.opts.ref.current) return;
        this.#originalStyles = this.#originalStyles || {
          transitionDuration: node.style.transitionDuration,
          animationName: node.style.animationName
        };
        node.style.transitionDuration = "0s";
        node.style.animationName = "none";
        const rect = node.getBoundingClientRect();
        this.#height = rect.height;
        this.#width = rect.width;
        if (!this.#isMountAnimationPrevented) {
          const { animationName, transitionDuration } = this.#originalStyles;
          node.style.transitionDuration = transitionDuration;
          node.style.animationName = animationName;
        }
      });
    });
  }
  get shouldRender() {
    return this.root.contentPresence.shouldRender;
  }
  #snippetProps = derived(() => ({ open: this.root.opts.open.current }));
  get snippetProps() {
    return this.#snippetProps();
  }
  set snippetProps($$value) {
    return this.#snippetProps($$value);
  }
  #props = derived(() => ({
    id: this.opts.id.current,
    style: {
      "--bits-collapsible-content-height": this.#height ? `${this.#height}px` : void 0,
      "--bits-collapsible-content-width": this.#width ? `${this.#width}px` : void 0
    },
    hidden: this.opts.hiddenUntilFound.current && !this.root.opts.open.current ? "until-found" : void 0,
    "data-state": getDataOpenClosed(this.root.opts.open.current),
    ...getDataTransitionAttrs(this.root.contentPresence.transitionStatus),
    "data-disabled": boolToEmptyStrOrUndef(this.root.opts.disabled.current),
    [collapsibleAttrs.content]: "",
    ...this.opts.hiddenUntilFound.current && !this.shouldRender ? {} : {
      hidden: this.opts.hiddenUntilFound.current ? !this.shouldRender : this.opts.forceMount.current ? void 0 : !this.shouldRender
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
class CollapsibleTriggerState {
  static create(opts) {
    return new CollapsibleTriggerState(opts, CollapsibleRootContext.get());
  }
  opts;
  root;
  attachment;
  #isDisabled = derived(() => this.opts.disabled.current || this.root.opts.disabled.current);
  constructor(opts, root) {
    this.opts = opts;
    this.root = root;
    this.attachment = attachRef(this.opts.ref);
    this.onclick = this.onclick.bind(this);
    this.onkeydown = this.onkeydown.bind(this);
  }
  onclick(e) {
    if (this.#isDisabled()) return;
    if (e.button !== 0) return e.preventDefault();
    this.root.toggleOpen();
  }
  onkeydown(e) {
    if (this.#isDisabled()) return;
    if (e.key === SPACE || e.key === ENTER) {
      e.preventDefault();
      this.root.toggleOpen();
    }
  }
  #props = derived(() => ({
    id: this.opts.id.current,
    type: "button",
    disabled: this.#isDisabled(),
    "aria-controls": this.root.contentId,
    "aria-expanded": boolToStr(this.root.opts.open.current),
    "data-state": getDataOpenClosed(this.root.opts.open.current),
    "data-disabled": boolToEmptyStrOrUndef(this.#isDisabled()),
    [collapsibleAttrs.trigger]: "",
    //
    onclick: this.onclick,
    onkeydown: this.onkeydown,
    ...this.attachment
  }));
  get props() {
    return this.#props();
  }
  set props($$value) {
    return this.#props($$value);
  }
}
function Collapsible$1($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const uid = props_id($$renderer2);
    let {
      children,
      child,
      id = createId(uid),
      ref = null,
      open = false,
      disabled = false,
      onOpenChange = noop,
      onOpenChangeComplete = noop,
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    const rootState = CollapsibleRootState.create({
      open: boxWith(() => open, (v) => {
        open = v;
        onOpenChange(v);
      }),
      disabled: boxWith(() => disabled),
      id: boxWith(() => id),
      ref: boxWith(() => ref, (v) => ref = v),
      onOpenChangeComplete: boxWith(() => onOpenChangeComplete)
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
    bind_props($$props, { ref, open });
  });
}
function Collapsible_content$1($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const uid = props_id($$renderer2);
    let {
      child,
      ref = null,
      forceMount = false,
      hiddenUntilFound = false,
      children,
      id = createId(uid),
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    const contentState = CollapsibleContentState.create({
      id: boxWith(() => id),
      forceMount: boxWith(() => forceMount),
      hiddenUntilFound: boxWith(() => hiddenUntilFound),
      ref: boxWith(() => ref, (v) => ref = v)
    });
    const mergedProps = derived(() => mergeProps(restProps, contentState.props));
    if (child) {
      $$renderer2.push("<!--[0-->");
      child($$renderer2, { ...contentState.snippetProps, props: mergedProps() });
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
function Collapsible_trigger$1($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const uid = props_id($$renderer2);
    let {
      children,
      child,
      ref = null,
      id = createId(uid),
      disabled = false,
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    const triggerState = CollapsibleTriggerState.create({
      id: boxWith(() => id),
      ref: boxWith(() => ref, (v) => ref = v),
      disabled: boxWith(() => disabled)
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
function Command_empty$1($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const uid = props_id($$renderer2);
    let {
      id = createId(uid),
      ref = null,
      children,
      child,
      forceMount = false,
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    const emptyState = CommandEmptyState.create({
      id: boxWith(() => id),
      ref: boxWith(() => ref, (v) => ref = v),
      forceMount: boxWith(() => forceMount)
    });
    const mergedProps = derived(() => mergeProps(emptyState.props, restProps));
    if (emptyState.shouldRender) {
      $$renderer2.push("<!--[0-->");
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
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
    bind_props($$props, { ref });
  });
}
function Command_group$1($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const uid = props_id($$renderer2);
    let {
      id = createId(uid),
      ref = null,
      value = "",
      forceMount = false,
      children,
      child,
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    const groupState = CommandGroupContainerState.create({
      id: boxWith(() => id),
      ref: boxWith(() => ref, (v) => ref = v),
      forceMount: boxWith(() => forceMount),
      value: boxWith(() => value)
    });
    const mergedProps = derived(() => mergeProps(restProps, groupState.props));
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
function Command_group_heading($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const uid = props_id($$renderer2);
    let {
      id = createId(uid),
      ref = null,
      children,
      child,
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    const headingState = CommandGroupHeadingState.create({
      id: boxWith(() => id),
      ref: boxWith(() => ref, (v) => ref = v)
    });
    const mergedProps = derived(() => mergeProps(restProps, headingState.props));
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
function Command_group_items($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const uid = props_id($$renderer2);
    let {
      id = createId(uid),
      ref = null,
      children,
      child,
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    const groupItemsState = CommandGroupItemsState.create({
      id: boxWith(() => id),
      ref: boxWith(() => ref, (v) => ref = v)
    });
    const mergedProps = derived(() => mergeProps(restProps, groupItemsState.props));
    $$renderer2.push(`<div style="display: contents;">`);
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
    $$renderer2.push(`<!--]--></div>`);
    bind_props($$props, { ref });
  });
}
function Command_item$1($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const uid = props_id($$renderer2);
    let {
      id = createId(uid),
      ref = null,
      value = "",
      disabled = false,
      children,
      child,
      onSelect = noop,
      forceMount = false,
      keywords = [],
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    const itemState = CommandItemState.create({
      id: boxWith(() => id),
      ref: boxWith(() => ref, (v) => ref = v),
      value: boxWith(() => value),
      disabled: boxWith(() => disabled),
      onSelect: boxWith(() => onSelect),
      forceMount: boxWith(() => forceMount),
      keywords: boxWith(() => keywords)
    });
    const mergedProps = derived(() => mergeProps(restProps, itemState.props));
    $$renderer2.push(`<!---->`);
    {
      $$renderer2.push(`<div style="display: contents;" data-item-wrapper=""${attr("data-value", itemState.trueValue)}>`);
      if (itemState.shouldRender) {
        $$renderer2.push("<!--[0-->");
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
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div>`);
    }
    $$renderer2.push(`<!---->`);
    bind_props($$props, { ref });
  });
}
function Command_list$1($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const uid = props_id($$renderer2);
    let {
      id = createId(uid),
      ref = null,
      child,
      children,
      "aria-label": ariaLabel,
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    const listState = CommandListState.create({
      id: boxWith(() => id),
      ref: boxWith(() => ref, (v) => ref = v),
      ariaLabel: boxWith(() => ariaLabel ?? "Suggestions...")
    });
    const mergedProps = derived(() => mergeProps(restProps, listState.props));
    $$renderer2.push(`<!---->`);
    {
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
    }
    $$renderer2.push(`<!---->`);
    bind_props($$props, { ref });
  });
}
function Command_empty($$renderer, $$props) {
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
      if (Command_empty$1) {
        $$renderer3.push("<!--[-->");
        Command_empty$1($$renderer3, spread_props([
          {
            "data-slot": "command-empty",
            class: cn("py-6 text-center text-sm", className)
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
function Command_group($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      ref = null,
      class: className,
      children,
      heading,
      value,
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      if (Command_group$1) {
        $$renderer3.push("<!--[-->");
        Command_group$1($$renderer3, spread_props([
          {
            "data-slot": "command-group",
            class: cn("text-foreground **:[[cmdk-group-heading]]:text-muted-foreground overflow-hidden p-1 **:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:py-1.5 **:[[cmdk-group-heading]]:text-xs **:[[cmdk-group-heading]]:font-medium", className),
            value: value ?? heading ?? `----${useId()}`
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
              if (heading) {
                $$renderer4.push("<!--[0-->");
                if (Command_group_heading) {
                  $$renderer4.push("<!--[-->");
                  Command_group_heading($$renderer4, {
                    class: "text-muted-foreground px-2 py-1.5 text-xs font-medium",
                    children: ($$renderer5) => {
                      $$renderer5.push(`<!---->${escape_html(heading)}`);
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
              $$renderer4.push(`<!--]--> `);
              if (Command_group_items) {
                $$renderer4.push("<!--[-->");
                Command_group_items($$renderer4, { children });
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
function Command_item($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      ref = null,
      class: className,
      children,
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      if (Command_item$1) {
        $$renderer3.push("<!--[-->");
        Command_item$1($$renderer3, spread_props([
          {
            "data-slot": "command-item",
            class: cn("group/command-item data-selected:bg-muted data-selected:text-foreground data-selected:*:[svg]:text-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none in-data-[slot=dialog-content]:rounded-lg! data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4", className)
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
              Check($$renderer4, {
                class: "cn-command-item-indicator ml-auto opacity-0 group-has-[[data-slot=command-shortcut]]/command-item:hidden group-data-[checked=true]/command-item:opacity-100"
              });
              $$renderer4.push(`<!---->`);
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
function Command_list($$renderer, $$props) {
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
      if (Command_list$1) {
        $$renderer3.push("<!--[-->");
        Command_list$1($$renderer3, spread_props([
          {
            "data-slot": "command-list",
            class: cn("no-scrollbar max-h-72 scroll-py-1 outline-none overflow-x-hidden overflow-y-auto", className)
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
const LONG_KINDS = /* @__PURE__ */ new Set(["vm.clone", "vm.migrate", "vm.backup", "vm.restore"]);
const TERMINAL = /* @__PURE__ */ new Set(["succeeded", "failed"]);
const MAX_JOBS = 50;
const BACKOFF_MS = [1e3, 2e3, 5e3, 1e4, 3e4];
function defaultWsUrl() {
  if (typeof location === "undefined") return "ws://localhost/api/v1/ws/jobs";
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}/api/v1/ws/jobs`;
}
function actionLabel(kind) {
  const tail = kind.split(".").slice(1).join(" ") || kind;
  return tail.charAt(0).toUpperCase() + tail.slice(1);
}
class JobsStore {
  /** Live job list, newest-first, trimmed to MAX_JOBS. */
  jobs = [];
  /** Whether the WebSocket is currently open. */
  connected = false;
  /** Whether the Tasks drawer Sheet is open. */
  drawerOpen = false;
  /**
   * False while there is an unacknowledged failure — drives the red badge.
   * Opening the drawer acknowledges (sets it back to true).
   */
  failuresAcknowledged = true;
  #runningCount = derived(() => this.jobs.filter((j) => j.state === "running").length);
  get runningCount() {
    return this.#runningCount();
  }
  set runningCount($$value) {
    return this.#runningCount($$value);
  }
  #pendingCount = derived(() => this.jobs.filter((j) => j.state === "pending" || j.state === "claimed").length);
  get pendingCount() {
    return this.#pendingCount();
  }
  set pendingCount($$value) {
    return this.#pendingCount($$value);
  }
  #failedCount = derived(() => this.jobs.filter((j) => j.state === "failed").length);
  get failedCount() {
    return this.#failedCount();
  }
  set failedCount($$value) {
    return this.#failedCount($$value);
  }
  #inFlightCount = derived(() => this.runningCount + this.pendingCount);
  get inFlightCount() {
    return this.#inFlightCount();
  }
  set inFlightCount($$value) {
    return this.#inFlightCount($$value);
  }
  #ws = null;
  #wsFactory;
  #wsUrl;
  #reconnectTimer = null;
  #reconnectAttempt = 0;
  #closedByUs = false;
  #silent;
  constructor(opts) {
    this.#wsFactory = opts?.wsFactory ?? ((url) => new WebSocket(url));
    this.#wsUrl = opts?.wsUrl ?? defaultWsUrl();
    this.#silent = opts?.silent ?? false;
  }
  /** Open the WebSocket. Idempotent — a second call while open is a no-op. */
  connect() {
    if (this.#ws) return;
    this.#closedByUs = false;
    this.#openSocket();
  }
  /** Close the WebSocket and cancel any pending reconnect. */
  disconnect() {
    this.#closedByUs = true;
    if (this.#reconnectTimer) {
      clearTimeout(this.#reconnectTimer);
      this.#reconnectTimer = null;
    }
    if (this.#ws) {
      this.#ws.close();
      this.#ws = null;
    }
    this.connected = false;
  }
  #openSocket() {
    const ws = this.#wsFactory(this.#wsUrl);
    this.#ws = ws;
    ws.onopen = () => {
      this.connected = true;
      this.#reconnectAttempt = 0;
    };
    ws.onmessage = (ev) => this.#handleMessage(ev.data);
    ws.onclose = () => {
      this.connected = false;
      this.#ws = null;
      if (!this.#closedByUs) this.#scheduleReconnect();
    };
    ws.onerror = () => {
    };
  }
  #scheduleReconnect() {
    if (this.#reconnectTimer) return;
    const delay = BACKOFF_MS[Math.min(this.#reconnectAttempt, BACKOFF_MS.length - 1)];
    this.#reconnectAttempt += 1;
    this.#reconnectTimer = setTimeout(
      () => {
        this.#reconnectTimer = null;
        if (!this.#closedByUs) this.#openSocket();
      },
      delay
    );
  }
  /** Parse + dispatch one inbound WebSocket frame. */
  #handleMessage(data) {
    let msg;
    try {
      msg = typeof data === "string" ? JSON.parse(data) : data;
    } catch {
      return;
    }
    if (!msg || typeof msg !== "object") return;
    if (msg.type === "backfill") {
      this.#applyBackfill(msg.jobs ?? []);
    } else if (msg.type === "job.running" || msg.type === "job.progress" || msg.type === "job.completed") {
      if (msg.job) this.upsertJob(msg.job);
    } else if (msg.type === "reaper.reattached") {
      const n = msg.job_ids?.length ?? 0;
      if (n > 0 && !this.#silent) {
        toast.info(`Resumed tracking ${n} task(s) that were running before a restart.`);
      }
    }
  }
  /**
   * Replace the list from a `backfill` frame, reconciled by `id` — on a
   * reconnect this is the de-dup point (UI-SPEC reconnect contract).
   */
  #applyBackfill(incoming) {
    const byId = /* @__PURE__ */ new Map();
    for (const j of this.jobs) byId.set(j.id, j);
    for (const j of incoming) byId.set(j.id, j);
    this.jobs = this.#sortAndTrim([...byId.values()]);
  }
  /**
   * Upsert a single job by `id` — replaces an existing row or prepends a new
   * one (never spawns a duplicate). On a transition into a terminal state the
   * completion toast fires (D-03); a long-kind job auto-opens the drawer (D-02).
   */
  upsertJob(job) {
    const prev = this.jobs.find((j) => j.id === job.id);
    const next = this.jobs.filter((j) => j.id !== job.id);
    next.unshift(job);
    this.jobs = this.#sortAndTrim(next);
    if (!prev && LONG_KINDS.has(job.kind)) {
      this.drawerOpen = true;
    }
    const enteredTerminal = TERMINAL.has(job.state) && (!prev || !TERMINAL.has(prev.state));
    if (enteredTerminal) {
      if (job.state === "failed") {
        this.failuresAcknowledged = false;
        if (!this.#silent) {
          const detail = job.friendly_error ?? job.error ?? "see the Tasks drawer";
          toast.error(`${actionLabel(job.kind)} failed: ${detail}.`, {
            duration: Infinity,
            action: { label: "Open in Tasks", onClick: () => this.openDrawer() }
          });
        }
      } else if (job.state === "succeeded" && !this.#silent) {
        toast.success(`${actionLabel(job.kind)} finished.`);
      }
    }
  }
  /** newest-first, running floated above completed, trimmed to MAX_JOBS. */
  #sortAndTrim(list) {
    const rank = (s) => s === "running" || s === "pending" || s === "claimed" ? 0 : 1;
    const sorted = [...list].sort((a, b) => {
      const r = rank(a.state) - rank(b.state);
      if (r !== 0) return r;
      return Date.parse(b.created_at) - Date.parse(a.created_at);
    });
    return sorted.slice(0, MAX_JOBS);
  }
  /** Open the drawer — opening also acknowledges any failures (UI-SPEC). */
  openDrawer() {
    this.drawerOpen = true;
    this.failuresAcknowledged = true;
  }
  /** Close the drawer. */
  closeDrawer() {
    this.drawerOpen = false;
  }
  /**
   * Retry a failed job (D-16). Re-arms the SAME job row server-side; the
   * WebSocket then streams its pending→running transition back in place.
   */
  async retry(id) {
    await api.jobs.retryJob(id);
  }
}
const jobsStore = new JobsStore();
function Collapsible($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { ref = null, open = false, $$slots, $$events, ...restProps } = $$props;
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      if (Collapsible$1) {
        $$renderer3.push("<!--[-->");
        Collapsible$1($$renderer3, spread_props([
          { "data-slot": "collapsible" },
          restProps,
          {
            get ref() {
              return ref;
            },
            set ref($$value) {
              ref = $$value;
              $$settled = false;
            },
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
    bind_props($$props, { ref, open });
  });
}
function Collapsible_trigger($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { ref = null, $$slots, $$events, ...restProps } = $$props;
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      if (Collapsible_trigger$1) {
        $$renderer3.push("<!--[-->");
        Collapsible_trigger$1($$renderer3, spread_props([
          { "data-slot": "collapsible-trigger" },
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
function Collapsible_content($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { ref = null, $$slots, $$events, ...restProps } = $$props;
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      if (Collapsible_content$1) {
        $$renderer3.push("<!--[-->");
        Collapsible_content$1($$renderer3, spread_props([
          { "data-slot": "collapsible-content" },
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

export { Command_list as C, Command_empty as a, Command_group as b, Collapsible as c, Collapsible_trigger as d, Collapsible_content as e, Command_item as f, jobsStore as j };
//# sourceMappingURL=collapsible-content-BqKbC9Ar.js.map
