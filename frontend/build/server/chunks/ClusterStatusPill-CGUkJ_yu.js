import { n as spread_props, j as attr_class, k as stringify, l as escape_html, d as derived } from './renderer-5OqEGBJa.js';
import { C as Circle_check_big, S as Shield_alert } from './shield-alert-DeUzDBBh.js';
import { I as Icon } from './button-B5bCAdGN.js';

function Plug($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["path", { "d": "M12 22v-5" }],
    ["path", { "d": "M15 8V2" }],
    [
      "path",
      {
        "d": "M17 8a1 1 0 0 1 1 1v4a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1z"
      }
    ],
    ["path", { "d": "M9 8V2" }]
  ];
  Icon($$renderer, spread_props([{ name: "plug" }, props, { iconNode }]));
}
function Clock($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["circle", { "cx": "12", "cy": "12", "r": "10" }],
    ["path", { "d": "M12 6v6l4 2" }]
  ];
  Icon($$renderer, spread_props([{ name: "clock" }, props, { iconNode }]));
}
function ClusterStatusPill($$renderer, $$props) {
  let { status, label, since, class: className = "" } = $$props;
  const defaultLabel = derived(() => status === "ok" ? "Connection OK" : status === "failed" ? "Connection failed" : status === "stale" ? `Stale (last seen ${since ?? "unknown"})` : "Not yet tested");
  const colorClasses = derived(() => status === "ok" ? "bg-success/10 border-success/30 text-success" : status === "failed" ? "bg-destructive/10 border-destructive/30 text-destructive" : status === "stale" ? "bg-warning/10 border-warning/30 text-warning" : "bg-muted border-border text-muted-foreground");
  $$renderer.push(`<span${attr_class(`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[13px] font-medium ${stringify(colorClasses())} ${stringify(className)}`)} role="status">`);
  if (status === "ok") {
    $$renderer.push("<!--[0-->");
    Circle_check_big($$renderer, { class: "size-3.5", "aria-hidden": "true" });
  } else if (status === "failed") {
    $$renderer.push("<!--[1-->");
    Shield_alert($$renderer, { class: "size-3.5", "aria-hidden": "true" });
  } else if (status === "stale") {
    $$renderer.push("<!--[2-->");
    Clock($$renderer, { class: "size-3.5", "aria-hidden": "true" });
  } else {
    $$renderer.push("<!--[-1-->");
    Plug($$renderer, { class: "size-3.5", "aria-hidden": "true" });
  }
  $$renderer.push(`<!--]--> <span>${escape_html(label ?? defaultLabel())}</span></span>`);
}

export { ClusterStatusPill as C, Clock as a };
//# sourceMappingURL=ClusterStatusPill-CGUkJ_yu.js.map
