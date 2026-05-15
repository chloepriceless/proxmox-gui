import { z as props_id, o as attributes, y as bind_props, d as derived } from './renderer-5OqEGBJa.js';
import { f as DialogDescriptionState } from './dialog-overlay-CKQuveke.js';
import { c as createId, b as boxWith, m as mergeProps } from './input-CVUkBx6i.js';

function Dialog_description($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const uid = props_id($$renderer2);
    let {
      id = createId(uid),
      children,
      child,
      ref = null,
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    const descriptionState = DialogDescriptionState.create({
      id: boxWith(() => id),
      ref: boxWith(() => ref, (v) => ref = v)
    });
    const mergedProps = derived(() => mergeProps(restProps, descriptionState.props));
    if (child) {
      $$renderer2.push("<!--[0-->");
      child($$renderer2, { props: mergedProps() });
      $$renderer2.push(`<!---->`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div${attributes({ ...mergedProps() })}>`);
      children?.($$renderer2);
      $$renderer2.push(`<!----></div>`);
    }
    $$renderer2.push(`<!--]-->`);
    bind_props($$props, { ref });
  });
}

export { Dialog_description as D };
//# sourceMappingURL=dialog-description2-CRb016Lx.js.map
