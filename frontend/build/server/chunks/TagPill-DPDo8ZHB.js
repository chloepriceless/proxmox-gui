import { o as spread_props, l as attr_class, m as stringify, k as attr, c as escape_html, d as derived } from './renderer-mZFfBJIU.js';
import { I as Icon } from './Icon-oF8immWv.js';

function Play($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    [
      "path",
      {
        "d": "M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"
      }
    ]
  ];
  Icon($$renderer, spread_props([{ name: "play" }, props, { iconNode }]));
}
function Square($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    [
      "rect",
      { "width": "18", "height": "18", "x": "3", "y": "3", "rx": "2" }
    ]
  ];
  Icon($$renderer, spread_props([{ name: "square" }, props, { iconNode }]));
}
function Power($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["path", { "d": "M12 2v10" }],
    ["path", { "d": "M18.4 6.6a9 9 0 1 1-12.77.04" }]
  ];
  Icon($$renderer, spread_props([{ name: "power" }, props, { iconNode }]));
}
const PALETTE = [
  "bg-primary/10 border-primary/30 text-primary",
  // 0
  "bg-success/10 border-success/30 text-success",
  // 1
  "bg-warning/10 border-warning/30 text-warning",
  // 2
  "bg-destructive/10 border-destructive/30 text-destructive",
  // 3
  "bg-muted border-border text-foreground",
  // 4
  "bg-primary/5 border-primary/20 text-primary",
  // 5
  "bg-success/5 border-success/20 text-success",
  // 6
  "bg-warning/5 border-warning/20 text-warning",
  // 7
  "bg-destructive/5 border-destructive/20 text-destructive",
  // 8
  "bg-muted/80 border-border text-muted-foreground",
  // 9
  "bg-primary/15 border-primary/40 text-primary",
  // 10
  "bg-muted/60 border-border text-foreground"
  // 11
];
function paletteFor(tag) {
  let h = 2166136261;
  for (let i = 0; i < tag.length; i++) {
    h ^= tag.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return PALETTE[h % PALETTE.length];
}
function TagPill($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { tag, onClick, class: className = "" } = $$props;
    const palette = derived(() => paletteFor(tag));
    if (onClick) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<button type="button"${attr_class(`inline-flex items-center h-6 px-2 rounded-md border text-[13px] font-medium ${stringify(palette())} ${stringify(className)}`)}${attr("aria-label", `Tag ${tag}`)}>${escape_html(tag)}</button>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<span${attr_class(`inline-flex items-center h-6 px-2 rounded-md border text-[13px] font-medium ${stringify(palette())} ${stringify(className)}`)}${attr("aria-label", `Tag ${tag}`)}>${escape_html(tag)}</span>`);
    }
    $$renderer2.push(`<!--]-->`);
  });
}

export { Play as P, Square as S, TagPill as T, Power as a };
//# sourceMappingURL=TagPill-DPDo8ZHB.js.map
