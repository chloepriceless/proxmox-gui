import { f as ensure_array_like, l as escape_html, n as spread_props, d as derived, k as stringify, y as bind_props, z as props_id, o as attributes, h as attr, j as attr_class, p as clsx } from './renderer-5OqEGBJa.js';
import { T as Table, b as Table_row, a as Table_body, c as Table_cell } from './table-row-CMsYy_rr.js';
import 'clsx';
import { T as Table_header, a as Table_head } from './table-header-VM9fHtz5.js';
import { C as Card } from './card-BLYI87Kx.js';
import { B as Badge } from './badge-TEIAL8qa.js';
import { B as Button, b as boxWith, s as simpleBox, i as createBitsAttrs, c as cn, a as createId, e as attachRef, j as boolToEmptyStrOrUndef, m as mergeProps, h as getDataTransitionAttrs } from './input-QG1nZPSy.js';
import { F as Floating_layer, P as Popper_layer_force_mount, b as Popper_layer, g as getFloatingContentCSSVars, c as FloatingArrowState } from './popper-layer-force-mount-D47fNzjm.js';
import { n as noop } from './noop-n4I-x7yK.js';
import { e as PresenceManager, P as Portal, f as DOMContext, u as useId } from './scroll-lock-BdvbL8bD.js';
import { C as Context, w as watch, a as isElement, y as isFocusVisible } from './is-DeZ4WIS2.js';
import { S as SafePolygon } from './popover-trigger-xV8smPjy.js';

function onDestroyEffect(fn) {
}
function Arrow($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      id = useId(),
      children,
      child,
      width = 10,
      height = 5,
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    const mergedProps = derived(() => mergeProps(restProps, { id }));
    if (child) {
      $$renderer2.push("<!--[0-->");
      child($$renderer2, { props: mergedProps() });
      $$renderer2.push(`<!---->`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<span${attributes({ ...mergedProps() })}>`);
      if (children) {
        $$renderer2.push("<!--[0-->");
        children?.($$renderer2);
        $$renderer2.push(`<!---->`);
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<svg${attr("width", width)}${attr("height", height)} viewBox="0 0 30 10" preserveAspectRatio="none" data-arrow=""><polygon points="0,0 30,0 15,10" fill="currentColor"></polygon></svg>`);
      }
      $$renderer2.push(`<!--]--></span>`);
    }
    $$renderer2.push(`<!--]-->`);
  });
}
function Floating_layer_arrow($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { id = useId(), ref = null, $$slots, $$events, ...restProps } = $$props;
    const arrowState = FloatingArrowState.create({
      id: boxWith(() => id),
      ref: boxWith(() => ref, (v) => ref = v)
    });
    const mergedProps = derived(() => mergeProps(restProps, arrowState.props));
    Arrow($$renderer2, spread_props([mergedProps()]));
    bind_props($$props, { ref });
  });
}
class TimeoutFn {
  #interval;
  #cb;
  #timer = null;
  constructor(cb, interval) {
    this.#cb = cb;
    this.#interval = interval;
    this.stop = this.stop.bind(this);
    this.start = this.start.bind(this);
    onDestroyEffect(this.stop);
  }
  #clear() {
    if (this.#timer !== null) {
      window.clearTimeout(this.#timer);
      this.#timer = null;
    }
  }
  stop() {
    this.#clear();
  }
  start(...args) {
    this.#clear();
    this.#timer = window.setTimeout(() => {
      this.#timer = null;
      this.#cb(...args);
    }, this.#interval);
  }
}
const tooltipAttrs = createBitsAttrs({ component: "tooltip", parts: ["content", "trigger"] });
const TooltipProviderContext = new Context("Tooltip.Provider");
const TooltipRootContext = new Context("Tooltip.Root");
class TooltipTriggerRegistryState {
  triggers = /* @__PURE__ */ new Map();
  activeTriggerId = null;
  #activeTriggerNode = derived(() => {
    const activeTriggerId = this.activeTriggerId;
    if (activeTriggerId === null) return null;
    return this.triggers.get(activeTriggerId)?.node ?? null;
  });
  get activeTriggerNode() {
    return this.#activeTriggerNode();
  }
  set activeTriggerNode($$value) {
    return this.#activeTriggerNode($$value);
  }
  #activePayload = derived(() => {
    const activeTriggerId = this.activeTriggerId;
    if (activeTriggerId === null) return null;
    return this.triggers.get(activeTriggerId)?.payload ?? null;
  });
  get activePayload() {
    return this.#activePayload();
  }
  set activePayload($$value) {
    return this.#activePayload($$value);
  }
  register = (record) => {
    const next = new Map(this.triggers);
    next.set(record.id, record);
    this.triggers = next;
    this.#coerceActiveTrigger();
  };
  update = (record) => {
    const next = new Map(this.triggers);
    next.set(record.id, record);
    this.triggers = next;
    this.#coerceActiveTrigger();
  };
  unregister = (id) => {
    if (!this.triggers.has(id)) return;
    const next = new Map(this.triggers);
    next.delete(id);
    this.triggers = next;
    if (this.activeTriggerId === id) {
      this.activeTriggerId = null;
    }
  };
  setActiveTrigger = (id) => {
    if (id === null) {
      this.activeTriggerId = null;
      return;
    }
    if (!this.triggers.has(id)) {
      this.activeTriggerId = null;
      return;
    }
    this.activeTriggerId = id;
  };
  get = (id) => {
    return this.triggers.get(id);
  };
  has = (id) => {
    return this.triggers.has(id);
  };
  getFirstTriggerId = () => {
    const firstEntry = this.triggers.entries().next();
    if (firstEntry.done) return null;
    return firstEntry.value[0];
  };
  #coerceActiveTrigger = () => {
    const activeTriggerId = this.activeTriggerId;
    if (activeTriggerId === null) return;
    if (!this.triggers.has(activeTriggerId)) {
      this.activeTriggerId = null;
    }
  };
}
class TooltipProviderState {
  static create(opts) {
    return TooltipProviderContext.set(new TooltipProviderState(opts));
  }
  opts;
  isOpenDelayed = true;
  isPointerInTransit = simpleBox(false);
  #timerFn;
  #openTooltip = null;
  constructor(opts) {
    this.opts = opts;
    this.#timerFn = new TimeoutFn(
      () => {
        this.isOpenDelayed = true;
      },
      this.opts.skipDelayDuration.current
    );
  }
  #startTimer = () => {
    const skipDuration = this.opts.skipDelayDuration.current;
    if (skipDuration === 0) {
      this.isOpenDelayed = true;
      return;
    } else {
      this.#timerFn.start();
    }
  };
  #clearTimer = () => {
    this.#timerFn.stop();
  };
  onOpen = (tooltip) => {
    if (this.#openTooltip && this.#openTooltip !== tooltip) {
      this.#openTooltip.handleClose();
    }
    this.#clearTimer();
    this.isOpenDelayed = false;
    this.#openTooltip = tooltip;
  };
  onClose = (tooltip) => {
    if (this.#openTooltip === tooltip) {
      this.#openTooltip = null;
      this.#startTimer();
    }
  };
  isTooltipOpen = (tooltip) => {
    return this.#openTooltip === tooltip;
  };
}
class TooltipRootState {
  static create(opts) {
    return TooltipRootContext.set(new TooltipRootState(opts, TooltipProviderContext.get()));
  }
  opts;
  provider;
  #delayDuration = derived(() => this.opts.delayDuration.current ?? this.provider.opts.delayDuration.current);
  get delayDuration() {
    return this.#delayDuration();
  }
  set delayDuration($$value) {
    return this.#delayDuration($$value);
  }
  #disableHoverableContent = derived(() => this.opts.disableHoverableContent.current ?? this.provider.opts.disableHoverableContent.current);
  get disableHoverableContent() {
    return this.#disableHoverableContent();
  }
  set disableHoverableContent($$value) {
    return this.#disableHoverableContent($$value);
  }
  #disableCloseOnTriggerClick = derived(() => this.opts.disableCloseOnTriggerClick.current ?? this.provider.opts.disableCloseOnTriggerClick.current);
  get disableCloseOnTriggerClick() {
    return this.#disableCloseOnTriggerClick();
  }
  set disableCloseOnTriggerClick($$value) {
    return this.#disableCloseOnTriggerClick($$value);
  }
  #disabled = derived(() => this.opts.disabled.current ?? this.provider.opts.disabled.current);
  get disabled() {
    return this.#disabled();
  }
  set disabled($$value) {
    return this.#disabled($$value);
  }
  #ignoreNonKeyboardFocus = derived(() => this.opts.ignoreNonKeyboardFocus.current ?? this.provider.opts.ignoreNonKeyboardFocus.current);
  get ignoreNonKeyboardFocus() {
    return this.#ignoreNonKeyboardFocus();
  }
  set ignoreNonKeyboardFocus($$value) {
    return this.#ignoreNonKeyboardFocus($$value);
  }
  registry;
  tether;
  contentNode = null;
  contentPresence;
  #wasOpenDelayed = false;
  #timerFn;
  #stateAttr = derived(() => {
    if (!this.opts.open.current) return "closed";
    return this.#wasOpenDelayed ? "delayed-open" : "instant-open";
  });
  get stateAttr() {
    return this.#stateAttr();
  }
  set stateAttr($$value) {
    return this.#stateAttr($$value);
  }
  constructor(opts, provider) {
    this.opts = opts;
    this.provider = provider;
    this.tether = opts.tether.current?.state ?? null;
    this.registry = this.tether?.registry ?? new TooltipTriggerRegistryState();
    this.#timerFn = new TimeoutFn(
      () => {
        this.#wasOpenDelayed = true;
        this.opts.open.current = true;
      },
      this.delayDuration ?? 0
    );
    if (this.tether) {
      this.tether.root = this;
    }
    this.contentPresence = new PresenceManager({
      open: this.opts.open,
      ref: boxWith(() => this.contentNode),
      onComplete: () => {
        this.opts.onOpenChangeComplete.current(this.opts.open.current);
      }
    });
    watch(() => this.delayDuration, () => {
      if (this.delayDuration === void 0) return;
      this.#timerFn = new TimeoutFn(
        () => {
          this.#wasOpenDelayed = true;
          this.opts.open.current = true;
        },
        this.delayDuration
      );
    });
    watch(
      () => this.opts.open.current,
      (isOpen) => {
        if (isOpen) {
          this.ensureActiveTrigger();
          this.provider.onOpen(this);
        } else {
          this.provider.onClose(this);
        }
      },
      { lazy: true }
    );
    watch(() => this.opts.triggerId.current, (triggerId) => {
      if (triggerId === this.registry.activeTriggerId) return;
      this.registry.setActiveTrigger(triggerId);
    });
    watch(() => this.registry.activeTriggerId, (activeTriggerId) => {
      if (this.opts.triggerId.current === activeTriggerId) return;
      this.opts.triggerId.current = activeTriggerId;
    });
  }
  handleOpen = () => {
    this.#timerFn.stop();
    this.#wasOpenDelayed = false;
    this.ensureActiveTrigger();
    this.opts.open.current = true;
  };
  handleClose = () => {
    this.#timerFn.stop();
    this.opts.open.current = false;
  };
  #handleDelayedOpen = () => {
    this.#timerFn.stop();
    const shouldSkipDelay = !this.provider.isOpenDelayed;
    const delayDuration = this.delayDuration ?? 0;
    if (shouldSkipDelay || delayDuration === 0) {
      this.#wasOpenDelayed = false;
      this.opts.open.current = true;
    } else {
      this.#timerFn.start();
    }
  };
  onTriggerEnter = (triggerId) => {
    this.setActiveTrigger(triggerId);
    this.#handleDelayedOpen();
  };
  onTriggerLeave = () => {
    if (this.disableHoverableContent) {
      this.handleClose();
    } else {
      this.#timerFn.stop();
    }
  };
  ensureActiveTrigger = () => {
    if (this.registry.activeTriggerId !== null && this.registry.has(this.registry.activeTriggerId)) {
      return;
    }
    if (this.opts.triggerId.current !== null && this.registry.has(this.opts.triggerId.current)) {
      this.registry.setActiveTrigger(this.opts.triggerId.current);
      return;
    }
    const firstTriggerId = this.registry.getFirstTriggerId();
    this.registry.setActiveTrigger(firstTriggerId);
  };
  setActiveTrigger = (triggerId) => {
    this.registry.setActiveTrigger(triggerId);
  };
  registerTrigger = (trigger) => {
    this.registry.register(trigger);
    if (trigger.disabled && this.registry.activeTriggerId === trigger.id && this.opts.open.current) {
      this.handleClose();
    }
  };
  updateTrigger = (trigger) => {
    this.registry.update(trigger);
    if (trigger.disabled && this.registry.activeTriggerId === trigger.id && this.opts.open.current) {
      this.handleClose();
    }
  };
  unregisterTrigger = (id) => {
    const isActive = this.registry.activeTriggerId === id;
    this.registry.unregister(id);
    if (isActive && this.opts.open.current) {
      this.handleClose();
    }
  };
  isActiveTrigger = (triggerId) => {
    return this.registry.activeTriggerId === triggerId;
  };
  get triggerNode() {
    return this.registry.activeTriggerNode;
  }
  get activePayload() {
    return this.registry.activePayload;
  }
  get activeTriggerId() {
    return this.registry.activeTriggerId;
  }
}
class TooltipTriggerState {
  static create(opts) {
    if (opts.tether.current) {
      return new TooltipTriggerState(opts, null, opts.tether.current.state);
    }
    return new TooltipTriggerState(opts, TooltipRootContext.get(), null);
  }
  opts;
  root;
  tether;
  attachment;
  #isPointerDown = simpleBox(false);
  #hasPointerMoveOpened = false;
  domContext;
  #transitCheckTimeout = null;
  #mounted = false;
  #lastRegisteredId = null;
  constructor(opts, root, tether) {
    this.opts = opts;
    this.root = root;
    this.tether = tether;
    this.domContext = new DOMContext(opts.ref);
    this.attachment = attachRef(this.opts.ref, (v) => this.#register(v));
    watch(() => this.opts.id.current, () => {
      this.#register(this.opts.ref.current);
    });
    watch(() => this.opts.payload.current, () => {
      this.#register(this.opts.ref.current);
    });
    watch(() => this.opts.disabled.current, () => {
      this.#register(this.opts.ref.current);
    });
  }
  #getRoot = () => {
    return this.tether?.root ?? this.root;
  };
  #isDisabled = () => {
    const root = this.#getRoot();
    return this.opts.disabled.current || Boolean(root?.disabled);
  };
  #register = (node) => {
    if (!this.#mounted) return;
    const id = this.opts.id.current;
    const payload = this.opts.payload.current;
    const disabled = this.opts.disabled.current;
    if (this.#lastRegisteredId && this.#lastRegisteredId !== id) {
      const root2 = this.#getRoot();
      if (this.tether) {
        this.tether.registry.unregister(this.#lastRegisteredId);
      } else {
        root2?.unregisterTrigger(this.#lastRegisteredId);
      }
    }
    const triggerRecord = { id, node, payload, disabled };
    const root = this.#getRoot();
    if (this.tether) {
      if (this.tether.registry.has(id)) {
        this.tether.registry.update(triggerRecord);
      } else {
        this.tether.registry.register(triggerRecord);
      }
      if (disabled && this.tether.registry.activeTriggerId === id && root?.opts.open.current) {
        root.handleClose();
      }
    } else {
      if (root?.registry.has(id)) {
        root.updateTrigger(triggerRecord);
      } else {
        root?.registerTrigger(triggerRecord);
      }
    }
    this.#lastRegisteredId = id;
  };
  #clearTransitCheck = () => {
    if (this.#transitCheckTimeout !== null) {
      clearTimeout(this.#transitCheckTimeout);
      this.#transitCheckTimeout = null;
    }
  };
  handlePointerUp = () => {
    this.#isPointerDown.current = false;
  };
  #onpointerup = () => {
    if (this.#isDisabled()) return;
    this.#isPointerDown.current = false;
  };
  #onpointerdown = () => {
    if (this.#isDisabled()) return;
    this.#isPointerDown.current = true;
    this.domContext.getDocument().addEventListener(
      "pointerup",
      () => {
        this.handlePointerUp();
      },
      { once: true }
    );
  };
  #onpointerenter = (e) => {
    const root = this.#getRoot();
    if (!root) return;
    if (this.#isDisabled()) {
      if (root.opts.open.current) {
        root.handleClose();
      }
      return;
    }
    if (e.pointerType === "touch") return;
    if (root.provider.isPointerInTransit.current) {
      this.#clearTransitCheck();
      this.#transitCheckTimeout = window.setTimeout(
        () => {
          if (root.provider.isPointerInTransit.current) {
            root.provider.isPointerInTransit.current = false;
            root.onTriggerEnter(this.opts.id.current);
            this.#hasPointerMoveOpened = true;
          }
        },
        250
      );
      return;
    }
    root.onTriggerEnter(this.opts.id.current);
    this.#hasPointerMoveOpened = true;
  };
  #onpointermove = (e) => {
    const root = this.#getRoot();
    if (!root) return;
    if (this.#isDisabled()) {
      if (root.opts.open.current) {
        root.handleClose();
      }
      return;
    }
    if (e.pointerType === "touch") return;
    if (this.#hasPointerMoveOpened) return;
    this.#clearTransitCheck();
    root.provider.isPointerInTransit.current = false;
    root.onTriggerEnter(this.opts.id.current);
    this.#hasPointerMoveOpened = true;
  };
  #onpointerleave = (e) => {
    const root = this.#getRoot();
    if (!root) return;
    if (this.#isDisabled()) return;
    this.#clearTransitCheck();
    if (!root.isActiveTrigger(this.opts.id.current)) {
      this.#hasPointerMoveOpened = false;
      return;
    }
    const relatedTarget = e.relatedTarget;
    if (isElement(relatedTarget)) {
      for (const record of root.registry.triggers.values()) {
        if (record.node !== relatedTarget) continue;
        if (root.provider.opts.skipDelayDuration.current > 0) {
          this.#hasPointerMoveOpened = false;
          return;
        }
        root.handleClose();
        this.#hasPointerMoveOpened = false;
        return;
      }
    }
    root.onTriggerLeave();
    this.#hasPointerMoveOpened = false;
  };
  #onfocus = (e) => {
    const root = this.#getRoot();
    if (!root) return;
    if (this.#isPointerDown.current) return;
    if (this.#isDisabled()) {
      if (root.opts.open.current) {
        root.handleClose();
      }
      return;
    }
    if (root.ignoreNonKeyboardFocus && !isFocusVisible(e.currentTarget)) return;
    root.setActiveTrigger(this.opts.id.current);
    root.handleOpen();
  };
  #onblur = () => {
    const root = this.#getRoot();
    if (!root || this.#isDisabled()) return;
    root.handleClose();
  };
  #onclick = () => {
    const root = this.#getRoot();
    if (!root || root.disableCloseOnTriggerClick || this.#isDisabled()) return;
    root.handleClose();
  };
  #props = derived(() => {
    const root = this.#getRoot();
    const isOpenForTrigger = Boolean(root?.opts.open.current && root.isActiveTrigger(this.opts.id.current));
    const isDisabled = this.#isDisabled();
    return {
      id: this.opts.id.current,
      "aria-describedby": isOpenForTrigger ? root?.contentNode?.id : void 0,
      "data-state": isOpenForTrigger ? root?.stateAttr : "closed",
      "data-disabled": boolToEmptyStrOrUndef(isDisabled),
      "data-delay-duration": `${root?.delayDuration ?? 0}`,
      [tooltipAttrs.trigger]: "",
      tabindex: isDisabled ? void 0 : this.opts.tabindex.current,
      disabled: this.opts.disabled.current,
      onpointerup: this.#onpointerup,
      onpointerdown: this.#onpointerdown,
      onpointerenter: this.#onpointerenter,
      onpointermove: this.#onpointermove,
      onpointerleave: this.#onpointerleave,
      onfocus: this.#onfocus,
      onblur: this.#onblur,
      onclick: this.#onclick,
      ...this.attachment
    };
  });
  get props() {
    return this.#props();
  }
  set props($$value) {
    return this.#props($$value);
  }
}
class TooltipContentState {
  static create(opts) {
    return new TooltipContentState(opts, TooltipRootContext.get());
  }
  opts;
  root;
  attachment;
  constructor(opts, root) {
    this.opts = opts;
    this.root = root;
    this.attachment = attachRef(this.opts.ref, (v) => this.root.contentNode = v);
    new SafePolygon({
      triggerNode: () => this.root.triggerNode,
      contentNode: () => this.root.contentNode,
      enabled: () => this.root.opts.open.current && !this.root.disableHoverableContent,
      transitIntentTimeout: 180,
      ignoredTargets: () => {
        if (this.root.provider.opts.skipDelayDuration.current === 0) return [];
        const nodes = [];
        const activeTriggerNode = this.root.triggerNode;
        for (const record of this.root.registry.triggers.values()) {
          if (record.node && record.node !== activeTriggerNode) {
            nodes.push(record.node);
          }
        }
        return nodes;
      },
      onPointerExit: () => {
        if (this.root.provider.isTooltipOpen(this.root)) {
          this.root.handleClose();
        }
      }
    });
  }
  onInteractOutside = (e) => {
    if (isElement(e.target) && this.root.triggerNode?.contains(e.target) && this.root.disableCloseOnTriggerClick) {
      e.preventDefault();
      return;
    }
    this.opts.onInteractOutside.current(e);
    if (e.defaultPrevented) return;
    this.root.handleClose();
  };
  onEscapeKeydown = (e) => {
    this.opts.onEscapeKeydown.current?.(e);
    if (e.defaultPrevented) return;
    this.root.handleClose();
  };
  onOpenAutoFocus = (e) => {
    e.preventDefault();
  };
  onCloseAutoFocus = (e) => {
    e.preventDefault();
  };
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
    "data-state": this.root.stateAttr,
    "data-disabled": boolToEmptyStrOrUndef(this.root.disabled),
    ...getDataTransitionAttrs(this.root.contentPresence.transitionStatus),
    style: { outline: "none" },
    [tooltipAttrs.content]: "",
    ...this.attachment
  }));
  get props() {
    return this.#props();
  }
  set props($$value) {
    return this.#props($$value);
  }
  popperProps = {
    onInteractOutside: this.onInteractOutside,
    onEscapeKeydown: this.onEscapeKeydown,
    onOpenAutoFocus: this.onOpenAutoFocus,
    onCloseAutoFocus: this.onCloseAutoFocus
  };
}
function Tooltip$1($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      open = false,
      triggerId = null,
      onOpenChange = noop,
      onOpenChangeComplete = noop,
      disabled,
      delayDuration,
      disableCloseOnTriggerClick,
      disableHoverableContent,
      ignoreNonKeyboardFocus,
      tether,
      children
    } = $$props;
    const rootState = TooltipRootState.create({
      open: boxWith(() => open, (v) => {
        open = v;
        onOpenChange(v);
      }),
      triggerId: boxWith(() => triggerId, (v) => {
        triggerId = v;
      }),
      delayDuration: boxWith(() => delayDuration),
      disableCloseOnTriggerClick: boxWith(() => disableCloseOnTriggerClick),
      disableHoverableContent: boxWith(() => disableHoverableContent),
      ignoreNonKeyboardFocus: boxWith(() => ignoreNonKeyboardFocus),
      disabled: boxWith(() => disabled),
      onOpenChangeComplete: boxWith(() => onOpenChangeComplete),
      tether: boxWith(() => tether)
    });
    Floating_layer($$renderer2, {
      tooltip: true,
      children: ($$renderer3) => {
        children?.($$renderer3, {
          open: rootState.opts.open.current,
          triggerId: rootState.activeTriggerId,
          payload: rootState.activePayload
        });
        $$renderer3.push(`<!---->`);
      }
    });
    bind_props($$props, { open, triggerId });
  });
}
function Tooltip_content$1($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const uid = props_id($$renderer2);
    let {
      children,
      child,
      id = createId(uid),
      ref = null,
      side = "top",
      sideOffset = 0,
      align = "center",
      avoidCollisions = true,
      arrowPadding = 0,
      sticky = "partial",
      strategy,
      hideWhenDetached = false,
      customAnchor,
      collisionPadding = 0,
      onInteractOutside = noop,
      onEscapeKeydown = noop,
      forceMount = false,
      style,
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    const contentState = TooltipContentState.create({
      id: boxWith(() => id),
      ref: boxWith(() => ref, (v) => ref = v),
      onInteractOutside: boxWith(() => onInteractOutside),
      onEscapeKeydown: boxWith(() => onEscapeKeydown)
    });
    const floatingProps = derived(() => ({
      side,
      sideOffset,
      align,
      avoidCollisions,
      arrowPadding,
      sticky,
      hideWhenDetached,
      collisionPadding,
      strategy,
      customAnchor: customAnchor ?? contentState.root.triggerNode
    }));
    const mergedProps = derived(() => mergeProps(restProps, floatingProps(), contentState.props));
    if (forceMount) {
      $$renderer2.push("<!--[0-->");
      {
        let popper = function($$renderer3, { props, wrapperProps }) {
          const finalWrapperProps = mergeProps(wrapperProps, {
            style: {
              pointerEvents: contentState.root.disableHoverableContent ? "none" : void 0
            }
          });
          const finalProps = mergeProps(props, { style: getFloatingContentCSSVars("tooltip") }, { style });
          if (child) {
            $$renderer3.push("<!--[0-->");
            child($$renderer3, {
              props: finalProps,
              wrapperProps: finalWrapperProps,
              ...contentState.snippetProps
            });
            $$renderer3.push(`<!---->`);
          } else {
            $$renderer3.push("<!--[-1-->");
            $$renderer3.push(`<div${attributes({ ...finalWrapperProps })}><div${attributes({ ...finalProps })}>`);
            children?.($$renderer3);
            $$renderer3.push(`<!----></div></div>`);
          }
          $$renderer3.push(`<!--]-->`);
        };
        Popper_layer_force_mount($$renderer2, spread_props([
          mergedProps(),
          contentState.popperProps,
          {
            enabled: contentState.root.opts.open.current,
            id,
            trapFocus: false,
            loop: false,
            preventScroll: false,
            forceMount: true,
            ref: contentState.opts.ref,
            tooltip: true,
            shouldRender: contentState.shouldRender,
            contentPointerEvents: contentState.root.disableHoverableContent ? "none" : "auto",
            popper,
            $$slots: { popper: true }
          }
        ]));
      }
    } else if (!forceMount) {
      $$renderer2.push("<!--[1-->");
      {
        let popper = function($$renderer3, { props, wrapperProps }) {
          const finalWrapperProps = mergeProps(wrapperProps, {
            style: {
              pointerEvents: contentState.root.disableHoverableContent ? "none" : void 0
            }
          });
          const finalProps = mergeProps(props, { style: getFloatingContentCSSVars("tooltip") }, { style });
          if (child) {
            $$renderer3.push("<!--[0-->");
            child($$renderer3, {
              props: finalProps,
              wrapperProps: finalWrapperProps,
              ...contentState.snippetProps
            });
            $$renderer3.push(`<!---->`);
          } else {
            $$renderer3.push("<!--[-1-->");
            $$renderer3.push(`<div${attributes({ ...finalWrapperProps })}><div${attributes({ ...finalProps })}>`);
            children?.($$renderer3);
            $$renderer3.push(`<!----></div></div>`);
          }
          $$renderer3.push(`<!--]-->`);
        };
        Popper_layer($$renderer2, spread_props([
          mergedProps(),
          contentState.popperProps,
          {
            open: contentState.root.opts.open.current,
            id,
            trapFocus: false,
            loop: false,
            preventScroll: false,
            forceMount: false,
            ref: contentState.opts.ref,
            tooltip: true,
            shouldRender: contentState.shouldRender,
            contentPointerEvents: contentState.root.disableHoverableContent ? "none" : "auto",
            popper,
            $$slots: { popper: true }
          }
        ]));
      }
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
    bind_props($$props, { ref });
  });
}
function Tooltip_trigger$1($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const uid = props_id($$renderer2);
    let {
      children,
      child,
      id = createId(uid),
      disabled = false,
      payload,
      tether,
      type = "button",
      tabindex = 0,
      ref = null,
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    const triggerState = TooltipTriggerState.create({
      id: boxWith(() => id),
      disabled: boxWith(() => disabled ?? false),
      tabindex: boxWith(() => tabindex ?? 0),
      payload: boxWith(() => payload),
      tether: boxWith(() => tether),
      ref: boxWith(() => ref, (v) => ref = v)
    });
    const mergedProps = derived(() => mergeProps(restProps, triggerState.props, { type }));
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
function Tooltip_arrow($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { ref = null, $$slots, $$events, ...restProps } = $$props;
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      Floating_layer_arrow($$renderer3, spread_props([
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
function Tooltip_provider$1($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      children,
      delayDuration = 700,
      disableCloseOnTriggerClick = false,
      disableHoverableContent = false,
      disabled = false,
      ignoreNonKeyboardFocus = false,
      skipDelayDuration = 300
    } = $$props;
    TooltipProviderState.create({
      delayDuration: boxWith(() => delayDuration),
      disableCloseOnTriggerClick: boxWith(() => disableCloseOnTriggerClick),
      disableHoverableContent: boxWith(() => disableHoverableContent),
      disabled: boxWith(() => disabled),
      ignoreNonKeyboardFocus: boxWith(() => ignoreNonKeyboardFocus),
      skipDelayDuration: boxWith(() => skipDelayDuration)
    });
    children?.($$renderer2);
    $$renderer2.push(`<!---->`);
  });
}
function AuditTable($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      rows,
      total,
      page,
      pageSize,
      onPageChange,
      error = null,
      loading = false
    } = $$props;
    const pages = derived(() => Math.max(1, Math.ceil(total / pageSize)));
    let expanded = {};
    function toggle(id) {
      expanded = { ...expanded, [id]: !expanded[id] };
    }
    function actionBadge(action) {
      if (action.startsWith("vm.create") || action.startsWith("team.create") || action.startsWith("user.create") || action.startsWith("cluster.create")) return "bg-success/10 border-success/30 text-success";
      if (action.startsWith("vm.delete") || action.startsWith("team.delete") || action.startsWith("user.delete") || action.startsWith("cluster.delete")) return "bg-destructive/10 border-destructive/30 text-destructive";
      if (action.startsWith("vm.power.")) return "bg-warning/10 border-warning/30 text-warning";
      if (action.startsWith("auth.")) return "bg-primary/10 border-primary/30 text-primary";
      return "bg-muted border-border text-foreground";
    }
    function tryParse(s) {
      if (!s) return null;
      try {
        return JSON.parse(s);
      } catch {
        return s;
      }
    }
    if (loading) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="space-y-2"><!--[-->`);
      const each_array = ensure_array_like(Array(5));
      for (let i = 0, $$length = each_array.length; i < $$length; i++) {
        each_array[i];
        $$renderer2.push(`<div class="h-11 bg-muted animate-pulse rounded"></div>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    } else if (error) {
      $$renderer2.push("<!--[1-->");
      $$renderer2.push(`<div class="border-border bg-muted/30 flex flex-col items-center gap-3 rounded-md border border-dashed px-6 py-10 text-center"><p class="text-sm font-medium">${escape_html(error)}</p></div>`);
    } else if (rows.length === 0) {
      $$renderer2.push("<!--[2-->");
      $$renderer2.push(`<div class="border-border bg-muted/30 rounded-md border border-dashed px-6 py-10 text-center"><p class="text-sm font-medium">No audit entries match the current filters.</p></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="rounded-md border border-border">`);
      if (Table) {
        $$renderer2.push("<!--[-->");
        Table($$renderer2, {
          children: ($$renderer3) => {
            if (Table_header) {
              $$renderer3.push("<!--[-->");
              Table_header($$renderer3, {
                children: ($$renderer4) => {
                  if (Table_row) {
                    $$renderer4.push("<!--[-->");
                    Table_row($$renderer4, {
                      children: ($$renderer5) => {
                        if (Table_head) {
                          $$renderer5.push("<!--[-->");
                          Table_head($$renderer5, {
                            class: "text-[13px] font-medium",
                            children: ($$renderer6) => {
                              $$renderer6.push(`<!---->Time`);
                            },
                            $$slots: { default: true }
                          });
                          $$renderer5.push("<!--]-->");
                        } else {
                          $$renderer5.push("<!--[!-->");
                          $$renderer5.push("<!--]-->");
                        }
                        $$renderer5.push(` `);
                        if (Table_head) {
                          $$renderer5.push("<!--[-->");
                          Table_head($$renderer5, {
                            class: "text-[13px] font-medium",
                            children: ($$renderer6) => {
                              $$renderer6.push(`<!---->Actor`);
                            },
                            $$slots: { default: true }
                          });
                          $$renderer5.push("<!--]-->");
                        } else {
                          $$renderer5.push("<!--[!-->");
                          $$renderer5.push("<!--]-->");
                        }
                        $$renderer5.push(` `);
                        if (Table_head) {
                          $$renderer5.push("<!--[-->");
                          Table_head($$renderer5, {
                            class: "text-[13px] font-medium",
                            children: ($$renderer6) => {
                              $$renderer6.push(`<!---->Action`);
                            },
                            $$slots: { default: true }
                          });
                          $$renderer5.push("<!--]-->");
                        } else {
                          $$renderer5.push("<!--[!-->");
                          $$renderer5.push("<!--]-->");
                        }
                        $$renderer5.push(` `);
                        if (Table_head) {
                          $$renderer5.push("<!--[-->");
                          Table_head($$renderer5, {
                            class: "text-[13px] font-medium",
                            children: ($$renderer6) => {
                              $$renderer6.push(`<!---->Target`);
                            },
                            $$slots: { default: true }
                          });
                          $$renderer5.push("<!--]-->");
                        } else {
                          $$renderer5.push("<!--[!-->");
                          $$renderer5.push("<!--]-->");
                        }
                        $$renderer5.push(` `);
                        if (Table_head) {
                          $$renderer5.push("<!--[-->");
                          Table_head($$renderer5, {
                            class: "text-[13px] font-medium",
                            children: ($$renderer6) => {
                              $$renderer6.push(`<!---->Result`);
                            },
                            $$slots: { default: true }
                          });
                          $$renderer5.push("<!--]-->");
                        } else {
                          $$renderer5.push("<!--[!-->");
                          $$renderer5.push("<!--]-->");
                        }
                        $$renderer5.push(` `);
                        if (Table_head) {
                          $$renderer5.push("<!--[-->");
                          Table_head($$renderer5, {
                            class: "text-[13px] font-medium",
                            children: ($$renderer6) => {
                              $$renderer6.push(`<!---->IP`);
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
            if (Table_body) {
              $$renderer3.push("<!--[-->");
              Table_body($$renderer3, {
                children: ($$renderer4) => {
                  $$renderer4.push(`<!--[-->`);
                  const each_array_1 = ensure_array_like(rows);
                  for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
                    let r = each_array_1[$$index_1];
                    if (Table_row) {
                      $$renderer4.push("<!--[-->");
                      Table_row($$renderer4, {
                        class: "min-h-11 hover:bg-muted/50 cursor-pointer",
                        onclick: () => toggle(r.id),
                        "aria-expanded": !!expanded[r.id],
                        children: ($$renderer5) => {
                          if (Table_cell) {
                            $$renderer5.push("<!--[-->");
                            Table_cell($$renderer5, {
                              class: "font-mono text-[13px]",
                              style: "font-variant-numeric: tabular-nums;",
                              children: ($$renderer6) => {
                                $$renderer6.push(`<!---->${escape_html(r.occurred_at)}`);
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
                              class: "text-[14px]",
                              children: ($$renderer6) => {
                                $$renderer6.push(`<!---->${escape_html(r.actor_username ?? (r.actor_pat_prefix ? `pat:${r.actor_pat_prefix}` : "system"))}`);
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
                                Badge($$renderer6, {
                                  variant: "outline",
                                  class: actionBadge(r.action),
                                  children: ($$renderer7) => {
                                    $$renderer7.push(`<!---->${escape_html(r.action)}`);
                                  },
                                  $$slots: { default: true }
                                });
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
                              class: "font-mono text-[13px] truncate max-w-[200px]",
                              title: `${stringify(r.target_type)}/${stringify(r.target_id ?? "-")}`,
                              children: ($$renderer6) => {
                                $$renderer6.push(`<!---->${escape_html(r.target_type)}/${escape_html(r.target_id ?? "-")}`);
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
                                $$renderer6.push(`<span${attr_class(clsx(r.result === "success" ? "text-success" : "text-destructive"))}>${escape_html(r.result)}</span>`);
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
                              class: "font-mono text-[13px] text-muted-foreground",
                              children: ($$renderer6) => {
                                $$renderer6.push(`<!---->${escape_html(r.source_ip ?? "-")}`);
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
                    if (expanded[r.id]) {
                      $$renderer4.push("<!--[0-->");
                      if (Table_row) {
                        $$renderer4.push("<!--[-->");
                        Table_row($$renderer4, {
                          class: "bg-muted/40 border-l-2 border-l-primary",
                          children: ($$renderer5) => {
                            if (Table_cell) {
                              $$renderer5.push("<!--[-->");
                              Table_cell($$renderer5, {
                                colspan: 6,
                                children: ($$renderer6) => {
                                  $$renderer6.push(`<div class="grid grid-cols-2 gap-4 p-4">`);
                                  if (Card) {
                                    $$renderer6.push("<!--[-->");
                                    Card($$renderer6, {
                                      class: "p-4",
                                      children: ($$renderer7) => {
                                        $$renderer7.push(`<h4 class="text-[13px] font-medium mb-2">Before</h4> <pre class="font-mono text-[13px] whitespace-pre-wrap text-foreground">${escape_html(JSON.stringify(tryParse(r.payload_before), null, 2))}</pre>`);
                                      },
                                      $$slots: { default: true }
                                    });
                                    $$renderer6.push("<!--]-->");
                                  } else {
                                    $$renderer6.push("<!--[!-->");
                                    $$renderer6.push("<!--]-->");
                                  }
                                  $$renderer6.push(` `);
                                  if (Card) {
                                    $$renderer6.push("<!--[-->");
                                    Card($$renderer6, {
                                      class: "p-4",
                                      children: ($$renderer7) => {
                                        $$renderer7.push(`<h4 class="text-[13px] font-medium mb-2">After</h4> <pre class="font-mono text-[13px] whitespace-pre-wrap text-foreground">${escape_html(JSON.stringify(tryParse(r.payload_after), null, 2))}</pre>`);
                                      },
                                      $$slots: { default: true }
                                    });
                                    $$renderer6.push("<!--]-->");
                                  } else {
                                    $$renderer6.push("<!--[!-->");
                                    $$renderer6.push("<!--]-->");
                                  }
                                  $$renderer6.push(`</div> `);
                                  if (r.error) {
                                    $$renderer6.push("<!--[0-->");
                                    $$renderer6.push(`<div class="p-4 border-t border-border text-[13px] text-destructive font-mono">Error: ${escape_html(r.error)}</div>`);
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
                    } else {
                      $$renderer4.push("<!--[-1-->");
                    }
                    $$renderer4.push(`<!--]-->`);
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
      $$renderer2.push(`</div> <div class="flex items-center justify-between mt-3 text-[13px] text-muted-foreground"><span>Page ${escape_html(page)} of ${escape_html(pages())} (${escape_html(total)} total)</span> <div class="flex gap-2">`);
      Button($$renderer2, {
        variant: "outline",
        size: "sm",
        disabled: page <= 1,
        onclick: () => onPageChange?.(page - 1),
        children: ($$renderer3) => {
          $$renderer3.push(`<!---->Prev`);
        },
        $$slots: { default: true }
      });
      $$renderer2.push(`<!----> `);
      Button($$renderer2, {
        variant: "outline",
        size: "sm",
        disabled: page >= pages(),
        onclick: () => onPageChange?.(page + 1),
        children: ($$renderer3) => {
          $$renderer3.push(`<!---->Next`);
        },
        $$slots: { default: true }
      });
      $$renderer2.push(`<!----></div></div>`);
    }
    $$renderer2.push(`<!--]-->`);
  });
}
function Tooltip($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { open = false, $$slots, $$events, ...restProps } = $$props;
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      if (Tooltip$1) {
        $$renderer3.push("<!--[-->");
        Tooltip$1($$renderer3, spread_props([
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
function Tooltip_trigger($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { ref = null, $$slots, $$events, ...restProps } = $$props;
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      if (Tooltip_trigger$1) {
        $$renderer3.push("<!--[-->");
        Tooltip_trigger$1($$renderer3, spread_props([
          { "data-slot": "tooltip-trigger" },
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
function Tooltip_portal($$renderer, $$props) {
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
function Tooltip_content($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      ref = null,
      class: className,
      sideOffset = 0,
      side = "top",
      children,
      arrowClasses,
      portalProps,
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      Tooltip_portal($$renderer3, spread_props([
        portalProps,
        {
          children: ($$renderer4) => {
            if (Tooltip_content$1) {
              $$renderer4.push("<!--[-->");
              Tooltip_content$1($$renderer4, spread_props([
                {
                  "data-slot": "tooltip-content",
                  sideOffset,
                  side,
                  class: cn("data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs has-data-[slot=kbd]:pr-1.5 **:data-[slot=kbd]:relative **:data-[slot=kbd]:isolate **:data-[slot=kbd]:z-50 **:data-[slot=kbd]:rounded-sm bg-foreground text-background z-50 w-fit max-w-xs origin-(--bits-tooltip-content-transform-origin)", className)
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
                    {
                      let child = function($$renderer6, { props }) {
                        $$renderer6.push(`<div${attributes({
                          class: clsx(cn("size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground z-50", "data-[side=top]:translate-x-1/2 data-[side=top]:translate-y-[calc(-50%+2px)]", "data-[side=bottom]:-translate-x-1/2 data-[side=bottom]:-translate-y-[calc(-50%+1px)]", "data-[side=right]:translate-x-[calc(50%+2px)] data-[side=right]:translate-y-1/2", "data-[side=left]:-translate-y-[calc(50%-3px)]", arrowClasses)),
                          ...props
                        })}></div>`);
                      };
                      if (Tooltip_arrow) {
                        $$renderer5.push("<!--[-->");
                        Tooltip_arrow($$renderer5, { child, $$slots: { child: true } });
                        $$renderer5.push("<!--]-->");
                      } else {
                        $$renderer5.push("<!--[!-->");
                        $$renderer5.push("<!--]-->");
                      }
                    }
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
function Tooltip_provider($$renderer, $$props) {
  let { delayDuration = 0, $$slots, $$events, ...restProps } = $$props;
  if (Tooltip_provider$1) {
    $$renderer.push("<!--[-->");
    Tooltip_provider$1($$renderer, spread_props([{ delayDuration }, restProps]));
    $$renderer.push("<!--]-->");
  } else {
    $$renderer.push("<!--[!-->");
    $$renderer.push("<!--]-->");
  }
}

export { AuditTable as A, Tooltip_provider as T, Tooltip as a, Tooltip_trigger as b, Tooltip_content as c };
//# sourceMappingURL=tooltip-provider-BlA6o5AG.js.map
