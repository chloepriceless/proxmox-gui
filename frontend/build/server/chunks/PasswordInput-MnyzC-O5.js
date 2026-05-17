import { f as bind_props, k as attr_class, l as stringify, j as attr, o as spread_props } from './renderer--hvGDOOw.js';
import { I as Input } from './input-CMvV7SCO.js';
import { I as Icon } from './button-BxOVow4s.js';

function Eye($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    [
      "path",
      {
        "d": "M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"
      }
    ],
    ["circle", { "cx": "12", "cy": "12", "r": "3" }]
  ];
  Icon($$renderer, spread_props([{ name: "eye" }, props, { iconNode }]));
}
function PasswordInput($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      value = "",
      name,
      id,
      placeholder,
      disabled = false,
      autocomplete,
      required = false,
      "aria-invalid": ariaInvalid,
      "aria-describedby": ariaDescribedby,
      class: className = ""
    } = $$props;
    let revealed = false;
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      $$renderer3.push(`<div${attr_class(`relative ${stringify(className)}`)}>`);
      Input($$renderer3, {
        type: "password",
        name,
        id,
        placeholder,
        disabled,
        autocomplete,
        required,
        class: "pr-10",
        "aria-invalid": ariaInvalid,
        "aria-describedby": ariaDescribedby,
        get value() {
          return value;
        },
        set value($$value) {
          value = $$value;
          $$settled = false;
        }
      });
      $$renderer3.push(`<!----> <button type="button" class="text-muted-foreground hover:text-foreground absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded transition-colors disabled:opacity-50"${attr("aria-label", "Show password")}${attr("aria-pressed", revealed)}${attr("disabled", disabled, true)}${attr("tabindex", -1)}>`);
      {
        $$renderer3.push("<!--[-1-->");
        Eye($$renderer3, { class: "size-4", "aria-hidden": "true" });
      }
      $$renderer3.push(`<!--]--></button></div>`);
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

export { PasswordInput as P };
//# sourceMappingURL=PasswordInput-MnyzC-O5.js.map
