import { p as attributes, q as clsx, h as bind_props, o as spread_props } from './renderer-mZFfBJIU.js';
import { c as cn, B as Button } from './button-CE_GHowG.js';
import { c as Dialog_close } from './dialog-description-Bxgdum_W.js';

function Dialog_footer($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      ref = null,
      class: className,
      children,
      showCloseButton = false,
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    $$renderer2.push(`<div${attributes({
      "data-slot": "dialog-footer",
      class: clsx(cn("bg-muted/50 -mx-4 -mb-4 rounded-b-xl border-t p-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)),
      ...restProps
    })}>`);
    children?.($$renderer2);
    $$renderer2.push(`<!----> `);
    if (showCloseButton) {
      $$renderer2.push("<!--[0-->");
      {
        let child = function($$renderer3, { props }) {
          Button($$renderer3, spread_props([
            { variant: "outline" },
            props,
            {
              children: ($$renderer4) => {
                $$renderer4.push(`<!---->Close`);
              },
              $$slots: { default: true }
            }
          ]));
        };
        if (Dialog_close) {
          $$renderer2.push("<!--[-->");
          Dialog_close($$renderer2, { child, $$slots: { child: true } });
          $$renderer2.push("<!--]-->");
        } else {
          $$renderer2.push("<!--[!-->");
          $$renderer2.push("<!--]-->");
        }
      }
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div>`);
    bind_props($$props, { ref });
  });
}

export { Dialog_footer as D };
//# sourceMappingURL=dialog-footer-CULuct0c.js.map
