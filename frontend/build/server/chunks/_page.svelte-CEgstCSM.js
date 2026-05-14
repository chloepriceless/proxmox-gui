import { A as head, f as ensure_array_like, j as attr_class, h as attr, k as stringify, l as escape_html } from './renderer-5OqEGBJa.js';
import { i as invalidateAll, g as goto } from './client-BLBuBvl1.js';
import { C as Card } from './card-BLYI87Kx.js';
import 'clsx';
import { A as Alert } from './alert-description-cFcqAgKO.js';
import { A as Alert_title } from './alert-title-B4F9lIW0.js';
import { B as Button, d as Input } from './input-QG1nZPSy.js';
import { L as Label } from './label-CnHFxire.js';
import { P as PasswordInput } from './PasswordInput-5u8Tb5x8.js';
import { F as FormSummaryAlert } from './FormSummaryAlert--3wUSwHp.js';
import { a as api, A as ApiError } from './client2-vvZGy19D.js';
import { C as Check } from './check-mBuM5jRg.js';
import { T as Triangle_alert } from './triangle-alert-CojLJBTH.js';
import { C as Circle_check_big, S as Shield_alert } from './shield-alert-B-hX3BFB.js';
import { L as Loader_circle } from './loader-circle-D1pNfZB6.js';
import '@sveltejs/kit/internal';
import './root-BZo_tL0Z.js';
import './index-Siz_BmGa.js';
import '@sveltejs/kit/internal/server';
import './state.svelte-Bqwbw8qw.js';
import 'tailwind-merge';

function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let step = 1;
    let adminUsername = "";
    let adminEmail = "";
    let adminPassword = "";
    let adminPasswordConfirm = "";
    let adminSubmitting = false;
    let adminFieldErrors = {};
    let clusterName = "";
    let clusterHost = "";
    let clusterPort = 8006;
    let clusterTokenUser = "";
    let clusterTokenName = "";
    let clusterTokenSecret = "";
    let clusterFingerprint = "";
    let clusterTesting = false;
    let clusterRegistering = false;
    let clusterFormError = null;
    let clusterFieldErrors = {};
    let clusterTestResult = null;
    function validateCluster() {
      const errs = {};
      if (!clusterName.trim()) errs["cluster-name"] = "Name is required.";
      if (!clusterHost.trim()) errs["cluster-host"] = "Host is required.";
      else if (/^https?:\/\//i.test(clusterHost.trim())) errs["cluster-host"] = "Use bare hostname or IP, not a URL (no http:// prefix).";
      if (!clusterTokenUser.trim()) errs["cluster-token-user"] = "Token user is required.";
      else if (!/^[A-Za-z0-9._@-]+@(pam|pve)$/.test(clusterTokenUser.trim())) errs["cluster-token-user"] = "Token user must be of the form name@pam or name@pve.";
      if (!clusterTokenName.trim()) errs["cluster-token-name"] = "Token name is required.";
      if (!clusterTokenSecret) errs["cluster-token-secret"] = "Token secret is required.";
      clusterFieldErrors = errs;
      return Object.keys(errs).length === 0;
    }
    function mapClusterError(err) {
      if (err instanceof ApiError) {
        const detail = err.body && typeof err.body === "object" && "detail" in err.body ? String(err.body.detail).toLowerCase() : "";
        if (err.status === 409 && detail.includes("name")) return "A cluster with that name is already registered.";
        if (detail.includes("unreach") || detail.includes("connect")) return "Couldn't reach that URL. Check the host and port, then try again.";
        if (detail.includes("fingerprint")) return "The server's certificate fingerprint doesn't match. Refusing to connect.";
        if (detail.includes("token") || err.status === 401 || err.status === 403) return "Proxmox rejected that token. Verify the realm and token ID.";
      }
      return "Something went wrong on our side. Please try again.";
    }
    function mapTestResult(res) {
      if (res.ok) return res;
      const detail = (res.error ?? "").toLowerCase();
      if (detail.includes("unreach") || detail.includes("connect")) return {
        ...res,
        error: "Couldn't reach that URL. Check the host and port, then try again."
      };
      if (detail.includes("fingerprint")) return {
        ...res,
        error: "The server's certificate fingerprint doesn't match. Refusing to connect."
      };
      if (detail.includes("token")) return {
        ...res,
        error: "Proxmox rejected that token. Verify the realm and token ID."
      };
      return res;
    }
    async function testCluster() {
      clusterFormError = null;
      clusterTestResult = null;
      if (!validateCluster()) return;
      clusterTesting = true;
      try {
        const res = await api.clusters.test({
          host: clusterHost.trim(),
          port: clusterPort,
          verify_ssl: true,
          token_user: clusterTokenUser.trim(),
          token_name: clusterTokenName.trim(),
          api_token_secret: clusterTokenSecret,
          tls_fingerprint: clusterFingerprint.trim() || null
        });
        clusterTestResult = mapTestResult(res);
      } catch (err) {
        clusterFormError = mapClusterError(err);
      } finally {
        clusterTesting = false;
      }
    }
    function skipCluster() {
      step = 4;
    }
    function backToStep2() {
      step = 2;
    }
    async function finish() {
      await api.auth.logout();
      await invalidateAll();
      await goto();
    }
    const STEP_LABELS = {
      1: "Welcome",
      2: "Create admin",
      3: "Register cluster",
      4: "Done"
    };
    const STEPS = [1, 2, 3, 4];
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      head("g40i6i", $$renderer3, ($$renderer4) => {
        $$renderer4.title(($$renderer5) => {
          $$renderer5.push(`<title>Set up — Proxmox GUI</title>`);
        });
      });
      $$renderer3.push(`<div class="flex items-center gap-2"><svg viewBox="0 0 24 24" class="text-primary size-8" role="img" aria-label="Proxmox GUI logo" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="3" width="7" height="7" rx="1.5"></rect><rect x="3" y="14" width="7" height="7" rx="1.5"></rect><rect x="14" y="14" width="7" height="7" rx="1.5"></rect></svg> <span class="text-lg font-semibold tracking-tight">Proxmox GUI</span></div> <ol class="flex w-full items-center justify-between gap-2" aria-label="Setup progress"><!--[-->`);
      const each_array = ensure_array_like(STEPS);
      for (let i = 0, $$length = each_array.length; i < $$length; i++) {
        let s = each_array[i];
        const isComplete = step > s;
        const isActive = step === s;
        $$renderer3.push(`<li class="flex flex-1 items-center gap-2"><span${attr_class(`flex size-7 shrink-0 items-center justify-center rounded-full border text-[13px] font-medium ${stringify(isActive ? "bg-primary text-primary-foreground border-primary" : isComplete ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border")}`)}${attr("aria-current", isActive ? "step" : void 0)}${attr("aria-label", `Step ${stringify(s)}: ${stringify(STEP_LABELS[s])}`)}>`);
        if (isComplete) {
          $$renderer3.push("<!--[0-->");
          Check($$renderer3, { class: "size-4", "aria-hidden": "true" });
        } else {
          $$renderer3.push("<!--[-1-->");
          $$renderer3.push(`${escape_html(s)}`);
        }
        $$renderer3.push(`<!--]--></span> `);
        if (i < STEPS.length - 1) {
          $$renderer3.push("<!--[0-->");
          $$renderer3.push(`<span aria-hidden="true"${attr_class(`h-[2px] flex-1 ${stringify(step > s ? "bg-primary" : "bg-border")}`)}></span>`);
        } else {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]--></li>`);
      }
      $$renderer3.push(`<!--]--></ol> `);
      if (Card) {
        $$renderer3.push("<!--[-->");
        Card($$renderer3, {
          class: "w-full p-12 shadow-sm",
          children: ($$renderer4) => {
            if (step === 1) {
              $$renderer4.push("<!--[0-->");
              $$renderer4.push(`<div class="flex flex-col gap-6"><header class="flex flex-col gap-2"><h1 class="text-[28px] font-semibold tracking-tight">Welcome to Proxmox GUI</h1> <p class="text-muted-foreground text-sm">Let's set up your installation. This takes about a minute.</p></header> <footer class="flex justify-end">`);
              Button($$renderer4, {
                onclick: () => step = 2,
                children: ($$renderer5) => {
                  $$renderer5.push(`<!---->Get started`);
                },
                $$slots: { default: true }
              });
              $$renderer4.push(`<!----></footer></div>`);
            } else if (step === 2) {
              $$renderer4.push("<!--[1-->");
              $$renderer4.push(`<div class="flex flex-col gap-6"><header class="flex flex-col gap-2"><h1 class="text-[28px] font-semibold tracking-tight">Create the first admin</h1> <p class="text-muted-foreground text-sm">This user has full access and can create more users later.</p></header> <form class="flex flex-col gap-4" novalidate="">`);
              FormSummaryAlert($$renderer4, { errors: adminFieldErrors, id: "setup-admin-summary" });
              $$renderer4.push(`<!----> `);
              {
                $$renderer4.push("<!--[-1-->");
              }
              $$renderer4.push(`<!--]--> <div class="flex flex-col gap-2">`);
              Label($$renderer4, {
                for: "setup-username",
                children: ($$renderer5) => {
                  $$renderer5.push(`<!---->Username`);
                },
                $$slots: { default: true }
              });
              $$renderer4.push(`<!----> `);
              Input($$renderer4, {
                id: "setup-username",
                name: "username",
                autocomplete: "username",
                autocapitalize: "off",
                disabled: adminSubmitting,
                required: true,
                "aria-invalid": adminFieldErrors["setup-username"] ? "true" : void 0,
                get value() {
                  return adminUsername;
                },
                set value($$value) {
                  adminUsername = $$value;
                  $$settled = false;
                }
              });
              $$renderer4.push(`<!----> `);
              if (adminFieldErrors["setup-username"]) {
                $$renderer4.push("<!--[0-->");
                $$renderer4.push(`<p class="text-destructive text-[13px]">${escape_html(adminFieldErrors["setup-username"])}</p>`);
              } else {
                $$renderer4.push("<!--[-1-->");
              }
              $$renderer4.push(`<!--]--></div> <div class="flex flex-col gap-2">`);
              Label($$renderer4, {
                for: "setup-email",
                children: ($$renderer5) => {
                  $$renderer5.push(`<!---->Email`);
                },
                $$slots: { default: true }
              });
              $$renderer4.push(`<!----> `);
              Input($$renderer4, {
                id: "setup-email",
                type: "email",
                name: "email",
                autocomplete: "email",
                disabled: adminSubmitting,
                required: true,
                "aria-invalid": adminFieldErrors["setup-email"] ? "true" : void 0,
                get value() {
                  return adminEmail;
                },
                set value($$value) {
                  adminEmail = $$value;
                  $$settled = false;
                }
              });
              $$renderer4.push(`<!----> `);
              if (adminFieldErrors["setup-email"]) {
                $$renderer4.push("<!--[0-->");
                $$renderer4.push(`<p class="text-destructive text-[13px]">${escape_html(adminFieldErrors["setup-email"])}</p>`);
              } else {
                $$renderer4.push("<!--[-1-->");
              }
              $$renderer4.push(`<!--]--></div> <div class="flex flex-col gap-2">`);
              Label($$renderer4, {
                for: "setup-password",
                children: ($$renderer5) => {
                  $$renderer5.push(`<!---->Password`);
                },
                $$slots: { default: true }
              });
              $$renderer4.push(`<!----> `);
              PasswordInput($$renderer4, {
                id: "setup-password",
                name: "password",
                autocomplete: "new-password",
                disabled: adminSubmitting,
                required: true,
                "aria-invalid": adminFieldErrors["setup-password"] ? "true" : void 0,
                get value() {
                  return adminPassword;
                },
                set value($$value) {
                  adminPassword = $$value;
                  $$settled = false;
                }
              });
              $$renderer4.push(`<!----> <p class="text-muted-foreground text-[13px]">At least 12 characters.</p> `);
              if (adminFieldErrors["setup-password"]) {
                $$renderer4.push("<!--[0-->");
                $$renderer4.push(`<p class="text-destructive text-[13px]">${escape_html(adminFieldErrors["setup-password"])}</p>`);
              } else {
                $$renderer4.push("<!--[-1-->");
              }
              $$renderer4.push(`<!--]--></div> <div class="flex flex-col gap-2">`);
              Label($$renderer4, {
                for: "setup-password-confirm",
                children: ($$renderer5) => {
                  $$renderer5.push(`<!---->Confirm password`);
                },
                $$slots: { default: true }
              });
              $$renderer4.push(`<!----> `);
              PasswordInput($$renderer4, {
                id: "setup-password-confirm",
                name: "password_confirm",
                autocomplete: "new-password",
                disabled: adminSubmitting,
                required: true,
                "aria-invalid": adminFieldErrors["setup-password-confirm"] ? "true" : void 0,
                get value() {
                  return adminPasswordConfirm;
                },
                set value($$value) {
                  adminPasswordConfirm = $$value;
                  $$settled = false;
                }
              });
              $$renderer4.push(`<!----> `);
              if (adminFieldErrors["setup-password-confirm"]) {
                $$renderer4.push("<!--[0-->");
                $$renderer4.push(`<p class="text-destructive text-[13px]">${escape_html(adminFieldErrors["setup-password-confirm"])}</p>`);
              } else {
                $$renderer4.push("<!--[-1-->");
              }
              $$renderer4.push(`<!--]--></div> <footer class="flex justify-end gap-2 pt-2">`);
              Button($$renderer4, {
                type: "submit",
                disabled: adminSubmitting,
                children: ($$renderer5) => {
                  {
                    $$renderer5.push("<!--[-1-->");
                    $$renderer5.push(`Create admin`);
                  }
                  $$renderer5.push(`<!--]-->`);
                },
                $$slots: { default: true }
              });
              $$renderer4.push(`<!----></footer></form></div>`);
            } else if (step === 3) {
              $$renderer4.push("<!--[2-->");
              $$renderer4.push(`<div class="flex flex-col gap-6"><header class="flex flex-col gap-2"><h1 class="text-[28px] font-semibold tracking-tight">Register your first Proxmox cluster</h1> <p class="text-muted-foreground text-sm">Optional. You can add clusters later from the admin area.</p></header> <form class="flex flex-col gap-4" novalidate="">`);
              FormSummaryAlert($$renderer4, { errors: clusterFieldErrors, id: "setup-cluster-summary" });
              $$renderer4.push(`<!----> `);
              if (clusterFormError) {
                $$renderer4.push("<!--[0-->");
                if (Alert) {
                  $$renderer4.push("<!--[-->");
                  Alert($$renderer4, {
                    variant: "destructive",
                    "aria-live": "polite",
                    children: ($$renderer5) => {
                      Triangle_alert($$renderer5, { "aria-hidden": "true" });
                      $$renderer5.push(`<!----> `);
                      if (Alert_title) {
                        $$renderer5.push("<!--[-->");
                        Alert_title($$renderer5, {
                          children: ($$renderer6) => {
                            $$renderer6.push(`<!---->${escape_html(clusterFormError)}`);
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
              } else {
                $$renderer4.push("<!--[-1-->");
              }
              $$renderer4.push(`<!--]--> <div class="flex flex-col gap-2">`);
              Label($$renderer4, {
                for: "cluster-name",
                children: ($$renderer5) => {
                  $$renderer5.push(`<!---->Name`);
                },
                $$slots: { default: true }
              });
              $$renderer4.push(`<!----> `);
              Input($$renderer4, {
                id: "cluster-name",
                name: "name",
                placeholder: "production",
                disabled: clusterTesting,
                required: true,
                "aria-invalid": clusterFieldErrors["cluster-name"] ? "true" : void 0,
                get value() {
                  return clusterName;
                },
                set value($$value) {
                  clusterName = $$value;
                  $$settled = false;
                }
              });
              $$renderer4.push(`<!----> `);
              if (clusterFieldErrors["cluster-name"]) {
                $$renderer4.push("<!--[0-->");
                $$renderer4.push(`<p class="text-destructive text-[13px]">${escape_html(clusterFieldErrors["cluster-name"])}</p>`);
              } else {
                $$renderer4.push("<!--[-1-->");
              }
              $$renderer4.push(`<!--]--></div> <div class="grid grid-cols-3 gap-3"><div class="col-span-2 flex flex-col gap-2">`);
              Label($$renderer4, {
                for: "cluster-host",
                children: ($$renderer5) => {
                  $$renderer5.push(`<!---->Host`);
                },
                $$slots: { default: true }
              });
              $$renderer4.push(`<!----> `);
              Input($$renderer4, {
                id: "cluster-host",
                name: "host",
                placeholder: "pve.example.com",
                disabled: clusterTesting,
                required: true,
                "aria-invalid": clusterFieldErrors["cluster-host"] ? "true" : void 0,
                get value() {
                  return clusterHost;
                },
                set value($$value) {
                  clusterHost = $$value;
                  $$settled = false;
                }
              });
              $$renderer4.push(`<!----> `);
              if (clusterFieldErrors["cluster-host"]) {
                $$renderer4.push("<!--[0-->");
                $$renderer4.push(`<p class="text-destructive text-[13px]">${escape_html(clusterFieldErrors["cluster-host"])}</p>`);
              } else {
                $$renderer4.push("<!--[-1-->");
              }
              $$renderer4.push(`<!--]--></div> <div class="flex flex-col gap-2">`);
              Label($$renderer4, {
                for: "cluster-port",
                children: ($$renderer5) => {
                  $$renderer5.push(`<!---->Port`);
                },
                $$slots: { default: true }
              });
              $$renderer4.push(`<!----> `);
              Input($$renderer4, {
                id: "cluster-port",
                name: "port",
                type: "number",
                min: "1",
                max: "65535",
                disabled: clusterTesting,
                required: true,
                get value() {
                  return clusterPort;
                },
                set value($$value) {
                  clusterPort = $$value;
                  $$settled = false;
                }
              });
              $$renderer4.push(`<!----></div></div> <div class="flex flex-col gap-2">`);
              Label($$renderer4, {
                for: "cluster-token-user",
                children: ($$renderer5) => {
                  $$renderer5.push(`<!---->API token user`);
                },
                $$slots: { default: true }
              });
              $$renderer4.push(`<!----> `);
              Input($$renderer4, {
                id: "cluster-token-user",
                name: "token_user",
                placeholder: "root@pam",
                autocomplete: "off",
                disabled: clusterTesting,
                required: true,
                "aria-invalid": clusterFieldErrors["cluster-token-user"] ? "true" : void 0,
                get value() {
                  return clusterTokenUser;
                },
                set value($$value) {
                  clusterTokenUser = $$value;
                  $$settled = false;
                }
              });
              $$renderer4.push(`<!----> <p class="text-muted-foreground text-[13px]">Format: name@pam or name@pve.</p> `);
              if (clusterFieldErrors["cluster-token-user"]) {
                $$renderer4.push("<!--[0-->");
                $$renderer4.push(`<p class="text-destructive text-[13px]">${escape_html(clusterFieldErrors["cluster-token-user"])}</p>`);
              } else {
                $$renderer4.push("<!--[-1-->");
              }
              $$renderer4.push(`<!--]--></div> <div class="flex flex-col gap-2">`);
              Label($$renderer4, {
                for: "cluster-token-name",
                children: ($$renderer5) => {
                  $$renderer5.push(`<!---->API token name`);
                },
                $$slots: { default: true }
              });
              $$renderer4.push(`<!----> `);
              Input($$renderer4, {
                id: "cluster-token-name",
                name: "token_name",
                placeholder: "proxmox-gui",
                autocomplete: "off",
                disabled: clusterTesting,
                required: true,
                "aria-invalid": clusterFieldErrors["cluster-token-name"] ? "true" : void 0,
                get value() {
                  return clusterTokenName;
                },
                set value($$value) {
                  clusterTokenName = $$value;
                  $$settled = false;
                }
              });
              $$renderer4.push(`<!----> `);
              if (clusterFieldErrors["cluster-token-name"]) {
                $$renderer4.push("<!--[0-->");
                $$renderer4.push(`<p class="text-destructive text-[13px]">${escape_html(clusterFieldErrors["cluster-token-name"])}</p>`);
              } else {
                $$renderer4.push("<!--[-1-->");
              }
              $$renderer4.push(`<!--]--></div> <div class="flex flex-col gap-2">`);
              Label($$renderer4, {
                for: "cluster-token-secret",
                children: ($$renderer5) => {
                  $$renderer5.push(`<!---->API token secret`);
                },
                $$slots: { default: true }
              });
              $$renderer4.push(`<!----> `);
              PasswordInput($$renderer4, {
                id: "cluster-token-secret",
                name: "token_secret",
                autocomplete: "new-password",
                disabled: clusterTesting,
                required: true,
                "aria-invalid": clusterFieldErrors["cluster-token-secret"] ? "true" : void 0,
                get value() {
                  return clusterTokenSecret;
                },
                set value($$value) {
                  clusterTokenSecret = $$value;
                  $$settled = false;
                }
              });
              $$renderer4.push(`<!----> `);
              if (clusterFieldErrors["cluster-token-secret"]) {
                $$renderer4.push("<!--[0-->");
                $$renderer4.push(`<p class="text-destructive text-[13px]">${escape_html(clusterFieldErrors["cluster-token-secret"])}</p>`);
              } else {
                $$renderer4.push("<!--[-1-->");
              }
              $$renderer4.push(`<!--]--></div> <div class="flex flex-col gap-2">`);
              Label($$renderer4, {
                for: "cluster-fingerprint",
                children: ($$renderer5) => {
                  $$renderer5.push(`<!---->TLS fingerprint (optional)`);
                },
                $$slots: { default: true }
              });
              $$renderer4.push(`<!----> `);
              Input($$renderer4, {
                id: "cluster-fingerprint",
                name: "fingerprint",
                placeholder: "AB:CD:EF:...",
                disabled: clusterTesting,
                get value() {
                  return clusterFingerprint;
                },
                set value($$value) {
                  clusterFingerprint = $$value;
                  $$settled = false;
                }
              });
              $$renderer4.push(`<!----> <p class="text-muted-foreground text-[13px]">Required only for self-signed certificates.</p></div> `);
              if (clusterTestResult) {
                $$renderer4.push("<!--[0-->");
                if (clusterTestResult.ok) {
                  $$renderer4.push("<!--[0-->");
                  $$renderer4.push(`<div class="bg-success/10 border-success/30 text-success flex items-center gap-2 rounded-md border px-3 py-2 text-sm" role="status">`);
                  Circle_check_big($$renderer4, { class: "size-4", "aria-hidden": "true" });
                  $$renderer4.push(`<!----> <span>Connection OK${escape_html(clusterTestResult.version ? ` — Proxmox VE ${clusterTestResult.version}` : "")}</span></div>`);
                } else {
                  $$renderer4.push("<!--[-1-->");
                  $$renderer4.push(`<div class="bg-destructive/10 border-destructive/30 text-destructive flex items-center gap-2 rounded-md border px-3 py-2 text-sm" role="status">`);
                  Shield_alert($$renderer4, { class: "size-4", "aria-hidden": "true" });
                  $$renderer4.push(`<!----> <span>${escape_html(clusterTestResult.error ?? "Connection failed.")}</span></div>`);
                }
                $$renderer4.push(`<!--]-->`);
              } else {
                $$renderer4.push("<!--[-1-->");
              }
              $$renderer4.push(`<!--]--> <footer class="flex flex-wrap items-center justify-between gap-2 pt-2">`);
              Button($$renderer4, {
                variant: "ghost",
                type: "button",
                onclick: backToStep2,
                disabled: clusterTesting,
                children: ($$renderer5) => {
                  $$renderer5.push(`<!---->Back`);
                },
                $$slots: { default: true }
              });
              $$renderer4.push(`<!----> <div class="flex items-center gap-2">`);
              Button($$renderer4, {
                variant: "link",
                type: "button",
                onclick: skipCluster,
                disabled: clusterTesting,
                children: ($$renderer5) => {
                  $$renderer5.push(`<!---->Skip for now`);
                },
                $$slots: { default: true }
              });
              $$renderer4.push(`<!----> `);
              Button($$renderer4, {
                variant: "secondary",
                type: "button",
                onclick: testCluster,
                disabled: clusterTesting || clusterRegistering,
                children: ($$renderer5) => {
                  if (clusterTesting) {
                    $$renderer5.push("<!--[0-->");
                    Loader_circle($$renderer5, { class: "size-4 animate-spin", "aria-hidden": "true" });
                    $$renderer5.push(`<!----> Testing...`);
                  } else {
                    $$renderer5.push("<!--[-1-->");
                    $$renderer5.push(`Test connection`);
                  }
                  $$renderer5.push(`<!--]-->`);
                },
                $$slots: { default: true }
              });
              $$renderer4.push(`<!----> `);
              Button($$renderer4, {
                type: "submit",
                disabled: clusterTesting,
                children: ($$renderer5) => {
                  {
                    $$renderer5.push("<!--[-1-->");
                    $$renderer5.push(`Register cluster`);
                  }
                  $$renderer5.push(`<!--]-->`);
                },
                $$slots: { default: true }
              });
              $$renderer4.push(`<!----></div></footer></form></div>`);
            } else if (step === 4) {
              $$renderer4.push("<!--[3-->");
              $$renderer4.push(`<div class="flex flex-col gap-6"><header class="flex flex-col gap-2"><h1 class="text-[28px] font-semibold tracking-tight">You're all set</h1> <p class="text-muted-foreground text-sm">Sign in to start managing your clusters.</p></header> <footer class="flex justify-end">`);
              Button($$renderer4, {
                onclick: finish,
                children: ($$renderer5) => {
                  $$renderer5.push(`<!---->Sign in`);
                },
                $$slots: { default: true }
              });
              $$renderer4.push(`<!----></footer></div>`);
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
//# sourceMappingURL=_page.svelte-CEgstCSM.js.map
