import { h as bind_props, c as escape_html, d as derived } from './renderer-mZFfBJIU.js';
import { A as Alert_dialog, a as Alert_dialog_content, b as Alert_dialog_header, c as Alert_dialog_title, d as Alert_dialog_description, e as Alert_dialog_footer } from './alert-dialog-description-C3hFoiPT.js';
import { B as Button } from './button-CE_GHowG.js';
import 'clsx';
import { I as Input } from './input-Be3KOSVg.js';
import { L as Label } from './label-Cf-Bm-qJ.js';

function ConfirmByNameDialog($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      open = false,
      heading,
      body,
      targetName,
      confirmLabel,
      cancelLabel = "Cancel",
      destructive = true,
      onConfirm,
      onCancel
    } = $$props;
    let typed = "";
    let busy = false;
    const matches = derived(() => typed.trim() === targetName.trim());
    const showHint = derived(() => typed.length > 0 && !matches());
    function onKeydown(event) {
      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
      }
    }
    async function handleConfirm() {
      if (!matches() || busy) return;
      busy = true;
      try {
        await onConfirm();
      } finally {
        busy = false;
        open = false;
      }
    }
    function handleCancel() {
      onCancel?.();
      open = false;
    }
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      if (Alert_dialog) {
        $$renderer3.push("<!--[-->");
        Alert_dialog($$renderer3, {
          get open() {
            return open;
          },
          set open($$value) {
            open = $$value;
            $$settled = false;
          },
          children: ($$renderer4) => {
            if (Alert_dialog_content) {
              $$renderer4.push("<!--[-->");
              Alert_dialog_content($$renderer4, {
                children: ($$renderer5) => {
                  if (Alert_dialog_header) {
                    $$renderer5.push("<!--[-->");
                    Alert_dialog_header($$renderer5, {
                      children: ($$renderer6) => {
                        if (Alert_dialog_title) {
                          $$renderer6.push("<!--[-->");
                          Alert_dialog_title($$renderer6, {
                            children: ($$renderer7) => {
                              $$renderer7.push(`<!---->${escape_html(heading)}`);
                            },
                            $$slots: { default: true }
                          });
                          $$renderer6.push("<!--]-->");
                        } else {
                          $$renderer6.push("<!--[!-->");
                          $$renderer6.push("<!--]-->");
                        }
                        $$renderer6.push(` `);
                        if (Alert_dialog_description) {
                          $$renderer6.push("<!--[-->");
                          Alert_dialog_description($$renderer6, {
                            children: ($$renderer7) => {
                              $$renderer7.push(`<!---->${escape_html(body)}`);
                            },
                            $$slots: { default: true }
                          });
                          $$renderer6.push("<!--]-->");
                        } else {
                          $$renderer6.push("<!--[!-->");
                          $$renderer6.push("<!--]-->");
                        }
                      },
                      $$slots: { default: true }
                    });
                    $$renderer5.push("<!--]-->");
                  } else {
                    $$renderer5.push("<!--[!-->");
                    $$renderer5.push("<!--]-->");
                  }
                  $$renderer5.push(` <div class="flex flex-col gap-2">`);
                  Label($$renderer5, {
                    for: "confirm-by-name-input",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->Type <code class="bg-muted rounded px-1 py-0.5 font-mono text-xs">${escape_html(targetName)}</code> to confirm`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> `);
                  Input($$renderer5, {
                    id: "confirm-by-name-input",
                    type: "text",
                    autocomplete: "off",
                    autocapitalize: "off",
                    autocorrect: "off",
                    spellcheck: false,
                    onkeydown: onKeydown,
                    "aria-invalid": showHint() ? "true" : void 0,
                    "aria-describedby": showHint() ? "confirm-by-name-hint" : void 0,
                    get value() {
                      return typed;
                    },
                    set value($$value) {
                      typed = $$value;
                      $$settled = false;
                    }
                  });
                  $$renderer5.push(`<!----> `);
                  if (showHint()) {
                    $$renderer5.push("<!--[0-->");
                    $$renderer5.push(`<p id="confirm-by-name-hint" class="text-destructive text-[13px]">Doesn't match — type the name exactly.</p>`);
                  } else {
                    $$renderer5.push("<!--[-1-->");
                  }
                  $$renderer5.push(`<!--]--></div> `);
                  if (Alert_dialog_footer) {
                    $$renderer5.push("<!--[-->");
                    Alert_dialog_footer($$renderer5, {
                      children: ($$renderer6) => {
                        Button($$renderer6, {
                          variant: "ghost",
                          onclick: handleCancel,
                          disabled: busy,
                          children: ($$renderer7) => {
                            $$renderer7.push(`<!---->${escape_html(cancelLabel)}`);
                          },
                          $$slots: { default: true }
                        });
                        $$renderer6.push(`<!----> `);
                        Button($$renderer6, {
                          variant: destructive ? "destructive" : "default",
                          disabled: !matches() || busy,
                          onclick: handleConfirm,
                          children: ($$renderer7) => {
                            $$renderer7.push(`<!---->${escape_html(confirmLabel)}`);
                          },
                          $$slots: { default: true }
                        });
                        $$renderer6.push(`<!---->`);
                      },
                      $$slots: { default: true }
                    });
                    $$renderer5.push("<!--]-->");
                  } else {
                    $$renderer5.push("<!--[!-->");
                    $$renderer5.push("<!--]-->");
                  }
                },
                $$slots: { default: true }
              });
              $$renderer4.push("<!--]-->");
            } else {
              $$renderer4.push("<!--[!-->");
              $$renderer4.push("<!--]-->");
            }
          },
          $$slots: { default: true }
        });
        $$renderer3.push("<!--]-->");
      } else {
        $$renderer3.push("<!--[!-->");
        $$renderer3.push("<!--]-->");
      }
    }
    do {
      $$settled = true;
      $$inner_renderer = $$renderer2.copy();
      $$render_inner($$inner_renderer);
    } while (!$$settled);
    $$renderer2.subsume($$inner_renderer);
    bind_props($$props, { open });
  });
}

export { ConfirmByNameDialog as C };
//# sourceMappingURL=ConfirmByNameDialog-CPP3oltV.js.map
