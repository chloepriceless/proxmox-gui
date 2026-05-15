import { A as head, l as escape_html } from './renderer-5OqEGBJa.js';
import { g as goto } from './client-BLBuBvl1.js';
import { C as Card } from './card-d0K3O0_w.js';
import { C as Card_header, b as Card_title, c as Card_description, a as Card_content } from './card-title-CwYi2S8Q.js';
import 'clsx';
import { A as Alert } from './alert-DKR6l6LD.js';
import { A as Alert_title } from './alert-title-MPDSeCCx.js';
import { B as Button } from './button-B5bCAdGN.js';
import { I as Input } from './input-CVUkBx6i.js';
import { L as Label } from './label-DVSPNLFi.js';
import { C as Checkbox } from './checkbox-C7RiAyiZ.js';
import { P as PasswordInput } from './PasswordInput-BWFsvdzC.js';
import { F as FormSummaryAlert } from './FormSummaryAlert-Bywtmmcz.js';
import { C as ClusterStatusPill } from './ClusterStatusPill-CGUkJ_yu.js';
import { a as api, A as ApiError } from './client2-vvZGy19D.js';
import { A as Arrow_left } from './arrow-left-CPxn2LPE.js';
import { T as Triangle_alert } from './triangle-alert-BZ_xtVFE.js';
import { L as Loader_circle } from './loader-circle-DbKsF1vv.js';
import '@sveltejs/kit/internal';
import './root-BZo_tL0Z.js';
import './index-Siz_BmGa.js';
import '@sveltejs/kit/internal/server';
import './state.svelte-Bqwbw8qw.js';
import 'tailwind-merge';
import './is-DeZ4WIS2.js';
import './clone-BIspTav0.js';
import './hidden-input-BgYWG1Tz.js';
import './sr-only-styles-BPX-4PGe.js';
import './check-DYbUlAJR.js';
import './alert-description-BLye52mR.js';
import './shield-alert-DeUzDBBh.js';

function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let name = "";
    let url = "";
    let tokenId = "";
    let tokenSecret = "";
    let tlsFingerprint = "";
    let verifySsl = true;
    let testing = false;
    let testResult = null;
    let formError = null;
    let fieldErrors = {};
    function parseUrl(raw) {
      const trimmed = raw.trim();
      if (!trimmed) return null;
      try {
        const u = new URL(trimmed);
        if (u.protocol !== "http:" && u.protocol !== "https:") return null;
        const port = u.port ? Number(u.port) : 8006;
        if (!Number.isFinite(port) || port <= 0 || port > 65535) return null;
        return { host: u.hostname, port };
      } catch {
        return null;
      }
    }
    const TOKEN_ID_RE = /^([a-zA-Z0-9._-]+@(pam|pve))!([a-zA-Z0-9._-]+)$/;
    function parseTokenId(raw) {
      const trimmed = raw.trim();
      const m = TOKEN_ID_RE.exec(trimmed);
      if (!m) return null;
      return { token_user: m[1], token_name: m[3] };
    }
    function validate() {
      const errs = {};
      if (!name.trim()) errs["cluster-new-name"] = "Name is required.";
      const parsedUrl = parseUrl(url);
      if (!url.trim()) {
        errs["cluster-new-url"] = "URL is required.";
      } else if (!parsedUrl) {
        errs["cluster-new-url"] = "Enter a URL like https://pve.example.com:8006.";
      }
      const parsedToken = parseTokenId(tokenId);
      if (!tokenId.trim()) {
        errs["cluster-new-token-id"] = "API token ID is required.";
      } else if (!parsedToken) {
        errs["cluster-new-token-id"] = "Format: user@realm!tokenid (e.g. root@pam!gui).";
      }
      if (!tokenSecret) {
        errs["cluster-new-token-secret"] = "API token secret is required.";
      }
      fieldErrors = errs;
      if (Object.keys(errs).length > 0) return null;
      return { name: name.trim(), parsedUrl, parsedToken };
    }
    function mapClusterError(err) {
      if (err instanceof ApiError) {
        const detail = String(err.body?.detail ?? "").toLowerCase();
        if (err.status === 422) {
          if (detail.includes("fingerprint")) {
            return {
              summary: "The server's certificate fingerprint doesn't match. Refusing to connect."
            };
          }
          if (detail.includes("reject") || detail.includes("token") || detail.includes("auth")) {
            return {
              summary: "Proxmox rejected that token. Verify the realm and token ID."
            };
          }
          return {
            summary: "Couldn't reach that URL. Check the host and port, then try again."
          };
        }
        if (err.status === 409) {
          return {
            field: "cluster-new-name",
            message: "A cluster with that name is already registered."
          };
        }
        if (err.status === 502) {
          return {
            summary: "Couldn't reach that URL. Check the host and port, then try again."
          };
        }
      }
      return {
        summary: "Something went wrong on our side. Please try again."
      };
    }
    async function handleTest(event) {
      event.preventDefault();
      formError = null;
      testResult = null;
      const parsed = validate();
      if (!parsed || !parsed.parsedUrl || !parsed.parsedToken) return;
      testing = true;
      try {
        const body = {
          host: parsed.parsedUrl.host,
          port: parsed.parsedUrl.port,
          verify_ssl: verifySsl,
          token_user: parsed.parsedToken.token_user,
          token_name: parsed.parsedToken.token_name,
          api_token_secret: tokenSecret,
          tls_fingerprint: tlsFingerprint.trim() || null
        };
        const res = await api.clusters.test(body);
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
      } catch (err) {
        const mapped = mapClusterError(err);
        testResult = {
          status: "failed",
          detail: mapped.summary ?? "Couldn't connect to that cluster."
        };
      } finally {
        testing = false;
      }
    }
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      head("14rx15b", $$renderer3, ($$renderer4) => {
        $$renderer4.title(($$renderer5) => {
          $$renderer5.push(`<title>Register cluster — Proxmox GUI</title>`);
        });
      });
      $$renderer3.push(`<div class="mx-auto flex w-full max-w-[720px] flex-col gap-6"><header class="flex flex-col gap-2"><a href="/admin/clusters" class="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-[13px]">`);
      Arrow_left($$renderer3, { class: "size-4", "aria-hidden": "true" });
      $$renderer3.push(`<!----> Back to Clusters</a> <h1 class="text-[28px] font-semibold tracking-tight">Register cluster</h1> <p class="text-muted-foreground text-sm">Connect to a Proxmox VE cluster using an API token.</p></header> `);
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
                        $$renderer6.push(`<!---->Test the connection to verify your token, then register the cluster.`);
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
                  FormSummaryAlert($$renderer5, { errors: fieldErrors, id: "cluster-new-summary" });
                  $$renderer5.push(`<!----> `);
                  if (formError) {
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
                                $$renderer7.push(`<!---->${escape_html(formError)}`);
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
                  $$renderer5.push(`<!--]--> <div class="flex flex-col gap-2">`);
                  Label($$renderer5, {
                    for: "cluster-new-name",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->Name`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> `);
                  Input($$renderer5, {
                    id: "cluster-new-name",
                    type: "text",
                    autocomplete: "off",
                    autocapitalize: "off",
                    spellcheck: false,
                    placeholder: "prod-cluster-1",
                    disabled: testing,
                    required: true,
                    "aria-invalid": fieldErrors["cluster-new-name"] ? "true" : void 0,
                    get value() {
                      return name;
                    },
                    set value($$value) {
                      name = $$value;
                      $$settled = false;
                    }
                  });
                  $$renderer5.push(`<!----> `);
                  if (fieldErrors["cluster-new-name"]) {
                    $$renderer5.push("<!--[0-->");
                    $$renderer5.push(`<p class="text-destructive text-[13px]">${escape_html(fieldErrors["cluster-new-name"])}</p>`);
                  } else {
                    $$renderer5.push("<!--[-1-->");
                    $$renderer5.push(`<p class="text-muted-foreground text-[13px]">A short identifier you'll see in lists.</p>`);
                  }
                  $$renderer5.push(`<!--]--></div> <div class="flex flex-col gap-2">`);
                  Label($$renderer5, {
                    for: "cluster-new-url",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->URL`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> `);
                  Input($$renderer5, {
                    id: "cluster-new-url",
                    type: "url",
                    autocomplete: "off",
                    spellcheck: false,
                    placeholder: "https://pve.example.com:8006",
                    disabled: testing,
                    required: true,
                    "aria-invalid": fieldErrors["cluster-new-url"] ? "true" : void 0,
                    get value() {
                      return url;
                    },
                    set value($$value) {
                      url = $$value;
                      $$settled = false;
                    }
                  });
                  $$renderer5.push(`<!----> `);
                  if (fieldErrors["cluster-new-url"]) {
                    $$renderer5.push("<!--[0-->");
                    $$renderer5.push(`<p class="text-destructive text-[13px]">${escape_html(fieldErrors["cluster-new-url"])}</p>`);
                  } else {
                    $$renderer5.push("<!--[-1-->");
                    $$renderer5.push(`<p class="text-muted-foreground text-[13px]">https://pve.example.com:8006 — the management URL of the Proxmox cluster.</p>`);
                  }
                  $$renderer5.push(`<!--]--></div> <div class="flex flex-col gap-2">`);
                  Label($$renderer5, {
                    for: "cluster-new-token-id",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->API token ID`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> `);
                  Input($$renderer5, {
                    id: "cluster-new-token-id",
                    type: "text",
                    autocomplete: "off",
                    spellcheck: false,
                    placeholder: "root@pam!gui",
                    disabled: testing,
                    required: true,
                    "aria-invalid": fieldErrors["cluster-new-token-id"] ? "true" : void 0,
                    class: "font-mono text-[13px]",
                    get value() {
                      return tokenId;
                    },
                    set value($$value) {
                      tokenId = $$value;
                      $$settled = false;
                    }
                  });
                  $$renderer5.push(`<!----> `);
                  if (fieldErrors["cluster-new-token-id"]) {
                    $$renderer5.push("<!--[0-->");
                    $$renderer5.push(`<p class="text-destructive text-[13px]">${escape_html(fieldErrors["cluster-new-token-id"])}</p>`);
                  } else {
                    $$renderer5.push("<!--[-1-->");
                    $$renderer5.push(`<p class="text-muted-foreground text-[13px]">Format: user@realm!tokenid (e.g. root@pam!gui)</p>`);
                  }
                  $$renderer5.push(`<!--]--></div> <div class="flex flex-col gap-2">`);
                  Label($$renderer5, {
                    for: "cluster-new-token-secret",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->API token secret`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> `);
                  PasswordInput($$renderer5, {
                    id: "cluster-new-token-secret",
                    name: "api_token_secret",
                    autocomplete: "off",
                    disabled: testing,
                    required: true,
                    "aria-invalid": fieldErrors["cluster-new-token-secret"] ? "true" : void 0,
                    get value() {
                      return tokenSecret;
                    },
                    set value($$value) {
                      tokenSecret = $$value;
                      $$settled = false;
                    }
                  });
                  $$renderer5.push(`<!----> `);
                  if (fieldErrors["cluster-new-token-secret"]) {
                    $$renderer5.push("<!--[0-->");
                    $$renderer5.push(`<p class="text-destructive text-[13px]">${escape_html(fieldErrors["cluster-new-token-secret"])}</p>`);
                  } else {
                    $$renderer5.push("<!--[-1-->");
                    $$renderer5.push(`<p class="text-muted-foreground text-[13px]">Paste the secret value PVE showed you when you created the token.</p>`);
                  }
                  $$renderer5.push(`<!--]--></div> <div class="flex flex-col gap-2">`);
                  Label($$renderer5, {
                    for: "cluster-new-fingerprint",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->TLS fingerprint (optional)`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> `);
                  Input($$renderer5, {
                    id: "cluster-new-fingerprint",
                    type: "text",
                    autocomplete: "off",
                    spellcheck: false,
                    placeholder: "AA:BB:CC:...",
                    disabled: testing,
                    class: "font-mono text-[13px]",
                    get value() {
                      return tlsFingerprint;
                    },
                    set value($$value) {
                      tlsFingerprint = $$value;
                      $$settled = false;
                    }
                  });
                  $$renderer5.push(`<!----> <p class="text-muted-foreground text-[13px]">Required only for self-signed certificates.</p></div> <div class="flex flex-row items-start gap-2 rounded-md border border-border p-3">`);
                  Checkbox($$renderer5, {
                    id: "cluster-new-verify-ssl",
                    checked: verifySsl,
                    onCheckedChange: (v) => verifySsl = v === true,
                    disabled: testing
                  });
                  $$renderer5.push(`<!----> <div class="flex flex-col gap-1">`);
                  Label($$renderer5, {
                    for: "cluster-new-verify-ssl",
                    class: "text-sm font-medium",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->Verify TLS`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> <p class="text-muted-foreground text-[13px]">Validate the cluster's TLS certificate chain. Uncheck for self-signed.</p></div></div> `);
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
                        $$renderer6.push(`Register cluster`);
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
//# sourceMappingURL=_page.svelte-CIX1qi-J.js.map
