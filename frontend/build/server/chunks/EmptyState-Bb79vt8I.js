import { k as attr_class, l as stringify, m as escape_html, d as derived, o as spread_props } from './renderer--hvGDOOw.js';
import { I as Icon } from './Icon-B86w_tDb.js';
import { B as Button } from './button-ntOmtgiY.js';

function Boxes($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    [
      "path",
      {
        "d": "M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42Z"
      }
    ],
    ["path", { "d": "m7 16.5-4.74-2.85" }],
    ["path", { "d": "m7 16.5 5-3" }],
    ["path", { "d": "M7 16.5v5.17" }],
    [
      "path",
      {
        "d": "M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3Z"
      }
    ],
    ["path", { "d": "m17 16.5-5-3" }],
    ["path", { "d": "m17 16.5 4.74-2.85" }],
    ["path", { "d": "M17 16.5v5.17" }],
    [
      "path",
      {
        "d": "M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8Z"
      }
    ],
    ["path", { "d": "M12 8 7.26 5.15" }],
    ["path", { "d": "m12 8 4.74-2.85" }],
    ["path", { "d": "M12 13.5V8" }]
  ];
  Icon($$renderer, spread_props([{ name: "boxes" }, props, { iconNode }]));
}
function EmptyState($$renderer, $$props) {
  let {
    icon: Icon2,
    heading,
    body,
    ctaLabel,
    ctaHref,
    fullPage = false,
    class: className = ""
  } = $$props;
  const hasCta = derived(() => Boolean(ctaLabel) && Boolean(ctaHref));
  $$renderer.push(`<div${attr_class(`flex flex-col items-center justify-center gap-2 py-12 text-center ${stringify(fullPage ? "mt-16" : "")} ${stringify(className)}`)}>`);
  if (Icon2) {
    $$renderer.push("<!--[-->");
    Icon2($$renderer, { class: "size-6 text-muted-foreground", "aria-hidden": "true" });
    $$renderer.push("<!--]-->");
  } else {
    $$renderer.push("<!--[!-->");
    $$renderer.push("<!--]-->");
  }
  $$renderer.push(` <h2 class="text-[18px] font-semibold leading-tight tracking-tight">${escape_html(heading)}</h2> <p class="text-[14px] text-muted-foreground">${escape_html(body)}</p> `);
  if (hasCta()) {
    $$renderer.push("<!--[0-->");
    Button($$renderer, {
      href: ctaHref,
      class: "mt-2",
      children: ($$renderer2) => {
        $$renderer2.push(`<!---->${escape_html(ctaLabel)}`);
      },
      $$slots: { default: true }
    });
  } else {
    $$renderer.push("<!--[-1-->");
  }
  $$renderer.push(`<!--]--></div>`);
}

export { Boxes as B, EmptyState as E };
//# sourceMappingURL=EmptyState-Bb79vt8I.js.map
