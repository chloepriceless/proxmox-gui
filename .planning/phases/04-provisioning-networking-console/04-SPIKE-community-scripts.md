# Spike: Community-Scripts Non-Interactive Execution

**Plan:** 04-01 · **Requirement:** LXC-03 · **Risk:** HIGH (Research Assumptions A1, A2, A7)
**Date investigated:** 2026-05-16
**Investigation method:** Live fetch of `community-scripts/ProxmoxVE` at a pinned commit + live probe of the project's real Proxmox cluster (PVE 9.1.2) and GUI LXC.

This document resolves the single highest-risk Phase-4 task — whether a community-script's per-app install stage can be driven non-interactively from the GUI — and is the contract that **04-06** (`run_community_script` two-stage job) implements against. Every claim below is evidence-backed (a quoted upstream line, a fetched JSON sample, or a live API probe result).

---

## Pinned Floor Commit

`community-scripts/ProxmoxVE` default branch is **`main`**. The bundled-catalog **floor commit** (D-05) is pinned to:

```
369f9013088f19771a1b95c40ee252fd4c16f91b   (2026-05-16T10:03:21Z)
```

This is a real content change ("Update authentik version to 2026.2.3 (#14517)"), deliberately chosen over the very latest `HEAD` (`b05fd788…`, an auto-generated `Update CHANGELOG.md` bot commit) so the floor sits on a reviewable human change. Per D-05 the bundled snapshot ships pinned to this 40-char SHA; the admin "Sync catalog" button re-pins to a fresher reviewed commit — never "always latest" (Pitfall 10 / threat T-04-01-01).

---

## 1. Install-stage standalone invocability (A1 — the gating question)

**`STANDALONE INVOCABLE: no`**

The per-app `install/<app>-install.sh` scripts are **not** standalone. Every inspected script's *first executable line* sources a function bundle that only `build.func` provides:

`install/pihole-install.sh` (line 8):
```bash
source /dev/stdin <<<"$FUNCTIONS_FILE_PATH"
```
`install/jellyfin-install.sh` (line 8): identical `source /dev/stdin <<<"$FUNCTIONS_FILE_PATH"`.
`install/immich-install.sh` (line 8): identical.
`install/nextcloudpi-install.sh` (line 8): identical.

`$FUNCTIONS_FILE_PATH` is **set by `build.func`**, not by the install script. From `misc/build.func` line 3811:
```bash
export FUNCTIONS_FILE_PATH="$(curl -fsSL "$_func_url")"
```
where `_func_url` resolves to `misc/install.func` for Debian/Ubuntu (`misc/alpine-install.func` for Alpine).

**Exact `build.func`/`install.func`-provided symbols each inspected install script depends on:**

| Symbol | Provided by | Used by (evidence) |
|--------|-------------|--------------------|
| `$FUNCTIONS_FILE_PATH` (env) | `build.func:3811` | every install script line 8 |
| `color`, `verb_ip6`, `catch_errors` | `install.func` → `core.func` + `error_handler.func` | every install script lines 9–11 |
| `setting_up_container` | `install.func:110` | every install script line ~12 |
| `network_check` | `install.func:150` | every install script line ~13 |
| `update_os` | `install.func:389` | every install script line ~14 |
| `$STD` (verbosity wrapper) | `install.func` `set_std_mode` | `pihole-install.sh`: `$STD apt install -y ufw`; `jellyfin-install.sh`: `$STD apt install -y jellyfin …` |
| `msg_info` / `msg_ok` / `msg_warn` / `msg_error` / `msg_custom` | `core.func` (loaded by `install.func:35`) | every install script |
| `motd_ssh`, `customize`, `cleanup_lxc` | `install.func` (`customize` at `install.func:489`) | every install script's last 3 lines |
| ~25 exported env vars (`CTID`, `PCT_OSTYPE`, `PCT_OSVERSION`, `APPLICATION`, `app`, `PASSWORD`, `VERBOSE`, `SSH_AUTHORIZED_KEY`, `tz`, `DIAGNOSTICS`, `SESSION_ID`, `INSTALL_LOG`, …) | `build.func:3817–3845` | `customize()` reads `$PASSWORD`, `$app`, `$SSH_AUTHORIZED_KEY`; `install.func` reads `$VERBOSE`, `$SESSION_ID` |

Running `install/<app>-install.sh` alone — without `build.func` having exported `FUNCTIONS_FILE_PATH` and the env block — fails immediately on line 8 (`$FUNCTIONS_FILE_PATH` is empty, `source /dev/stdin <<<""` is a no-op, then line 9 `color` is an undefined command). **The GUI cannot run the bare install script.**

A second blocker: install scripts can be **interactive**. `install/pihole-install.sh` and `install/nextcloudpi-install.sh` both contain:
```bash
read -r -p "${TAB3}Do you want to continue? [y/N]: " CONFIRM
if [[ ! "$CONFIRM" =~ ^([yY][eE][sS]|[yY])$ ]]; then
  msg_error "Aborted by user. No changes have been made."
  exit 10
fi
```
and `misc/install.func` itself has interactive `read` calls (`install.func:175` "No Internet detected, would you like to continue anyway?", `install.func:359` mirror prompt). These must be fed via stdin.

---

## 2. Fallback path — the actual GUI mechanism

Because the install stage is not standalone, the GUI mirrors the **exact mechanism upstream's own `build.func` uses** to run the install stage. From `misc/build.func` line 4526:

```bash
lxc-attach -n "$CTID" -- bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/install/${var_install}.sh)"
```

Note this is **not** `ct/<app>.sh` and it is **not** `build.func` — upstream itself runs only the install-stage script inside the container, after exporting `FUNCTIONS_FILE_PATH` + the env block on the host side. This is precisely the GUI's Pitfall-10 model: the GUI creates the empty LXC with its own `pct create` code path, then runs only the in-container install stage. **The GUI must NOT run `ct/<app>.sh`** (that script sources `build.func` and drives the interactive whiptail orchestrator — Pitfall 10).

`var_install` derives mechanically: `build.func:42` → `var_install="${NSAPP}-install"`, where `NSAPP` is `APP` lowercased with spaces stripped (`build.func:41`). For the GUI, `var_install` = `<slug>-install` from the catalog JSON `slug` field.

**Concrete stage-2 mechanism the GUI implements (this is what D-07's "defaults-only non-interactive fallback" means):**

1. **Host-side preamble** — before invoking the install stage, export the env block `build.func` exports. Minimum viable set the install stage + `customize()` actually read:
   - `FUNCTIONS_FILE_PATH` = the fetched contents of `misc/install.func` (pinned to the floor commit, **not** `main`)
   - `CTID` = the new LXC vmid
   - `PCT_OSTYPE` = `var_os`, `PCT_OSVERSION` = `var_version` (from the catalog `resources` block or wizard override)
   - `APPLICATION` = display name, `app` = slug
   - `PASSWORD` = "" (empty → `customize()` enables autologin; GUI sets the password itself)
   - `VERBOSE` = `yes` (so `$STD` does **not** suppress output — D-08 needs the stream)
   - `tz` = host timezone, `DIAGNOSTICS` = `no` (no upstream telemetry — privacy + Pitfall 10)
   - `SSH_AUTHORIZED_KEY` = the user's selected SSH key (optional)
   - `SESSION_ID` = an 8-char id; `INSTALL_LOG` = `/root/.install-${SESSION_ID}.log`
2. **Whiptail bypass** — `core.func`/`error_handler.func` are sourced fresh inside `install.func`; the GUI does not run `build.func`, so the whiptail *menu* (`build.func:1699+`) is never reached. The only interactivity left is the `read -r -p` confirm prompts inside a few install scripts and `install.func`. **Bypass:** feed `stdin` so every `read` resolves "yes" — e.g. run the install stage with `yes y |` piped in, or attach a here-string. Document per-script: scripts with a third-party-installer `read` confirm (pihole, nextcloudpi) need the affirmative stdin; most do not.
3. **Invocation** — run inside the *already-created, already-running* LXC, fetching the install script at the **pinned floor commit**:
   ```
   lxc-attach -n <CTID> -- bash -c "$(curl -fsSL \
     https://raw.githubusercontent.com/community-scripts/ProxmoxVE/<FLOOR_SHA>/install/<slug>-install.sh)"
   ```
   (`lxc-attach` and `pct exec` are equivalent here; see §3 for which the GUI uses and why.)
4. **Failure detection** — `build.func:4535` shows the install stage writes `/root/.install-${SESSION_ID}.failed` containing the exit code on error; the GUI reads that flag file after the command returns and falls back to the process exit code if absent.

"Defaults-only non-interactive fallback" (D-07) in practice = run the install stage with the catalog `resources` defaults for CPU/RAM/disk/OS, an empty `PASSWORD`, `VERBOSE=yes`, and affirmative stdin — no per-script option parsing required for the floor behaviour.

---

## 3. The `lxc_exec` / `pct exec` mechanism

**`EXEC MECHANISM: pct exec (CLI) over SSH to the PVE host — output delivery: chunked`**

**There is no LXC `exec` REST endpoint.** Probed live against the project's PVE **9.1.2** cluster (`192.168.20.240:8006`):

- `GET /nodes/{node}/lxc/{vmid}/status/` returns subdirs: `current, migrate, reboot, shutdown, start, stop` — **no `exec`**.
- `POST /nodes/{node}/lxc/{vmid}/status/exec` → **`501 Not Implemented`**: `ResourceException 501 Not Implemented: Method 'POST /nodes/proxmox/lxc/133/status/exec' not implemented`.
- The `lxc/{vmid}/` subtree has no `agent` child either (unlike QEMU, which has `qemu/{vmid}/agent/exec` for VMs). LXC containers have no qemu-guest-agent path.

`pct exec` is documented (`pve-docs/pct.1.html`) strictly as a **CLI command** ("Launch a command inside the specified container"), not a REST resource. `proxmoxer` is a thin REST wrapper — it therefore **cannot** expose `pct exec`; the canonical upstream code uses the `lxc-attach`/`pct exec` *binary*, run on the PVE host shell (`build.func:4526`, and `pct exec` 9× elsewhere in `build.func`).

**Conclusion for the connector method shape.** The `lxc_exec` method sketched in the plan's `<interfaces>` block — `POST /nodes/{node}/lxc/{vmid}/status/exec` via proxmoxer — **does not exist in PVE 9** and must not be implemented as a REST call. The real method is a **shell-out over SSH** to the PVE node:

```python
async def lxc_exec(self, *, node: str, vmid: int, command: list[str]) -> ExecResult:
    """Run a command inside an LXC by SSH-ing to the PVE *node* and invoking
    `pct exec <vmid> -- <command>`. There is NO PVE REST endpoint for this
    (confirmed: POST .../lxc/{vmid}/status/exec -> 501 on PVE 9.1.2).
    Returns combined stdout/stderr + exit code; output arrives in chunks."""
```

**Reachability — confirmed live.** The GUI LXC (`192.168.20.171`) can reach the PVE host on **port 22 (SSH)** and **8006 (API)** — both probed open. So the GUI ships an SSH transport to each registered PVE node for `pct exec` (and for `pct create` / `lxc-attach`), in addition to the proxmoxer REST connector.

**Output delivery: chunked.** `pct exec` runs the command synchronously and returns when it finishes — it does **not** mint a UPID and is **not** a pollable PVE task (it is absent from the task index). The GUI's arq job reads the SSH channel's stdout/stderr as data arrives (line-buffered chunks), forwarding each chunk to the Phase-3 Tasks-drawer WebSocket. This satisfies D-08 ("live `pct exec` stdout/stderr streams into the Tasks drawer") as **incremental chunked output**, not a single terminal dump — the SSH channel is a live byte stream, so the drawer updates as the install progresses. A long install (`immich`, `nextcloudpi`) produces many chunks over several minutes. The arq job itself is the durable unit; `pct exec` not being UPID-polled means the job tracks completion via the SSH exit code + the `/root/.install-${SESSION_ID}.failed` flag file (§2.4), not via PVE task polling.

---

## 4. Metadata JSON format + stability (A7)

**Important repo-structure correction.** The path the research assumed (`frontend/public/json/<app>.json` in `community-scripts/ProxmoxVE`) **no longer exists**. The Next.js web frontend was split out: `community-scripts/ProxmoxVE` now contains only `ct/ install/ misc/ tools/ turnkey/ vm/` and **zero per-app JSON files**. The frontend lives at `community-scripts/ProxmoxVE-Frontend-Archive` (archived, stale — last commit 2026-03-12).

**The live, maintained metadata source is `community-scripts/ProxmoxVE-Local`** — the official "local version of the ProxmoxVE repository" — which carries the per-app JSON at:
```
scripts/json/<slug>.json
```
414 JSON files present. This is the catalog source the GUI's bundled snapshot (D-05) should mirror.

Fetched live `scripts/json/pihole.json` and `scripts/json/jellyfin.json`. **Actual field set** (A7 assumed-fields verdict):

| Field | Present | A7 assumed? | Notes |
|-------|---------|-------------|-------|
| `name` | always | yes ✓ | display name |
| `slug` | always | yes ✓ | → `install/<slug>-install.sh`, `ct/<slug>.sh` |
| `categories` | always | yes ✓ | array of integer category IDs |
| `type` | always | yes ✓ | `ct` (LXC) or `vm` |
| `updateable` | always | A7 said `updateable` ✓ | (note: spelled `updateable`, not `updatable`) |
| `privileged` | always | yes ✓ | unprivileged-vs-privileged LXC |
| `interface_port` | usually (`null` for headless apps) | yes ✓ | web UI port |
| `install_methods[]` | always | yes ✓ | each: `type`, `script` (`ct/<slug>.sh`), `resources{cpu,ram,hdd,os,version}` |
| `default_credentials` | always (often `{username:null,password:null}`) | yes ✓ | |
| `notes[]` | always | yes ✓ | each: `text`, `type` (`info`/`warning`) |
| `date_created` | always | not in A7 — **add** | ISO date |
| `documentation` | usually | not in A7 — **add** | upstream docs URL |
| `website` | usually | not in A7 — **add** | |
| `logo` | always | not in A7 — **add** | CDN webp icon URL |
| `config_path` | usually | not in A7 — **add** | in-container config path |
| `description` | always | not in A7 — **add** | long catalog blurb |
| `repository_url` | present in `ProxmoxVE-Local` JSON | not in A7 — **add** | points back at `community-scripts/ProxmoxVE` |

**Reliably present** (every JSON): `name`, `slug`, `categories`, `type`, `updateable`, `privileged`, `install_methods` (with full `resources`), `default_credentials`, `notes`, `description`, `logo`, `date_created`.
**Sometimes missing / nullable**: `interface_port` (`null` for headless apps), `documentation`, `website`, `config_path`.

**Fields the catalog module (04-06) parses into wizard option fields (D-07):**
`name` + `logo` + `description` (card display) · `slug` (→ install-script name) · `type` (filters LXC-only) · `install_methods[].resources.{cpu,ram,hdd}` (prefill the CPU/RAM/disk wizard fields, validated against quota) · `resources.{os,version}` (selects the vztmpl) · `privileged` (sets `var_unprivileged`) · `interface_port` (post-deploy "open URL" link) · `notes[]` of `type:warning` (surfaced as a deploy-time caution) · `default_credentials` (post-deploy info panel).

**Metadata-format stability verdict:** the schema is **stable and consistent** across the inspected apps — every required field present, no per-app schema drift. D-07's "defaults-only non-interactive fallback when metadata cannot be parsed" remains the correct safety net, but it should rarely fire: the realistic failure mode is the **upstream path moving** (as it just did — `frontend/public/json` → `ProxmoxVE-Local/scripts/json`), not individual JSON files being malformed. The catalog module must therefore tolerate a missing/renamed path and fall back to the bundled snapshot.

---

## 5. Commit pinning (Pitfall 10, D-05)

- **Floor commit:** `369f9013088f19771a1b95c40ee252fd4c16f91b` (`community-scripts/ProxmoxVE`, branch `main`, 2026-05-16). This is the bundled-snapshot floor — the GUI ships this SHA and updates only via the admin "Sync catalog" action (D-05), satisfying threat **T-04-01-01** (pin to a reviewed commit, never "always latest").
- **Raw fetch URL shape — install/entry scripts** (pin the SHA, never `main`):
  ```
  https://raw.githubusercontent.com/community-scripts/ProxmoxVE/<SHA>/install/<slug>-install.sh
  https://raw.githubusercontent.com/community-scripts/ProxmoxVE/<SHA>/misc/install.func
  ```
- **Raw fetch URL shape — catalog JSON metadata** (note: a *different* repo — see §4):
  ```
  https://raw.githubusercontent.com/community-scripts/ProxmoxVE-Local/<SHA-or-tag>/scripts/json/<slug>.json
  ```
  The two repos pin independently; the bundled GUI snapshot records a `{scripts_repo_sha, catalog_repo_sha}` pair. The "Sync catalog" button re-pins both deliberately.
- **Practical consequence for §2's invocation:** the GUI must rewrite the upstream `curl …/ProxmoxVE/main/install/…` to `…/ProxmoxVE/<FLOOR_SHA>/install/…` AND likewise pin the `FUNCTIONS_FILE_PATH` source (`misc/install.func`) — because `install.func` itself re-sources `core.func`/`error_handler.func` from `…/main/…` (see `install.func:35`). A fully-pinned execution either (a) fetches `install.func` from the pinned SHA and accepts that its inner `core.func` fetch still hits `main`, or (b) for true supply-chain hardening, mirrors `misc/*.func` into the bundled snapshot and serves them from the GUI's own host. **(b) is the Pitfall-10-correct posture; 04-06 should implement (b) — vendor `misc/install.func`, `misc/core.func`, `misc/error_handler.func` into the snapshot at the floor SHA.**

---

## 6. Attribution format (Pitfall 10, LXC-04)

`community-scripts/ProxmoxVE` is **MIT-licensed** (`LICENSE`: `Copyright (c) 2021-2026 tteck | community-scripts ORG`). MIT requires the copyright + permission notice be retained. Each `install/<app>-install.sh` also carries its own per-author header (e.g. `immich-install.sh`: `Author: vhsdream`).

**Attribution string the UI surfaces before the deploy button** (LXC-04 / D-07 — source link + commit hash + last-reviewed date):

> This installs **{app.name}** using community code from
> **community-scripts/ProxmoxVE@`369f9013`** — MIT licensed, © 2021-2026 tteck | community-scripts ORG.
> Last reviewed: **2026-05-16**. [View source](https://github.com/community-scripts/ProxmoxVE/blob/369f9013088f19771a1b95c40ee252fd4c16f91b/install/{slug}-install.sh) · [Diff since last review](…)
> ⚠️ Runs third-party code as root inside the new container.

Where any catalog `notes[]` entry has `type: "warning"` (e.g. pihole's *"Installation sources scripts outside of Community Scripts repo"*), that warning text is shown alongside the attribution. The full stdout/stderr of the install run is captured to the audit log (Pitfall 10 #6 / CLAUDE.md constraint 8 / threat T-04-01-02).

---

## 7. Go/no-go for LXC-03 + impact on 04-06

**Verdict: GO — with a confirmed, evidence-backed non-interactive path.**

A working non-interactive deploy path exists: it is **not** "run the bare install script" (impossible — §1) and **not** "run `ct/<app>.sh`" (forbidden — Pitfall 10), but the *upstream-proven* path of running only the install stage inside the GUI-created LXC via `pct exec`/`lxc-attach`, with the `build.func` env block reproduced host-side and affirmative stdin fed to the few interactive `read` prompts (§2). This is exactly the model D-05/D-07/D-08 already assume — the spike confirms it works rather than degrading LXC-03 to a defaults-only floor.

**One material correction to the plan's assumptions, carried into 04-06:** the connector's `lxc_exec` is **SSH `pct exec`, not a proxmoxer REST call** — `POST …/lxc/{vmid}/status/exec` returns `501` on PVE 9.1.2 (§3). 04-06 (and the networking/console plans that create LXCs) must add an **SSH transport** to each PVE node alongside the proxmoxer REST connector.

### Concrete contract — what `run_community_script` stage 2 MUST do (04-06)

`run_community_script` is a **two-stage arq job** (Pattern 3 / 04-RESEARCH §Pattern 3):

- **Stage 1 — `create_lxc`:** the GUI's *own* code path creates the empty unprivileged LXC via `pct create` (over SSH to the target node) using the catalog `resources` (`cpu`/`ram`/`hdd`/`os`/`version`) and the wizard's network/storage picks. UPID-polled like every other Phase-3 mutating job. Start the container; wait for network (`hostname -I` non-empty, mirroring `setting_up_container`).

- **Stage 2 — install stage (this spike's deliverable):**
  1. Fetch `install/<slug>-install.sh` and `misc/install.func` from the **pinned floor SHA** `369f9013…` (or, preferred, the bundled-snapshot vendored copies — §5).
  2. On the PVE node host, export the `build.func` env block (§2.1): `FUNCTIONS_FILE_PATH` (= `install.func` contents), `CTID`, `PCT_OSTYPE`, `PCT_OSVERSION`, `APPLICATION`, `app`, `PASSWORD=""`, `VERBOSE=yes`, `tz`, `DIAGNOSTICS=no`, `SSH_AUTHORIZED_KEY`, `SESSION_ID`, `INSTALL_LOG`.
  3. Run, inside the running LXC: `lxc-attach -n <CTID> -- bash -c "$(<install-script>)"` with affirmative stdin (`yes y |`) to clear the third-party-installer `read` confirms.
  4. Stream stdout/stderr **in chunks** off the SSH channel into the Phase-3 Tasks-drawer WebSocket (D-08).
  5. On completion, check the container for `/root/.install-${SESSION_ID}.failed`; if present, read its exit code; else use the SSH exit code. Non-zero ⇒ job fails, container is left for inspection (or torn down per the wizard's choice).
  6. Persist the **full captured output** to the audit log (Pitfall 10 / CLAUDE.md #8 / T-04-01-02), and record the floor SHA + last-reviewed date on the job row for LXC-04 traceability.

- **Defaults-only fallback (D-07):** if the catalog JSON for an app cannot be parsed (missing/renamed upstream path — §4), 04-06 falls back to the bundled-snapshot JSON; if even that is unavailable for an app, the app is shown as non-deployable rather than deployed with guessed values.

This contract resolves Research Assumptions **A1** (install stage is not standalone — confirmed `no`), **A2** (non-interactive path — confirmed via `lxc-attach` + env block + stdin), and **A7** (metadata format — confirmed stable, with the repo-path correction). Plan **04-06** now has an evidence-backed, implementable spec for `run_community_script`.
