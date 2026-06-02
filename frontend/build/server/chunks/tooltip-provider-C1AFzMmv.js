import { o as spread_props, h as bind_props, d as derived, z as props_id, p as attributes, k as attr, q as clsx } from './renderer-mZFfBJIU.js';
import { F as Floating_layer, P as Popper_layer_force_mount, b as Popper_layer, g as getFloatingContentCSSVars, c as FloatingArrowState } from './popper-layer-force-mount-NeUEE3xR.js';
import { n as noop } from './noop-n4I-x7yK.js';
import { b as boxWith, s as simpleBox, a as createBitsAttrs, c as createId, d as attachRef, f as boolToEmptyStrOrUndef, m as mergeProps, e as getDataTransitionAttrs } from './input-Be3KOSVg.js';
import { c as cn } from './button-CE_GHowG.js';
import { g as PresenceManager, P as Portal, D as DOMContext, u as useId } from './scroll-lock-CmFP2s08.js';
import 'clsx';
import { C as Context, w as watch, b as isElement, y as isFocusVisible } from './is-DiTqhZmY.js';
import { S as SafePolygon } from './popover-trigger-CW5_3VeS.js';

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

export { Tooltip_provider as T, Tooltip as a, Tooltip_trigger as b, Tooltip_content as c };
//# sourceMappingURL=tooltip-provider-C1AFzMmv.js.map
