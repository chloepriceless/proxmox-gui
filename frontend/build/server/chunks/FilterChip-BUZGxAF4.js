import { j as attr_class, l as escape_html, h as attr, k as stringify } from './renderer-5OqEGBJa.js';
import { L as Lock } from './lock-DL53n3Lr.js';
import { X } from './x-DmQKkO3M.js';

function FilterChip($$renderer, $$props) {
  let {
    label,
    onRemove,
    locked = false,
    statusColor,
    class: className = ""
  } = $$props;
  $$renderer.push(`<span${attr_class(`inline-flex items-center gap-2 h-7 px-2 rounded-md border border-border bg-muted text-foreground text-[13px] font-medium ${stringify(className)}`)}>`);
  if (statusColor) {
    $$renderer.push("<!--[0-->");
    $$renderer.push(`<span${attr_class(`size-2 rounded-full ${stringify(statusColor)}`)} aria-hidden="true"></span>`);
  } else {
    $$renderer.push("<!--[-1-->");
  }
  $$renderer.push(`<!--]--> <span>${escape_html(label)}</span> `);
  if (locked) {
    $$renderer.push("<!--[0-->");
    Lock($$renderer, { class: "size-3 text-muted-foreground", "aria-hidden": "true" });
  } else if (onRemove) {
    $$renderer.push("<!--[1-->");
    $$renderer.push(`<button type="button" class="-mr-1 inline-flex size-4 items-center justify-center rounded hover:bg-destructive/10 hover:text-destructive"${attr("aria-label", `Remove filter ${label}`)}>`);
    X($$renderer, { class: "size-3" });
    $$renderer.push(`<!----></button>`);
  } else {
    $$renderer.push("<!--[-1-->");
  }
  $$renderer.push(`<!--]--></span>`);
}

export { FilterChip as F };
//# sourceMappingURL=FilterChip-BUZGxAF4.js.map
