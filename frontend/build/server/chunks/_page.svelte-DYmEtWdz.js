import { x as run, aB as head, m as escape_html, j as attr, h as ensure_array_like, d as derived } from './renderer--hvGDOOw.js';
import { g as goto } from './client-bCVElyx1.js';
import { C as Card } from './card-BUGQ1elQ.js';
import { C as Card_header, b as Card_content, a as Card_title } from './card-title-DQvVyNSe.js';
import { C as Card_description } from './card-description-MliYuxx-.js';
import 'clsx';
import { A as Alert } from './alert-CDmFQdZq.js';
import { A as Alert_title } from './alert-title-BufPPCWl.js';
import { S as Select, a as Select_trigger, b as Select_content, c as Select_item } from './select-trigger-DyCtkrT3.js';
import { B as Button } from './button-ntOmtgiY.js';
import { I as Input } from './input-Buwd_f-b.js';
import { L as Label } from './label-7gbcsuPJ.js';
import { C as Checkbox } from './checkbox-BaIm7C4I.js';
import { S as Switch } from './switch-CO9eG-qb.js';
import { F as FormSummaryAlert } from './FormSummaryAlert-Cd0-Zz2l.js';
import { C as ConfirmByNameDialog } from './ConfirmByNameDialog-97SqJ_Il.js';
import { C as ClusterStatusPill } from './ClusterStatusPill-CFkkKC5-.js';
import { a as api, A as ApiError } from './client2-WJrlUD72.js';
import { A as Arrow_left } from './arrow-left-D4uZBeO1.js';
import { a as toast } from './toast-state.svelte-Ckj_X06S.js';
import { T as Triangle_alert } from './triangle-alert-D6NlG2tC.js';
import { L as Loader_circle } from './loader-circle-CtiWA2FY.js';
import '@sveltejs/kit/internal';
import './root-DHp9To-z.js';
import './index-B54IuS4T.js';
import '@sveltejs/kit/internal/server';
import './state.svelte-BYtSRxhp.js';
import './popper-layer-force-mount-DL2Z2See.js';
import './scroll-lock-CGoEUeDJ.js';
import './is-HJ-O5XFN.js';
import './noop-n4I-x7yK.js';
import './hidden-input-C4DjPWyi.js';
import './sr-only-styles-BFTOatBw.js';
import './check-Czpunie5.js';
import './Icon-B86w_tDb.js';
import './chevron-up-BjMYcytG.js';
import './chevron-down-C_ZM4_gT.js';
import 'tailwind-merge';
import './clone-BTaVLdQ_.js';
import './alert-description-Cz6DQ4pO.js';
import './alert-dialog-description-CQsrn2hX.js';
import './dialog-description-BW9UDPMx.js';
import './shield-alert-C6UufUOa.js';
import './clock-D1v6CFWO.js';

function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    let name = run(() => data.cluster.name);
    let host = run(() => data.cluster.host);
    let port = run(() => data.cluster.port);
    let tokenUser = run(() => data.cluster.token_user);
    let tokenName = run(() => data.cluster.token_name);
    let tlsFingerprint = run(() => data.cluster.tls_fingerprint ?? "");
    let verifySsl = run(() => data.cluster.verify_ssl);
    let notes = run(() => data.cluster.notes ?? "");
    let isActive = run(() => data.cluster.is_active);
    const NONE_STORAGE = "__none__";
    let backupStorage = run(() => data.cluster.backup_storage ?? NONE_STORAGE);
    let backupStorages = [];
    const backupStorageLabel = derived(() => backupStorage === NONE_STORAGE ? "None — backups disabled" : backupStorage);
    let saving = false;
    let testing = false;
    let fieldErrors = {};
    let testResult = null;
    async function handleTest() {
      testing = true;
      testResult = null;
      try {
        const res = await api.clusters.testExisting({ id: data.cluster.id });
        if (res.ok) {
          testResult = {
            status: "ok",
            label: res.version ? `Connection OK (${res.version})` : "Connection OK"
          };
        } else {
          testResult = {
            status: "failed",
            detail: res.error ?? "Couldn't connect to that cluster."
          };
        }
      } catch {
        testResult = { status: "failed", detail: "Couldn't reach that cluster." };
      } finally {
        testing = false;
      }
    }
    let deleteOpen = false;
    async function handleDelete() {
      try {
        await api.clusters.del({ id: data.cluster.id });
        toast.success(`${data.cluster.name} was deleted.`);
        await goto("/admin/clusters");
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          const detail = String(err.body?.detail ?? "");
          toast.error(detail || "Couldn't delete: cluster has active team bindings.");
        } else {
          toast.error("Couldn't delete that cluster.");
        }
      }
    }
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      head("1j9eq74", $$renderer3, ($$renderer4) => {
        $$renderer4.title(($$renderer5) => {
          $$renderer5.push(`<title>${escape_html(data.cluster.name)} — Clusters — Proxmox GUI</title>`);
        });
      });
      $$renderer3.push(`<div class="mx-auto flex w-full max-w-[720px] flex-col gap-6"><header class="flex flex-col gap-2"><a href="/admin/clusters" class="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-[13px]">`);
      Arrow_left($$renderer3, { class: "size-4", "aria-hidden": "true" });
      $$renderer3.push(`<!----> Back to Clusters</a> <h1 class="text-[28px] font-semibold tracking-tight">${escape_html(data.cluster.name)}</h1> <p class="text-muted-foreground text-sm">Edit this cluster's connection details and credentials.</p></header> `);
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
                      class: "text-lg font-semibold tracking-tight",
                      children: ($$renderer6) => {
                        $$renderer6.push(`<!---->Cluster details`);
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
                        $$renderer6.push(`<!---->Change the cluster's name, host, token, or fingerprint. Leave the token field hidden to keep
        the stored value.`);
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
                  $$renderer5.push(`<form class="flex flex-col gap-4" novalidate="">`);
                  FormSummaryAlert($$renderer5, { errors: fieldErrors, id: "cluster-edit-summary" });
                  $$renderer5.push(`<!----> `);
                  {
                    $$renderer5.push("<!--[-1-->");
                  }
                  $$renderer5.push(`<!--]--> <div class="flex flex-col gap-2">`);
                  Label($$renderer5, {
                    for: "cluster-edit-name",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->Name`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> `);
                  Input($$renderer5, {
                    id: "cluster-edit-name",
                    type: "text",
                    autocomplete: "off",
                    spellcheck: false,
                    disabled: saving,
                    required: true,
                    "aria-invalid": fieldErrors["cluster-edit-name"] ? "true" : void 0,
                    get value() {
                      return name;
                    },
                    set value($$value) {
                      name = $$value;
                      $$settled = false;
                    }
                  });
                  $$renderer5.push(`<!----> `);
                  if (fieldErrors["cluster-edit-name"]) {
                    $$renderer5.push("<!--[0-->");
                    $$renderer5.push(`<p class="text-destructive text-[13px]">${escape_html(fieldErrors["cluster-edit-name"])}</p>`);
                  } else {
                    $$renderer5.push("<!--[-1-->");
                    $$renderer5.push(`<p class="text-muted-foreground text-[13px]">A short identifier you'll see in lists.</p>`);
                  }
                  $$renderer5.push(`<!--]--></div> <div class="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_120px]"><div class="flex flex-col gap-2">`);
                  Label($$renderer5, {
                    for: "cluster-edit-host",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->Host`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> `);
                  Input($$renderer5, {
                    id: "cluster-edit-host",
                    type: "text",
                    autocomplete: "off",
                    spellcheck: false,
                    disabled: saving,
                    required: true,
                    "aria-invalid": fieldErrors["cluster-edit-host"] ? "true" : void 0,
                    get value() {
                      return host;
                    },
                    set value($$value) {
                      host = $$value;
                      $$settled = false;
                    }
                  });
                  $$renderer5.push(`<!----> `);
                  if (fieldErrors["cluster-edit-host"]) {
                    $$renderer5.push("<!--[0-->");
                    $$renderer5.push(`<p class="text-destructive text-[13px]">${escape_html(fieldErrors["cluster-edit-host"])}</p>`);
                  } else {
                    $$renderer5.push("<!--[-1-->");
                    $$renderer5.push(`<p class="text-muted-foreground text-[13px]">Hostname or IP of the Proxmox cluster.</p>`);
                  }
                  $$renderer5.push(`<!--]--></div> <div class="flex flex-col gap-2">`);
                  Label($$renderer5, {
                    for: "cluster-edit-port",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->Port`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> `);
                  Input($$renderer5, {
                    id: "cluster-edit-port",
                    type: "number",
                    min: 1,
                    max: 65535,
                    disabled: saving,
                    required: true,
                    "aria-invalid": fieldErrors["cluster-edit-port"] ? "true" : void 0,
                    style: "font-variant-numeric: tabular-nums;",
                    get value() {
                      return port;
                    },
                    set value($$value) {
                      port = $$value;
                      $$settled = false;
                    }
                  });
                  $$renderer5.push(`<!----> `);
                  if (fieldErrors["cluster-edit-port"]) {
                    $$renderer5.push("<!--[0-->");
                    $$renderer5.push(`<p class="text-destructive text-[13px]">${escape_html(fieldErrors["cluster-edit-port"])}</p>`);
                  } else {
                    $$renderer5.push("<!--[-1-->");
                  }
                  $$renderer5.push(`<!--]--></div></div> <div class="grid grid-cols-1 gap-4 sm:grid-cols-2"><div class="flex flex-col gap-2">`);
                  Label($$renderer5, {
                    for: "cluster-edit-token-user",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->Token user`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> `);
                  Input($$renderer5, {
                    id: "cluster-edit-token-user",
                    type: "text",
                    autocomplete: "off",
                    spellcheck: false,
                    disabled: saving,
                    required: true,
                    "aria-invalid": fieldErrors["cluster-edit-token-user"] ? "true" : void 0,
                    class: "font-mono text-[13px]",
                    get value() {
                      return tokenUser;
                    },
                    set value($$value) {
                      tokenUser = $$value;
                      $$settled = false;
                    }
                  });
                  $$renderer5.push(`<!----> `);
                  if (fieldErrors["cluster-edit-token-user"]) {
                    $$renderer5.push("<!--[0-->");
                    $$renderer5.push(`<p class="text-destructive text-[13px]">${escape_html(fieldErrors["cluster-edit-token-user"])}</p>`);
                  } else {
                    $$renderer5.push("<!--[-1-->");
                    $$renderer5.push(`<p class="text-muted-foreground text-[13px]">e.g. root@pam</p>`);
                  }
                  $$renderer5.push(`<!--]--></div> <div class="flex flex-col gap-2">`);
                  Label($$renderer5, {
                    for: "cluster-edit-token-name",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->Token name`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> `);
                  Input($$renderer5, {
                    id: "cluster-edit-token-name",
                    type: "text",
                    autocomplete: "off",
                    spellcheck: false,
                    disabled: saving,
                    required: true,
                    "aria-invalid": fieldErrors["cluster-edit-token-name"] ? "true" : void 0,
                    class: "font-mono text-[13px]",
                    get value() {
                      return tokenName;
                    },
                    set value($$value) {
                      tokenName = $$value;
                      $$settled = false;
                    }
                  });
                  $$renderer5.push(`<!----> `);
                  if (fieldErrors["cluster-edit-token-name"]) {
                    $$renderer5.push("<!--[0-->");
                    $$renderer5.push(`<p class="text-destructive text-[13px]">${escape_html(fieldErrors["cluster-edit-token-name"])}</p>`);
                  } else {
                    $$renderer5.push("<!--[-1-->");
                    $$renderer5.push(`<p class="text-muted-foreground text-[13px]">e.g. gui</p>`);
                  }
                  $$renderer5.push(`<!--]--></div></div> <div class="flex flex-col gap-2"><div class="flex items-center justify-between">`);
                  Label($$renderer5, {
                    for: "cluster-edit-token-secret",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->API token secret`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> `);
                  {
                    $$renderer5.push("<!--[0-->");
                    $$renderer5.push(`<button type="button" class="text-primary text-[13px] font-medium underline-offset-4 hover:underline"${attr("disabled", saving, true)}>Update token</button>`);
                  }
                  $$renderer5.push(`<!--]--></div> `);
                  {
                    $$renderer5.push("<!--[-1-->");
                    Input($$renderer5, {
                      id: "cluster-edit-token-secret",
                      type: "password",
                      value: "••••••••",
                      readonly: true,
                      disabled: true,
                      "aria-readonly": "true",
                      class: "font-mono"
                    });
                    $$renderer5.push(`<!----> <p class="text-muted-foreground text-[13px]">The stored token is preserved. Click "Update token" to change it.</p>`);
                  }
                  $$renderer5.push(`<!--]--></div> <div class="flex flex-col gap-2">`);
                  Label($$renderer5, {
                    for: "cluster-edit-fingerprint",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->TLS fingerprint (optional)`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> `);
                  Input($$renderer5, {
                    id: "cluster-edit-fingerprint",
                    type: "text",
                    autocomplete: "off",
                    spellcheck: false,
                    disabled: saving,
                    class: "font-mono text-[13px]",
                    get value() {
                      return tlsFingerprint;
                    },
                    set value($$value) {
                      tlsFingerprint = $$value;
                      $$settled = false;
                    }
                  });
                  $$renderer5.push(`<!----> <p class="text-muted-foreground text-[13px]">Required only for self-signed certificates.</p></div> <div class="flex flex-col gap-2">`);
                  Label($$renderer5, {
                    for: "cluster-edit-backup-storage",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->Backup storage`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> `);
                  if (Select) {
                    $$renderer5.push("<!--[-->");
                    Select($$renderer5, {
                      type: "single",
                      get value() {
                        return backupStorage;
                      },
                      set value($$value) {
                        backupStorage = $$value;
                        $$settled = false;
                      },
                      children: ($$renderer6) => {
                        if (Select_trigger) {
                          $$renderer6.push("<!--[-->");
                          Select_trigger($$renderer6, {
                            id: "cluster-edit-backup-storage",
                            class: "w-full",
                            disabled: saving,
                            children: ($$renderer7) => {
                              $$renderer7.push(`<!---->${escape_html(backupStorageLabel())}`);
                            },
                            $$slots: { default: true }
                          });
                          $$renderer6.push("<!--]-->");
                        } else {
                          $$renderer6.push("<!--[!-->");
                          $$renderer6.push("<!--]-->");
                        }
                        $$renderer6.push(` `);
                        if (Select_content) {
                          $$renderer6.push("<!--[-->");
                          Select_content($$renderer6, {
                            children: ($$renderer7) => {
                              if (Select_item) {
                                $$renderer7.push("<!--[-->");
                                Select_item($$renderer7, {
                                  value: NONE_STORAGE,
                                  children: ($$renderer8) => {
                                    $$renderer8.push(`<!---->None — backups disabled`);
                                  },
                                  $$slots: { default: true }
                                });
                                $$renderer7.push("<!--]-->");
                              } else {
                                $$renderer7.push("<!--[!-->");
                                $$renderer7.push("<!--]-->");
                              }
                              $$renderer7.push(` <!--[-->`);
                              const each_array = ensure_array_like(backupStorages);
                              for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
                                let s = each_array[$$index];
                                if (Select_item) {
                                  $$renderer7.push("<!--[-->");
                                  Select_item($$renderer7, {
                                    value: s.storage,
                                    children: ($$renderer8) => {
                                      $$renderer8.push(`<!---->${escape_html(s.storage)}`);
                                    },
                                    $$slots: { default: true }
                                  });
                                  $$renderer7.push("<!--]-->");
                                } else {
                                  $$renderer7.push("<!--[!-->");
                                  $$renderer7.push("<!--]-->");
                                }
                              }
                              $$renderer7.push(`<!--]-->`);
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
                  $$renderer5.push(` <p class="text-muted-foreground text-[13px]">Choose the storage where this GUI runs backups for this cluster.
            Users select retention; they do not pick storage.</p></div> <div class="flex flex-row items-start gap-2 rounded-md border border-border p-3">`);
                  Checkbox($$renderer5, {
                    id: "cluster-edit-verify-ssl",
                    checked: verifySsl,
                    onCheckedChange: (v) => verifySsl = v === true,
                    disabled: saving
                  });
                  $$renderer5.push(`<!----> <div class="flex flex-col gap-1">`);
                  Label($$renderer5, {
                    for: "cluster-edit-verify-ssl",
                    class: "text-sm font-medium",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->Verify TLS`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> <p class="text-muted-foreground text-[13px]">Validate the cluster's TLS certificate chain. Uncheck for self-signed.</p></div></div> <div class="flex flex-row items-start justify-between gap-4 rounded-md border border-border p-4"><div class="flex flex-col gap-1">`);
                  Label($$renderer5, {
                    for: "cluster-edit-active",
                    class: "text-sm font-medium",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->Active`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> <p class="text-muted-foreground text-[13px]">Inactive clusters are skipped for new tenant bootstraps.</p></div> `);
                  Switch($$renderer5, {
                    id: "cluster-edit-active",
                    disabled: saving,
                    get checked() {
                      return isActive;
                    },
                    set checked($$value) {
                      isActive = $$value;
                      $$settled = false;
                    }
                  });
                  $$renderer5.push(`<!----></div> <div class="flex flex-col gap-2">`);
                  Label($$renderer5, {
                    for: "cluster-edit-notes",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->Notes (optional)`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> `);
                  Input($$renderer5, {
                    id: "cluster-edit-notes",
                    type: "text",
                    autocomplete: "off",
                    disabled: saving,
                    get value() {
                      return notes;
                    },
                    set value($$value) {
                      notes = $$value;
                      $$settled = false;
                    }
                  });
                  $$renderer5.push(`<!----> <p class="text-muted-foreground text-[13px]">Free-form internal notes — never sent to Proxmox.</p></div> `);
                  if (testResult) {
                    $$renderer5.push("<!--[0-->");
                    $$renderer5.push(`<div class="flex flex-col gap-2">`);
                    ClusterStatusPill($$renderer5, { status: testResult.status, label: testResult.label });
                    $$renderer5.push(`<!----> `);
                    if (testResult.status === "failed" && testResult.detail) {
                      $$renderer5.push("<!--[0-->");
                      if (Alert) {
                        $$renderer5.push("<!--[-->");
                        Alert($$renderer5, {
                          variant: "destructive",
                          "aria-live": "polite",
                          children: ($$renderer6) => {
                            Triangle_alert($$renderer6, { "aria-hidden": "true" });
                            $$renderer6.push(`<!----> `);
                            if (Alert_title) {
                              $$renderer6.push("<!--[-->");
                              Alert_title($$renderer6, {
                                children: ($$renderer7) => {
                                  $$renderer7.push(`<!---->${escape_html(testResult.detail)}`);
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
                    } else {
                      $$renderer5.push("<!--[-1-->");
                    }
                    $$renderer5.push(`<!--]--></div>`);
                  } else {
                    $$renderer5.push("<!--[-1-->");
                  }
                  $$renderer5.push(`<!--]--> <div class="flex flex-row items-center justify-end gap-2">`);
                  Button($$renderer5, {
                    type: "button",
                    variant: "ghost",
                    onclick: () => goto(),
                    disabled: testing,
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->Cancel`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> `);
                  Button($$renderer5, {
                    type: "button",
                    variant: "secondary",
                    onclick: handleTest,
                    disabled: testing,
                    children: ($$renderer6) => {
                      if (testing) {
                        $$renderer6.push("<!--[0-->");
                        Loader_circle($$renderer6, { class: "size-4 animate-spin", "aria-hidden": "true" });
                        $$renderer6.push(`<!----> Testing...`);
                      } else {
                        $$renderer6.push("<!--[-1-->");
                        $$renderer6.push(`Test connection`);
                      }
                      $$renderer6.push(`<!--]-->`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> `);
                  Button($$renderer5, {
                    type: "submit",
                    disabled: testing,
                    children: ($$renderer6) => {
                      {
                        $$renderer6.push("<!--[-1-->");
                        $$renderer6.push(`Save changes`);
                      }
                      $$renderer6.push(`<!--]-->`);
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
          class: "border-destructive/40",
          children: ($$renderer4) => {
            if (Card_header) {
              $$renderer4.push("<!--[-->");
              Card_header($$renderer4, {
                children: ($$renderer5) => {
                  if (Card_title) {
                    $$renderer5.push("<!--[-->");
                    Card_title($$renderer5, {
                      class: "text-destructive text-lg font-semibold tracking-tight",
                      children: ($$renderer6) => {
                        $$renderer6.push(`<!---->Danger zone`);
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
                        $$renderer6.push(`<!---->Deleting a cluster destroys its encrypted credentials here. The Proxmox cluster itself is
        not affected.`);
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
                  Button($$renderer5, {
                    variant: "destructive",
                    onclick: () => deleteOpen = true,
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->Delete cluster`);
                    },
                    $$slots: { default: true }
                  });
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
      $$renderer3.push(`</div> `);
      ConfirmByNameDialog($$renderer3, {
        heading: `Delete ${data.cluster.name}?`,
        body: `This GUI will stop managing this cluster. The Proxmox cluster itself is not affected. Encrypted tokens stored here are destroyed.`,
        targetName: data.cluster.name,
        confirmLabel: "Delete cluster",
        onConfirm: handleDelete,
        get open() {
          return deleteOpen;
        },
        set open($$value) {
          deleteOpen = $$value;
          $$settled = false;
        }
      });
      $$renderer3.push(`<!---->`);
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
//# sourceMappingURL=_page.svelte-DYmEtWdz.js.map
