import { o as attributes, p as clsx, y as bind_props } from './renderer-5OqEGBJa.js';
import { c as cn } from './button-B5bCAdGN.js';

function Table_head($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      ref = null,
      class: className,
      children,
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    $$renderer2.push(`<th${attributes({
      "data-slot": "table-head",
      class: clsx(cn("text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0", className)),
      ...restProps
    })}>`);
    children?.($$renderer2);
    $$renderer2.push(`<!----></th>`);
    bind_props($$props, { ref });
  });
}
function Table_header($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      ref = null,
      class: className,
      children,
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    $$renderer2.push(`<thead${attributes({
      "data-slot": "table-header",
      class: clsx(cn("[&_tr]:border-b", className)),
      ...restProps
    })}>`);
    children?.($$renderer2);
    $$renderer2.push(`<!----></thead>`);
    bind_props($$props, { ref });
  });
}

export { Table_header as T, Table_head as a };
//# sourceMappingURL=table-header-DckvTEzE.js.map
