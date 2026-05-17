import { p as attributes, q as clsx, f as bind_props } from './renderer--hvGDOOw.js';
import { c as cn } from './button-BxOVow4s.js';

function Alert_description($$renderer, $$props) {
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
      "data-slot": "alert-description",
      class: clsx(cn("text-muted-foreground text-sm text-balance md:text-pretty [&_p:not(:last-child)]:mb-4 [&_a]:hover:text-foreground [&_a]:underline [&_a]:underline-offset-3", className)),
      ...restProps
    })}>`);
    children?.($$renderer2);
    $$renderer2.push(`<!----></div>`);
    bind_props($$props, { ref });
  });
}

export { Alert_description as A };
//# sourceMappingURL=alert-description-BlBkGLZQ.js.map
