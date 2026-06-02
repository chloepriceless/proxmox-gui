import { x as run, c as escape_html } from './renderer-mZFfBJIU.js';
import 'clsx';
import { C as Card } from './card-xlHxCeq2.js';
import { C as Card_header, b as Card_content, a as Card_title } from './card-title-D9QrKn4F.js';
import { C as Card_description } from './card-description-DQE8zzIh.js';
import { B as Button } from './button-CE_GHowG.js';
import { I as Input } from './input-Be3KOSVg.js';
import { L as Label } from './label-Cf-Bm-qJ.js';
import { ApiError, apiJson, apiFetch } from './api-By_nInf4.js';
import { a as toast } from './toast-state.svelte-Bp1lssrC.js';
import 'tailwind-merge';

function withFetch(opts, init) {
  return init;
}
async function startSelfUpdate(targetVersion, opts) {
  return apiJson(
    "/admin/self-update/",
    withFetch(opts, {
      method: "POST",
      body: {}
    })
  );
}
async function health(opts) {
  try {
    const res = await apiFetch("/health", withFetch(opts, { method: "GET" }));
    return res.ok;
  } catch {
    return false;
  }
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    let idleTimeout = run(() => data.settings?.idle_timeout_minutes ?? 30);
    let retentionDays = run(() => data.settings?.audit_retention_days ?? 365);
    let saving = false;
    let updating = false;
    let updateMessage = null;
    let updateError = null;
    async function runSelfUpdate() {
      if (updating) return;
      updating = true;
      updateError = null;
      try {
        const { job_id } = await startSelfUpdate();
        updateMessage = `Update started (task #${job_id}). The app will restart and reconnect automatically — watch the Tasks drawer for progress.`;
        toast(`Self-update started (task #${job_id}).`);
        await pollHealthThenReload();
      } catch (err) {
        updating = false;
        const msg = err instanceof ApiError ? err.message : "Try again.";
        updateError = `Couldn't start the update. ${msg}`;
        toast.error("Couldn’t start the self-update.");
      }
    }
    async function pollHealthThenReload() {
      const start = Date.now();
      const MAX_MS = 5 * 60 * 1e3;
      let sawDown = false;
      while (Date.now() - start < MAX_MS) {
        await new Promise((r) => setTimeout(r, 3e3));
        const ok = await health();
        if (!ok) {
          sawDown = true;
          continue;
        }
        if (sawDown) {
          window.location.reload();
          return;
        }
      }
      updating = false;
      updateError = "The update is taking longer than expected — check the Tasks drawer for its status.";
    }
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      $$renderer3.push(`<header class="mb-6"><h1 class="text-[28px] font-semibold tracking-tight">Settings</h1> <p class="text-muted-foreground mt-1 text-sm">Installation-wide settings for sessions, audit retention, and updates.</p></header> <div class="flex max-w-2xl flex-col gap-6">`);
      if (Card) {
        $$renderer3.push("<!--[-->");
        Card($$renderer3, {
          children: ($$renderer4) => {
            if (Card_header) {
              $$renderer4.push("<!--[-->");
              Card_header($$renderer4, {
                children: ($$renderer5) => {
                  if (Card_title) {
                    $$renderer5.push("<!--[-->");
                    Card_title($$renderer5, {
                      children: ($$renderer6) => {
                        $$renderer6.push(`<!---->General`);
                      },
                      $$slots: { default: true }
                    });
                    $$renderer5.push("<!--]-->");
                  } else {
                    $$renderer5.push("<!--[!-->");
                    $$renderer5.push("<!--]-->");
                  }
                  $$renderer5.push(` `);
                  if (Card_description) {
                    $$renderer5.push("<!--[-->");
                    Card_description($$renderer5, {
                      children: ($$renderer6) => {
                        $$renderer6.push(`<!---->Session idle timeout and audit log retention.`);
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
            $$renderer4.push(` `);
            if (Card_content) {
              $$renderer4.push("<!--[-->");
              Card_content($$renderer4, {
                children: ($$renderer5) => {
                  $$renderer5.push(`<form class="flex flex-col gap-4"><div class="flex flex-col gap-1.5">`);
                  Label($$renderer5, {
                    for: "idle_timeout_minutes",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->Idle timeout (minutes)`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> `);
                  Input($$renderer5, {
                    id: "idle_timeout_minutes",
                    type: "number",
                    min: "1",
                    max: "1440",
                    class: "max-w-[12rem]",
                    get value() {
                      return idleTimeout;
                    },
                    set value($$value) {
                      idleTimeout = $$value;
                      $$settled = false;
                    }
                  });
                  $$renderer5.push(`<!----> <p class="text-muted-foreground text-[13px]">Users are signed out after this long without activity (a warning shows
            2 minutes before).</p></div> <div class="flex flex-col gap-1.5">`);
                  Label($$renderer5, {
                    for: "audit_retention_days",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->Audit retention (days)`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> `);
                  Input($$renderer5, {
                    id: "audit_retention_days",
                    type: "number",
                    min: "1",
                    max: "3650",
                    class: "max-w-[12rem]",
                    get value() {
                      return retentionDays;
                    },
                    set value($$value) {
                      retentionDays = $$value;
                      $$settled = false;
                    }
                  });
                  $$renderer5.push(`<!----> <p class="text-muted-foreground text-[13px]">Audit entries older than this are rolled into compressed archives
            nightly.</p></div> <div>`);
                  Button($$renderer5, {
                    type: "submit",
                    disabled: saving,
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->${escape_html("Save changes")}`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----></div></form>`);
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
      $$renderer3.push(` `);
      if (Card) {
        $$renderer3.push("<!--[-->");
        Card($$renderer3, {
          children: ($$renderer4) => {
            if (Card_header) {
              $$renderer4.push("<!--[-->");
              Card_header($$renderer4, {
                children: ($$renderer5) => {
                  if (Card_title) {
                    $$renderer5.push("<!--[-->");
                    Card_title($$renderer5, {
                      children: ($$renderer6) => {
                        $$renderer6.push(`<!---->Self-update`);
                      },
                      $$slots: { default: true }
                    });
                    $$renderer5.push("<!--]-->");
                  } else {
                    $$renderer5.push("<!--[!-->");
                    $$renderer5.push("<!--]-->");
                  }
                  $$renderer5.push(` `);
                  if (Card_description) {
                    $$renderer5.push("<!--[-->");
                    Card_description($$renderer5, {
                      children: ($$renderer6) => {
                        $$renderer6.push(`<!---->Pull the latest tagged release, verify it, and apply it with an automatic
        rollback if the new version fails its health check.`);
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
            $$renderer4.push(` `);
            if (Card_content) {
              $$renderer4.push("<!--[-->");
              Card_content($$renderer4, {
                class: "flex flex-col gap-3",
                children: ($$renderer5) => {
                  if (updateMessage) {
                    $$renderer5.push("<!--[0-->");
                    $$renderer5.push(`<p class="text-[14px]" role="status" aria-live="polite">${escape_html(updateMessage)}</p>`);
                  } else {
                    $$renderer5.push("<!--[-1-->");
                  }
                  $$renderer5.push(`<!--]--> `);
                  if (updateError) {
                    $$renderer5.push("<!--[0-->");
                    $$renderer5.push(`<p class="text-destructive text-[14px]" role="alert">${escape_html(updateError)}</p>`);
                  } else {
                    $$renderer5.push("<!--[-1-->");
                  }
                  $$renderer5.push(`<!--]--> <div>`);
                  Button($$renderer5, {
                    onclick: runSelfUpdate,
                    disabled: updating,
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->${escape_html(updating ? "Updating…" : "Update now")}`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----></div>`);
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
      $$renderer3.push(`</div>`);
    }
    do {
      $$settled = true;
      $$inner_renderer = $$renderer2.copy();
      $$render_inner($$inner_renderer);
    } while (!$$settled);
    $$renderer2.subsume($$inner_renderer);
  });
}

export { _page as default };
//# sourceMappingURL=_page.svelte-C_2GDUzi.js.map
