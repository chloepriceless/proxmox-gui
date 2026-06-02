import { aB as head, j as ensure_array_like, l as attr_class, m as stringify, k as attr, c as escape_html, d as derived, h as bind_props, x as run, p as attributes, q as clsx, z as props_id, o as spread_props } from './renderer-mZFfBJIU.js';
import { g as goto } from './client-vbU_CWqW.js';
import { A as Alert_dialog, a as Alert_dialog_content, b as Alert_dialog_header, c as Alert_dialog_title, d as Alert_dialog_description, e as Alert_dialog_footer } from './alert-dialog-description-C3hFoiPT.js';
import { B as Button, c as cn } from './button-CE_GHowG.js';
import 'clsx';
import { C as Card } from './card-xlHxCeq2.js';
import { X } from './x-DRD3hFMZ.js';
import { C as Check } from './check-C7XRLeXa.js';
import { C as Context, w as watch, S as SPACE } from './is-DiTqhZmY.js';
import { a as createBitsAttrs, I as Input, c as createId, b as boxWith, d as attachRef, f as boolToEmptyStrOrUndef, h as boolToStr, m as mergeProps, x as getAriaChecked } from './input-Be3KOSVg.js';
import { R as RovingFocusGroup } from './scroll-lock-CmFP2s08.js';
import { H as Hidden_input } from './hidden-input-Q3ZT26w4.js';
import { n as noop } from './noop-n4I-x7yK.js';
import { C as Copy } from './copy-Ch3Vo_sg.js';
import { I as Icon } from './Icon-oF8immWv.js';
import { E as EmptyState, B as Boxes } from './EmptyState-DYMLE9qi.js';
import { C as Command, a as Command_input } from './command-input-DdpRtNko.js';
import { B as Badge } from './badge-CwoKb4lT.js';
import { S as Select, a as Select_trigger, b as Select_content, c as Select_item } from './select-trigger-D_NqXYnx.js';
import { L as Label } from './label-Cf-Bm-qJ.js';
import { T as Tooltip_provider, a as Tooltip, b as Tooltip_trigger, c as Tooltip_content } from './tooltip-provider-C1AFzMmv.js';
import { P as Popover, a as Popover_trigger, b as Popover_content } from './popover-trigger-CW5_3VeS.js';
import { E as External_link } from './external-link-BTa_-afj.js';
import { S as Switch } from './switch-CPUtptdH.js';
import { C as Checkbox } from './checkbox-DBOvAVyp.js';
import { T as Triangle_alert } from './triangle-alert-fkzDfgmm.js';
import { T as Table, a as Table_header, b as Table_row, c as Table_head, d as Table_body, e as Table_cell } from './table-row-CyEWIwNm.js';
import { a as api } from './client2-FWmWn_B2.js';
import { a as formatBytes } from './format-Cqeoh9TR.js';
import { D as Download } from './download-D-wLopDS.js';
import { a as toast } from './toast-state.svelte-Bp1lssrC.js';
import { T as Textarea } from './textarea-CXeJA3NL.js';
import { P as PasswordInput } from './PasswordInput-DVf84fj9.js';
import '@sveltejs/kit/internal';
import './root-C3vAr9go.js';
import './index-B0sFcY-v.js';
import '@sveltejs/kit/internal/server';
import './state.svelte-DtuilCOR.js';
import './dialog-description2-DYXaekbV.js';
import 'tailwind-merge';
import './sr-only-styles-lCW8LjNz.js';
import './clone-WEom5mq4.js';
import './popper-layer-force-mount-NeUEE3xR.js';
import './chevron-up-DMqbLdKr.js';
import './chevron-down-DXRC0OiZ.js';
import './api-By_nInf4.js';

const radioGroupAttrs = createBitsAttrs({ component: "radio-group", parts: ["root", "item"] });
const RadioGroupRootContext = new Context("RadioGroup.Root");
class RadioGroupRootState {
  static create(opts) {
    return RadioGroupRootContext.set(new RadioGroupRootState(opts));
  }
  opts;
  #hasValue = derived(() => this.opts.value.current !== "");
  get hasValue() {
    return this.#hasValue();
  }
  set hasValue($$value) {
    return this.#hasValue($$value);
  }
  rovingFocusGroup;
  attachment;
  constructor(opts) {
    this.opts = opts;
    this.attachment = attachRef(this.opts.ref);
    this.rovingFocusGroup = new RovingFocusGroup({
      rootNode: this.opts.ref,
      candidateAttr: radioGroupAttrs.item,
      loop: this.opts.loop,
      orientation: this.opts.orientation
    });
  }
  isChecked(value) {
    return this.opts.value.current === value;
  }
  setValue(value) {
    this.opts.value.current = value;
  }
  #props = derived(() => ({
    id: this.opts.id.current,
    role: "radiogroup",
    "aria-required": boolToStr(this.opts.required.current),
    "aria-disabled": boolToStr(this.opts.disabled.current),
    "aria-readonly": this.opts.readonly.current ? "true" : void 0,
    "data-disabled": boolToEmptyStrOrUndef(this.opts.disabled.current),
    "data-readonly": boolToEmptyStrOrUndef(this.opts.readonly.current),
    "data-orientation": this.opts.orientation.current,
    [radioGroupAttrs.root]: "",
    ...this.attachment
  }));
  get props() {
    return this.#props();
  }
  set props($$value) {
    return this.#props($$value);
  }
}
class RadioGroupItemState {
  static create(opts) {
    return new RadioGroupItemState(opts, RadioGroupRootContext.get());
  }
  opts;
  root;
  attachment;
  #checked = derived(() => this.root.opts.value.current === this.opts.value.current);
  get checked() {
    return this.#checked();
  }
  set checked($$value) {
    return this.#checked($$value);
  }
  #isDisabled = derived(() => this.opts.disabled.current || this.root.opts.disabled.current);
  #isReadonly = derived(() => this.root.opts.readonly.current);
  #isChecked = derived(() => this.root.isChecked(this.opts.value.current));
  #tabIndex = -1;
  constructor(opts, root) {
    this.opts = opts;
    this.root = root;
    this.attachment = attachRef(this.opts.ref);
    if (this.opts.value.current === this.root.opts.value.current) {
      this.root.rovingFocusGroup.setCurrentTabStopId(this.opts.id.current);
      this.#tabIndex = 0;
    } else if (!this.root.opts.value.current) {
      this.#tabIndex = 0;
    }
    watch(
      [
        () => this.opts.value.current,
        () => this.root.opts.value.current
      ],
      () => {
        if (this.opts.value.current === this.root.opts.value.current) {
          this.root.rovingFocusGroup.setCurrentTabStopId(this.opts.id.current);
          this.#tabIndex = 0;
        }
      }
    );
    this.onclick = this.onclick.bind(this);
    this.onkeydown = this.onkeydown.bind(this);
    this.onfocus = this.onfocus.bind(this);
  }
  onclick(_) {
    if (this.opts.disabled.current || this.#isReadonly()) return;
    this.root.setValue(this.opts.value.current);
  }
  onfocus(_) {
    if (!this.root.hasValue || this.#isReadonly()) return;
    this.root.setValue(this.opts.value.current);
  }
  onkeydown(e) {
    if (this.#isDisabled()) return;
    if (e.key === SPACE) {
      e.preventDefault();
      if (!this.#isReadonly()) {
        this.root.setValue(this.opts.value.current);
      }
      return;
    }
    this.root.rovingFocusGroup.handleKeydown(this.opts.ref.current, e, true);
  }
  #snippetProps = derived(() => ({ checked: this.#isChecked() }));
  get snippetProps() {
    return this.#snippetProps();
  }
  set snippetProps($$value) {
    return this.#snippetProps($$value);
  }
  #props = derived(() => ({
    id: this.opts.id.current,
    disabled: this.#isDisabled() ? true : void 0,
    "data-value": this.opts.value.current,
    "data-orientation": this.root.opts.orientation.current,
    "data-disabled": boolToEmptyStrOrUndef(this.#isDisabled()),
    "data-readonly": boolToEmptyStrOrUndef(this.#isReadonly()),
    "data-state": this.#isChecked() ? "checked" : "unchecked",
    "aria-checked": getAriaChecked(this.#isChecked(), false),
    [radioGroupAttrs.item]: "",
    type: "button",
    role: "radio",
    tabindex: this.#tabIndex,
    onkeydown: this.onkeydown,
    onfocus: this.onfocus,
    onclick: this.onclick,
    ...this.attachment
  }));
  get props() {
    return this.#props();
  }
  set props($$value) {
    return this.#props($$value);
  }
}
class RadioGroupInputState {
  static create() {
    return new RadioGroupInputState(RadioGroupRootContext.get());
  }
  root;
  #shouldRender = derived(() => this.root.opts.name.current !== void 0);
  get shouldRender() {
    return this.#shouldRender();
  }
  set shouldRender($$value) {
    return this.#shouldRender($$value);
  }
  constructor(root) {
    this.root = root;
    this.onfocus = this.onfocus.bind(this);
  }
  onfocus(_) {
    this.root.rovingFocusGroup.focusCurrentTabStop();
  }
  #props = derived(() => ({
    name: this.root.opts.name.current,
    value: this.root.opts.value.current,
    required: this.root.opts.required.current,
    disabled: this.root.opts.disabled.current,
    onfocus: this.onfocus
  }));
  get props() {
    return this.#props();
  }
  set props($$value) {
    return this.#props($$value);
  }
}
function Radio_group_input($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const inputState = RadioGroupInputState.create();
    if (inputState.shouldRender) {
      $$renderer2.push("<!--[0-->");
      Hidden_input($$renderer2, spread_props([inputState.props]));
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
function Radio_group$1($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const uid = props_id($$renderer2);
    let {
      disabled = false,
      children,
      child,
      value = "",
      ref = null,
      orientation = "vertical",
      loop = true,
      name = void 0,
      required = false,
      readonly = false,
      id = createId(uid),
      onValueChange = noop,
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    const rootState = RadioGroupRootState.create({
      orientation: boxWith(() => orientation),
      disabled: boxWith(() => disabled),
      loop: boxWith(() => loop),
      name: boxWith(() => name),
      required: boxWith(() => required),
      readonly: boxWith(() => readonly),
      id: boxWith(() => id),
      value: boxWith(() => value, (v) => {
        if (v === value) return;
        value = v;
        onValueChange?.(v);
      }),
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
    $$renderer2.push(`<!--]--> `);
    Radio_group_input($$renderer2);
    $$renderer2.push(`<!---->`);
    bind_props($$props, { value, ref });
  });
}
function Radio_group_item$1($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const uid = props_id($$renderer2);
    let {
      id = createId(uid),
      children,
      child,
      value,
      disabled = false,
      ref = null,
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    const itemState = RadioGroupItemState.create({
      value: boxWith(() => value),
      disabled: boxWith(() => disabled ?? false),
      id: boxWith(() => id),
      ref: boxWith(() => ref, (v) => ref = v)
    });
    const mergedProps = derived(() => mergeProps(restProps, itemState.props));
    if (child) {
      $$renderer2.push("<!--[0-->");
      child($$renderer2, { props: mergedProps(), ...itemState.snippetProps });
      $$renderer2.push(`<!---->`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<button${attributes({ ...mergedProps() })}>`);
      children?.($$renderer2, itemState.snippetProps);
      $$renderer2.push(`<!----></button>`);
    }
    $$renderer2.push(`<!--]-->`);
    bind_props($$props, { ref });
  });
}
const WIZARD_STEP_LABEL = {
  path: "Path",
  source: "Source",
  resources: "Resources",
  network: "Network",
  "cloud-init": "Cloud-Init",
  review: "Review"
};
function stepsForPath(path) {
  if (path === null) return ["path"];
  const kind = pathKind(path);
  const middle = kind === "lxc" ? ["source", "resources", "network"] : ["source", "resources", "network", "cloud-init"];
  return ["path", ...middle, "review"];
}
function pathKind(path) {
  return path === "plain-lxc" || path === "community-script" ? "lxc" : "vm";
}
function canAdvanceFromPathStep(path) {
  return path !== null;
}
function shouldPromptDiscard(path, activeStep) {
  return path !== null || activeStep > 1;
}
const PATH_CARDS = [
  {
    path: "plain-lxc",
    iconName: "Container",
    title: "Plain LXC",
    description: "A lightweight container from a system template.",
    kind: "lxc"
  },
  {
    path: "community-script",
    iconName: "Rocket",
    title: "Community Script",
    description: "One-click install a curated app into a new container.",
    kind: "lxc"
  },
  {
    path: "cloud-image",
    iconName: "Disc",
    title: "Cloud-Init image",
    description: "A VM from an Ubuntu, Debian, or Rocky cloud image.",
    kind: "vm"
  },
  {
    path: "template-clone",
    iconName: "Boxes",
    title: "Clone a template",
    description: "A VM cloned from an existing Proxmox template.",
    kind: "vm"
  },
  {
    path: "blank-iso",
    iconName: "Image",
    title: "Blank VM + ISO",
    description: "An empty VM that boots from an installation ISO.",
    kind: "vm"
  },
  {
    path: "vm-clone",
    iconName: "Copy",
    title: "Clone a VM",
    description: "A copy of one of your existing VMs.",
    kind: "vm"
  }
];
const KNOWN_PATHS = new Set(PATH_CARDS.map((c) => c.path));
const FINAL_CTA_LABEL = {
  "plain-lxc": "Create container",
  "community-script": "Deploy script",
  "cloud-image": "Create VM",
  "template-clone": "Create VM",
  "blank-iso": "Create VM",
  "vm-clone": "Clone VM"
};
function inventoryPathForJob(clusterId, job) {
  return `/inventory/${clusterId}/${job.vmid}`;
}
function WizardChrome($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      steps,
      activeStep,
      body,
      onBack,
      onNext,
      onClose,
      nextLabel = "Next",
      nextDisabled = false,
      wide = false
    } = $$props;
    const showBack = derived(() => activeStep > 1 && typeof onBack === "function");
    $$renderer2.push(`<div class="flex h-full min-h-[32rem] flex-col"><header class="flex items-center justify-between gap-4 border-b px-6 py-4"><h1 class="text-[18px] font-semibold tracking-tight">Create</h1> `);
    Button($$renderer2, {
      variant: "ghost",
      size: "icon",
      onclick: onClose,
      "aria-label": "Close wizard",
      children: ($$renderer3) => {
        X($$renderer3, { class: "size-4", "aria-hidden": "true" });
      },
      $$slots: { default: true }
    });
    $$renderer2.push(`<!----></header>  <ol class="flex w-full items-center gap-2 border-b px-6 py-4" aria-label="Wizard progress"><!--[-->`);
    const each_array = ensure_array_like(steps);
    for (let i = 0, $$length = each_array.length; i < $$length; i++) {
      let stepId = each_array[i];
      const stepNo = i + 1;
      const isComplete = activeStep > stepNo;
      const isActive = activeStep === stepNo;
      $$renderer2.push(`<li class="flex flex-1 items-center gap-2"><span${attr_class(`flex size-7 shrink-0 items-center justify-center rounded-full border text-[13px] font-medium ${stringify(isActive ? "bg-primary text-primary-foreground border-primary" : isComplete ? "bg-success text-success-foreground border-success" : "bg-muted text-muted-foreground border-border")}`)}${attr("aria-current", isActive ? "step" : void 0)}${attr("aria-label", `Step ${stringify(stepNo)}: ${stringify(WIZARD_STEP_LABEL[stepId])}`)}>`);
      if (isComplete) {
        $$renderer2.push("<!--[0-->");
        Check($$renderer2, { class: "size-4", "aria-hidden": "true" });
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`${escape_html(stepNo)}`);
      }
      $$renderer2.push(`<!--]--></span> <span${attr_class(`text-[13px] font-medium whitespace-nowrap ${stringify(isActive ? "text-foreground" : "text-muted-foreground")}`)}>${escape_html(WIZARD_STEP_LABEL[stepId])}</span> `);
      if (i < steps.length - 1) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<span aria-hidden="true"${attr_class(`h-[2px] flex-1 ${stringify(isComplete ? "bg-success" : "bg-border")}`)}></span>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></li>`);
    }
    $$renderer2.push(`<!--]--></ol>  <div class="flex-1 overflow-y-auto px-6 py-6"><div${attr_class(`mx-auto w-full ${stringify(wide ? "" : "max-w-[45rem]")}`)}>`);
    body($$renderer2);
    $$renderer2.push(`<!----></div></div>  <footer class="bg-background sticky bottom-0 flex h-16 items-center justify-between gap-2 border-t px-6"><div>`);
    if (showBack()) {
      $$renderer2.push("<!--[0-->");
      Button($$renderer2, {
        variant: "ghost",
        type: "button",
        onclick: onBack,
        children: ($$renderer3) => {
          $$renderer3.push(`<!---->Back`);
        },
        $$slots: { default: true }
      });
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> `);
    Button($$renderer2, {
      type: "button",
      onclick: onNext,
      disabled: nextDisabled,
      children: ($$renderer3) => {
        $$renderer3.push(`<!---->${escape_html(nextLabel)}`);
      },
      $$slots: { default: true }
    });
    $$renderer2.push(`<!----></footer></div>`);
  });
}
function Container($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    [
      "path",
      {
        "d": "M22 7.7c0-.6-.4-1.2-.8-1.5l-6.3-3.9a1.72 1.72 0 0 0-1.7 0l-10.3 6c-.5.2-.9.8-.9 1.4v6.6c0 .5.4 1.2.8 1.5l6.3 3.9a1.72 1.72 0 0 0 1.7 0l10.3-6c.5-.3.9-1 .9-1.5Z"
      }
    ],
    ["path", { "d": "M10 21.9V14L2.1 9.1" }],
    ["path", { "d": "m10 14 11.9-6.9" }],
    ["path", { "d": "M14 19.8v-8.1" }],
    ["path", { "d": "M18 17.5V9.4" }]
  ];
  Icon($$renderer, spread_props([{ name: "container" }, props, { iconNode }]));
}
function Rocket($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["path", { "d": "M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" }],
    [
      "path",
      {
        "d": "M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09"
      }
    ],
    [
      "path",
      {
        "d": "M9 12a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.4 22.4 0 0 1-4 2z"
      }
    ],
    [
      "path",
      { "d": "M9 12H4s.55-3.03 2-4c1.62-1.08 5 .05 5 .05" }
    ]
  ];
  Icon($$renderer, spread_props([{ name: "rocket" }, props, { iconNode }]));
}
function Disc($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["circle", { "cx": "12", "cy": "12", "r": "10" }],
    ["circle", { "cx": "12", "cy": "12", "r": "2" }]
  ];
  Icon($$renderer, spread_props([{ name: "disc" }, props, { iconNode }]));
}
function Image($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    [
      "rect",
      {
        "width": "18",
        "height": "18",
        "x": "3",
        "y": "3",
        "rx": "2",
        "ry": "2"
      }
    ],
    ["circle", { "cx": "9", "cy": "9", "r": "2" }],
    ["path", { "d": "m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" }]
  ];
  Icon($$renderer, spread_props([{ name: "image" }, props, { iconNode }]));
}
function PathPicker($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { value = null, onSelect } = $$props;
    const ICONS = { Container, Rocket, Disc, Boxes, Image, Copy };
    let groupValue = value ?? "";
    function handleChange(next) {
      groupValue = next;
      value = next;
      onSelect?.(next);
    }
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      $$renderer3.push(`<div class="flex flex-col gap-2"><header class="flex flex-col gap-1"><h2 class="text-[18px] font-semibold leading-tight tracking-tight">Choose what to create</h2> <p class="text-muted-foreground text-[14px]">Pick a provisioning path to get started.</p></header> `);
      if (Radio_group$1) {
        $$renderer3.push("<!--[-->");
        Radio_group$1($$renderer3, {
          onValueChange: handleChange,
          "aria-label": "Provisioning path",
          class: "grid grid-cols-1 gap-2 pt-2 sm:grid-cols-2 lg:grid-cols-3",
          get value() {
            return groupValue;
          },
          set value($$value) {
            groupValue = $$value;
            $$settled = false;
          },
          children: ($$renderer4) => {
            $$renderer4.push(`<!--[-->`);
            const each_array = ensure_array_like(PATH_CARDS);
            for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
              let card = each_array[$$index];
              const Icon2 = ICONS[card.iconName];
              const selected = groupValue === card.path;
              if (Radio_group_item$1) {
                $$renderer4.push("<!--[-->");
                Radio_group_item$1($$renderer4, {
                  value: card.path,
                  class: `bg-card relative flex h-40 min-w-60 cursor-pointer flex-col items-start gap-2 rounded-lg border p-4 text-left outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring ${stringify(selected ? "border-primary ring-1 ring-primary" : "border-border")}`,
                  children: ($$renderer5) => {
                    if (selected) {
                      $$renderer5.push("<!--[0-->");
                      Check($$renderer5, {
                        class: "text-primary absolute right-3 top-3 size-4",
                        "aria-hidden": "true"
                      });
                    } else {
                      $$renderer5.push("<!--[-1-->");
                    }
                    $$renderer5.push(`<!--]--> `);
                    if (Icon2) {
                      $$renderer5.push("<!--[-->");
                      Icon2($$renderer5, { class: "size-6 text-foreground", "aria-hidden": "true" });
                      $$renderer5.push("<!--]-->");
                    } else {
                      $$renderer5.push("<!--[!-->");
                      $$renderer5.push("<!--]-->");
                    }
                    $$renderer5.push(` <span class="text-[14px] font-semibold text-foreground">${escape_html(card.title)}</span> <span class="text-muted-foreground text-[13px]">${escape_html(card.description)}</span>`);
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
      $$renderer3.push(`</div>`);
    }
    do {
      $$settled = true;
      $$inner_renderer = $$renderer2.copy();
      $$render_inner($$inner_renderer);
    } while (!$$settled);
    $$renderer2.subsume($$inner_renderer);
    bind_props($$props, { value });
  });
}
function curatedEntries(entries) {
  return entries.filter((e) => e.featured);
}
function catalogCategories(entries) {
  const seen = /* @__PURE__ */ new Set();
  for (const e of entries) {
    for (const c of e.categories) seen.add(c);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}
function filterCatalog(entries, args) {
  const q = (args.q ?? "").trim().toLowerCase();
  const category = (args.category ?? "").trim().toLowerCase();
  return entries.filter((e) => {
    if (q) {
      const haystack = `${e.name} ${e.description}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (category) {
      if (!e.categories.some((c) => c.toLowerCase() === category)) return false;
    }
    return true;
  });
}
const LXC_FEATURE_FLAGS = ["keyctl", "fuse"];
const LXC_RESOURCE_DEFAULTS = {
  unprivileged: true,
  nesting: false,
  features: []
};
function asString$1(v) {
  return typeof v === "string" ? v.trim() : "";
}
function asPositiveInt$1(v) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}
function validateLxcStep(step, path, formData) {
  const errors = {};
  if (step === "source") {
    if (path === "plain-lxc") {
      if (!asString$1(formData.ostemplate)) {
        errors.ostemplate = "Pick a container template to continue.";
      }
    } else {
      if (!asString$1(formData.script_slug)) {
        errors.script_slug = "Choose a community script to continue.";
      }
    }
    return errors;
  }
  if (step === "resources") {
    if (!asString$1(formData.node)) errors.node = "Pick a target node.";
    if (!asString$1(formData.storage)) errors.storage = "Pick a storage.";
    if (!asString$1(formData.hostname)) {
      errors.hostname = "Enter a hostname.";
    }
    if (asPositiveInt$1(formData.cpu_cores) === null) {
      errors.cpu_cores = "CPU cores must be a positive whole number.";
    }
    if (asPositiveInt$1(formData.memory_mb) === null) {
      errors.memory_mb = "Memory must be a positive whole number.";
    }
    if (asPositiveInt$1(formData.disk_gb) === null) {
      errors.disk_gb = "Disk size must be a positive whole number.";
    }
    return errors;
  }
  return errors;
}
function lxcStepValid(step, path, formData) {
  return Object.keys(validateLxcStep(step, path, formData)).length === 0;
}
function readNetwork$1(formData) {
  const net = formData.network;
  if (net && typeof net === "object") return net;
  return null;
}
function readFeatures(formData) {
  const f = formData.features;
  if (Array.isArray(f)) return f.filter((x) => typeof x === "string");
  return [];
}
function buildLxcRequest(formData, teamId) {
  return {
    team_id: teamId,
    node: asString$1(formData.node),
    storage: asString$1(formData.storage),
    ostemplate: asString$1(formData.ostemplate),
    hostname: asString$1(formData.hostname),
    cpu_cores: asPositiveInt$1(formData.cpu_cores) ?? 1,
    memory_mb: asPositiveInt$1(formData.memory_mb) ?? 512,
    disk_gb: asPositiveInt$1(formData.disk_gb) ?? 8,
    network: readNetwork$1(formData),
    unprivileged: typeof formData.unprivileged === "boolean" ? formData.unprivileged : LXC_RESOURCE_DEFAULTS.unprivileged,
    nesting: typeof formData.nesting === "boolean" ? formData.nesting : LXC_RESOURCE_DEFAULTS.nesting,
    features: readFeatures(formData),
    ssh_public_keys: asString$1(formData.ssh_public_keys) || null,
    password: asString$1(formData.password) || null,
    start_after_create: typeof formData.start_after_create === "boolean" ? formData.start_after_create : true
  };
}
function buildCommunityScriptRequest(formData, teamId) {
  const rawOptions = formData.script_options;
  const script_options = {};
  if (rawOptions && typeof rawOptions === "object" && !Array.isArray(rawOptions)) {
    for (const [k, v] of Object.entries(rawOptions)) {
      if (typeof v === "string" || typeof v === "number") {
        script_options[k] = String(v);
      }
    }
  }
  return {
    team_id: teamId,
    node: asString$1(formData.node),
    storage: asString$1(formData.storage),
    script_slug: asString$1(formData.script_slug),
    hostname: asString$1(formData.hostname),
    cpu_cores: asPositiveInt$1(formData.cpu_cores) ?? 1,
    memory_mb: asPositiveInt$1(formData.memory_mb) ?? 512,
    disk_gb: asPositiveInt$1(formData.disk_gb) ?? 8,
    network: readNetwork$1(formData),
    unprivileged: typeof formData.unprivileged === "boolean" ? formData.unprivileged : LXC_RESOURCE_DEFAULTS.unprivileged,
    ssh_public_keys: asString$1(formData.ssh_public_keys) || null,
    script_options
  };
}
function mapLxcCreateError(err) {
  const e = err;
  const detail = (e?.detail ?? "").toLowerCase();
  if (e?.status === 409) {
    return detail ? `This would exceed your team's quota: ${e.detail}` : "This would exceed your team's quota. Reduce the size and try again.";
  }
  if (e?.status === 403) {
    return "You don't have permission to provision into this team or cluster.";
  }
  if (e?.status === 422) {
    return "Please check the wizard fields and try again.";
  }
  if (e?.status === 404) {
    return "The selected template, script, or cluster is no longer available.";
  }
  return "Couldn't start the create job. Try again.";
}
function Search_x($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["path", { "d": "m13.5 8.5-5 5" }],
    ["path", { "d": "m8.5 8.5 5 5" }],
    ["circle", { "cx": "11", "cy": "11", "r": "8" }],
    ["path", { "d": "m21 21-4.3-4.3" }]
  ];
  Icon($$renderer, spread_props([{ name: "search-x" }, props, { iconNode }]));
}
function Tag($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    [
      "path",
      {
        "d": "M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"
      }
    ],
    [
      "circle",
      { "cx": "7.5", "cy": "7.5", "r": ".5", "fill": "currentColor" }
    ]
  ];
  Icon($$renderer, spread_props([{ name: "tag" }, props, { iconNode }]));
}
function CatalogBrowser($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { selectedSlug = null } = $$props;
    let view = "curated";
    let entries = [];
    let query = "";
    let activeCategory = "";
    const curated = derived(() => curatedEntries(entries));
    const categories = derived(() => catalogCategories(entries));
    const shown = derived(() => view === "curated" ? curated() : filterCatalog(entries, { q: query, category: activeCategory }));
    const noMatch = derived(() => view === "full" && true && true && shown().length === 0 && entries.length > 0);
    function switchView(next) {
      view = next;
      query = "";
      activeCategory = "";
    }
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      $$renderer3.push(`<section class="flex flex-col gap-4"><header class="flex flex-col gap-3"><div class="flex flex-wrap items-center justify-between gap-3"><h2 class="text-[18px] font-semibold leading-tight tracking-tight">Choose a community script</h2> <div class="bg-muted inline-flex items-center gap-1 rounded-md p-1" role="tablist" aria-label="Catalog view">`);
      Button($$renderer3, {
        variant: view === "curated" ? "secondary" : "ghost",
        size: "sm",
        role: "tab",
        "aria-selected": view === "curated",
        onclick: () => switchView("curated"),
        children: ($$renderer4) => {
          $$renderer4.push(`<!---->Curated`);
        },
        $$slots: { default: true }
      });
      $$renderer3.push(`<!----> `);
      Button($$renderer3, {
        variant: view === "full" ? "secondary" : "ghost",
        size: "sm",
        role: "tab",
        "aria-selected": view === "full",
        onclick: () => switchView("full"),
        children: ($$renderer4) => {
          $$renderer4.push(`<!---->Full catalog`);
        },
        $$slots: { default: true }
      });
      $$renderer3.push(`<!----></div></div> `);
      if (view === "full") {
        $$renderer3.push("<!--[0-->");
        if (Command) {
          $$renderer3.push("<!--[-->");
          Command($$renderer3, {
            shouldFilter: false,
            class: "bg-transparent p-0",
            children: ($$renderer4) => {
              if (Command_input) {
                $$renderer4.push("<!--[-->");
                Command_input($$renderer4, {
                  placeholder: "Search scripts…",
                  get value() {
                    return query;
                  },
                  set value($$value) {
                    query = $$value;
                    $$settled = false;
                  }
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
        if (categories().length > 0) {
          $$renderer3.push("<!--[0-->");
          $$renderer3.push(`<div class="flex flex-wrap items-center gap-2"><!--[-->`);
          const each_array = ensure_array_like(categories());
          for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
            let cat = each_array[$$index];
            $$renderer3.push(`<button type="button"${attr("aria-pressed", activeCategory === cat)} class="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">`);
            Badge($$renderer3, {
              variant: activeCategory === cat ? "default" : "outline",
              class: "cursor-pointer gap-1",
              children: ($$renderer4) => {
                Tag($$renderer4, { class: "size-3", "aria-hidden": "true" });
                $$renderer4.push(`<!----> ${escape_html(cat)}`);
              },
              $$slots: { default: true }
            });
            $$renderer3.push(`<!----></button>`);
          }
          $$renderer3.push(`<!--]--></div>`);
        } else {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]-->`);
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--></header> `);
      if (noMatch()) {
        $$renderer3.push("<!--[2-->");
        EmptyState($$renderer3, {
          icon: Search_x,
          heading: "No scripts match your search",
          body: "Try a different keyword or clear the category filters."
        });
      } else {
        $$renderer3.push("<!--[-1-->");
        $$renderer3.push(`<div class="grid grid-cols-1 gap-3 sm:grid-cols-2"><!--[-->`);
        const each_array_2 = ensure_array_like(shown());
        for (let $$index_3 = 0, $$length = each_array_2.length; $$index_3 < $$length; $$index_3++) {
          let entry = each_array_2[$$index_3];
          $$renderer3.push(`<button type="button"${attr_class(`flex h-24 w-full flex-col gap-1 rounded-md border p-3 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring ${stringify(entry.slug === selectedSlug ? "border-primary ring-1 ring-primary" : "border-border")}`)}${attr("aria-label", `Open ${entry.name}`)}><div class="flex items-center gap-2">`);
          Rocket($$renderer3, {
            class: "text-muted-foreground size-4 shrink-0",
            "aria-hidden": "true"
          });
          $$renderer3.push(`<!----> <span class="text-[14px] font-semibold leading-tight">${escape_html(entry.name)}</span> <!--[-->`);
          const each_array_3 = ensure_array_like(entry.categories);
          for (let $$index_2 = 0, $$length2 = each_array_3.length; $$index_2 < $$length2; $$index_2++) {
            let cat = each_array_3[$$index_2];
            Badge($$renderer3, {
              variant: "outline",
              class: "text-[11px]",
              children: ($$renderer4) => {
                $$renderer4.push(`<!---->${escape_html(cat)}`);
              },
              $$slots: { default: true }
            });
          }
          $$renderer3.push(`<!--]--></div> <p class="text-muted-foreground line-clamp-2 text-[14px]">${escape_html(entry.description)}</p></button>`);
        }
        $$renderer3.push(`<!--]--></div>`);
      }
      $$renderer3.push(`<!--]--></section> `);
      {
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
function Circle_question_mark($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["circle", { "cx": "12", "cy": "12", "r": "10" }],
    ["path", { "d": "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" }],
    ["path", { "d": "M12 17h.01" }]
  ];
  Icon($$renderer, spread_props([{ name: "circle-question-mark" }, props, { iconNode }]));
}
function HelpTooltip($$renderer, $$props) {
  let { label, text, learnMoreHref, class: className = "" } = $$props;
  const triggerBase = "text-muted-foreground hover:text-foreground inline-flex size-3.5 items-center justify-center rounded-full align-middle outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const triggerClass = derived(() => `${triggerBase} ${className}`);
  if (learnMoreHref) {
    $$renderer.push("<!--[0-->");
    if (Popover) {
      $$renderer.push("<!--[-->");
      Popover($$renderer, {
        children: ($$renderer2) => {
          {
            let child = function($$renderer3, { props }) {
              $$renderer3.push(`<button${attributes({
                ...props,
                type: "button",
                class: clsx(triggerClass()),
                "aria-label": `Help: ${label}`
              })}>`);
              Circle_question_mark($$renderer3, { class: "size-3.5", "aria-hidden": "true" });
              $$renderer3.push(`<!----></button>`);
            };
            if (Popover_trigger) {
              $$renderer2.push("<!--[-->");
              Popover_trigger($$renderer2, { child, $$slots: { child: true } });
              $$renderer2.push("<!--]-->");
            } else {
              $$renderer2.push("<!--[!-->");
              $$renderer2.push("<!--]-->");
            }
          }
          $$renderer2.push(` `);
          if (Popover_content) {
            $$renderer2.push("<!--[-->");
            Popover_content($$renderer2, {
              class: "max-w-xs",
              role: "tooltip",
              children: ($$renderer3) => {
                $$renderer3.push(`<p class="text-[13px] leading-normal">${escape_html(text)}</p> `);
                Button($$renderer3, {
                  href: learnMoreHref,
                  variant: "link",
                  size: "sm",
                  class: "h-auto justify-start p-0",
                  target: "_blank",
                  rel: "noopener noreferrer",
                  children: ($$renderer4) => {
                    $$renderer4.push(`<!---->Learn more `);
                    External_link($$renderer4, { class: "size-3.5", "aria-hidden": "true" });
                    $$renderer4.push(`<!---->`);
                  },
                  $$slots: { default: true }
                });
                $$renderer3.push(`<!---->`);
              },
              $$slots: { default: true }
            });
            $$renderer2.push("<!--]-->");
          } else {
            $$renderer2.push("<!--[!-->");
            $$renderer2.push("<!--]-->");
          }
        },
        $$slots: { default: true }
      });
      $$renderer.push("<!--]-->");
    } else {
      $$renderer.push("<!--[!-->");
      $$renderer.push("<!--]-->");
    }
  } else {
    $$renderer.push("<!--[-1-->");
    if (Tooltip_provider) {
      $$renderer.push("<!--[-->");
      Tooltip_provider($$renderer, {
        children: ($$renderer2) => {
          if (Tooltip) {
            $$renderer2.push("<!--[-->");
            Tooltip($$renderer2, {
              children: ($$renderer3) => {
                {
                  let child = function($$renderer4, { props }) {
                    $$renderer4.push(`<button${attributes({
                      ...props,
                      type: "button",
                      class: clsx(triggerClass()),
                      "aria-label": `Help: ${label}`
                    })}>`);
                    Circle_question_mark($$renderer4, { class: "size-3.5", "aria-hidden": "true" });
                    $$renderer4.push(`<!----></button>`);
                  };
                  if (Tooltip_trigger) {
                    $$renderer3.push("<!--[-->");
                    Tooltip_trigger($$renderer3, { child, $$slots: { child: true } });
                    $$renderer3.push("<!--]-->");
                  } else {
                    $$renderer3.push("<!--[!-->");
                    $$renderer3.push("<!--]-->");
                  }
                }
                $$renderer3.push(` `);
                if (Tooltip_content) {
                  $$renderer3.push("<!--[-->");
                  Tooltip_content($$renderer3, {
                    role: "tooltip",
                    children: ($$renderer4) => {
                      $$renderer4.push(`<span class="text-[13px]">${escape_html(text)}</span>`);
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
        },
        $$slots: { default: true }
      });
      $$renderer.push("<!--]-->");
    } else {
      $$renderer.push("<!--[!-->");
      $$renderer.push("<!--]-->");
    }
  }
  $$renderer.push(`<!--]-->`);
}
function LxcTemplateStep($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { templates = [], value = "", onChange } = $$props;
    const triggerLabel = derived(() => templates.find((t) => t.volid === value)?.label ?? (value || "Select a container template"));
    $$renderer2.push(`<section class="flex flex-col gap-4"><header class="flex flex-col gap-1"><h2 class="text-[18px] font-semibold leading-tight tracking-tight">Pick a container template</h2> <p class="text-muted-foreground text-[14px]">The LXC is created from a system template (a <code>vztmpl</code> volume on
      the cluster).</p></header> <div class="flex flex-col gap-1.5"><div class="flex items-center gap-1.5">`);
    Label($$renderer2, {
      for: "lxc-template",
      children: ($$renderer3) => {
        $$renderer3.push(`<!---->Container template`);
      },
      $$slots: { default: true }
    });
    $$renderer2.push(`<!----> `);
    HelpTooltip($$renderer2, {
      label: "Container template",
      text: "A vztmpl is a pre-built root filesystem for an LXC — e.g. Ubuntu, Debian, or Alpine. The container is created from this template."
    });
    $$renderer2.push(`<!----></div> `);
    if (templates.length > 0) {
      $$renderer2.push("<!--[0-->");
      if (Select) {
        $$renderer2.push("<!--[-->");
        Select($$renderer2, {
          type: "single",
          value: value || void 0,
          onValueChange: (v) => onChange?.(v ?? ""),
          children: ($$renderer3) => {
            if (Select_trigger) {
              $$renderer3.push("<!--[-->");
              Select_trigger($$renderer3, {
                id: "lxc-template",
                class: "w-full",
                children: ($$renderer4) => {
                  $$renderer4.push(`<!---->${escape_html(triggerLabel())}`);
                },
                $$slots: { default: true }
              });
              $$renderer3.push("<!--]-->");
            } else {
              $$renderer3.push("<!--[!-->");
              $$renderer3.push("<!--]-->");
            }
            $$renderer3.push(` `);
            if (Select_content) {
              $$renderer3.push("<!--[-->");
              Select_content($$renderer3, {
                children: ($$renderer4) => {
                  $$renderer4.push(`<!--[-->`);
                  const each_array = ensure_array_like(templates);
                  for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
                    let tmpl = each_array[$$index];
                    if (Select_item) {
                      $$renderer4.push("<!--[-->");
                      Select_item($$renderer4, {
                        value: tmpl.volid,
                        children: ($$renderer5) => {
                          $$renderer5.push(`<!---->${escape_html(tmpl.label ?? tmpl.volid)}`);
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
    } else {
      $$renderer2.push("<!--[-1-->");
      Input($$renderer2, {
        id: "lxc-template",
        placeholder: "local:vztmpl/ubuntu-24.04-standard_24.04-1_amd64.tar.zst",
        value,
        oninput: (e) => onChange?.(e.currentTarget.value)
      });
      $$renderer2.push(`<!----> <p class="text-muted-foreground text-[13px]">Enter the template's storage volume id.</p>`);
    }
    $$renderer2.push(`<!--]--></div></section>`);
  });
}
function LxcResourcesStep($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      nodes = [],
      storages = [],
      teams = [],
      teamId = null,
      value,
      errors = {},
      onChange,
      onTeamChange
    } = $$props;
    const teamLabel = derived(() => teams.find((t) => t.id === teamId)?.name ?? "Select a team");
    function patch(part) {
      onChange?.({ ...value, ...part });
    }
    function toggleFeature(flag, on) {
      const set = new Set(value.features);
      if (on) set.add(flag);
      else set.delete(flag);
      patch({ features: [...set] });
    }
    function toInt(raw) {
      const n = Number(raw);
      return Number.isFinite(n) ? Math.trunc(n) : 0;
    }
    $$renderer2.push(`<section class="flex flex-col gap-5"><header class="flex flex-col gap-1"><h2 class="text-[18px] font-semibold leading-tight tracking-tight">Size your container</h2> <p class="text-muted-foreground text-[14px]">Choose where the container runs and how much CPU, memory, and disk it gets.</p></header> `);
    if (teams.length > 1) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="flex flex-col gap-1.5"><div class="flex items-center gap-1.5">`);
      Label($$renderer2, {
        for: "lxc-team",
        children: ($$renderer3) => {
          $$renderer3.push(`<!---->Owning team`);
        },
        $$slots: { default: true }
      });
      $$renderer2.push(`<!----> `);
      HelpTooltip($$renderer2, {
        label: "Owning team",
        text: "The team this container counts against for quota and visibility. Only members of the team can see and manage it."
      });
      $$renderer2.push(`<!----></div> `);
      if (Select) {
        $$renderer2.push("<!--[-->");
        Select($$renderer2, {
          type: "single",
          value: teamId != null ? String(teamId) : void 0,
          onValueChange: (v) => v && onTeamChange?.(Number(v)),
          children: ($$renderer3) => {
            if (Select_trigger) {
              $$renderer3.push("<!--[-->");
              Select_trigger($$renderer3, {
                id: "lxc-team",
                class: "w-full",
                children: ($$renderer4) => {
                  $$renderer4.push(`<!---->${escape_html(teamLabel())}`);
                },
                $$slots: { default: true }
              });
              $$renderer3.push("<!--]-->");
            } else {
              $$renderer3.push("<!--[!-->");
              $$renderer3.push("<!--]-->");
            }
            $$renderer3.push(` `);
            if (Select_content) {
              $$renderer3.push("<!--[-->");
              Select_content($$renderer3, {
                children: ($$renderer4) => {
                  $$renderer4.push(`<!--[-->`);
                  const each_array = ensure_array_like(teams);
                  for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
                    let team = each_array[$$index];
                    if (Select_item) {
                      $$renderer4.push("<!--[-->");
                      Select_item($$renderer4, {
                        value: String(team.id),
                        children: ($$renderer5) => {
                          $$renderer5.push(`<!---->${escape_html(team.name)}`);
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
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="grid grid-cols-1 gap-4 sm:grid-cols-2"><div class="flex flex-col gap-1.5"><div class="flex items-center gap-1.5">`);
    Label($$renderer2, {
      for: "lxc-node",
      children: ($$renderer3) => {
        $$renderer3.push(`<!---->Target node`);
      },
      $$slots: { default: true }
    });
    $$renderer2.push(`<!----> `);
    HelpTooltip($$renderer2, {
      label: "Target node",
      text: "The Proxmox host the container runs on. Each node has its own free CPU, memory, and storage."
    });
    $$renderer2.push(`<!----></div> `);
    if (nodes.length > 0) {
      $$renderer2.push("<!--[0-->");
      if (Select) {
        $$renderer2.push("<!--[-->");
        Select($$renderer2, {
          type: "single",
          value: value.node || void 0,
          onValueChange: (v) => patch({ node: v ?? "" }),
          children: ($$renderer3) => {
            if (Select_trigger) {
              $$renderer3.push("<!--[-->");
              Select_trigger($$renderer3, {
                id: "lxc-node",
                class: "w-full",
                children: ($$renderer4) => {
                  $$renderer4.push(`<!---->${escape_html(value.node || "Select a node")}`);
                },
                $$slots: { default: true }
              });
              $$renderer3.push("<!--]-->");
            } else {
              $$renderer3.push("<!--[!-->");
              $$renderer3.push("<!--]-->");
            }
            $$renderer3.push(` `);
            if (Select_content) {
              $$renderer3.push("<!--[-->");
              Select_content($$renderer3, {
                children: ($$renderer4) => {
                  $$renderer4.push(`<!--[-->`);
                  const each_array_1 = ensure_array_like(nodes);
                  for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
                    let node = each_array_1[$$index_1];
                    if (Select_item) {
                      $$renderer4.push("<!--[-->");
                      Select_item($$renderer4, {
                        value: node,
                        children: ($$renderer5) => {
                          $$renderer5.push(`<!---->${escape_html(node)}`);
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
    } else {
      $$renderer2.push("<!--[-1-->");
      Input($$renderer2, {
        id: "lxc-node",
        placeholder: "pve1",
        value: value.node,
        oninput: (e) => patch({ node: e.currentTarget.value })
      });
    }
    $$renderer2.push(`<!--]--> `);
    if (errors.node) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="text-[13px] text-destructive">${escape_html(errors.node)}</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> <div class="flex flex-col gap-1.5"><div class="flex items-center gap-1.5">`);
    Label($$renderer2, {
      for: "lxc-storage",
      children: ($$renderer3) => {
        $$renderer3.push(`<!---->Storage`);
      },
      $$slots: { default: true }
    });
    $$renderer2.push(`<!----> `);
    HelpTooltip($$renderer2, {
      label: "Storage",
      text: "The storage pool the container's root disk is created on. Only storages that can hold a container root filesystem are listed."
    });
    $$renderer2.push(`<!----></div> `);
    if (storages.length > 0) {
      $$renderer2.push("<!--[0-->");
      if (Select) {
        $$renderer2.push("<!--[-->");
        Select($$renderer2, {
          type: "single",
          value: value.storage || void 0,
          onValueChange: (v) => patch({ storage: v ?? "" }),
          children: ($$renderer3) => {
            if (Select_trigger) {
              $$renderer3.push("<!--[-->");
              Select_trigger($$renderer3, {
                id: "lxc-storage",
                class: "w-full",
                children: ($$renderer4) => {
                  $$renderer4.push(`<!---->${escape_html(value.storage || "Select storage")}`);
                },
                $$slots: { default: true }
              });
              $$renderer3.push("<!--]-->");
            } else {
              $$renderer3.push("<!--[!-->");
              $$renderer3.push("<!--]-->");
            }
            $$renderer3.push(` `);
            if (Select_content) {
              $$renderer3.push("<!--[-->");
              Select_content($$renderer3, {
                children: ($$renderer4) => {
                  $$renderer4.push(`<!--[-->`);
                  const each_array_2 = ensure_array_like(storages);
                  for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
                    let storage = each_array_2[$$index_2];
                    if (Select_item) {
                      $$renderer4.push("<!--[-->");
                      Select_item($$renderer4, {
                        value: storage,
                        children: ($$renderer5) => {
                          $$renderer5.push(`<!---->${escape_html(storage)}`);
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
    } else {
      $$renderer2.push("<!--[-1-->");
      Input($$renderer2, {
        id: "lxc-storage",
        placeholder: "local-lvm",
        value: value.storage,
        oninput: (e) => patch({ storage: e.currentTarget.value })
      });
    }
    $$renderer2.push(`<!--]--> `);
    if (errors.storage) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="text-[13px] text-destructive">${escape_html(errors.storage)}</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></div> <div class="flex flex-col gap-1.5">`);
    Label($$renderer2, {
      for: "lxc-hostname",
      children: ($$renderer3) => {
        $$renderer3.push(`<!---->Hostname`);
      },
      $$slots: { default: true }
    });
    $$renderer2.push(`<!----> `);
    Input($$renderer2, {
      id: "lxc-hostname",
      placeholder: "web01",
      value: value.hostname,
      oninput: (e) => patch({ hostname: e.currentTarget.value })
    });
    $$renderer2.push(`<!----> `);
    if (errors.hostname) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="text-[13px] text-destructive">${escape_html(errors.hostname)}</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> <div class="grid grid-cols-1 gap-4 sm:grid-cols-3"><div class="flex flex-col gap-1.5">`);
    Label($$renderer2, {
      for: "lxc-cpu",
      children: ($$renderer3) => {
        $$renderer3.push(`<!---->CPU cores`);
      },
      $$slots: { default: true }
    });
    $$renderer2.push(`<!----> `);
    Input($$renderer2, {
      id: "lxc-cpu",
      type: "number",
      min: "1",
      value: value.cpu_cores,
      oninput: (e) => patch({ cpu_cores: toInt(e.currentTarget.value) })
    });
    $$renderer2.push(`<!----> `);
    if (errors.cpu_cores) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="text-[13px] text-destructive">${escape_html(errors.cpu_cores)}</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> <div class="flex flex-col gap-1.5">`);
    Label($$renderer2, {
      for: "lxc-memory",
      children: ($$renderer3) => {
        $$renderer3.push(`<!---->Memory (MB)`);
      },
      $$slots: { default: true }
    });
    $$renderer2.push(`<!----> `);
    Input($$renderer2, {
      id: "lxc-memory",
      type: "number",
      min: "1",
      value: value.memory_mb,
      oninput: (e) => patch({ memory_mb: toInt(e.currentTarget.value) })
    });
    $$renderer2.push(`<!----> `);
    if (errors.memory_mb) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="text-[13px] text-destructive">${escape_html(errors.memory_mb)}</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> <div class="flex flex-col gap-1.5">`);
    Label($$renderer2, {
      for: "lxc-disk",
      children: ($$renderer3) => {
        $$renderer3.push(`<!---->Disk (GB)`);
      },
      $$slots: { default: true }
    });
    $$renderer2.push(`<!----> `);
    Input($$renderer2, {
      id: "lxc-disk",
      type: "number",
      min: "1",
      value: value.disk_gb,
      oninput: (e) => patch({ disk_gb: toInt(e.currentTarget.value) })
    });
    $$renderer2.push(`<!----> `);
    if (errors.disk_gb) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="text-[13px] text-destructive">${escape_html(errors.disk_gb)}</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></div>    <fieldset class="flex flex-col gap-4 rounded-md border p-4"><legend class="px-1 text-[13px] font-semibold">Container options</legend> <div class="flex items-start justify-between gap-4"><div class="flex flex-col gap-0.5"><div class="flex items-center gap-1.5">`);
    Label($$renderer2, {
      for: "lxc-unprivileged",
      children: ($$renderer3) => {
        $$renderer3.push(`<!---->Unprivileged container`);
      },
      $$slots: { default: true }
    });
    $$renderer2.push(`<!----> `);
    HelpTooltip($$renderer2, {
      label: "Unprivileged container",
      text: "An unprivileged container maps its root to a non-root host user — the recommended, safer default. Disable only when the workload genuinely needs host-level privileges."
    });
    $$renderer2.push(`<!----></div> <p class="text-muted-foreground text-[13px]">Recommended for most workloads.</p></div> `);
    Switch($$renderer2, {
      id: "lxc-unprivileged",
      checked: value.unprivileged,
      onCheckedChange: (v) => patch({ unprivileged: v })
    });
    $$renderer2.push(`<!----></div> <div class="flex items-start justify-between gap-4"><div class="flex flex-col gap-0.5"><div class="flex items-center gap-1.5">`);
    Label($$renderer2, {
      for: "lxc-nesting",
      children: ($$renderer3) => {
        $$renderer3.push(`<!---->Nesting`);
      },
      $$slots: { default: true }
    });
    $$renderer2.push(`<!----> `);
    HelpTooltip($$renderer2, {
      label: "Nesting",
      text: "Nesting lets the container run its own containers (e.g. Docker) or systemd cleanly. Off by default."
    });
    $$renderer2.push(`<!----></div> <p class="text-muted-foreground text-[13px]">Enable to run Docker or nested containers inside this LXC.</p></div> `);
    Switch($$renderer2, {
      id: "lxc-nesting",
      checked: value.nesting,
      onCheckedChange: (v) => patch({ nesting: v })
    });
    $$renderer2.push(`<!----></div> <div class="flex flex-col gap-2"><div class="flex items-center gap-1.5"><span class="text-[14px] font-medium">Features</span> `);
    HelpTooltip($$renderer2, {
      label: "Features",
      text: "Extra container features. keyctl exposes the kernel keyring (some apps need it); fuse allows FUSE-based filesystem mounts."
    });
    $$renderer2.push(`<!----></div> <div class="flex flex-col gap-2"><!--[-->`);
    const each_array_3 = ensure_array_like(LXC_FEATURE_FLAGS);
    for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
      let flag = each_array_3[$$index_3];
      $$renderer2.push(`<div class="flex items-center gap-2">`);
      Checkbox($$renderer2, {
        id: `lxc-feature-${flag}`,
        checked: value.features.includes(flag),
        onCheckedChange: (v) => toggleFeature(flag, v === true)
      });
      $$renderer2.push(`<!----> `);
      Label($$renderer2, {
        for: `lxc-feature-${flag}`,
        class: "font-normal",
        children: ($$renderer3) => {
          $$renderer3.push(`<!---->${escape_html(flag)}`);
        },
        $$slots: { default: true }
      });
      $$renderer2.push(`<!----></div>`);
    }
    $$renderer2.push(`<!--]--></div></div></fieldset></section>`);
  });
}
function gb(mb) {
  const value = mb / 1024;
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} GB`;
}
function computeNodeFit(request, nodes) {
  return nodes.map((n) => {
    if (n.freeRamMb !== null && n.freeRamMb < request.requestedRamMb) {
      return {
        node: n.node,
        fits: false,
        reason: `${n.node} — ${gb(n.freeRamMb)} free, needs ${gb(
          request.requestedRamMb
        )}`
      };
    }
    if (n.freeCpu !== null && n.freeCpu < request.requestedCpu) {
      return {
        node: n.node,
        fits: false,
        reason: `${n.node} — ${n.freeCpu} vCPU free, needs ${request.requestedCpu}`
      };
    }
    return { node: n.node, fits: true, reason: null };
  });
}
function allBlocked(fits) {
  return fits.length > 0 && fits.every((f) => !f.fits);
}
function NodeSelect($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      nodes = [],
      value = "",
      requestedCpu,
      requestedRamMb,
      error,
      onChange,
      onBlockedChange
    } = $$props;
    const nodeFit = derived(() => computeNodeFit({ requestedCpu, requestedRamMb }, nodes));
    const blocked = derived(() => allBlocked(nodeFit()));
    const fitByNode = derived(() => new Map(nodeFit().map((f) => [f.node, f])));
    $$renderer2.push(`<div class="flex flex-col gap-1.5"><div class="flex items-center gap-1.5">`);
    Label($$renderer2, {
      for: "node-select",
      children: ($$renderer3) => {
        $$renderer3.push(`<!---->Target node`);
      },
      $$slots: { default: true }
    });
    $$renderer2.push(`<!----> `);
    HelpTooltip($$renderer2, {
      label: "Target node",
      text: "The Proxmox host this resource runs on. A node that doesn't have enough free CPU or memory for this size is shown disabled."
    });
    $$renderer2.push(`<!----></div> `);
    if (blocked()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="bg-warning/10 border-warning/30 flex items-start gap-2 rounded-md border p-3">`);
      Triangle_alert($$renderer2, {
        class: "text-warning mt-0.5 size-4 shrink-0",
        "aria-hidden": "true"
      });
      $$renderer2.push(`<!----> <p class="text-foreground text-[13px]">No node currently has room for this size. Reduce CPU or memory, or try
        again later.</p></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (nodes.length > 0) {
      $$renderer2.push("<!--[0-->");
      if (Select) {
        $$renderer2.push("<!--[-->");
        Select($$renderer2, {
          type: "single",
          value: value || void 0,
          onValueChange: (v) => v && onChange?.(v),
          children: ($$renderer3) => {
            if (Select_trigger) {
              $$renderer3.push("<!--[-->");
              Select_trigger($$renderer3, {
                id: "node-select",
                class: "w-full",
                children: ($$renderer4) => {
                  $$renderer4.push(`<!---->${escape_html(value || "Select a node")}`);
                },
                $$slots: { default: true }
              });
              $$renderer3.push("<!--]-->");
            } else {
              $$renderer3.push("<!--[!-->");
              $$renderer3.push("<!--]-->");
            }
            $$renderer3.push(` `);
            if (Select_content) {
              $$renderer3.push("<!--[-->");
              Select_content($$renderer3, {
                children: ($$renderer4) => {
                  $$renderer4.push(`<!--[-->`);
                  const each_array = ensure_array_like(nodes);
                  for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
                    let n = each_array[$$index];
                    const fit = fitByNode().get(n.node);
                    if (Select_item) {
                      $$renderer4.push("<!--[-->");
                      Select_item($$renderer4, {
                        value: n.node,
                        disabled: fit ? !fit.fits : false,
                        class: fit && !fit.fits ? "opacity-50" : "",
                        children: ($$renderer5) => {
                          $$renderer5.push(`<span class="flex flex-col gap-0.5"><span>${escape_html(n.node)}</span> `);
                          if (fit && !fit.fits && fit.reason) {
                            $$renderer5.push("<!--[0-->");
                            $$renderer5.push(`<span class="text-muted-foreground text-[13px] font-medium">${escape_html(fit.reason)}</span>`);
                          } else {
                            $$renderer5.push("<!--[-1-->");
                          }
                          $$renderer5.push(`<!--]--></span>`);
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
    } else {
      $$renderer2.push("<!--[-1-->");
      Input($$renderer2, {
        id: "node-select",
        placeholder: "pve1",
        value,
        oninput: (e) => onChange?.(e.currentTarget.value)
      });
    }
    $$renderer2.push(`<!--]--> `);
    if (error) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="text-destructive text-[13px]">${escape_html(error)}</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
function sourceKindForPath(path) {
  switch (path) {
    case "cloud-image":
      return "cloud-image";
    case "template-clone":
      return "template-clone";
    case "blank-iso":
      return "blank-iso";
    case "vm-clone":
      return "vm-clone";
    default:
      throw new Error(`sourceKindForPath: ${path} is not a VM path`);
  }
}
function isClonePath(path) {
  return path === "template-clone" || path === "vm-clone";
}
function isVmPath(path) {
  return path === "cloud-image" || path === "template-clone" || path === "blank-iso" || path === "vm-clone";
}
function computeQuotaDelta(request, budget) {
  const deltaCpu = request.cpu;
  const deltaRamGb = Math.round(request.ramMb / 1024 * 10) / 10;
  let overQuota = false;
  if (budget) {
    if (budget.limitCpu !== null && budget.usedCpu + deltaCpu > budget.limitCpu) {
      overQuota = true;
    }
    if (budget.limitRamGb !== null && budget.usedRamGb + deltaRamGb > budget.limitRamGb) {
      overQuota = true;
    }
  }
  return {
    deltaCpu,
    deltaRamGb,
    overQuota,
    label: `+${deltaCpu} vCPU, +${deltaRamGb} GB RAM`
  };
}
function asString(v) {
  return typeof v === "string" ? v.trim() : "";
}
function asPositiveInt(v) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}
function validateVmStep(step, path, formData) {
  const errors = {};
  if (step === "source") {
    switch (path) {
      case "cloud-image":
        if (!asString(formData.image_id)) {
          errors.image_id = "Pick a cloud image to continue.";
        }
        break;
      case "blank-iso":
        if (!asString(formData.iso_volid)) {
          errors.iso_volid = "Pick an installation ISO to continue.";
        }
        break;
      case "template-clone":
      case "vm-clone":
        if (asPositiveInt(formData.source_vmid) === null) {
          errors.source_vmid = path === "template-clone" ? "Pick a template to clone." : "Pick a VM to clone.";
        }
        break;
    }
    return errors;
  }
  if (step === "resources") {
    if (!asString(formData.name)) errors.name = "Enter a name for the VM.";
    if (!asString(formData.node)) errors.node = "Pick a target node.";
    if (!isClonePath(path)) {
      if (!asString(formData.storage)) errors.storage = "Pick a storage.";
      if (asPositiveInt(formData.cpu_cores) === null) {
        errors.cpu_cores = "CPU cores must be a positive whole number.";
      }
      if (asPositiveInt(formData.memory_mb) === null) {
        errors.memory_mb = "Memory must be a positive whole number.";
      }
      if (asPositiveInt(formData.disk_gb) === null) {
        errors.disk_gb = "Disk size must be a positive whole number.";
      }
    }
    return errors;
  }
  return errors;
}
function vmStepValid(step, path, formData) {
  return Object.keys(validateVmStep(step, path, formData)).length === 0;
}
function readNetwork(formData) {
  const net = formData.network;
  if (net && typeof net === "object") return net;
  return null;
}
function buildQemuRequest(formData, teamId, path) {
  const source_kind = sourceKindForPath(path);
  const base = {
    team_id: teamId,
    source_kind,
    node: asString(formData.node),
    name: asString(formData.name),
    network: readNetwork(formData)
  };
  if (source_kind === "cloud-image") {
    return {
      ...base,
      storage: asString(formData.storage) || null,
      cpu_cores: asPositiveInt(formData.cpu_cores),
      memory_mb: asPositiveInt(formData.memory_mb),
      disk_gb: asPositiveInt(formData.disk_gb),
      image_id: asString(formData.image_id) || null,
      ci_user: asString(formData.ci_user) || null,
      ci_password: asString(formData.ci_password) || null,
      ssh_public_keys: asString(formData.ssh_public_keys) || null
    };
  }
  if (source_kind === "blank-iso") {
    return {
      ...base,
      storage: asString(formData.storage) || null,
      cpu_cores: asPositiveInt(formData.cpu_cores),
      memory_mb: asPositiveInt(formData.memory_mb),
      disk_gb: asPositiveInt(formData.disk_gb),
      iso_volid: asString(formData.iso_volid) || null
    };
  }
  const clone_mode = formData.clone_mode === "full" ? "full" : "linked";
  return {
    ...base,
    source_vmid: asPositiveInt(formData.source_vmid),
    clone_mode
  };
}
function mapQemuCreateError(err) {
  const e = err;
  const detail = (e?.detail ?? "").toLowerCase();
  if (e?.status === 409) {
    return detail ? `This would exceed your team's quota: ${e.detail}` : "This would exceed your team's quota. Reduce the size and try again.";
  }
  if (e?.status === 403) {
    return "You don't have permission to provision into this team or cluster, or to clone that source.";
  }
  if (e?.status === 422) {
    return "Please check the wizard fields and try again.";
  }
  if (e?.status === 404) {
    return "The selected image, ISO, template, or source VM is no longer available.";
  }
  return "Couldn't start the create job. Try again.";
}
function QuotaDeltaLine($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      requestedCpu,
      requestedRamMb,
      budget = null,
      onOverQuotaChange
    } = $$props;
    const delta = derived(() => computeQuotaDelta({ cpu: requestedCpu, ramMb: requestedRamMb }, budget));
    $$renderer2.push(`<div class="flex items-center gap-1.5"><p${attr_class(`text-[13px] font-medium ${stringify(
      /** Signal the over-quota state up to the Resources step. */
      delta().overQuota ? "text-destructive" : "text-muted-foreground"
    )}`)}>${escape_html(delta().overQuota ? `${delta().label} — over quota` : delta().label)}</p> `);
    if (delta().overQuota) {
      $$renderer2.push("<!--[0-->");
      HelpTooltip($$renderer2, {
        label: "Over quota",
        text: "This size would push your team past its CPU or memory quota on this cluster. Reduce the size, or ask an administrator to raise the limit."
      });
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
function Radio_group($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      ref = null,
      class: className,
      value = "",
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      if (Radio_group$1) {
        $$renderer3.push("<!--[-->");
        Radio_group$1($$renderer3, spread_props([
          {
            "data-slot": "radio-group",
            class: cn("grid gap-2 w-full", className)
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
function Circle($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [["circle", { "cx": "12", "cy": "12", "r": "10" }]];
  Icon($$renderer, spread_props([{ name: "circle" }, props, { iconNode }]));
}
function Radio_group_item($$renderer, $$props) {
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
      {
        let children = function($$renderer4, { checked }) {
          $$renderer4.push(`<div data-slot="radio-group-indicator" class="flex size-4 items-center justify-center">`);
          if (checked) {
            $$renderer4.push("<!--[0-->");
            Circle($$renderer4, {
              class: "bg-primary-foreground absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            });
          } else {
            $$renderer4.push("<!--[-1-->");
          }
          $$renderer4.push(`<!--]--></div>`);
        };
        if (Radio_group_item$1) {
          $$renderer3.push("<!--[-->");
          Radio_group_item$1($$renderer3, spread_props([
            {
              "data-slot": "radio-group-item",
              class: cn("border-input dark:bg-input/30 data-checked:bg-primary data-checked:text-primary-foreground dark:data-checked:bg-primary data-checked:border-primary aria-invalid:aria-checked:border-primary aria-invalid:border-destructive focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 dark:aria-invalid:border-destructive/50 flex size-4 rounded-full focus-visible:ring-3 aria-invalid:ring-3 group/radio-group-item peer relative aspect-square shrink-0 border outline-none after:absolute after:-inset-x-3 after:-inset-y-2 disabled:cursor-not-allowed disabled:opacity-50", className)
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
              children,
              $$slots: { default: true }
            }
          ]));
          $$renderer3.push("<!--]-->");
        } else {
          $$renderer3.push("<!--[!-->");
          $$renderer3.push("<!--]-->");
        }
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
function NetworkPicker($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { clusterId, value = null, onChange, onBlockedChange } = $$props;
    const initial = run(() => value);
    initial?.id ?? "";
    initial?.ip_mode === "static" ? "auto" : "dhcp";
    initial?.ip_cidr ?? "";
    initial?.gateway ?? "";
    $$renderer2.push(`<section class="flex flex-col gap-5"><header class="flex flex-col gap-1"><h2 class="text-[18px] font-semibold leading-tight tracking-tight">Network</h2> <p class="text-muted-foreground text-[14px]">Choose a network and how this resource gets its IP address.</p></header> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="text-muted-foreground text-[13px]">Loading networks…</p>`);
    }
    $$renderer2.push(`<!--]--></section>`);
  });
}
function File_down($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    [
      "path",
      {
        "d": "M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"
      }
    ],
    ["path", { "d": "M14 2v5a1 1 0 0 0 1 1h5" }],
    ["path", { "d": "M12 18v-6" }],
    ["path", { "d": "m9 15 3 3 3-3" }]
  ];
  Icon($$renderer, spread_props([{ name: "file-down" }, props, { iconNode }]));
}
function filterIsos(isos, query) {
  const q = query.trim().toLowerCase();
  if (!q) return isos;
  return isos.filter(
    (iso) => iso.filename.toLowerCase().includes(q) || iso.storage.toLowerCase().includes(q)
  );
}
function filenameFromUrl(url) {
  const trimmed = url.trim();
  if (!trimmed) return "download.iso";
  const noQuery = trimmed.split(/[?#]/)[0];
  const afterHost = noQuery.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]+/i, "");
  const segments = afterHost.split("/").filter(Boolean);
  const tail = segments[segments.length - 1] ?? "";
  return tail || "download.iso";
}
function looksLikeHttpUrl(url) {
  const trimmed = url.trim();
  return /^https?:\/\/\S+$/i.test(trimmed);
}
function buildIsoUrlDownload(args) {
  return {
    team_id: args.teamId,
    node: args.node,
    storage: args.storage,
    url: args.url.trim(),
    content: "iso",
    filename: args.filename?.trim() || filenameFromUrl(args.url)
  };
}
function buildCloudImageDownload(args) {
  return {
    team_id: args.teamId,
    node: args.node,
    storage: args.storage,
    url: args.image.url,
    content: "import",
    filename: filenameFromUrl(args.image.url)
  };
}
function isIsoLibraryEmpty(isos) {
  return isos.length === 0;
}
function IsoLibrary($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      clusterId,
      teamId,
      node,
      storage = "local",
      curated = [],
      value = "",
      error,
      onSelect
    } = $$props;
    let isos = [];
    let query = "";
    const filteredIsos = derived(() => filterIsos(isos, query));
    const isoListEmpty = derived(() => isIsoLibraryEmpty(isos));
    let downloadUrl = "";
    let downloading = false;
    const urlDownloadEnabled = derived(() => !downloading && looksLikeHttpUrl(downloadUrl));
    async function downloadFromUrl() {
      if (!urlDownloadEnabled()) return;
      downloading = true;
      try {
        await api.iso.downloadIso({
          clusterId,
          body: buildIsoUrlDownload({ teamId, node, storage, url: downloadUrl })
        });
        toast(`ISO download started — track progress in Tasks.`);
        downloadUrl = "";
      } catch {
        toast.error("Couldn't queue the ISO download. Check the URL and try again.");
      } finally {
        downloading = false;
      }
    }
    async function downloadCurated(image) {
      if (downloading) return;
      downloading = true;
      try {
        await api.iso.downloadIso({
          clusterId,
          body: buildCloudImageDownload({ teamId, node, storage, image })
        });
        toast(`Downloading ${image.name} — track progress in Tasks.`);
      } catch {
        toast.error(`Couldn't queue the ${image.name} download. Try again.`);
      } finally {
        downloading = false;
      }
    }
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      $$renderer3.push(`<div class="flex flex-col gap-6"><section class="flex flex-col gap-2"><div class="flex items-center gap-1.5">`);
      Label($$renderer3, {
        children: ($$renderer4) => {
          $$renderer4.push(`<!---->ISOs on storage`);
        },
        $$slots: { default: true }
      });
      $$renderer3.push(`<!----> `);
      HelpTooltip($$renderer3, {
        label: "ISOs on storage",
        text: "Installation ISOs already present on a storage that accepts ISO content. Pick one, or download a new one below."
      });
      $$renderer3.push(`<!----></div> `);
      if (isoListEmpty()) {
        $$renderer3.push("<!--[2-->");
        EmptyState($$renderer3, {
          icon: Disc,
          heading: "No ISOs on this storage yet",
          body: "Pick one from the curated list or paste a download URL below."
        });
      } else {
        $$renderer3.push("<!--[-1-->");
        if (Command) {
          $$renderer3.push("<!--[-->");
          Command($$renderer3, {
            shouldFilter: false,
            class: "bg-transparent p-0",
            children: ($$renderer4) => {
              if (Command_input) {
                $$renderer4.push("<!--[-->");
                Command_input($$renderer4, {
                  placeholder: "Search ISOs…",
                  get value() {
                    return query;
                  },
                  set value($$value) {
                    query = $$value;
                    $$settled = false;
                  }
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
        $$renderer3.push(` <div class="rounded-md border">`);
        if (Table) {
          $$renderer3.push("<!--[-->");
          Table($$renderer3, {
            children: ($$renderer4) => {
              if (Table_header) {
                $$renderer4.push("<!--[-->");
                Table_header($$renderer4, {
                  children: ($$renderer5) => {
                    if (Table_row) {
                      $$renderer5.push("<!--[-->");
                      Table_row($$renderer5, {
                        children: ($$renderer6) => {
                          if (Table_head) {
                            $$renderer6.push("<!--[-->");
                            Table_head($$renderer6, {
                              children: ($$renderer7) => {
                                $$renderer7.push(`<!---->Filename`);
                              },
                              $$slots: { default: true }
                            });
                            $$renderer6.push("<!--]-->");
                          } else {
                            $$renderer6.push("<!--[!-->");
                            $$renderer6.push("<!--]-->");
                          }
                          $$renderer6.push(` `);
                          if (Table_head) {
                            $$renderer6.push("<!--[-->");
                            Table_head($$renderer6, {
                              class: "text-right",
                              children: ($$renderer7) => {
                                $$renderer7.push(`<!---->Size`);
                              },
                              $$slots: { default: true }
                            });
                            $$renderer6.push("<!--]-->");
                          } else {
                            $$renderer6.push("<!--[!-->");
                            $$renderer6.push("<!--]-->");
                          }
                          $$renderer6.push(` `);
                          if (Table_head) {
                            $$renderer6.push("<!--[-->");
                            Table_head($$renderer6, {
                              children: ($$renderer7) => {
                                $$renderer7.push(`<!---->Storage`);
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
              if (Table_body) {
                $$renderer4.push("<!--[-->");
                Table_body($$renderer4, {
                  children: ($$renderer5) => {
                    $$renderer5.push(`<!--[-->`);
                    const each_array = ensure_array_like(filteredIsos());
                    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
                      let iso = each_array[$$index];
                      if (Table_row) {
                        $$renderer5.push("<!--[-->");
                        Table_row($$renderer5, {
                          class: `h-12 cursor-pointer ${stringify(value === iso.volid ? "bg-accent/50" : "")}`,
                          onclick: () => onSelect?.(iso.volid),
                          children: ($$renderer6) => {
                            if (Table_cell) {
                              $$renderer6.push("<!--[-->");
                              Table_cell($$renderer6, {
                                class: "font-mono text-[13px]",
                                children: ($$renderer7) => {
                                  $$renderer7.push(`<span class="flex items-center gap-2">`);
                                  if (value === iso.volid) {
                                    $$renderer7.push("<!--[0-->");
                                    Check($$renderer7, { class: "text-primary size-4", "aria-hidden": "true" });
                                  } else {
                                    $$renderer7.push("<!--[-1-->");
                                  }
                                  $$renderer7.push(`<!--]--> <span class="truncate">${escape_html(iso.filename)}</span></span>`);
                                },
                                $$slots: { default: true }
                              });
                              $$renderer6.push("<!--]-->");
                            } else {
                              $$renderer6.push("<!--[!-->");
                              $$renderer6.push("<!--]-->");
                            }
                            $$renderer6.push(` `);
                            if (Table_cell) {
                              $$renderer6.push("<!--[-->");
                              Table_cell($$renderer6, {
                                class: "text-right text-[14px]",
                                style: "font-variant-numeric: tabular-nums;",
                                children: ($$renderer7) => {
                                  $$renderer7.push(`<!---->${escape_html(formatBytes(iso.size))}`);
                                },
                                $$slots: { default: true }
                              });
                              $$renderer6.push("<!--]-->");
                            } else {
                              $$renderer6.push("<!--[!-->");
                              $$renderer6.push("<!--]-->");
                            }
                            $$renderer6.push(` `);
                            if (Table_cell) {
                              $$renderer6.push("<!--[-->");
                              Table_cell($$renderer6, {
                                class: "text-[14px]",
                                children: ($$renderer7) => {
                                  $$renderer7.push(`<!---->${escape_html(iso.storage)}`);
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
                    }
                    $$renderer5.push(`<!--]--> `);
                    if (filteredIsos().length === 0) {
                      $$renderer5.push("<!--[0-->");
                      if (Table_row) {
                        $$renderer5.push("<!--[-->");
                        Table_row($$renderer5, {
                          children: ($$renderer6) => {
                            if (Table_cell) {
                              $$renderer6.push("<!--[-->");
                              Table_cell($$renderer6, {
                                colspan: 3,
                                class: "text-muted-foreground text-center text-[13px]",
                                children: ($$renderer7) => {
                                  $$renderer7.push(`<!---->No ISOs match “${escape_html(query)}”.`);
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
            },
            $$slots: { default: true }
          });
          $$renderer3.push("<!--]-->");
        } else {
          $$renderer3.push("<!--[!-->");
          $$renderer3.push("<!--]-->");
        }
        $$renderer3.push(`</div>`);
      }
      $$renderer3.push(`<!--]--> `);
      if (error) {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<p class="text-destructive text-[13px]">${escape_html(error)}</p>`);
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--></section> `);
      if (curated.length > 0) {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<section class="flex flex-col gap-2"><div class="flex items-center gap-1.5">`);
        Label($$renderer3, {
          children: ($$renderer4) => {
            $$renderer4.push(`<!---->Curated ISOs`);
          },
          $$slots: { default: true }
        });
        $$renderer3.push(`<!----> `);
        HelpTooltip($$renderer3, {
          label: "Curated ISOs",
          text: "Common OS install ISOs with known download URLs. Picking one downloads it to storage if it isn't already there."
        });
        $$renderer3.push(`<!----></div> <div class="flex flex-col gap-1.5"><!--[-->`);
        const each_array_1 = ensure_array_like(curated);
        for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
          let image = each_array_1[$$index_1];
          $$renderer3.push(`<div class="flex items-center gap-3 rounded-md border px-3 py-2.5">`);
          Disc($$renderer3, { class: "text-muted-foreground size-4", "aria-hidden": "true" });
          $$renderer3.push(`<!----> <span class="flex flex-1 flex-col gap-0.5"><span class="text-foreground text-[14px] font-medium">${escape_html(image.name)}</span> <span class="text-muted-foreground text-[13px]">${escape_html(image.os_family)}
                ${escape_html(image.version)}</span></span> `);
          Button($$renderer3, {
            variant: "outline",
            size: "sm",
            disabled: downloading,
            onclick: () => downloadCurated(image),
            children: ($$renderer4) => {
              File_down($$renderer4, { class: "size-4", "aria-hidden": "true" });
              $$renderer4.push(`<!----> Download`);
            },
            $$slots: { default: true }
          });
          $$renderer3.push(`<!----></div>`);
        }
        $$renderer3.push(`<!--]--></div></section>`);
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--> <section class="flex flex-col gap-2"><div class="flex items-center gap-1.5">`);
      Label($$renderer3, {
        for: "iso-url",
        children: ($$renderer4) => {
          $$renderer4.push(`<!---->Download by URL`);
        },
        $$slots: { default: true }
      });
      $$renderer3.push(`<!----> `);
      HelpTooltip($$renderer3, {
        label: "Download by URL",
        text: "Paste a direct http(s) link to an ISO. Proxmox fetches it onto storage — the download runs as a background job you can track in Tasks."
      });
      $$renderer3.push(`<!----> `);
      Badge($$renderer3, {
        variant: "outline",
        class: "text-[11px] font-normal",
        children: ($$renderer4) => {
          $$renderer4.push(`<!---->Any user`);
        },
        $$slots: { default: true }
      });
      $$renderer3.push(`<!----></div> <div class="flex items-center gap-2">`);
      Input($$renderer3, {
        id: "iso-url",
        type: "url",
        placeholder: "https://example.com/path/to/install.iso",
        class: "flex-1",
        get value() {
          return downloadUrl;
        },
        set value($$value) {
          downloadUrl = $$value;
          $$settled = false;
        }
      });
      $$renderer3.push(`<!----> `);
      Button($$renderer3, {
        disabled: !urlDownloadEnabled(),
        onclick: downloadFromUrl,
        children: ($$renderer4) => {
          Download($$renderer4, { class: "size-4", "aria-hidden": "true" });
          $$renderer4.push(`<!----> Download ISO`);
        },
        $$slots: { default: true }
      });
      $$renderer3.push(`<!----></div> <p class="text-muted-foreground text-[12px]">The download stages onto <span class="font-medium">${escape_html(storage)}</span> and
      appears in Tasks. Anyone on the team can download an ISO.</p></section></div>`);
    }
    do {
      $$settled = true;
      $$inner_renderer = $$renderer2.copy();
      $$render_inner($$inner_renderer);
    } while (!$$settled);
    $$renderer2.subsume($$inner_renderer);
  });
}
function VmSourceStep($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      sourceKind,
      clusterId,
      teamId,
      node = "",
      templates = [],
      sourceVms = [],
      value,
      errors = {},
      onChange
    } = $$props;
    function patch(part) {
      onChange?.({ ...value, ...part });
    }
    let cloudImages = [];
    const cloneSources = derived(() => sourceKind === "template-clone" ? templates : sourceVms);
    const cloneSourceLabel = derived(() => cloneSources().find((s) => s.vmid === value.source_vmid)?.name ?? (value.source_vmid > 0 ? `VMID ${value.source_vmid}` : sourceKind === "template-clone" ? "Select a template" : "Select a VM"));
    const initialVmid = run(() => value.source_vmid);
    let vmidText = initialVmid > 0 ? String(initialVmid) : "";
    $$renderer2.push(`<section class="flex flex-col gap-5">`);
    if (sourceKind === "cloud-image") {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<header class="flex flex-col gap-1"><h2 class="text-[18px] font-semibold leading-tight tracking-tight">Pick a cloud image</h2> <p class="text-muted-foreground text-[14px]">Choose an OS image. It downloads to storage if it isn't already there.</p></header> `);
      if (cloudImages.length === 0) {
        $$renderer2.push("<!--[2-->");
        EmptyState($$renderer2, {
          icon: Disc,
          heading: "No cloud images available",
          body: "No curated cloud images are configured for this cluster."
        });
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<div class="flex flex-col gap-2">`);
        if (Radio_group) {
          $$renderer2.push("<!--[-->");
          Radio_group($$renderer2, {
            value: value.image_id,
            onValueChange: (v) => patch({ image_id: v }),
            children: ($$renderer3) => {
              $$renderer3.push(`<!--[-->`);
              const each_array = ensure_array_like(cloudImages);
              for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
                let image = each_array[$$index];
                $$renderer3.push(`<label${attr_class(`flex items-center gap-3 rounded-md border px-3 py-2.5 ${stringify(value.image_id === image.id ? "border-primary bg-accent/40" : "")}`)}>`);
                if (Radio_group_item) {
                  $$renderer3.push("<!--[-->");
                  Radio_group_item($$renderer3, { value: image.id });
                  $$renderer3.push("<!--]-->");
                } else {
                  $$renderer3.push("<!--[!-->");
                  $$renderer3.push("<!--]-->");
                }
                $$renderer3.push(` <span class="flex flex-1 flex-col gap-0.5"><span class="text-foreground text-[14px] font-medium">${escape_html(image.name)}</span> <span class="text-muted-foreground text-[13px]">${escape_html(image.os_family)}
                  ${escape_html(image.version)}</span></span></label>`);
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
        $$renderer2.push(` `);
        if (errors.image_id) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<p class="text-destructive text-[13px]">${escape_html(errors.image_id)}</p>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></div>`);
      }
      $$renderer2.push(`<!--]-->`);
    } else if (sourceKind === "blank-iso") {
      $$renderer2.push("<!--[1-->");
      $$renderer2.push(`<header class="flex flex-col gap-1"><h2 class="text-[18px] font-semibold leading-tight tracking-tight">Pick an installation ISO</h2> <p class="text-muted-foreground text-[14px]">Browse ISOs on storage, pick a curated one, or download one by URL.</p></header> `);
      IsoLibrary($$renderer2, {
        clusterId,
        teamId,
        node,
        curated: cloudImages,
        value: value.iso_volid,
        error: errors.iso_volid,
        onSelect: (volid) => patch({ iso_volid: volid })
      });
      $$renderer2.push(`<!---->`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<header class="flex flex-col gap-1"><h2 class="text-[18px] font-semibold leading-tight tracking-tight">${escape_html(sourceKind === "template-clone" ? "Pick a template to clone" : "Pick a VM to clone")}</h2> <p class="text-muted-foreground text-[14px]">${escape_html(sourceKind === "template-clone" ? "Choose an existing Proxmox template." : "Choose an existing VM to copy.")}</p></header> <div class="flex flex-col gap-1.5"><div class="flex items-center gap-1.5">`);
      Label($$renderer2, {
        for: "vm-clone-source",
        children: ($$renderer3) => {
          $$renderer3.push(`<!---->${escape_html(sourceKind === "template-clone" ? "Template" : "Source VM")}`);
        },
        $$slots: { default: true }
      });
      $$renderer2.push(`<!----> `);
      HelpTooltip($$renderer2, {
        label: sourceKind === "template-clone" ? "Template" : "Source VM",
        text: "The clone copies this source's disks and configuration. Only resources your team can see are listed."
      });
      $$renderer2.push(`<!----></div> `);
      if (cloneSources().length > 0) {
        $$renderer2.push("<!--[0-->");
        if (Select) {
          $$renderer2.push("<!--[-->");
          Select($$renderer2, {
            type: "single",
            value: value.source_vmid > 0 ? String(value.source_vmid) : void 0,
            onValueChange: (v) => v && patch({ source_vmid: Number(v) }),
            children: ($$renderer3) => {
              if (Select_trigger) {
                $$renderer3.push("<!--[-->");
                Select_trigger($$renderer3, {
                  id: "vm-clone-source",
                  class: "w-full",
                  children: ($$renderer4) => {
                    $$renderer4.push(`<!---->${escape_html(cloneSourceLabel())}`);
                  },
                  $$slots: { default: true }
                });
                $$renderer3.push("<!--]-->");
              } else {
                $$renderer3.push("<!--[!-->");
                $$renderer3.push("<!--]-->");
              }
              $$renderer3.push(` `);
              if (Select_content) {
                $$renderer3.push("<!--[-->");
                Select_content($$renderer3, {
                  children: ($$renderer4) => {
                    $$renderer4.push(`<!--[-->`);
                    const each_array_1 = ensure_array_like(cloneSources());
                    for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
                      let src = each_array_1[$$index_1];
                      if (Select_item) {
                        $$renderer4.push("<!--[-->");
                        Select_item($$renderer4, {
                          value: String(src.vmid),
                          children: ($$renderer5) => {
                            $$renderer5.push(`<!---->${escape_html(src.name)} (VMID ${escape_html(src.vmid)}${escape_html(src.node ? ` · ${src.node}` : "")})`);
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
      } else {
        $$renderer2.push("<!--[-1-->");
        Input($$renderer2, {
          id: "vm-clone-source",
          type: "number",
          min: "1",
          placeholder: "9000",
          value: vmidText,
          oninput: (e) => {
            vmidText = e.currentTarget.value;
            patch({ source_vmid: Number(e.currentTarget.value) || 0 });
          }
        });
        $$renderer2.push(`<!----> <p class="text-muted-foreground text-[13px]">Enter the ${escape_html(sourceKind === "template-clone" ? "template" : "VM")}'s VMID.</p>`);
      }
      $$renderer2.push(`<!--]--> `);
      if (errors.source_vmid) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<p class="text-destructive text-[13px]">${escape_html(errors.source_vmid)}</p>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div> <div class="flex flex-col gap-1.5"><div class="flex items-center gap-1.5">`);
      Label($$renderer2, {
        children: ($$renderer3) => {
          $$renderer3.push(`<!---->Clone mode`);
        },
        $$slots: { default: true }
      });
      $$renderer2.push(`<!----> `);
      HelpTooltip($$renderer2, {
        label: "Clone mode",
        text: "A linked clone shares the source's base disk (fast, space-efficient, depends on the source); a full clone is an independent copy."
      });
      $$renderer2.push(`<!----></div> `);
      if (Radio_group) {
        $$renderer2.push("<!--[-->");
        Radio_group($$renderer2, {
          value: value.clone_mode,
          onValueChange: (v) => patch({ clone_mode: v === "full" ? "full" : "linked" }),
          children: ($$renderer3) => {
            $$renderer3.push(`<label class="flex items-center gap-3">`);
            if (Radio_group_item) {
              $$renderer3.push("<!--[-->");
              Radio_group_item($$renderer3, { value: "linked" });
              $$renderer3.push("<!--]-->");
            } else {
              $$renderer3.push("<!--[!-->");
              $$renderer3.push("<!--]-->");
            }
            $$renderer3.push(` <span class="text-[14px]">Linked clone — fast, shares the source disk</span></label> <label class="flex items-center gap-3">`);
            if (Radio_group_item) {
              $$renderer3.push("<!--[-->");
              Radio_group_item($$renderer3, { value: "full" });
              $$renderer3.push("<!--]-->");
            } else {
              $$renderer3.push("<!--[!-->");
              $$renderer3.push("<!--]-->");
            }
            $$renderer3.push(` <span class="text-[14px]">Full clone — an independent copy</span></label>`);
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
    $$renderer2.push(`<!--]--></section>`);
  });
}
function VmResourcesStep($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      isClone = false,
      nodes = [],
      storages = [],
      quotaBudget = null,
      teams = [],
      teamId = null,
      value,
      errors = {},
      onChange,
      onTeamChange
    } = $$props;
    const teamLabel = derived(() => teams.find((t) => t.id === teamId)?.name ?? "Select a team");
    function patch(part) {
      onChange?.({ ...value, ...part });
    }
    function toInt(raw) {
      const n = Number(raw);
      return Number.isFinite(n) ? Math.trunc(n) : 0;
    }
    $$renderer2.push(`<section class="flex flex-col gap-5"><header class="flex flex-col gap-1"><h2 class="text-[18px] font-semibold leading-tight tracking-tight">Resources</h2> <p class="text-muted-foreground text-[14px]">Set the host node, storage, and size for this resource.</p></header> `);
    if (
      /** Surface the combined Next gate up to the route. */
      teams.length > 1
    ) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="flex flex-col gap-1.5"><div class="flex items-center gap-1.5">`);
      Label($$renderer2, {
        for: "vm-team",
        children: ($$renderer3) => {
          $$renderer3.push(`<!---->Owning team`);
        },
        $$slots: { default: true }
      });
      $$renderer2.push(`<!----> `);
      HelpTooltip($$renderer2, {
        label: "Owning team",
        text: "The team this VM counts against for quota and visibility. Only members of the team can see and manage it."
      });
      $$renderer2.push(`<!----></div> `);
      if (Select) {
        $$renderer2.push("<!--[-->");
        Select($$renderer2, {
          type: "single",
          value: teamId != null ? String(teamId) : void 0,
          onValueChange: (v) => v && onTeamChange?.(Number(v)),
          children: ($$renderer3) => {
            if (Select_trigger) {
              $$renderer3.push("<!--[-->");
              Select_trigger($$renderer3, {
                id: "vm-team",
                class: "w-full",
                children: ($$renderer4) => {
                  $$renderer4.push(`<!---->${escape_html(teamLabel())}`);
                },
                $$slots: { default: true }
              });
              $$renderer3.push("<!--]-->");
            } else {
              $$renderer3.push("<!--[!-->");
              $$renderer3.push("<!--]-->");
            }
            $$renderer3.push(` `);
            if (Select_content) {
              $$renderer3.push("<!--[-->");
              Select_content($$renderer3, {
                children: ($$renderer4) => {
                  $$renderer4.push(`<!--[-->`);
                  const each_array = ensure_array_like(teams);
                  for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
                    let team = each_array[$$index];
                    if (Select_item) {
                      $$renderer4.push("<!--[-->");
                      Select_item($$renderer4, {
                        value: String(team.id),
                        children: ($$renderer5) => {
                          $$renderer5.push(`<!---->${escape_html(team.name)}`);
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
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="flex flex-col gap-1.5">`);
    Label($$renderer2, {
      for: "vm-name",
      children: ($$renderer3) => {
        $$renderer3.push(`<!---->Name`);
      },
      $$slots: { default: true }
    });
    $$renderer2.push(`<!----> `);
    Input($$renderer2, {
      id: "vm-name",
      placeholder: "web01",
      value: value.name,
      oninput: (e) => patch({ name: e.currentTarget.value })
    });
    $$renderer2.push(`<!----> `);
    if (errors.name) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="text-destructive text-[13px]">${escape_html(errors.name)}</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">`);
    NodeSelect($$renderer2, {
      nodes,
      value: value.node,
      requestedCpu: value.cpu_cores,
      requestedRamMb: value.memory_mb,
      error: errors.node,
      onChange: (node) => patch({ node }),
      onBlockedChange: (b) => b
    });
    $$renderer2.push(`<!----> `);
    if (!isClone) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="flex flex-col gap-1.5"><div class="flex items-center gap-1.5">`);
      Label($$renderer2, {
        for: "vm-storage",
        children: ($$renderer3) => {
          $$renderer3.push(`<!---->Storage`);
        },
        $$slots: { default: true }
      });
      $$renderer2.push(`<!----> `);
      HelpTooltip($$renderer2, {
        label: "Storage",
        text: "The storage pool the VM's disk is created on. Only storages that can hold a VM disk image are listed."
      });
      $$renderer2.push(`<!----></div> `);
      if (storages.length > 0) {
        $$renderer2.push("<!--[0-->");
        if (Select) {
          $$renderer2.push("<!--[-->");
          Select($$renderer2, {
            type: "single",
            value: value.storage || void 0,
            onValueChange: (v) => v && patch({ storage: v }),
            children: ($$renderer3) => {
              if (Select_trigger) {
                $$renderer3.push("<!--[-->");
                Select_trigger($$renderer3, {
                  id: "vm-storage",
                  class: "w-full",
                  children: ($$renderer4) => {
                    $$renderer4.push(`<!---->${escape_html(value.storage || "Select storage")}`);
                  },
                  $$slots: { default: true }
                });
                $$renderer3.push("<!--]-->");
              } else {
                $$renderer3.push("<!--[!-->");
                $$renderer3.push("<!--]-->");
              }
              $$renderer3.push(` `);
              if (Select_content) {
                $$renderer3.push("<!--[-->");
                Select_content($$renderer3, {
                  children: ($$renderer4) => {
                    $$renderer4.push(`<!--[-->`);
                    const each_array_1 = ensure_array_like(storages);
                    for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
                      let storage = each_array_1[$$index_1];
                      if (Select_item) {
                        $$renderer4.push("<!--[-->");
                        Select_item($$renderer4, {
                          value: storage,
                          children: ($$renderer5) => {
                            $$renderer5.push(`<!---->${escape_html(storage)}`);
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
      } else {
        $$renderer2.push("<!--[-1-->");
        Input($$renderer2, {
          id: "vm-storage",
          placeholder: "local-lvm",
          value: value.storage,
          oninput: (e) => patch({ storage: e.currentTarget.value })
        });
      }
      $$renderer2.push(`<!--]--> `);
      if (errors.storage) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<p class="text-destructive text-[13px]">${escape_html(errors.storage)}</p>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> `);
    if (!isClone) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="grid grid-cols-1 gap-4 sm:grid-cols-3"><div class="flex flex-col gap-1.5"><div class="flex items-center gap-1.5">`);
      Label($$renderer2, {
        for: "vm-cpu",
        children: ($$renderer3) => {
          $$renderer3.push(`<!---->CPU cores`);
        },
        $$slots: { default: true }
      });
      $$renderer2.push(`<!----> `);
      HelpTooltip($$renderer2, {
        label: "CPU cores",
        text: "The number of virtual CPU cores assigned to the VM."
      });
      $$renderer2.push(`<!----></div> `);
      Input($$renderer2, {
        id: "vm-cpu",
        type: "number",
        min: "1",
        value: value.cpu_cores,
        oninput: (e) => patch({ cpu_cores: toInt(e.currentTarget.value) })
      });
      $$renderer2.push(`<!----> `);
      if (errors.cpu_cores) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<p class="text-destructive text-[13px]">${escape_html(errors.cpu_cores)}</p>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div> <div class="flex flex-col gap-1.5"><div class="flex items-center gap-1.5">`);
      Label($$renderer2, {
        for: "vm-memory",
        children: ($$renderer3) => {
          $$renderer3.push(`<!---->Memory (MB)`);
        },
        $$slots: { default: true }
      });
      $$renderer2.push(`<!----> `);
      HelpTooltip($$renderer2, {
        label: "Memory",
        text: "The RAM assigned to the VM, in megabytes."
      });
      $$renderer2.push(`<!----></div> `);
      Input($$renderer2, {
        id: "vm-memory",
        type: "number",
        min: "1",
        value: value.memory_mb,
        oninput: (e) => patch({ memory_mb: toInt(e.currentTarget.value) })
      });
      $$renderer2.push(`<!----> `);
      if (errors.memory_mb) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<p class="text-destructive text-[13px]">${escape_html(errors.memory_mb)}</p>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div> <div class="flex flex-col gap-1.5"><div class="flex items-center gap-1.5">`);
      Label($$renderer2, {
        for: "vm-disk",
        children: ($$renderer3) => {
          $$renderer3.push(`<!---->Disk (GB)`);
        },
        $$slots: { default: true }
      });
      $$renderer2.push(`<!----> `);
      HelpTooltip($$renderer2, {
        label: "Disk",
        text: "The size of the VM's primary disk, in gigabytes."
      });
      $$renderer2.push(`<!----></div> `);
      Input($$renderer2, {
        id: "vm-disk",
        type: "number",
        min: "1",
        value: value.disk_gb,
        oninput: (e) => patch({ disk_gb: toInt(e.currentTarget.value) })
      });
      $$renderer2.push(`<!----> `);
      if (errors.disk_gb) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<p class="text-destructive text-[13px]">${escape_html(errors.disk_gb)}</p>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div></div> `);
      QuotaDeltaLine($$renderer2, {
        requestedCpu: value.cpu_cores,
        requestedRamMb: value.memory_mb,
        budget: quotaBudget,
        onOverQuotaChange: (o) => o
      });
      $$renderer2.push(`<!---->`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<p class="text-muted-foreground text-[13px]">A clone copies the source's CPU, memory, and disks. You can resize the new
      VM after it is created.</p>`);
    }
    $$renderer2.push(`<!--]--></section>`);
  });
}
function ReviewStep($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      sections,
      requestedCpu = 0,
      requestedRamMb = 0,
      quotaBudget = null,
      submitError = null,
      onEdit
    } = $$props;
    const showQuotaDelta = derived(() => requestedCpu > 0 && requestedRamMb > 0);
    $$renderer2.push(`<section class="flex flex-col gap-4"><header class="flex flex-col gap-1"><h2 class="text-[18px] font-semibold leading-tight tracking-tight">Review and create</h2> <p class="text-muted-foreground text-[14px]">Check the configuration, then create your resource.</p></header> <!--[-->`);
    const each_array = ensure_array_like(sections);
    for (let $$index_1 = 0, $$length = each_array.length; $$index_1 < $$length; $$index_1++) {
      let section = each_array[$$index_1];
      if (Card) {
        $$renderer2.push("<!--[-->");
        Card($$renderer2, {
          class: "p-0",
          children: ($$renderer3) => {
            $$renderer3.push(`<div class="flex items-center justify-between border-b px-4 py-2.5"><h3 class="text-[14px] font-semibold">${escape_html(section.title)}</h3> `);
            Button($$renderer3, {
              variant: "link",
              class: "h-auto p-0 text-[13px]",
              onclick: () => onEdit?.(section.editStep),
              children: ($$renderer4) => {
                $$renderer4.push(`<!---->Edit`);
              },
              $$slots: { default: true }
            });
            $$renderer3.push(`<!----></div> <dl class="divide-border divide-y"><!--[-->`);
            const each_array_1 = ensure_array_like(section.rows);
            for (let $$index = 0, $$length2 = each_array_1.length; $$index < $$length2; $$index++) {
              let row = each_array_1[$$index];
              $$renderer3.push(`<div class="flex items-center justify-between gap-4 px-4 py-2"><dt class="text-muted-foreground text-[13px]">${escape_html(row.label)}</dt> <dd class="text-[14px] font-medium">${escape_html(row.value)}</dd></div>`);
            }
            $$renderer3.push(`<!--]--></dl>`);
          },
          $$slots: { default: true }
        });
        $$renderer2.push("<!--]-->");
      } else {
        $$renderer2.push("<!--[!-->");
        $$renderer2.push("<!--]-->");
      }
    }
    $$renderer2.push(`<!--]--> `);
    if (showQuotaDelta()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="flex items-center justify-between gap-4 px-1"><span class="text-muted-foreground text-[13px]">This resource adds</span> `);
      QuotaDeltaLine($$renderer2, { requestedCpu, requestedRamMb, budget: quotaBudget });
      $$renderer2.push(`<!----></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (submitError) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="bg-destructive/10 rounded-md p-3"><p class="text-destructive text-[13px]">${escape_html(submitError)}</p></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></section>`);
  });
}
function CloudInitYamlPane($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { lines = [], loading = false } = $$props;
    $$renderer2.push(`<div class="flex h-full flex-col gap-1.5"><div class="flex items-center justify-between"><span class="text-foreground text-[13px] font-medium">Effective cloud-config</span> `);
    if (loading) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<span class="text-muted-foreground text-[12px]">Updating…</span>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> <pre class="bg-muted text-foreground h-full max-h-[28rem] overflow-auto whitespace-pre rounded-md p-3 font-mono text-[13px] leading-relaxed" aria-label="Effective cloud-config preview" role="region">`);
    if (lines.length === 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<span class="text-muted-foreground">${escape_html(loading ? "Rendering the cloud-config…" : "Fill in the form to see the effective cloud-config.")}</span>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<!--[-->`);
      const each_array = ensure_array_like(lines);
      for (let i = 0, $$length = each_array.length; i < $$length; i++) {
        let line = each_array[i];
        $$renderer2.push(`<span${attr_class(`block ${stringify(line.injected ? "text-muted-foreground" : "")}`)}>${escape_html(line.text)}`);
        if (line.injected) {
          $$renderer2.push("<!--[0-->");
          Badge($$renderer2, {
            variant: "outline",
            class: "ml-2 align-middle text-[11px] font-normal",
            children: ($$renderer3) => {
              $$renderer3.push(`<!---->PVE default`);
            },
            $$slots: { default: true }
          });
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></span>`);
      }
      $$renderer2.push(`<!--]-->`);
    }
    $$renderer2.push(`<!--]--></pre> <p class="text-muted-foreground text-[12px]">Dimmed lines marked `);
    Badge($$renderer2, {
      variant: "outline",
      class: "text-[11px] font-normal",
      children: ($$renderer3) => {
        $$renderer3.push(`<!---->PVE default`);
      },
      $$slots: { default: true }
    });
    $$renderer2.push(`<!----> are Proxmox-injected defaults you did not set.</p></div>`);
  });
}
const CLOUD_INIT_IP_MODES = ["auto", "dhcp", "static", "none"];
function cloudInitFormDefaults() {
  return {
    ciuser: "",
    cipassword: "",
    sshKeyIds: [],
    ipMode: "dhcp",
    ipAddress: "",
    gateway: "",
    nameservers: [],
    packages: [],
    runcmd: []
  };
}
function resolveSshKeys(selectedIds, catalogue) {
  const byId = new Map(catalogue.map((k) => [k.id, k]));
  const out = [];
  for (const id of selectedIds) {
    const key = byId.get(id);
    if (key && key.publicKey.trim()) out.push(key.publicKey.trim());
  }
  return out;
}
function groupSshKeysByOwner(catalogue) {
  const groups = /* @__PURE__ */ new Map();
  for (const key of catalogue) {
    const bucket = groups.get(key.owner);
    if (bucket) bucket.push(key);
    else groups.set(key.owner, [key]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([owner, keys]) => ({ owner, keys }));
}
function toQemuCloudInitFields(form, catalogue) {
  const keys = resolveSshKeys(form.sshKeyIds, catalogue);
  return {
    ci_user: form.ciuser.trim() || null,
    ci_password: form.cipassword || null,
    ssh_public_keys: keys.length ? keys.join("\n") : null
  };
}
function cloudInitBlocksNext(verdict) {
  return verdict !== null && verdict.hard_errors.length > 0;
}
function hardErrorFor(verdict, field) {
  return null;
}
function linesToList(raw) {
  return raw.split("\n").map((l) => l.trim()).filter(Boolean);
}
function listToLines(list) {
  return list.join("\n");
}
function CloudInitEditor($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      sshKeys = [],
      value = cloudInitFormDefaults(),
      onChange
    } = $$props;
    const sshGroups = derived(() => groupSshKeysByOwner(sshKeys));
    let lines = [];
    let verdict = null;
    let previewing = false;
    const blocksNext = derived(() => cloudInitBlocksNext(verdict));
    function patch(part) {
      onChange?.({ ...value, ...part });
    }
    function toggleKey(id, checked) {
      const next = checked ? [...value.sshKeyIds, id] : value.sshKeyIds.filter((k) => k !== id);
      patch({ sshKeyIds: next });
    }
    const showStaticIp = derived(() => value.ipMode === "static");
    const ipModeLabel = derived(() => value.ipMode.charAt(0).toUpperCase() + value.ipMode.slice(1));
    const ciuserError = derived(() => hardErrorFor());
    const cipasswordError = derived(() => hardErrorFor());
    const ipAddressError = derived(() => hardErrorFor());
    const gatewayError = derived(() => hardErrorFor());
    const ipconfigError = derived(() => hardErrorFor());
    const sshkeysError = derived(() => hardErrorFor());
    $$renderer2.push(`<section class="flex w-full flex-col gap-5"><header class="flex flex-col gap-1"><h2 class="text-[18px] font-semibold leading-tight tracking-tight">Cloud-Init</h2> <p class="text-muted-foreground text-[14px]">Set the VM's first-boot user, SSH keys and network. The preview on the
      right shows the effective cloud-config — dimmed lines are Proxmox
      defaults.</p></header> `);
    if (blocksNext() && verdict) ;
    else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="grid gap-6 lg:grid-cols-2"><div class="flex flex-col gap-4"><div class="flex flex-col gap-1.5"><div class="flex items-center gap-1.5">`);
    Label($$renderer2, {
      for: "ci-user",
      children: ($$renderer3) => {
        $$renderer3.push(`<!---->First-boot user`);
      },
      $$slots: { default: true }
    });
    $$renderer2.push(`<!----> `);
    HelpTooltip($$renderer2, {
      label: "First-boot user",
      text: "The cloud-init user account created on first boot (the `ciuser` field). Leave blank to use the image's default account."
    });
    $$renderer2.push(`<!----></div> `);
    Input($$renderer2, {
      id: "ci-user",
      placeholder: "ubuntu",
      value: value.ciuser,
      "aria-invalid": ciuserError() ? "true" : void 0,
      oninput: (e) => patch({ ciuser: e.currentTarget.value })
    });
    $$renderer2.push(`<!----> `);
    if (ciuserError()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="text-destructive text-[13px]">${escape_html(ciuserError())}</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> <div class="flex flex-col gap-1.5"><div class="flex items-center gap-1.5">`);
    Label($$renderer2, {
      for: "ci-password",
      children: ($$renderer3) => {
        $$renderer3.push(`<!---->Password`);
      },
      $$slots: { default: true }
    });
    $$renderer2.push(`<!----> `);
    HelpTooltip($$renderer2, {
      label: "Password",
      text: "The first-boot password for the cloud-init user (the `cipassword` field). Required. It is sent over HTTPS and is never saved in your browser draft."
    });
    $$renderer2.push(`<!----></div> `);
    PasswordInput($$renderer2, {
      id: "ci-password",
      placeholder: "Required",
      required: true,
      autocomplete: "new-password",
      value: value.cipassword,
      "aria-invalid": cipasswordError() ? "true" : void 0
    });
    $$renderer2.push(`<!----> `);
    if (cipasswordError()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="text-destructive text-[13px]">${escape_html(cipasswordError())}</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> <div class="flex flex-col gap-1.5"><div class="flex items-center gap-1.5">`);
    Label($$renderer2, {
      children: ($$renderer3) => {
        $$renderer3.push(`<!---->SSH keys`);
      },
      $$slots: { default: true }
    });
    $$renderer2.push(`<!----> `);
    HelpTooltip($$renderer2, {
      label: "SSH keys",
      text: "Pick one or more SSH public keys to authorise on the new VM. Keys from every member of the owning team are listed, grouped by owner."
    });
    $$renderer2.push(`<!----></div> `);
    if (sshGroups().length === 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="text-muted-foreground text-[13px]">No SSH keys are stored for this team. Add one from your account
            settings, or set a password above.</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="flex flex-col gap-3 rounded-md border p-3"><!--[-->`);
      const each_array_2 = ensure_array_like(sshGroups());
      for (let $$index_3 = 0, $$length = each_array_2.length; $$index_3 < $$length; $$index_3++) {
        let group = each_array_2[$$index_3];
        $$renderer2.push(`<fieldset class="flex flex-col gap-1.5"><legend class="text-muted-foreground text-[12px] font-medium">${escape_html(group.owner)}</legend> <!--[-->`);
        const each_array_3 = ensure_array_like(group.keys);
        for (let $$index_2 = 0, $$length2 = each_array_3.length; $$index_2 < $$length2; $$index_2++) {
          let key = each_array_3[$$index_2];
          $$renderer2.push(`<label class="flex items-center gap-2.5 text-[14px]">`);
          Checkbox($$renderer2, {
            checked: value.sshKeyIds.includes(key.id),
            onCheckedChange: (c) => toggleKey(key.id, c === true)
          });
          $$renderer2.push(`<!----> <span class="flex flex-1 flex-col"><span class="text-foreground">${escape_html(key.name)}</span></span></label>`);
        }
        $$renderer2.push(`<!--]--></fieldset>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    }
    $$renderer2.push(`<!--]--> `);
    if (sshkeysError()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="text-destructive text-[13px]">${escape_html(sshkeysError())}</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> <div class="flex flex-col gap-1.5"><div class="flex items-center gap-1.5">`);
    Label($$renderer2, {
      for: "ci-ip-mode",
      children: ($$renderer3) => {
        $$renderer3.push(`<!---->IP configuration`);
      },
      $$slots: { default: true }
    });
    $$renderer2.push(`<!----> `);
    HelpTooltip($$renderer2, {
      label: "IP configuration",
      text: "How the VM's primary NIC gets its address on first boot — DHCP, a static address, or none."
    });
    $$renderer2.push(`<!----></div> `);
    if (Select) {
      $$renderer2.push("<!--[-->");
      Select($$renderer2, {
        type: "single",
        value: value.ipMode,
        onValueChange: (v) => v && patch({ ipMode: v }),
        children: ($$renderer3) => {
          if (Select_trigger) {
            $$renderer3.push("<!--[-->");
            Select_trigger($$renderer3, {
              id: "ci-ip-mode",
              class: "w-full",
              children: ($$renderer4) => {
                $$renderer4.push(`<!---->${escape_html(ipModeLabel())}`);
              },
              $$slots: { default: true }
            });
            $$renderer3.push("<!--]-->");
          } else {
            $$renderer3.push("<!--[!-->");
            $$renderer3.push("<!--]-->");
          }
          $$renderer3.push(` `);
          if (Select_content) {
            $$renderer3.push("<!--[-->");
            Select_content($$renderer3, {
              children: ($$renderer4) => {
                $$renderer4.push(`<!--[-->`);
                const each_array_4 = ensure_array_like(CLOUD_INIT_IP_MODES);
                for (let $$index_4 = 0, $$length = each_array_4.length; $$index_4 < $$length; $$index_4++) {
                  let mode = each_array_4[$$index_4];
                  if (Select_item) {
                    $$renderer4.push("<!--[-->");
                    Select_item($$renderer4, {
                      value: mode,
                      children: ($$renderer5) => {
                        $$renderer5.push(`<!---->${escape_html(mode.charAt(0).toUpperCase() + mode.slice(1))}`);
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
    $$renderer2.push(` `);
    if (ipconfigError()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="text-destructive text-[13px]">${escape_html(ipconfigError())}</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> `);
    if (showStaticIp()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="flex flex-col gap-1.5">`);
      Label($$renderer2, {
        for: "ci-ip-address",
        children: ($$renderer3) => {
          $$renderer3.push(`<!---->Static IP address (CIDR)`);
        },
        $$slots: { default: true }
      });
      $$renderer2.push(`<!----> `);
      Input($$renderer2, {
        id: "ci-ip-address",
        placeholder: "10.0.0.5/24",
        value: value.ipAddress,
        "aria-invalid": ipAddressError() ? "true" : void 0,
        oninput: (e) => patch({ ipAddress: e.currentTarget.value })
      });
      $$renderer2.push(`<!----> `);
      if (ipAddressError()) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<p class="text-destructive text-[13px]">${escape_html(ipAddressError())}</p>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div> <div class="flex flex-col gap-1.5">`);
      Label($$renderer2, {
        for: "ci-gateway",
        children: ($$renderer3) => {
          $$renderer3.push(`<!---->Gateway`);
        },
        $$slots: { default: true }
      });
      $$renderer2.push(`<!----> `);
      Input($$renderer2, {
        id: "ci-gateway",
        placeholder: "10.0.0.1",
        value: value.gateway,
        "aria-invalid": gatewayError() ? "true" : void 0,
        oninput: (e) => patch({ gateway: e.currentTarget.value })
      });
      $$renderer2.push(`<!----> `);
      if (gatewayError()) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<p class="text-destructive text-[13px]">${escape_html(gatewayError())}</p>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="flex flex-col gap-1.5">`);
    Label($$renderer2, {
      for: "ci-dns",
      children: ($$renderer3) => {
        $$renderer3.push(`<!---->DNS servers`);
      },
      $$slots: { default: true }
    });
    $$renderer2.push(`<!----> `);
    Textarea($$renderer2, {
      id: "ci-dns",
      placeholder: "1.1.1.1 8.8.8.8",
      rows: 2,
      value: listToLines(value.nameservers),
      oninput: (e) => patch({ nameservers: linesToList(e.currentTarget.value) })
    });
    $$renderer2.push(`<!----> <p class="text-muted-foreground text-[12px]">One per line. Optional.</p></div> <div class="flex flex-col gap-1.5">`);
    Label($$renderer2, {
      for: "ci-packages",
      children: ($$renderer3) => {
        $$renderer3.push(`<!---->Packages`);
      },
      $$slots: { default: true }
    });
    $$renderer2.push(`<!----> `);
    Textarea($$renderer2, {
      id: "ci-packages",
      placeholder: "curl htop",
      rows: 2,
      value: listToLines(value.packages),
      oninput: (e) => patch({ packages: linesToList(e.currentTarget.value) })
    });
    $$renderer2.push(`<!----> <p class="text-muted-foreground text-[12px]">Extra packages installed on first boot. One per line. Optional.</p></div> <div class="flex flex-col gap-1.5">`);
    Label($$renderer2, {
      for: "ci-runcmd",
      children: ($$renderer3) => {
        $$renderer3.push(`<!---->First-boot commands`);
      },
      $$slots: { default: true }
    });
    $$renderer2.push(`<!----> `);
    Textarea($$renderer2, {
      id: "ci-runcmd",
      placeholder: "systemctl enable docker",
      rows: 2,
      value: listToLines(value.runcmd),
      oninput: (e) => patch({ runcmd: linesToList(e.currentTarget.value) })
    });
    $$renderer2.push(`<!----> <p class="text-muted-foreground text-[12px]">Commands run once on first boot. One per line. Optional.</p></div></div> <div class="lg:sticky lg:top-4 lg:self-start">`);
    CloudInitYamlPane($$renderer2, { lines, loading: previewing });
    $$renderer2.push(`<!----></div></div></section>`);
  });
}
const DRAFT_KEY = "proxmox-gui:wizard-draft";
const SECRET_KEYS = /* @__PURE__ */ new Set(["cipassword", "ci_password", "password"]);
function resolveStorage() {
  if (typeof sessionStorage !== "undefined") return sessionStorage;
  const map = /* @__PURE__ */ new Map();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k)
  };
}
function stripSecrets(formData) {
  const safe = {};
  for (const [k, v] of Object.entries(formData)) {
    if (!SECRET_KEYS.has(k)) safe[k] = v;
  }
  return safe;
}
class WizardDraftStore {
  /** The chosen provisioning path, or `null` until Step 1 picks one. */
  path = null;
  /** The 1-based current step index within the path's step model. */
  step = 1;
  /**
   * The per-step form bag the sibling step plans (04-11/12/13) fill in. The
   * live bag MAY hold a secret (`cipassword`) for the form; the serialised
   * draft never does.
   */
  formData = {};
  #storage;
  constructor(opts) {
    this.#storage = opts?.storage ?? resolveStorage();
    this.#rehydrate();
  }
  // -- mutations -----------------------------------------------------------
  /** Step 1 chose a path — persist it. */
  selectPath(path) {
    this.path = path;
    this.#persist();
  }
  /** Move to a step index — persist it (a reload restores the step). */
  goToStep(step) {
    this.step = step;
    this.#persist();
  }
  /**
   * Merge a partial bag into `formData` (the sibling step plans call this as
   * the user fills each step). Persisted with secrets stripped.
   */
  patchFormData(patch) {
    this.formData = { ...this.formData, ...patch };
    this.#persist();
  }
  /**
   * Discard the draft — clears the in-memory state AND removes the
   * sessionStorage blob. Called on wizard complete or discard.
   */
  clear() {
    this.path = null;
    this.step = 1;
    this.formData = {};
    try {
      this.#storage.removeItem(DRAFT_KEY);
    } catch {
    }
  }
  // -- persistence ---------------------------------------------------------
  /** Serialise the current draft (secrets stripped) to storage. */
  #persist() {
    const draft = {
      path: this.path,
      step: this.step,
      formData: stripSecrets(this.formData)
    };
    try {
      this.#storage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
    }
  }
  /**
   * Rehydrate from storage on construction. A corrupt blob, an unknown path,
   * or an out-of-range step all fall back to a fresh empty draft
   * (T-04-10-03). Secret keys are never restored even if a tampered blob
   * carries them.
   */
  #rehydrate() {
    let raw;
    try {
      raw = this.#storage.getItem(DRAFT_KEY);
    } catch {
      return;
    }
    if (!raw) return;
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    if (!parsed || typeof parsed !== "object") return;
    const draft = parsed;
    const pathOk = draft.path === null || draft.path === void 0 || typeof draft.path === "string" && KNOWN_PATHS.has(draft.path);
    if (!pathOk) return;
    if (typeof draft.path === "string") this.path = draft.path;
    if (typeof draft.step === "number" && Number.isInteger(draft.step) && draft.step >= 1) {
      this.step = draft.step;
    }
    if (draft.formData && typeof draft.formData === "object") {
      this.formData = stripSecrets(draft.formData);
    }
  }
}
const wizardDraft = new WizardDraftStore();
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    const steps = derived(() => stepsForPath(wizardDraft.path));
    const activeStep = derived(() => Math.min(wizardDraft.step, steps().length));
    const activeStepId = derived(() => steps()[activeStep() - 1] ?? "path");
    const isLxcPath = derived(() => wizardDraft.path === "plain-lxc" || wizardDraft.path === "community-script");
    const isVmWizardPath = derived(() => wizardDraft.path !== null && isVmPath(wizardDraft.path));
    const isVmClone = derived(() => wizardDraft.path !== null && isClonePath(wizardDraft.path));
    const wide = derived(() => activeStepId() === "cloud-init");
    const nextLabel = derived(() => activeStepId() === "review" && wizardDraft.path ? FINAL_CTA_LABEL[wizardDraft.path] : "Next");
    const teams = derived(() => (data.user?.teams ?? []).map((t) => ({ id: t.id, name: t.name })));
    let teamId = null;
    const clusterId = derived(() => data.clusters[0]?.id ?? null);
    let clusterNodes = [];
    let inventoryVms = [];
    let quotaBudget = null;
    let ostemplate = wizardDraft.formData.ostemplate ?? "";
    let scriptSlug = wizardDraft.formData.script_slug ?? "";
    let scriptOptions = wizardDraft.formData.script_options ?? {};
    let scriptName = wizardDraft.formData.script_name ?? "";
    let resources = {
      node: wizardDraft.formData.node ?? "",
      storage: wizardDraft.formData.storage ?? "",
      hostname: wizardDraft.formData.hostname ?? "",
      cpu_cores: wizardDraft.formData.cpu_cores ?? 1,
      memory_mb: wizardDraft.formData.memory_mb ?? 512,
      disk_gb: wizardDraft.formData.disk_gb ?? 8,
      unprivileged: wizardDraft.formData.unprivileged ?? LXC_RESOURCE_DEFAULTS.unprivileged,
      nesting: wizardDraft.formData.nesting ?? LXC_RESOURCE_DEFAULTS.nesting,
      features: wizardDraft.formData.features ?? [...LXC_RESOURCE_DEFAULTS.features]
    };
    let vmSource = {
      image_id: wizardDraft.formData.image_id ?? "",
      iso_volid: wizardDraft.formData.iso_volid ?? "",
      source_vmid: wizardDraft.formData.source_vmid ?? 0,
      clone_mode: wizardDraft.formData.clone_mode ?? "linked"
    };
    let vmResources = {
      name: wizardDraft.formData.name ?? "",
      node: wizardDraft.formData.node ?? "",
      storage: wizardDraft.formData.storage ?? "",
      cpu_cores: wizardDraft.formData.cpu_cores ?? 2,
      memory_mb: wizardDraft.formData.memory_mb ?? 2048,
      disk_gb: wizardDraft.formData.disk_gb ?? 32
    };
    let networkConfig = wizardDraft.formData.network ?? null;
    let cloudInit = cloudInitFormDefaults();
    let cloudInitGate = false;
    const sshKeyCatalogue = [];
    let submitError = null;
    let submitting = false;
    let vmResourcesGate = false;
    let networkGate = false;
    let lxcNodeBlocked = false;
    const lxcFormBag = derived(() => ({
      ostemplate,
      script_slug: scriptSlug,
      node: resources.node,
      storage: resources.storage,
      hostname: resources.hostname,
      cpu_cores: resources.cpu_cores,
      memory_mb: resources.memory_mb,
      disk_gb: resources.disk_gb
    }));
    const vmFormBag = derived(() => ({
      image_id: vmSource.image_id,
      iso_volid: vmSource.iso_volid,
      source_vmid: vmSource.source_vmid,
      clone_mode: vmSource.clone_mode,
      name: vmResources.name,
      node: vmResources.node,
      storage: vmResources.storage,
      cpu_cores: vmResources.cpu_cores,
      memory_mb: vmResources.memory_mb,
      disk_gb: vmResources.disk_gb,
      ...toQemuCloudInitFields(cloudInit, sshKeyCatalogue)
    }));
    const stepErrors = derived(() => {
      if (!wizardDraft.path) return {};
      if (isLxcPath()) return validateLxcStep(activeStepId(), wizardDraft.path, lxcFormBag());
      if (isVmWizardPath()) return validateVmStep(activeStepId(), wizardDraft.path, vmFormBag());
      return {};
    });
    const nextDisabled = derived(() => {
      if (activeStepId() === "path") return !canAdvanceFromPathStep(wizardDraft.path);
      if (!wizardDraft.path) return false;
      if (isLxcPath()) {
        if (activeStepId() === "source" || activeStepId() === "resources") {
          if (!lxcStepValid(activeStepId(), wizardDraft.path, lxcFormBag())) return true;
        }
        if (activeStepId() === "resources" && lxcNodeBlocked) return true;
        if (activeStepId() === "network" && networkGate) return true;
        return false;
      }
      if (isVmWizardPath()) {
        if (activeStepId() === "source" || activeStepId() === "resources") {
          if (!vmStepValid(activeStepId(), wizardDraft.path, vmFormBag())) return true;
        }
        if (activeStepId() === "resources" && vmResourcesGate) ;
        if (activeStepId() === "network" && networkGate) return true;
        if (activeStepId() === "cloud-init" && cloudInitGate) ;
        return false;
      }
      return false;
    });
    function persistDraft() {
      wizardDraft.patchFormData({
        // LXC fields
        ostemplate,
        script_slug: scriptSlug,
        script_options: scriptOptions,
        script_name: scriptName,
        hostname: resources.hostname,
        unprivileged: resources.unprivileged,
        nesting: resources.nesting,
        features: resources.features,
        // VM fields
        image_id: vmSource.image_id,
        iso_volid: vmSource.iso_volid,
        source_vmid: vmSource.source_vmid,
        clone_mode: vmSource.clone_mode,
        name: vmResources.name,
        // shared placement / sizing — written from whichever path is active
        node: isVmWizardPath() ? vmResources.node : resources.node,
        storage: isVmWizardPath() ? vmResources.storage : resources.storage,
        cpu_cores: isVmWizardPath() ? vmResources.cpu_cores : resources.cpu_cores,
        memory_mb: isVmWizardPath() ? vmResources.memory_mb : resources.memory_mb,
        disk_gb: isVmWizardPath() ? vmResources.disk_gb : resources.disk_gb,
        // shared network
        network: networkConfig
      });
    }
    function next() {
      if (nextDisabled()) return;
      persistDraft();
      if (activeStep() < steps().length) wizardDraft.goToStep(activeStep() + 1);
    }
    function back() {
      if (activeStep() > 1) wizardDraft.goToStep(activeStep() - 1);
    }
    function goToStep(target) {
      if (target >= 1 && target <= steps().length) wizardDraft.goToStep(target);
    }
    function handlePathSelect(path) {
      wizardDraft.selectPath(path);
      wizardDraft.goToStep(1);
    }
    async function completeWithJob(cluster, job, resourceName) {
      wizardDraft.clear();
      toast.info(`Creating ${resourceName}… — Track progress in Tasks.`);
      await goto(inventoryPathForJob(cluster, job));
    }
    async function submit() {
      if (submitting || clusterId() === null || teamId === null || !wizardDraft.path) return;
      submitting = true;
      submitError = null;
      try {
        let job;
        let resourceName;
        if (wizardDraft.path === "plain-lxc") {
          const body = buildLxcRequest({ ...lxcFormBag(), ...resources, network: networkConfig }, teamId);
          job = await api.provisioning.createLxc({ clusterId: clusterId(), body });
          resourceName = body.hostname;
        } else if (wizardDraft.path === "community-script") {
          const body = buildCommunityScriptRequest(
            {
              ...lxcFormBag(),
              ...resources,
              script_options: scriptOptions,
              network: networkConfig
            },
            teamId
          );
          job = await api.provisioning.createCommunityScript({ clusterId: clusterId(), body });
          resourceName = scriptName || body.hostname;
        } else {
          const body = buildQemuRequest({ ...vmFormBag(), network: networkConfig }, teamId, wizardDraft.path);
          job = await api.provisioning.createQemu({ clusterId: clusterId(), body });
          resourceName = body.name;
        }
        await completeWithJob(clusterId(), job, resourceName);
      } catch (err) {
        submitError = isVmWizardPath() ? mapQemuCreateError(err) : mapLxcCreateError(err);
      } finally {
        submitting = false;
      }
    }
    function handleNext() {
      if (activeStepId() === "review") void submit();
      else next();
    }
    let discardOpen = false;
    function requestClose() {
      if (shouldPromptDiscard(wizardDraft.path, activeStep())) discardOpen = true;
      else void goto();
    }
    async function confirmDiscard() {
      discardOpen = false;
      wizardDraft.clear();
      await goto();
    }
    function stepIndex(id) {
      const i = steps().indexOf(id);
      return i >= 0 ? i + 1 : 1;
    }
    function orDash(v) {
      return v.trim() || "—";
    }
    const reviewSections = derived(() => {
      if (!wizardDraft.path) return [];
      const sections = [];
      if (isLxcPath()) {
        sections.push({
          title: "Source",
          editStep: stepIndex("source"),
          rows: wizardDraft.path === "plain-lxc" ? [{ label: "Template", value: orDash(ostemplate) }] : [{ label: "Script", value: scriptName || scriptSlug || "—" }]
        });
        sections.push({
          title: "Resources",
          editStep: stepIndex("resources"),
          rows: [
            { label: "Hostname", value: orDash(resources.hostname) },
            { label: "Node", value: orDash(resources.node) },
            { label: "Storage", value: orDash(resources.storage) },
            {
              label: "Size",
              value: `${resources.cpu_cores} vCPU · ${resources.memory_mb} MB RAM · ${resources.disk_gb} GB disk`
            },
            {
              label: "Options",
              value: [
                resources.unprivileged ? "unprivileged" : "privileged",
                resources.nesting ? "nesting" : null,
                ...resources.features
              ].filter(Boolean).join(", ") || "—"
            }
          ]
        });
      } else {
        sections.push({
          title: "Source",
          editStep: stepIndex("source"),
          rows: vmSourceReviewRows()
        });
        const resourceRows = [
          { label: "Name", value: orDash(vmResources.name) },
          { label: "Node", value: orDash(vmResources.node) }
        ];
        if (!isVmClone()) {
          resourceRows.push({ label: "Storage", value: orDash(vmResources.storage) }, {
            label: "Size",
            value: `${vmResources.cpu_cores} vCPU · ${vmResources.memory_mb} MB RAM · ${vmResources.disk_gb} GB disk`
          });
        }
        sections.push({
          title: "Resources",
          editStep: stepIndex("resources"),
          rows: resourceRows
        });
      }
      sections.push({
        title: "Network",
        editStep: stepIndex("network"),
        rows: [
          {
            label: "Network",
            value: networkConfig ? `${networkConfig.id} (${networkConfig.ip_mode ?? "dhcp"})` : "Cluster default"
          }
        ]
      });
      return sections;
    });
    function vmSourceReviewRows() {
      switch (wizardDraft.path) {
        case "cloud-image":
          return [{ label: "Cloud image", value: orDash(vmSource.image_id) }];
        case "blank-iso":
          return [{ label: "ISO", value: orDash(vmSource.iso_volid) }];
        case "template-clone":
        case "vm-clone":
          return [
            {
              label: wizardDraft.path === "template-clone" ? "Template" : "Source VM",
              value: vmSource.source_vmid > 0 ? `VMID ${vmSource.source_vmid}` : "—"
            },
            { label: "Clone mode", value: vmSource.clone_mode }
          ];
        default:
          return [];
      }
    }
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      head("jztt4t", $$renderer3, ($$renderer4) => {
        $$renderer4.title(($$renderer5) => {
          $$renderer5.push(`<title>Create — Proxmox GUI</title>`);
        });
      });
      $$renderer3.push(`<div class="mx-auto w-full max-w-5xl">`);
      if (Card) {
        $$renderer3.push("<!--[-->");
        Card($$renderer3, {
          class: "overflow-hidden p-0 shadow-sm",
          children: ($$renderer4) => {
            {
              let body = function($$renderer5) {
                if (activeStepId() === "path") {
                  $$renderer5.push("<!--[0-->");
                  PathPicker($$renderer5, { value: wizardDraft.path, onSelect: handlePathSelect });
                } else if (isLxcPath() && wizardDraft.path) {
                  $$renderer5.push("<!--[1-->");
                  if (activeStepId() === "source" && wizardDraft.path === "plain-lxc") {
                    $$renderer5.push("<!--[0-->");
                    LxcTemplateStep($$renderer5, {
                      value: ostemplate,
                      onChange: (v) => {
                        ostemplate = v;
                        persistDraft();
                      }
                    });
                  } else if (activeStepId() === "source" && wizardDraft.path === "community-script") {
                    $$renderer5.push("<!--[1-->");
                    if (clusterId() !== null) {
                      $$renderer5.push("<!--[0-->");
                      CatalogBrowser($$renderer5, {
                        clusterId: clusterId(),
                        selectedSlug: scriptSlug
                      });
                    } else {
                      $$renderer5.push("<!--[-1-->");
                      EmptyState($$renderer5, {
                        icon: Boxes,
                        heading: "No cluster available",
                        body: "The community-scripts catalog needs a cluster. Register one first."
                      });
                    }
                    $$renderer5.push(`<!--]-->`);
                  } else if (activeStepId() === "resources") {
                    $$renderer5.push("<!--[2-->");
                    $$renderer5.push(`<div class="flex flex-col gap-5">`);
                    NodeSelect($$renderer5, {
                      nodes: clusterNodes,
                      value: resources.node,
                      requestedCpu: resources.cpu_cores,
                      requestedRamMb: resources.memory_mb,
                      onChange: (node) => {
                        resources = { ...resources, node };
                        persistDraft();
                      },
                      onBlockedChange: (b) => lxcNodeBlocked = b
                    });
                    $$renderer5.push(`<!----> `);
                    LxcResourcesStep($$renderer5, {
                      nodes: clusterNodes.map((n) => n.node),
                      teams: teams(),
                      teamId,
                      value: resources,
                      errors: stepErrors(),
                      onChange: (nextValue) => {
                        resources = nextValue;
                        persistDraft();
                      },
                      onTeamChange: (id) => teamId = id
                    });
                    $$renderer5.push(`<!----> `);
                    QuotaDeltaLine($$renderer5, {
                      requestedCpu: resources.cpu_cores,
                      requestedRamMb: resources.memory_mb,
                      budget: quotaBudget
                    });
                    $$renderer5.push(`<!----></div>`);
                  } else if (activeStepId() === "network") {
                    $$renderer5.push("<!--[3-->");
                    if (clusterId() !== null) {
                      $$renderer5.push("<!--[0-->");
                      NetworkPicker($$renderer5, {
                        clusterId: clusterId(),
                        value: networkConfig,
                        onChange: (net) => {
                          networkConfig = net;
                          persistDraft();
                        },
                        onBlockedChange: (b) => networkGate = b
                      });
                    } else {
                      $$renderer5.push("<!--[-1-->");
                      EmptyState($$renderer5, {
                        icon: Boxes,
                        heading: "No cluster available",
                        body: "The network picker needs a cluster."
                      });
                    }
                    $$renderer5.push(`<!--]-->`);
                  } else if (activeStepId() === "review") {
                    $$renderer5.push("<!--[4-->");
                    ReviewStep($$renderer5, {
                      sections: reviewSections(),
                      requestedCpu: resources.cpu_cores,
                      requestedRamMb: resources.memory_mb,
                      quotaBudget,
                      submitError,
                      onEdit: goToStep
                    });
                  } else {
                    $$renderer5.push("<!--[-1-->");
                  }
                  $$renderer5.push(`<!--]-->`);
                } else if (isVmWizardPath() && wizardDraft.path) {
                  $$renderer5.push("<!--[2-->");
                  if (activeStepId() === "source") {
                    $$renderer5.push("<!--[0-->");
                    if (clusterId() !== null && teamId !== null) {
                      $$renderer5.push("<!--[0-->");
                      VmSourceStep($$renderer5, {
                        sourceKind: sourceKindForPath(wizardDraft.path),
                        clusterId: clusterId(),
                        teamId,
                        node: vmResources.node,
                        sourceVms: inventoryVms,
                        value: vmSource,
                        errors: stepErrors(),
                        onChange: (nextValue) => {
                          vmSource = nextValue;
                          persistDraft();
                        }
                      });
                    } else {
                      $$renderer5.push("<!--[-1-->");
                      EmptyState($$renderer5, {
                        icon: Boxes,
                        heading: "No cluster available",
                        body: "The VM wizard needs a cluster. Register one first."
                      });
                    }
                    $$renderer5.push(`<!--]-->`);
                  } else if (activeStepId() === "resources") {
                    $$renderer5.push("<!--[1-->");
                    VmResourcesStep($$renderer5, {
                      isClone: isVmClone(),
                      nodes: clusterNodes,
                      quotaBudget,
                      teams: teams(),
                      teamId,
                      value: vmResources,
                      errors: stepErrors(),
                      onChange: (nextValue) => {
                        vmResources = nextValue;
                        persistDraft();
                      },
                      onTeamChange: (id) => teamId = id
                    });
                  } else if (activeStepId() === "network") {
                    $$renderer5.push("<!--[2-->");
                    if (clusterId() !== null) {
                      $$renderer5.push("<!--[0-->");
                      NetworkPicker($$renderer5, {
                        clusterId: clusterId(),
                        value: networkConfig,
                        onChange: (net) => {
                          networkConfig = net;
                          persistDraft();
                        },
                        onBlockedChange: (b) => networkGate = b
                      });
                    } else {
                      $$renderer5.push("<!--[-1-->");
                      EmptyState($$renderer5, {
                        icon: Boxes,
                        heading: "No cluster available",
                        body: "The network picker needs a cluster."
                      });
                    }
                    $$renderer5.push(`<!--]-->`);
                  } else if (activeStepId() === "cloud-init") {
                    $$renderer5.push("<!--[3-->");
                    if (clusterId() !== null) {
                      $$renderer5.push("<!--[0-->");
                      CloudInitEditor($$renderer5, {
                        clusterId: clusterId(),
                        sourceKind: sourceKindForPath(wizardDraft.path),
                        sshKeys: sshKeyCatalogue,
                        value: cloudInit,
                        onChange: (next2) => cloudInit = next2
                      });
                    } else {
                      $$renderer5.push("<!--[-1-->");
                      EmptyState($$renderer5, {
                        icon: Boxes,
                        heading: "No cluster available",
                        body: "The Cloud-Init editor needs a cluster. Register one first."
                      });
                    }
                    $$renderer5.push(`<!--]-->`);
                  } else if (activeStepId() === "review") {
                    $$renderer5.push("<!--[4-->");
                    ReviewStep($$renderer5, {
                      sections: reviewSections(),
                      requestedCpu: isVmClone() ? 0 : vmResources.cpu_cores,
                      requestedRamMb: isVmClone() ? 0 : vmResources.memory_mb,
                      quotaBudget,
                      submitError,
                      onEdit: goToStep
                    });
                  } else {
                    $$renderer5.push("<!--[-1-->");
                  }
                  $$renderer5.push(`<!--]-->`);
                } else {
                  $$renderer5.push("<!--[-1-->");
                  $$renderer5.push(`<div class="flex flex-col gap-2"><h2 class="text-[18px] font-semibold leading-tight tracking-tight">${escape_html(WIZARD_STEP_LABEL[activeStepId()])}</h2> <p class="text-muted-foreground text-[14px]">Use Back to return to the path picker.</p> `);
                  if (wizardDraft.path) {
                    $$renderer5.push("<!--[0-->");
                    $$renderer5.push(`<p class="text-muted-foreground text-[13px]">Selected path: <span class="text-foreground font-medium">${escape_html(wizardDraft.path)}</span> (${escape_html(pathKind(wizardDraft.path) === "lxc" ? "container" : "VM")}).</p>`);
                  } else {
                    $$renderer5.push("<!--[-1-->");
                  }
                  $$renderer5.push(`<!--]--></div>`);
                }
                $$renderer5.push(`<!--]-->`);
              };
              WizardChrome($$renderer4, {
                steps: steps(),
                activeStep: activeStep(),
                wide: wide(),
                nextLabel: nextLabel(),
                nextDisabled: nextDisabled() || submitting,
                onBack: back,
                onNext: handleNext,
                onClose: requestClose,
                body
              });
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
      if (data.loadError) {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<div class="mt-4">`);
        EmptyState($$renderer3, {
          icon: Boxes,
          heading: "Couldn't load your clusters",
          body: "The wizard can still start, but cluster-dependent steps may be unavailable. Try reloading."
        });
        $$renderer3.push(`<!----></div>`);
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--></div> `);
      if (Alert_dialog) {
        $$renderer3.push("<!--[-->");
        Alert_dialog($$renderer3, {
          get open() {
            return discardOpen;
          },
          set open($$value) {
            discardOpen = $$value;
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
                              $$renderer7.push(`<!---->Discard this draft?`);
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
                              $$renderer7.push(`<!---->Your wizard progress will be lost. The resource has not been created.`);
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
                          onclick: () => discardOpen = false,
                          children: ($$renderer7) => {
                            $$renderer7.push(`<!---->Cancel`);
                          },
                          $$slots: { default: true }
                        });
                        $$renderer6.push(`<!----> `);
                        Button($$renderer6, {
                          variant: "destructive",
                          onclick: confirmDiscard,
                          children: ($$renderer7) => {
                            $$renderer7.push(`<!---->Discard draft`);
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
  });
}

export { _page as default };
//# sourceMappingURL=_page.svelte-BNMmjURL.js.map
