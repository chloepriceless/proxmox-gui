import { aB as head, l as stringify, m as escape_html, h as ensure_array_like } from './renderer--hvGDOOw.js';
import { C as Card } from './card-BUGQ1elQ.js';
import { C as Card_header, a as Card_title, b as Card_content } from './card-title-DQvVyNSe.js';
import { C as Card_description } from './card-description-MliYuxx-.js';
import 'clsx';
import { B as Button } from './button-ntOmtgiY.js';
import { a as api, A as ApiError } from './client2-WJrlUD72.js';
import { R as Refresh_cw } from './refresh-cw-BeG7cXp0.js';
import { a as toast } from './toast-state.svelte-Ckj_X06S.js';
import { U as Users, a as Users_round, S as Server } from './server-BkW6jWq8.js';
import 'tailwind-merge';
import './Icon-B86w_tDb.js';

function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let syncing = false;
    let lastSync = null;
    let syncError = null;
    async function syncCatalog() {
      if (syncing) return;
      syncing = true;
      syncError = null;
      try {
        const res = await api.catalog.syncCatalog();
        lastSync = res;
        toast.success(`Catalog synced — pinned to commit ${res.commit_sha}.`);
      } catch (err) {
        lastSync = null;
        syncError = err instanceof ApiError && err.status === 403 ? "You need admin rights to sync the catalog." : "Couldn't sync the catalog. Try again.";
        toast.error(syncError);
      } finally {
        syncing = false;
      }
    }
    const adminLinks = [
      { href: "/admin/users", label: "Users", icon: Users },
      { href: "/admin/teams", label: "Teams", icon: Users_round },
      { href: "/admin/clusters", label: "Clusters", icon: Server }
    ];
    head("1jef3w8", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Admin — Proxmox GUI</title>`);
      });
    });
    $$renderer2.push(`<div class="mx-auto flex w-full max-w-3xl flex-col gap-6"><header class="flex flex-col gap-1"><h1 class="text-[22px] font-semibold tracking-tight">Admin</h1> <p class="text-muted-foreground text-[14px]">Manage users, teams, clusters, and the community-scripts catalog.</p></header> `);
    if (Card) {
      $$renderer2.push("<!--[-->");
      Card($$renderer2, {
        children: ($$renderer3) => {
          if (Card_header) {
            $$renderer3.push("<!--[-->");
            Card_header($$renderer3, {
              children: ($$renderer4) => {
                if (Card_title) {
                  $$renderer4.push("<!--[-->");
                  Card_title($$renderer4, {
                    children: ($$renderer5) => {
                      $$renderer5.push(`<!---->Community-scripts catalog`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer4.push("<!--]-->");
                } else {
                  $$renderer4.push("<!--[!-->");
                  $$renderer4.push("<!--]-->");
                }
                $$renderer4.push(` `);
                if (Card_description) {
                  $$renderer4.push("<!--[-->");
                  Card_description($$renderer4, {
                    children: ($$renderer5) => {
                      $$renderer5.push(`<!---->The catalog is pinned to a specific community-scripts commit. Sync to
        pull a fresher upstream snapshot and re-pin.`);
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
          if (Card_content) {
            $$renderer3.push("<!--[-->");
            Card_content($$renderer3, {
              class: "flex flex-col gap-3",
              children: ($$renderer4) => {
                $$renderer4.push(`<div>`);
                Button($$renderer4, {
                  onclick: syncCatalog,
                  disabled: syncing,
                  children: ($$renderer5) => {
                    Refresh_cw($$renderer5, {
                      class: `size-4 ${stringify(syncing ? "animate-spin" : "")}`,
                      "aria-hidden": "true"
                    });
                    $$renderer5.push(`<!----> ${escape_html(syncing ? "Syncing…" : "Sync catalog")}`);
                  },
                  $$slots: { default: true }
                });
                $$renderer4.push(`<!----></div> `);
                if (lastSync) {
                  $$renderer4.push("<!--[0-->");
                  $$renderer4.push(`<p class="text-[13px] text-success">${escape_html(lastSync.added)} scripts added, ${escape_html(lastSync.updated)} updated, pinned to commit <span class="font-mono">${escape_html(lastSync.commit_sha)}</span>.</p>`);
                } else if (syncError) {
                  $$renderer4.push("<!--[1-->");
                  $$renderer4.push(`<p class="text-[13px] text-destructive">${escape_html(syncError)}</p>`);
                } else {
                  $$renderer4.push("<!--[-1-->");
                }
                $$renderer4.push(`<!--]-->`);
              },
              $$slots: { default: true }
            });
            $$renderer3.push("<!--]-->");
          } else {
            $$renderer3.push("<!--[!-->");
            $$renderer3.push("<!--]-->");
          }
        },
        $$slots: { default: true }
      });
      $$renderer2.push("<!--]-->");
    } else {
      $$renderer2.push("<!--[!-->");
      $$renderer2.push("<!--]-->");
    }
    $$renderer2.push(` `);
    if (Card) {
      $$renderer2.push("<!--[-->");
      Card($$renderer2, {
        children: ($$renderer3) => {
          if (Card_header) {
            $$renderer3.push("<!--[-->");
            Card_header($$renderer3, {
              children: ($$renderer4) => {
                if (Card_title) {
                  $$renderer4.push("<!--[-->");
                  Card_title($$renderer4, {
                    children: ($$renderer5) => {
                      $$renderer5.push(`<!---->Manage`);
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
          if (Card_content) {
            $$renderer3.push("<!--[-->");
            Card_content($$renderer3, {
              class: "flex flex-wrap gap-2",
              children: ($$renderer4) => {
                $$renderer4.push(`<!--[-->`);
                const each_array = ensure_array_like(adminLinks);
                for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
                  let link = each_array[$$index];
                  const Icon = link.icon;
                  Button($$renderer4, {
                    href: link.href,
                    variant: "outline",
                    children: ($$renderer5) => {
                      if (Icon) {
                        $$renderer5.push("<!--[-->");
                        Icon($$renderer5, { class: "size-4", "aria-hidden": "true" });
                        $$renderer5.push("<!--]-->");
                      } else {
                        $$renderer5.push("<!--[!-->");
                        $$renderer5.push("<!--]-->");
                      }
                      $$renderer5.push(` ${escape_html(link.label)}`);
                    },
                    $$slots: { default: true }
                  });
                }
                $$renderer4.push(`<!--]-->`);
              },
              $$slots: { default: true }
            });
            $$renderer3.push("<!--]-->");
          } else {
            $$renderer3.push("<!--[!-->");
            $$renderer3.push("<!--]-->");
          }
        },
        $$slots: { default: true }
      });
      $$renderer2.push("<!--]-->");
    } else {
      $$renderer2.push("<!--[!-->");
      $$renderer2.push("<!--]-->");
    }
    $$renderer2.push(`</div>`);
  });
}

export { _page as default };
//# sourceMappingURL=_page.svelte-BZNLj00k.js.map
