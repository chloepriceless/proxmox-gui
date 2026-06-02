import { p as attributes, q as clsx, h as bind_props } from './renderer-mZFfBJIU.js';
import { c as cn } from './button-CE_GHowG.js';

function Card_description($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      ref = null,
      class: className,
      children,
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    $$renderer2.push(`<p${attributes({
      "data-slot": "card-description",
      class: clsx(cn("text-muted-foreground text-sm", className)),
      ...restProps
    })}>`);
    children?.($$renderer2);
    $$renderer2.push(`<!----></p>`);
    bind_props($$props, { ref });
  });
}

export { Card_description as C };
//# sourceMappingURL=card-description-DQE8zzIh.js.map
