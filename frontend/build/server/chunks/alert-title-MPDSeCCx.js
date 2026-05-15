import { o as attributes, p as clsx, y as bind_props } from './renderer-5OqEGBJa.js';
import { c as cn } from './button-B5bCAdGN.js';

function Alert_title($$renderer, $$props) {
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
      "data-slot": "alert-title",
      class: clsx(cn("font-medium group-has-[>svg]/alert:col-start-2 [&_a]:hover:text-foreground [&_a]:underline [&_a]:underline-offset-3", className)),
      ...restProps
    })}>`);
    children?.($$renderer2);
    $$renderer2.push(`<!----></div>`);
    bind_props($$props, { ref });
  });
}

export { Alert_title as A };
//# sourceMappingURL=alert-title-MPDSeCCx.js.map
