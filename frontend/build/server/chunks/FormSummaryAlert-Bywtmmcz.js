import { d as derived, f as ensure_array_like, h as attr, k as stringify, l as escape_html } from './renderer-5OqEGBJa.js';
import { A as Alert } from './alert-DKR6l6LD.js';
import { A as Alert_description } from './alert-description-BLye52mR.js';
import { A as Alert_title } from './alert-title-MPDSeCCx.js';
import 'clsx';
import { T as Triangle_alert } from './triangle-alert-BZ_xtVFE.js';

function FormSummaryAlert($$renderer, $$props) {
  let { errors, id } = $$props;
  const entries = derived(() => Object.entries(errors));
  if (entries().length > 0) {
    $$renderer.push("<!--[0-->");
    if (Alert) {
      $$renderer.push("<!--[-->");
      Alert($$renderer, {
        variant: "destructive",
        id,
        "aria-live": "polite",
        children: ($$renderer2) => {
          Triangle_alert($$renderer2, { "aria-hidden": "true" });
          $$renderer2.push(`<!----> `);
          if (Alert_title) {
            $$renderer2.push("<!--[-->");
            Alert_title($$renderer2, {
              children: ($$renderer3) => {
                $$renderer3.push(`<!---->Please fix the following:`);
              },
              $$slots: { default: true }
            });
            $$renderer2.push("<!--]-->");
          } else {
            $$renderer2.push("<!--[!-->");
            $$renderer2.push("<!--]-->");
          }
          $$renderer2.push(` `);
          if (Alert_description) {
            $$renderer2.push("<!--[-->");
            Alert_description($$renderer2, {
              children: ($$renderer3) => {
                $$renderer3.push(`<ul class="mt-2 list-disc space-y-1 pl-5"><!--[-->`);
                const each_array = ensure_array_like(entries());
                for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
                  let [fieldName, message] = each_array[$$index];
                  $$renderer3.push(`<li><a${attr("href", `#${stringify(fieldName)}`)} class="text-destructive underline underline-offset-2 hover:no-underline"><span class="sr-only">${escape_html(fieldName)}:</span>${escape_html(message)}</a></li>`);
                }
                $$renderer3.push(`<!--]--></ul>`);
              },
              $$slots: { default: true }
            });
            $$renderer2.push("<!--]-->");
          } else {
            $$renderer2.push("<!--[!-->");
            $$renderer2.push("<!--]-->");
          }
        },
        $$slots: { default: true }
      });
      $$renderer.push("<!--]-->");
    } else {
      $$renderer.push("<!--[!-->");
      $$renderer.push("<!--]-->");
    }
  } else {
    $$renderer.push("<!--[-1-->");
  }
  $$renderer.push(`<!--]-->`);
}

export { FormSummaryAlert as F };
//# sourceMappingURL=FormSummaryAlert-Bywtmmcz.js.map
