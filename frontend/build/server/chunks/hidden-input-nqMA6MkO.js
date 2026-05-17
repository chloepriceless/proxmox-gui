import { p as attributes, f as bind_props, d as derived } from './renderer--hvGDOOw.js';
import { m as mergeProps } from './input-CMvV7SCO.js';
import { s as srOnlyStyles } from './sr-only-styles-Cqf-HEXV.js';

function Hidden_input($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { value = void 0, $$slots, $$events, ...restProps } = $$props;
    const mergedProps = derived(() => mergeProps(restProps, {
      "aria-hidden": "true",
      tabindex: -1,
      style: { ...srOnlyStyles, position: "absolute", top: "0", left: "0" }
    }));
    if (mergedProps().type === "checkbox") {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<input${attributes({ ...mergedProps(), value }, void 0, void 0, void 0, 4)}/>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<input${attributes({ value, ...mergedProps() }, void 0, void 0, void 0, 4)}/>`);
    }
    $$renderer2.push(`<!--]-->`);
    bind_props($$props, { value });
  });
}

export { Hidden_input as H };
//# sourceMappingURL=hidden-input-nqMA6MkO.js.map
