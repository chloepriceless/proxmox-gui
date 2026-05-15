import { f as ensure_array_like, l as escape_html, d as derived, c as store_get, y as bind_props, n as spread_props, z as props_id, o as attributes, m as unsubscribe_stores, j as attr_class, p as clsx } from './renderer-5OqEGBJa.js';
import { i as invalidateAll, g as goto } from './client-BLBuBvl1.js';
import { p as page } from './stores-C0P6ZS0h.js';
import { B as Button, c as cn, I as Icon } from './button-B5bCAdGN.js';
import { I as Input, c as createId, b as boxWith, m as mergeProps, a as attachRef, h as boolToEmptyStrOrUndef, f as createBitsAttrs, g as getDataOpenClosed, e as getDataTransitionAttrs, d as boolToStr } from './input-CVUkBx6i.js';
import { D as Dropdown_menu, a as Dropdown_menu_trigger, b as Dropdown_menu_content, c as Dropdown_menu_item } from './dropdown-menu-trigger-D8Q6pE1W.js';
import 'clsx';
import { w as watch, C as Context, S as SPACE, E as ENTER } from './is-DeZ4WIS2.js';
import { o as on } from './root-BZo_tL0Z.js';
import { R as RovingFocusGroup, e as PresenceManager, h as afterTick } from './scroll-lock-BXSbnLUA.js';
import { n as noop } from './noop-n4I-x7yK.js';
import { T as Table, b as Table_body, a as Table_row, c as Table_cell } from './table-row-CHObHOSI.js';
import { B as Badge } from './badge-ohCh8OUw.js';
import { A as Alert } from './alert-DKR6l6LD.js';
import { A as Alert_description } from './alert-description-BLye52mR.js';
import { A as Alert_title } from './alert-title-MPDSeCCx.js';
import { a as Clock, C as ClusterStatusPill } from './ClusterStatusPill-CGUkJ_yu.js';
import { S as Shield_alert } from './shield-alert-DeUzDBBh.js';
import { F as FilterChip } from './FilterChip-DiymKOIO.js';
import { T as TagPill } from './TagPill-D3sB1Fnz.js';
import '@sveltejs/kit/internal';
import './index-Siz_BmGa.js';
import '@sveltejs/kit/internal/server';
import './state.svelte-Bqwbw8qw.js';
import 'tailwind-merge';
import './popper-layer-force-mount-DItOXSN8.js';
import './lock-7RFs808g.js';
import './x-hAU9CgJu.js';

const accordionAttrs = createBitsAttrs({
  component: "accordion",
  parts: ["root", "trigger", "content", "item", "header"]
});
const AccordionRootContext = new Context("Accordion.Root");
const AccordionItemContext = new Context("Accordion.Item");
class AccordionBaseState {
  opts;
  rovingFocusGroup;
  attachment;
  constructor(opts) {
    this.opts = opts;
    this.rovingFocusGroup = new RovingFocusGroup({
      rootNode: this.opts.ref,
      candidateAttr: accordionAttrs.trigger,
      loop: this.opts.loop,
      orientation: this.opts.orientation
    });
    this.attachment = attachRef(this.opts.ref);
  }
  #props = derived(() => ({
    id: this.opts.id.current,
    "data-orientation": this.opts.orientation.current,
    "data-disabled": boolToEmptyStrOrUndef(this.opts.disabled.current),
    [accordionAttrs.root]: "",
    ...this.attachment
  }));
  get props() {
    return this.#props();
  }
  set props($$value) {
    return this.#props($$value);
  }
}
class AccordionSingleState extends AccordionBaseState {
  opts;
  isMulti = false;
  constructor(opts) {
    super(opts);
    this.opts = opts;
    this.includesItem = this.includesItem.bind(this);
    this.toggleItem = this.toggleItem.bind(this);
  }
  includesItem(item) {
    return this.opts.value.current === item;
  }
  toggleItem(item) {
    this.opts.value.current = this.includesItem(item) ? "" : item;
  }
}
class AccordionMultiState extends AccordionBaseState {
  #value;
  isMulti = true;
  constructor(props) {
    super(props);
    this.#value = props.value;
    this.includesItem = this.includesItem.bind(this);
    this.toggleItem = this.toggleItem.bind(this);
  }
  includesItem(item) {
    return this.#value.current.includes(item);
  }
  toggleItem(item) {
    this.#value.current = this.includesItem(item) ? this.#value.current.filter((v) => v !== item) : [...this.#value.current, item];
  }
}
class AccordionRootState {
  static create(props) {
    const { type, ...rest } = props;
    const rootState = type === "single" ? new AccordionSingleState(rest) : new AccordionMultiState(rest);
    return AccordionRootContext.set(rootState);
  }
}
class AccordionItemState {
  static create(props) {
    return AccordionItemContext.set(new AccordionItemState({ ...props, rootState: AccordionRootContext.get() }));
  }
  opts;
  root;
  #isActive = derived(() => this.root.includesItem(this.opts.value.current));
  get isActive() {
    return this.#isActive();
  }
  set isActive($$value) {
    return this.#isActive($$value);
  }
  #isDisabled = derived(() => this.opts.disabled.current || this.root.opts.disabled.current);
  get isDisabled() {
    return this.#isDisabled();
  }
  set isDisabled($$value) {
    return this.#isDisabled($$value);
  }
  attachment;
  contentNode = null;
  contentPresence;
  constructor(opts) {
    this.opts = opts;
    this.root = opts.rootState;
    this.updateValue = this.updateValue.bind(this);
    this.attachment = attachRef(this.opts.ref);
    this.contentPresence = new PresenceManager({
      ref: boxWith(() => this.contentNode),
      open: boxWith(() => this.isActive)
    });
  }
  updateValue() {
    this.root.toggleItem(this.opts.value.current);
  }
  #props = derived(() => ({
    id: this.opts.id.current,
    "data-state": getDataOpenClosed(this.isActive),
    "data-disabled": boolToEmptyStrOrUndef(this.isDisabled),
    "data-orientation": this.root.opts.orientation.current,
    [accordionAttrs.item]: "",
    ...this.attachment
  }));
  get props() {
    return this.#props();
  }
  set props($$value) {
    return this.#props($$value);
  }
}
class AccordionTriggerState {
  opts;
  itemState;
  #root;
  #isDisabled = derived(() => this.opts.disabled.current || this.itemState.opts.disabled.current || this.#root.opts.disabled.current);
  attachment;
  constructor(opts, itemState) {
    this.opts = opts;
    this.itemState = itemState;
    this.#root = itemState.root;
    this.onclick = this.onclick.bind(this);
    this.onkeydown = this.onkeydown.bind(this);
    this.attachment = attachRef(this.opts.ref);
  }
  static create(props) {
    return new AccordionTriggerState(props, AccordionItemContext.get());
  }
  onclick(e) {
    if (this.#isDisabled() || e.button !== 0) {
      e.preventDefault();
      return;
    }
    this.itemState.updateValue();
  }
  onkeydown(e) {
    if (this.#isDisabled()) return;
    if (e.key === SPACE || e.key === ENTER) {
      e.preventDefault();
      this.itemState.updateValue();
      return;
    }
    this.#root.rovingFocusGroup.handleKeydown(this.opts.ref.current, e);
  }
  #props = derived(() => ({
    id: this.opts.id.current,
    disabled: this.#isDisabled(),
    "aria-expanded": boolToStr(this.itemState.isActive),
    "aria-disabled": boolToStr(this.#isDisabled()),
    "data-disabled": boolToEmptyStrOrUndef(this.#isDisabled()),
    "data-state": getDataOpenClosed(this.itemState.isActive),
    "data-orientation": this.#root.opts.orientation.current,
    [accordionAttrs.trigger]: "",
    tabindex: this.opts.tabindex.current,
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
class AccordionContentState {
  opts;
  item;
  attachment;
  #originalStyles = void 0;
  #isMountAnimationPrevented = false;
  #dimensions = { width: 0, height: 0 };
  #open = derived(() => {
    if (this.opts.hiddenUntilFound.current) return this.item.isActive;
    return this.opts.forceMount.current || this.item.isActive;
  });
  get open() {
    return this.#open();
  }
  set open($$value) {
    return this.#open($$value);
  }
  constructor(opts, item) {
    this.opts = opts;
    this.item = item;
    this.#isMountAnimationPrevented = this.item.isActive;
    this.attachment = attachRef(this.opts.ref, (v) => this.item.contentNode = v);
    watch.pre(
      [
        () => this.opts.ref.current,
        () => this.opts.hiddenUntilFound.current
      ],
      ([node, hiddenUntilFound]) => {
        if (!node || !hiddenUntilFound) return;
        const handleBeforeMatch = () => {
          if (this.item.isActive) return;
          requestAnimationFrame(() => {
            this.item.updateValue();
          });
        };
        return on(node, "beforematch", handleBeforeMatch);
      }
    );
    watch([() => this.open, () => this.opts.ref.current], this.#updateDimensions);
  }
  static create(props) {
    return new AccordionContentState(props, AccordionItemContext.get());
  }
  #updateDimensions = ([_, node]) => {
    if (!node) return;
    afterTick(() => {
      const element = this.opts.ref.current;
      if (!element) return;
      this.#originalStyles ??= {
        transitionDuration: element.style.transitionDuration,
        animationName: element.style.animationName
      };
      element.style.transitionDuration = "0s";
      element.style.animationName = "none";
      const rect = element.getBoundingClientRect();
      this.#dimensions = { width: rect.width, height: rect.height };
      if (!this.#isMountAnimationPrevented && this.#originalStyles) {
        element.style.transitionDuration = this.#originalStyles.transitionDuration;
        element.style.animationName = this.#originalStyles.animationName;
      }
    });
  };
  get shouldRender() {
    return this.item.contentPresence.shouldRender;
  }
  #snippetProps = derived(() => ({ open: this.item.isActive }));
  get snippetProps() {
    return this.#snippetProps();
  }
  set snippetProps($$value) {
    return this.#snippetProps($$value);
  }
  #props = derived(() => ({
    id: this.opts.id.current,
    "data-state": getDataOpenClosed(this.item.isActive),
    ...getDataTransitionAttrs(this.item.contentPresence.transitionStatus),
    "data-disabled": boolToEmptyStrOrUndef(this.item.isDisabled),
    "data-orientation": this.item.root.opts.orientation.current,
    [accordionAttrs.content]: "",
    style: {
      "--bits-accordion-content-height": `${this.#dimensions.height}px`,
      "--bits-accordion-content-width": `${this.#dimensions.width}px`
    },
    hidden: this.opts.hiddenUntilFound.current && !this.item.isActive ? "until-found" : void 0,
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
class AccordionHeaderState {
  opts;
  item;
  attachment;
  constructor(opts, item) {
    this.opts = opts;
    this.item = item;
    this.attachment = attachRef(this.opts.ref);
  }
  static create(props) {
    return new AccordionHeaderState(props, AccordionItemContext.get());
  }
  #props = derived(() => ({
    id: this.opts.id.current,
    role: "heading",
    "aria-level": this.opts.level.current,
    "data-heading-level": this.opts.level.current,
    "data-state": getDataOpenClosed(this.item.isActive),
    "data-orientation": this.item.root.opts.orientation.current,
    [accordionAttrs.header]: "",
    ...this.attachment
  }));
  get props() {
    return this.#props();
  }
  set props($$value) {
    return this.#props($$value);
  }
}
function Accordion$1($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const uid = props_id($$renderer2);
    let {
      disabled = false,
      children,
      child,
      type,
      value = void 0,
      ref = null,
      id = createId(uid),
      onValueChange = noop,
      loop = true,
      orientation = "vertical",
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    function handleDefaultValue() {
      if (value !== void 0) return;
      value = type === "single" ? "" : [];
    }
    handleDefaultValue();
    watch.pre(() => value, () => {
      handleDefaultValue();
    });
    const rootState = AccordionRootState.create({
      type,
      value: boxWith(() => value, (v) => {
        value = v;
        onValueChange(v);
      }),
      id: boxWith(() => id),
      disabled: boxWith(() => disabled),
      loop: boxWith(() => loop),
      orientation: boxWith(() => orientation),
      ref: boxWith(() => ref, (v) => ref = v)
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
    bind_props($$props, { value, ref });
  });
}
function Accordion_item$1($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const uid = props_id($$renderer2);
    const defaultId = createId(uid);
    let {
      id = defaultId,
      disabled = false,
      value = defaultId,
      children,
      child,
      ref = null,
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    const itemState = AccordionItemState.create({
      value: boxWith(() => value),
      disabled: boxWith(() => disabled),
      id: boxWith(() => id),
      ref: boxWith(() => ref, (v) => ref = v)
    });
    const mergedProps = derived(() => mergeProps(restProps, itemState.props));
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
function Accordion_header($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const uid = props_id($$renderer2);
    let {
      id = createId(uid),
      level = 2,
      children,
      child,
      ref = null,
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    const headerState = AccordionHeaderState.create({
      id: boxWith(() => id),
      level: boxWith(() => level),
      ref: boxWith(() => ref, (v) => ref = v)
    });
    const mergedProps = derived(() => mergeProps(restProps, headerState.props));
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
function Accordion_trigger$1($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const uid = props_id($$renderer2);
    let {
      disabled = false,
      ref = null,
      id = createId(uid),
      tabindex = 0,
      children,
      child,
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    const triggerState = AccordionTriggerState.create({
      disabled: boxWith(() => disabled),
      id: boxWith(() => id),
      tabindex: boxWith(() => tabindex ?? 0),
      ref: boxWith(() => ref, (v) => ref = v)
    });
    const mergedProps = derived(() => mergeProps(restProps, triggerState.props));
    if (child) {
      $$renderer2.push("<!--[0-->");
      child($$renderer2, { props: mergedProps() });
      $$renderer2.push(`<!---->`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<button${attributes({ type: "button", ...mergedProps() })}>`);
      children?.($$renderer2);
      $$renderer2.push(`<!----></button>`);
    }
    $$renderer2.push(`<!--]-->`);
    bind_props($$props, { ref });
  });
}
function Accordion_content$1($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const uid = props_id($$renderer2);
    let {
      child,
      ref = null,
      id = createId(uid),
      forceMount = false,
      children,
      hiddenUntilFound = false,
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    const contentState = AccordionContentState.create({
      forceMount: boxWith(() => forceMount),
      id: boxWith(() => id),
      ref: boxWith(() => ref, (v) => ref = v),
      hiddenUntilFound: boxWith(() => hiddenUntilFound)
    });
    const mergedProps = derived(() => mergeProps(restProps, contentState.props));
    if (child) {
      $$renderer2.push("<!--[0-->");
      child($$renderer2, { props: mergedProps(), ...contentState.snippetProps });
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
function Chevron_right($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [["path", { "d": "m9 18 6-6-6-6" }]];
  Icon($$renderer, spread_props([{ name: "chevron-right" }, props, { iconNode }]));
}
function Accordion($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      ref = null,
      value = void 0,
      class: className,
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      if (Accordion$1) {
        $$renderer3.push("<!--[-->");
        Accordion$1($$renderer3, spread_props([
          {
            "data-slot": "accordion",
            class: cn("cn-accordion flex w-full flex-col", className)
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
            get value() {
              return value;
            },
            set value($$value) {
              value = $$value;
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
    bind_props($$props, { ref, value });
  });
}
function Accordion_content($$renderer, $$props) {
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
      if (Accordion_content$1) {
        $$renderer3.push("<!--[-->");
        Accordion_content$1($$renderer3, spread_props([
          {
            "data-slot": "accordion-content",
            class: "data-open:animate-accordion-down data-closed:animate-accordion-up text-sm overflow-hidden"
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
              $$renderer4.push(`<div${attr_class(clsx(cn("pt-0 pb-2.5 [&_a]:hover:text-foreground [&_a]:underline [&_a]:underline-offset-3 [&_p:not(:last-child)]:mb-4", className)))}>`);
              children?.($$renderer4);
              $$renderer4.push(`<!----></div>`);
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
function Accordion_item($$renderer, $$props) {
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
      if (Accordion_item$1) {
        $$renderer3.push("<!--[-->");
        Accordion_item$1($$renderer3, spread_props([
          {
            "data-slot": "accordion-item",
            class: cn("not-last:border-b", className)
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
function Chevron_down($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [["path", { "d": "m6 9 6 6 6-6" }]];
  Icon($$renderer, spread_props([{ name: "chevron-down" }, props, { iconNode }]));
}
function Chevron_up($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [["path", { "d": "m18 15-6-6-6 6" }]];
  Icon($$renderer, spread_props([{ name: "chevron-up" }, props, { iconNode }]));
}
function Accordion_trigger($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      ref = null,
      class: className,
      level = 3,
      children,
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      if (Accordion_header) {
        $$renderer3.push("<!--[-->");
        Accordion_header($$renderer3, {
          level,
          class: "flex",
          children: ($$renderer4) => {
            if (Accordion_trigger$1) {
              $$renderer4.push("<!--[-->");
              Accordion_trigger$1($$renderer4, spread_props([
                {
                  "data-slot": "accordion-trigger",
                  class: cn("focus-visible:ring-ring/50 focus-visible:border-ring focus-visible:after:border-ring **:data-[slot=accordion-trigger-icon]:text-muted-foreground rounded-lg py-2.5 text-left text-sm font-medium hover:underline focus-visible:ring-3 **:data-[slot=accordion-trigger-icon]:ml-auto **:data-[slot=accordion-trigger-icon]:size-4 group/accordion-trigger relative flex flex-1 items-start justify-between border border-transparent transition-all outline-none disabled:pointer-events-none disabled:opacity-50", className)
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
                    Chevron_down($$renderer5, {
                      "data-slot": "accordion-trigger-icon",
                      class: "cn-accordion-trigger-icon pointer-events-none shrink-0 group-aria-expanded/accordion-trigger:hidden"
                    });
                    $$renderer5.push(`<!----> `);
                    Chevron_up($$renderer5, {
                      "data-slot": "accordion-trigger-icon",
                      class: "cn-accordion-trigger-icon pointer-events-none hidden shrink-0 group-aria-expanded/accordion-trigger:inline"
                    });
                    $$renderer5.push(`<!---->`);
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
    bind_props($$props, { ref });
  });
}
function Circle_play($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    [
      "path",
      {
        "d": "M9 9.003a1 1 0 0 1 1.517-.859l4.997 2.997a1 1 0 0 1 0 1.718l-4.997 2.997A1 1 0 0 1 9 14.996z"
      }
    ],
    ["circle", { "cx": "12", "cy": "12", "r": "10" }]
  ];
  Icon($$renderer, spread_props([{ name: "circle-play" }, props, { iconNode }]));
}
function Circle_stop($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["circle", { "cx": "12", "cy": "12", "r": "10" }],
    [
      "rect",
      { "x": "9", "y": "9", "width": "6", "height": "6", "rx": "1" }
    ]
  ];
  Icon($$renderer, spread_props([{ name: "circle-stop" }, props, { iconNode }]));
}
function Circle_pause($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["circle", { "cx": "12", "cy": "12", "r": "10" }],
    ["line", { "x1": "10", "x2": "10", "y1": "15", "y2": "9" }],
    ["line", { "x1": "14", "x2": "14", "y1": "15", "y2": "9" }]
  ];
  Icon($$renderer, spread_props([{ name: "circle-pause" }, props, { iconNode }]));
}
function Circle_alert($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["circle", { "cx": "12", "cy": "12", "r": "10" }],
    ["line", { "x1": "12", "x2": "12", "y1": "8", "y2": "12" }],
    [
      "line",
      { "x1": "12", "x2": "12.01", "y1": "16", "y2": "16" }
    ]
  ];
  Icon($$renderer, spread_props([{ name: "circle-alert" }, props, { iconNode }]));
}
function ClusterSection($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      clusterId,
      clusterName,
      clusterStatus,
      isStale,
      lastError,
      matched,
      total,
      filterActive,
      children
    } = $$props;
    const counterLabel = derived(() => filterActive ? `(${matched} / ${total})` : `(${total})`);
    const pillStatus = derived(() => isStale ? "stale" : ["ok", "failed", "untested"].includes(clusterStatus) ? clusterStatus : "untested");
    if (Accordion_item) {
      $$renderer2.push("<!--[-->");
      Accordion_item($$renderer2, {
        value: `cluster-${clusterId}`,
        class: "border-0",
        children: ($$renderer3) => {
          if (Accordion_trigger) {
            $$renderer3.push("<!--[-->");
            Accordion_trigger($$renderer3, {
              class: "bg-muted/40 h-12 px-6 hover:bg-muted/60 rounded-md w-full text-left",
              children: ($$renderer4) => {
                $$renderer4.push(`<div class="flex items-center gap-3 flex-1 min-w-0"><span class="text-[18px] font-semibold tracking-tight truncate">${escape_html(clusterName)}</span> `);
                ClusterStatusPill($$renderer4, { status: pillStatus() });
                $$renderer4.push(`<!----> `);
                Badge($$renderer4, {
                  variant: "outline",
                  class: "text-[13px] font-medium text-muted-foreground shrink-0",
                  children: ($$renderer5) => {
                    $$renderer5.push(`<!---->${escape_html(counterLabel())}`);
                  },
                  $$slots: { default: true }
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
          if (Accordion_content) {
            $$renderer3.push("<!--[-->");
            Accordion_content($$renderer3, {
              class: "pt-0 pb-0",
              children: ($$renderer4) => {
                if (clusterStatus === "failed" || isStale && clusterStatus !== "ok") {
                  $$renderer4.push("<!--[0-->");
                  if (Alert) {
                    $$renderer4.push("<!--[-->");
                    Alert($$renderer4, {
                      variant: "destructive",
                      class: "mb-4 mt-2",
                      children: ($$renderer5) => {
                        Shield_alert($$renderer5, { class: "size-4" });
                        $$renderer5.push(`<!----> `);
                        if (Alert_title) {
                          $$renderer5.push("<!--[-->");
                          Alert_title($$renderer5, {
                            children: ($$renderer6) => {
                              $$renderer6.push(`<!---->Cluster ${escape_html(clusterName)} unreachable`);
                            },
                            $$slots: { default: true }
                          });
                          $$renderer5.push("<!--]-->");
                        } else {
                          $$renderer5.push("<!--[!-->");
                          $$renderer5.push("<!--]-->");
                        }
                        $$renderer5.push(` `);
                        if (Alert_description) {
                          $$renderer5.push("<!--[-->");
                          Alert_description($$renderer5, {
                            children: ($$renderer6) => {
                              $$renderer6.push(`<!---->${escape_html(lastError ?? "Showing last cached data. Actions are read-only until the cluster recovers.")}`);
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
                }
                $$renderer4.push(`<!--]--> `);
                children($$renderer4);
                $$renderer4.push(`<!---->`);
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
    const STATUS_ORDER = { running: 0, paused: 1, stopped: 2, error: 3, unknown: 4 };
    const params = derived(() => store_get($$store_subs ??= {}, "$page", page).url.searchParams);
    const q = derived(() => params().get("q")?.toLowerCase() ?? "");
    const statusFilter = derived(() => new Set((params().get("status") ?? "").split(",").filter(Boolean)));
    const tagFilter = derived(() => new Set((params().get("tag") ?? "").split(",").filter(Boolean)));
    const clusterFilter = derived(() => params().get("cluster") ? Number(params().get("cluster")) : null);
    const sort = derived(() => params().get("sort") ?? "status");
    const filterActive = derived(() => q().length > 0 || statusFilter().size > 0 || tagFilter().size > 0 || clusterFilter() !== null);
    function setParam(key, value) {
      const url = new URL(store_get($$store_subs ??= {}, "$page", page).url);
      if (value === null || value === "") {
        url.searchParams.delete(key);
      } else {
        url.searchParams.set(key, value);
      }
      goto(url.pathname + url.search, {});
    }
    function matchesFilter(it) {
      if (q() && !(it.name?.toLowerCase().includes(q()) || String(it.vmid).includes(q()) || it.tags.some((t) => t.includes(q())))) {
        return false;
      }
      if (statusFilter().size > 0 && !statusFilter().has(it.status)) return false;
      if (tagFilter().size > 0 && !it.tags.some((t) => tagFilter().has(t))) return false;
      return true;
    }
    function compareItems(a, b) {
      if (sort() === "name") return (a.name ?? "").localeCompare(b.name ?? "");
      if (sort() === "vmid") return a.vmid - b.vmid;
      if (sort() === "last_changed") return 0;
      const sd = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
      if (sd !== 0) return sd;
      return (a.name ?? "").localeCompare(b.name ?? "");
    }
    const clusters = derived(() => clusterFilter() === null ? data.inventory : data.inventory.filter((c) => c.cluster_id === clusterFilter()));
    $$renderer2.push(`<header class="flex flex-row items-start justify-between gap-4 mb-6"><div class="flex flex-col gap-1"><h1 class="text-[28px] font-semibold tracking-tight">Inventory</h1> <p class="text-muted-foreground text-[14px]">Your VMs and LXCs across all clusters.</p></div></header> <div class="sticky top-14 z-10 bg-background border-b border-border py-4 -mx-6 px-6 mb-6 flex flex-col gap-3"><div class="flex items-center gap-3">`);
    Input($$renderer2, {
      placeholder: "Search by name, vmid, or tag…",
      value: params().get("q") ?? "",
      oninput: (e) => setParam("q", e.target.value),
      class: "flex-1"
    });
    $$renderer2.push(`<!----> `);
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
                    $$renderer5.push(`<!---->Sort ▾`);
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
                if (Dropdown_menu_item) {
                  $$renderer4.push("<!--[-->");
                  Dropdown_menu_item($$renderer4, {
                    onclick: () => setParam("sort", null),
                    children: ($$renderer5) => {
                      $$renderer5.push(`<!---->Status (default)`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer4.push("<!--]-->");
                } else {
                  $$renderer4.push("<!--[!-->");
                  $$renderer4.push("<!--]-->");
                }
                $$renderer4.push(` `);
                if (Dropdown_menu_item) {
                  $$renderer4.push("<!--[-->");
                  Dropdown_menu_item($$renderer4, {
                    onclick: () => setParam("sort", "name"),
                    children: ($$renderer5) => {
                      $$renderer5.push(`<!---->Name A→Z`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer4.push("<!--]-->");
                } else {
                  $$renderer4.push("<!--[!-->");
                  $$renderer4.push("<!--]-->");
                }
                $$renderer4.push(` `);
                if (Dropdown_menu_item) {
                  $$renderer4.push("<!--[-->");
                  Dropdown_menu_item($$renderer4, {
                    onclick: () => setParam("sort", "vmid"),
                    children: ($$renderer5) => {
                      $$renderer5.push(`<!---->VMID`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer4.push("<!--]-->");
                } else {
                  $$renderer4.push("<!--[!-->");
                  $$renderer4.push("<!--]-->");
                }
                $$renderer4.push(` `);
                if (Dropdown_menu_item) {
                  $$renderer4.push("<!--[-->");
                  Dropdown_menu_item($$renderer4, {
                    onclick: () => setParam("sort", "last_changed"),
                    children: ($$renderer5) => {
                      $$renderer5.push(`<!---->Last changed`);
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
    $$renderer2.push(`</div> `);
    if (filterActive()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="flex flex-wrap items-center gap-2">`);
      if (q()) {
        $$renderer2.push("<!--[0-->");
        FilterChip($$renderer2, { label: `search: ${q()}`, onRemove: () => setParam("q", null) });
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <!--[-->`);
      const each_array = ensure_array_like(Array.from(statusFilter()));
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let s = each_array[$$index];
        FilterChip($$renderer2, {
          label: `status: ${s}`,
          onRemove: () => {
            const next = Array.from(statusFilter()).filter((v) => v !== s).join(",");
            setParam("status", next || null);
          }
        });
      }
      $$renderer2.push(`<!--]--> <!--[-->`);
      const each_array_1 = ensure_array_like(Array.from(tagFilter()));
      for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
        let t = each_array_1[$$index_1];
        FilterChip($$renderer2, {
          label: `tag: ${t}`,
          onRemove: () => {
            const next = Array.from(tagFilter()).filter((v) => v !== t).join(",");
            setParam("tag", next || null);
          }
        });
      }
      $$renderer2.push(`<!--]--> `);
      if (clusterFilter() !== null) {
        $$renderer2.push("<!--[0-->");
        FilterChip($$renderer2, {
          label: `cluster: ${data.inventory.find((c) => c.cluster_id === clusterFilter())?.cluster_name ?? clusterFilter()}`,
          onRemove: () => setParam("cluster", null)
        });
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <button type="button" class="text-[13px] text-primary underline-offset-4 hover:underline">Clear all</button></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> `);
    if (data.loadError) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="border-border bg-muted/30 flex flex-col items-center gap-3 rounded-md border border-dashed px-6 py-10 text-center"><p class="text-[14px] font-medium">Couldn't load inventory.</p> `);
      Button($$renderer2, {
        variant: "outline",
        onclick: () => invalidateAll(),
        children: ($$renderer3) => {
          $$renderer3.push(`<!---->Try again`);
        },
        $$slots: { default: true }
      });
      $$renderer2.push(`<!----></div>`);
    } else if (clusters().length === 0) {
      $$renderer2.push("<!--[1-->");
      $$renderer2.push(`<div class="border-border bg-muted/30 flex flex-col items-center gap-3 rounded-md border border-dashed px-6 py-16 text-center"><p class="text-[14px] font-medium">No VMs or LXCs in your scope yet.</p></div>`);
    } else if (data.inventory.length === 1 && clusterFilter() === null) {
      $$renderer2.push("<!--[2-->");
      const c = data.inventory[0];
      const filtered = c.items.filter(matchesFilter).sort(compareItems);
      if (filtered.length === 0) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="px-6 py-6 text-muted-foreground text-[14px]">${escape_html(filterActive() ? "No VMs match the current filter in this cluster." : `No VMs in ${c.cluster_name}.`)}</div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<div class="rounded-md border border-border">`);
        if (Table) {
          $$renderer2.push("<!--[-->");
          Table($$renderer2, {
            children: ($$renderer3) => {
              if (Table_body) {
                $$renderer3.push("<!--[-->");
                Table_body($$renderer3, {
                  children: ($$renderer4) => {
                    $$renderer4.push(`<!--[-->`);
                    const each_array_2 = ensure_array_like(filtered);
                    for (let $$index_3 = 0, $$length = each_array_2.length; $$index_3 < $$length; $$index_3++) {
                      let item = each_array_2[$$index_3];
                      if (Table_row) {
                        $$renderer4.push("<!--[-->");
                        Table_row($$renderer4, {
                          class: "hover:bg-muted/50 cursor-pointer h-14",
                          onclick: () => goto(`/inventory/${item.cluster_id}/${item.vmid}`),
                          children: ($$renderer5) => {
                            if (Table_cell) {
                              $$renderer5.push("<!--[-->");
                              Table_cell($$renderer5, {
                                class: "w-[140px]",
                                children: ($$renderer6) => {
                                  if (item.status === "running") {
                                    $$renderer6.push("<!--[0-->");
                                    Circle_play($$renderer6, { class: "size-4 text-success inline mr-1" });
                                  } else if (item.status === "paused") {
                                    $$renderer6.push("<!--[1-->");
                                    Circle_pause($$renderer6, { class: "size-4 text-warning inline mr-1" });
                                  } else if (item.status === "stopped") {
                                    $$renderer6.push("<!--[2-->");
                                    Circle_stop($$renderer6, { class: "size-4 text-muted-foreground inline mr-1" });
                                  } else {
                                    $$renderer6.push("<!--[-1-->");
                                    Circle_alert($$renderer6, { class: "size-4 text-destructive inline mr-1" });
                                  }
                                  $$renderer6.push(`<!--]--> <span class="text-[14px]">${escape_html(item.status)}</span>`);
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
                                  $$renderer6.push(`<div class="font-medium text-[14px]">${escape_html(item.name ?? `VM ${item.vmid}`)}</div> <div class="font-mono text-[13px] text-muted-foreground">${escape_html(item.vmid)}</div>`);
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
                                  $$renderer6.push(`<div class="flex flex-wrap gap-1"><!--[-->`);
                                  const each_array_3 = ensure_array_like(item.tags.slice(0, 3));
                                  for (let $$index_2 = 0, $$length2 = each_array_3.length; $$index_2 < $$length2; $$index_2++) {
                                    let t = each_array_3[$$index_2];
                                    TagPill($$renderer6, {
                                      tag: t,
                                      onClick: () => {
                                        const nxt = Array.from(/* @__PURE__ */ new Set([...Array.from(tagFilter()), t])).join(",");
                                        setParam("tag", nxt);
                                      }
                                    });
                                  }
                                  $$renderer6.push(`<!--]--> `);
                                  if (item.tags.length > 3) {
                                    $$renderer6.push("<!--[0-->");
                                    Badge($$renderer6, {
                                      variant: "outline",
                                      children: ($$renderer7) => {
                                        $$renderer7.push(`<!---->+${escape_html(item.tags.length - 3)}`);
                                      },
                                      $$slots: { default: true }
                                    });
                                  } else {
                                    $$renderer6.push("<!--[-1-->");
                                  }
                                  $$renderer6.push(`<!--]--></div>`);
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
                                class: "text-muted-foreground text-[14px]",
                                children: ($$renderer6) => {
                                  $$renderer6.push(`<!---->${escape_html(item.node)}`);
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
                                class: "text-right w-[40px]",
                                children: ($$renderer6) => {
                                  if (item.is_stale) {
                                    $$renderer6.push("<!--[0-->");
                                    Clock($$renderer6, {
                                      class: "size-4 text-warning inline mr-2",
                                      "aria-label": "Stale data"
                                    });
                                  } else {
                                    $$renderer6.push("<!--[-1-->");
                                  }
                                  $$renderer6.push(`<!--]--> `);
                                  Chevron_right($$renderer6, { class: "size-4 text-muted-foreground inline" });
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
        $$renderer2.push(`</div>`);
      }
      $$renderer2.push(`<!--]-->`);
    } else {
      $$renderer2.push("<!--[-1-->");
      if (Accordion) {
        $$renderer2.push("<!--[-->");
        Accordion($$renderer2, {
          type: "multiple",
          value: clusters().map((c) => `cluster-${c.cluster_id}`),
          class: "flex flex-col gap-6",
          children: ($$renderer3) => {
            $$renderer3.push(`<!--[-->`);
            const each_array_4 = ensure_array_like(clusters());
            for (let $$index_6 = 0, $$length = each_array_4.length; $$index_6 < $$length; $$index_6++) {
              let c = each_array_4[$$index_6];
              const filtered = c.items.filter(matchesFilter).sort(compareItems);
              ClusterSection($$renderer3, {
                clusterId: c.cluster_id,
                clusterName: c.cluster_name,
                clusterStatus: c.cluster_status,
                isStale: c.is_stale,
                lastError: c.last_error,
                matched: filtered.length,
                total: c.items.length,
                filterActive: filterActive(),
                children: ($$renderer4) => {
                  if (filtered.length === 0) {
                    $$renderer4.push("<!--[0-->");
                    $$renderer4.push(`<div class="px-6 py-6 text-muted-foreground text-[14px]">${escape_html(filterActive() ? "No VMs match the current filter in this cluster." : `No VMs in ${c.cluster_name}.`)}</div>`);
                  } else {
                    $$renderer4.push("<!--[-1-->");
                    $$renderer4.push(`<div class="rounded-md border border-border">`);
                    if (Table) {
                      $$renderer4.push("<!--[-->");
                      Table($$renderer4, {
                        children: ($$renderer5) => {
                          if (Table_body) {
                            $$renderer5.push("<!--[-->");
                            Table_body($$renderer5, {
                              children: ($$renderer6) => {
                                $$renderer6.push(`<!--[-->`);
                                const each_array_5 = ensure_array_like(filtered);
                                for (let $$index_5 = 0, $$length2 = each_array_5.length; $$index_5 < $$length2; $$index_5++) {
                                  let item = each_array_5[$$index_5];
                                  if (Table_row) {
                                    $$renderer6.push("<!--[-->");
                                    Table_row($$renderer6, {
                                      class: "hover:bg-muted/50 cursor-pointer h-14",
                                      onclick: () => goto(`/inventory/${item.cluster_id}/${item.vmid}`),
                                      children: ($$renderer7) => {
                                        if (Table_cell) {
                                          $$renderer7.push("<!--[-->");
                                          Table_cell($$renderer7, {
                                            class: "w-[140px]",
                                            children: ($$renderer8) => {
                                              if (item.status === "running") {
                                                $$renderer8.push("<!--[0-->");
                                                Circle_play($$renderer8, { class: "size-4 text-success inline mr-1" });
                                              } else if (item.status === "paused") {
                                                $$renderer8.push("<!--[1-->");
                                                Circle_pause($$renderer8, { class: "size-4 text-warning inline mr-1" });
                                              } else if (item.status === "stopped") {
                                                $$renderer8.push("<!--[2-->");
                                                Circle_stop($$renderer8, { class: "size-4 text-muted-foreground inline mr-1" });
                                              } else {
                                                $$renderer8.push("<!--[-1-->");
                                                Circle_alert($$renderer8, { class: "size-4 text-destructive inline mr-1" });
                                              }
                                              $$renderer8.push(`<!--]--> <span class="text-[14px]">${escape_html(item.status)}</span>`);
                                            },
                                            $$slots: { default: true }
                                          });
                                          $$renderer7.push("<!--]-->");
                                        } else {
                                          $$renderer7.push("<!--[!-->");
                                          $$renderer7.push("<!--]-->");
                                        }
                                        $$renderer7.push(` `);
                                        if (Table_cell) {
                                          $$renderer7.push("<!--[-->");
                                          Table_cell($$renderer7, {
                                            children: ($$renderer8) => {
                                              $$renderer8.push(`<div class="font-medium text-[14px]">${escape_html(item.name ?? `VM ${item.vmid}`)}</div> <div class="font-mono text-[13px] text-muted-foreground">${escape_html(item.vmid)}</div>`);
                                            },
                                            $$slots: { default: true }
                                          });
                                          $$renderer7.push("<!--]-->");
                                        } else {
                                          $$renderer7.push("<!--[!-->");
                                          $$renderer7.push("<!--]-->");
                                        }
                                        $$renderer7.push(` `);
                                        if (Table_cell) {
                                          $$renderer7.push("<!--[-->");
                                          Table_cell($$renderer7, {
                                            children: ($$renderer8) => {
                                              $$renderer8.push(`<div class="flex flex-wrap gap-1"><!--[-->`);
                                              const each_array_6 = ensure_array_like(item.tags.slice(0, 3));
                                              for (let $$index_4 = 0, $$length3 = each_array_6.length; $$index_4 < $$length3; $$index_4++) {
                                                let t = each_array_6[$$index_4];
                                                TagPill($$renderer8, {
                                                  tag: t,
                                                  onClick: () => {
                                                    const nxt = Array.from(/* @__PURE__ */ new Set([...Array.from(tagFilter()), t])).join(",");
                                                    setParam("tag", nxt);
                                                  }
                                                });
                                              }
                                              $$renderer8.push(`<!--]--> `);
                                              if (item.tags.length > 3) {
                                                $$renderer8.push("<!--[0-->");
                                                Badge($$renderer8, {
                                                  variant: "outline",
                                                  children: ($$renderer9) => {
                                                    $$renderer9.push(`<!---->+${escape_html(item.tags.length - 3)}`);
                                                  },
                                                  $$slots: { default: true }
                                                });
                                              } else {
                                                $$renderer8.push("<!--[-1-->");
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
                                        $$renderer7.push(` `);
                                        if (Table_cell) {
                                          $$renderer7.push("<!--[-->");
                                          Table_cell($$renderer7, {
                                            class: "text-muted-foreground text-[14px]",
                                            children: ($$renderer8) => {
                                              $$renderer8.push(`<!---->${escape_html(item.node)}`);
                                            },
                                            $$slots: { default: true }
                                          });
                                          $$renderer7.push("<!--]-->");
                                        } else {
                                          $$renderer7.push("<!--[!-->");
                                          $$renderer7.push("<!--]-->");
                                        }
                                        $$renderer7.push(` `);
                                        if (Table_cell) {
                                          $$renderer7.push("<!--[-->");
                                          Table_cell($$renderer7, {
                                            class: "text-right w-[40px]",
                                            children: ($$renderer8) => {
                                              if (item.is_stale) {
                                                $$renderer8.push("<!--[0-->");
                                                Clock($$renderer8, {
                                                  class: "size-4 text-warning inline mr-2",
                                                  "aria-label": "Stale data"
                                                });
                                              } else {
                                                $$renderer8.push("<!--[-1-->");
                                              }
                                              $$renderer8.push(`<!--]--> `);
                                              Chevron_right($$renderer8, { class: "size-4 text-muted-foreground inline" });
                                              $$renderer8.push(`<!---->`);
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
                    $$renderer4.push(`</div>`);
                  }
                  $$renderer4.push(`<!--]-->`);
                }
              });
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
    $$renderer2.push(`<!--]-->`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}

export { _page as default };
//# sourceMappingURL=_page.svelte-DitnGsxu.js.map
