import { h as bind_props, o as spread_props, z as props_id, p as attributes, d as derived } from './renderer-mZFfBJIU.js';
import { c as cn } from './button-CE_GHowG.js';
import { C as Context, w as watch, E as ENTER, S as SPACE, i as isHTMLElement } from './is-DiTqhZmY.js';
import { s as snapshot } from './clone-WEom5mq4.js';
import { c as createId, b as boxWith, d as attachRef, f as boolToEmptyStrOrUndef, h as boolToStr, x as getAriaChecked, m as mergeProps, a as createBitsAttrs } from './input-Be3KOSVg.js';
import { H as Hidden_input } from './hidden-input-Q3ZT26w4.js';
import { C as Check } from './check-C7XRLeXa.js';
import { I as Icon } from './Icon-oF8immWv.js';

const checkboxAttrs = createBitsAttrs({
  component: "checkbox",
  parts: ["root", "group", "group-label", "input"]
});
const CheckboxGroupContext = new Context("Checkbox.Group");
const CheckboxRootContext = new Context("Checkbox.Root");
class CheckboxRootState {
  static create(opts, group = null) {
    return CheckboxRootContext.set(new CheckboxRootState(opts, group));
  }
  opts;
  group;
  #trueName = derived(() => {
    if (this.group && this.group.opts.name.current) return this.group.opts.name.current;
    return this.opts.name.current;
  });
  get trueName() {
    return this.#trueName();
  }
  set trueName($$value) {
    return this.#trueName($$value);
  }
  #trueRequired = derived(() => {
    if (this.group && this.group.opts.required.current) return true;
    return this.opts.required.current;
  });
  get trueRequired() {
    return this.#trueRequired();
  }
  set trueRequired($$value) {
    return this.#trueRequired($$value);
  }
  #trueDisabled = derived(() => {
    if (this.group && this.group.opts.disabled.current) return true;
    return this.opts.disabled.current;
  });
  get trueDisabled() {
    return this.#trueDisabled();
  }
  set trueDisabled($$value) {
    return this.#trueDisabled($$value);
  }
  #trueReadonly = derived(() => {
    if (this.group && this.group.opts.readonly.current) return true;
    return this.opts.readonly.current;
  });
  get trueReadonly() {
    return this.#trueReadonly();
  }
  set trueReadonly($$value) {
    return this.#trueReadonly($$value);
  }
  attachment;
  constructor(opts, group) {
    this.opts = opts;
    this.group = group;
    this.attachment = attachRef(this.opts.ref);
    this.onkeydown = this.onkeydown.bind(this);
    this.onclick = this.onclick.bind(this);
    watch.pre(
      [
        () => snapshot(this.group?.opts.value.current),
        () => this.opts.value.current
      ],
      ([groupValue, value]) => {
        if (!groupValue || !value) return;
        this.opts.checked.current = groupValue.includes(value);
      }
    );
    watch.pre(() => this.opts.checked.current, (checked) => {
      if (!this.group) return;
      if (checked) {
        this.group?.addValue(this.opts.value.current);
      } else {
        this.group?.removeValue(this.opts.value.current);
      }
    });
  }
  onkeydown(e) {
    if (this.trueDisabled || this.trueReadonly) return;
    if (e.key === ENTER) {
      e.preventDefault();
      if (this.opts.type.current === "submit") {
        const form = e.currentTarget.closest("form");
        form?.requestSubmit();
      }
      return;
    }
    if (e.key === SPACE) {
      e.preventDefault();
      this.#toggle();
    }
  }
  #toggle() {
    if (this.opts.indeterminate.current) {
      this.opts.indeterminate.current = false;
      this.opts.checked.current = true;
    } else {
      this.opts.checked.current = !this.opts.checked.current;
    }
  }
  onclick(e) {
    if (this.trueDisabled || this.trueReadonly) return;
    if (this.opts.type.current === "submit") {
      this.#toggle();
      return;
    }
    e.preventDefault();
    this.#toggle();
  }
  #snippetProps = derived(() => ({
    checked: this.opts.checked.current,
    indeterminate: this.opts.indeterminate.current
  }));
  get snippetProps() {
    return this.#snippetProps();
  }
  set snippetProps($$value) {
    return this.#snippetProps($$value);
  }
  #props = derived(() => ({
    id: this.opts.id.current,
    role: "checkbox",
    type: this.opts.type.current,
    disabled: this.trueDisabled,
    "aria-checked": getAriaChecked(this.opts.checked.current, this.opts.indeterminate.current),
    "aria-required": boolToStr(this.trueRequired),
    "aria-readonly": boolToStr(this.trueReadonly),
    "data-disabled": boolToEmptyStrOrUndef(this.trueDisabled),
    "data-readonly": boolToEmptyStrOrUndef(this.trueReadonly),
    "data-state": getCheckboxDataState(this.opts.checked.current, this.opts.indeterminate.current),
    [checkboxAttrs.root]: "",
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
class CheckboxInputState {
  static create() {
    return new CheckboxInputState(CheckboxRootContext.get());
  }
  root;
  #trueChecked = derived(() => {
    if (!this.root.group) return this.root.opts.checked.current;
    if (this.root.opts.value.current !== void 0 && this.root.group.opts.value.current.includes(this.root.opts.value.current)) {
      return true;
    }
    return false;
  });
  get trueChecked() {
    return this.#trueChecked();
  }
  set trueChecked($$value) {
    return this.#trueChecked($$value);
  }
  #shouldRender = derived(() => Boolean(this.root.trueName));
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
    if (!isHTMLElement(this.root.opts.ref.current)) return;
    this.root.opts.ref.current.focus();
  }
  #props = derived(() => ({
    type: "checkbox",
    checked: this.root.opts.checked.current === true,
    disabled: this.root.trueDisabled,
    required: this.root.trueRequired,
    name: this.root.trueName,
    value: this.root.opts.value.current,
    readonly: this.root.trueReadonly,
    onfocus: this.onfocus
  }));
  get props() {
    return this.#props();
  }
  set props($$value) {
    return this.#props($$value);
  }
}
function getCheckboxDataState(checked, indeterminate) {
  if (indeterminate) return "indeterminate";
  return checked ? "checked" : "unchecked";
}
function Checkbox_input($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const inputState = CheckboxInputState.create();
    if (inputState.shouldRender) {
      $$renderer2.push("<!--[0-->");
      Hidden_input($$renderer2, spread_props([inputState.props]));
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
function Checkbox$1($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const uid = props_id($$renderer2);
    let {
      checked = false,
      ref = null,
      onCheckedChange,
      children,
      disabled = false,
      required = false,
      name = void 0,
      value = "on",
      id = createId(uid),
      indeterminate = false,
      onIndeterminateChange,
      child,
      type = "button",
      readonly,
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    const group = CheckboxGroupContext.getOr(null);
    if (group && value) {
      if (group.opts.value.current.includes(value)) {
        checked = true;
      } else {
        checked = false;
      }
    }
    watch.pre(() => value, () => {
      if (group && value) {
        if (group.opts.value.current.includes(value)) {
          checked = true;
        } else {
          checked = false;
        }
      }
    });
    const rootState = CheckboxRootState.create(
      {
        checked: boxWith(() => checked, (v) => {
          checked = v;
          onCheckedChange?.(v);
        }),
        disabled: boxWith(() => disabled ?? false),
        required: boxWith(() => required),
        name: boxWith(() => name),
        value: boxWith(() => value),
        id: boxWith(() => id),
        ref: boxWith(() => ref, (v) => ref = v),
        indeterminate: boxWith(() => indeterminate, (v) => {
          indeterminate = v;
          onIndeterminateChange?.(v);
        }),
        type: boxWith(() => type),
        readonly: boxWith(() => Boolean(readonly))
      },
      group
    );
    const mergedProps = derived(() => mergeProps({ ...restProps }, rootState.props));
    if (child) {
      $$renderer2.push("<!--[0-->");
      child($$renderer2, { props: mergedProps(), ...rootState.snippetProps });
      $$renderer2.push(`<!---->`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<button${attributes({ ...mergedProps() })}>`);
      children?.($$renderer2, rootState.snippetProps);
      $$renderer2.push(`<!----></button>`);
    }
    $$renderer2.push(`<!--]--> `);
    Checkbox_input($$renderer2);
    $$renderer2.push(`<!---->`);
    bind_props($$props, { checked, ref, indeterminate });
  });
}
function Minus($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [["path", { "d": "M5 12h14" }]];
  Icon($$renderer, spread_props([{ name: "minus" }, props, { iconNode }]));
}
function Checkbox($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      ref = null,
      checked = false,
      indeterminate = false,
      class: className,
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      {
        let children = function($$renderer4, { checked: checked2, indeterminate: indeterminate2 }) {
          $$renderer4.push(`<div data-slot="checkbox-indicator" class="[&amp;>svg]:size-3.5 grid place-content-center text-current transition-none">`);
          if (checked2) {
            $$renderer4.push("<!--[0-->");
            Check($$renderer4, {});
          } else if (indeterminate2) {
            $$renderer4.push("<!--[1-->");
            Minus($$renderer4, {});
          } else {
            $$renderer4.push("<!--[-1-->");
          }
          $$renderer4.push(`<!--]--></div>`);
        };
        if (Checkbox$1) {
          $$renderer3.push("<!--[-->");
          Checkbox$1($$renderer3, spread_props([
            {
              "data-slot": "checkbox",
              class: cn("border-input dark:bg-input/30 data-checked:bg-primary data-checked:text-primary-foreground dark:data-checked:bg-primary data-checked:border-primary aria-invalid:aria-checked:border-primary aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 flex size-4 items-center justify-center rounded-[4px] border transition-colors group-has-disabled/field:opacity-50 focus-visible:ring-3 aria-invalid:ring-3 peer relative shrink-0 outline-none after:absolute after:-inset-x-3 after:-inset-y-2 disabled:cursor-not-allowed disabled:opacity-50", className)
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
              get checked() {
                return checked;
              },
              set checked($$value) {
                checked = $$value;
                $$settled = false;
              },
              get indeterminate() {
                return indeterminate;
              },
              set indeterminate($$value) {
                indeterminate = $$value;
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
    bind_props($$props, { ref, checked, indeterminate });
  });
}

export { Checkbox as C };
//# sourceMappingURL=checkbox-DBOvAVyp.js.map
