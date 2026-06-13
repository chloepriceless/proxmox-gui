# T-0116/E2 Exec-Key Deploy-Plan — Cross-Lab Codex-Refute (Roh-Evidenz)

**Tool:** /usr/bin/codex exec · codex-cli 0.139.0 · gpt-5-codex · Refute-Modus · 2026-06-13.
**Reviewer:** Schraubi (vm-deployment-gui) + codex-worker (cross-lab). **Gate:** R22 (prod-reichende SSH/sudo-Grant-Aenderung).
**Verdict:** BLOCK — 12 Findings, schwerwiegendste = sudoers root-aequivalent. Eingearbeitet als E2-A1..A11 in E2-EXEC-KEY-DEPLOY-PLAN.md.
**Zusatz-Befund (Code-Read, nicht von Codex):** bootstrap-authorized_key ist exclusive:true => 2.-Key-Run wiped E1 (E2-A5).

---

**Findings**

**Critical: “minimal-sudoers” is effectively root-equivalent**
Severity: Critical

Scenario: A compromised Semaphore template, malicious Forgejo commit, or attacker with access to the Semaphore key can run Ansible as `ansible` and use allowed sudo commands to execute attacker-controlled code as root. `dpkg --install` can install a crafted `.deb` with maintainer scripts running as root. `apt-get` can be abused through config options/hooks depending on sudoers argument restrictions, for example `Dpkg::Pre-Invoke`, `DPkg::Post-Invoke`, custom config files, local package install, or package scripts. `needrestart` has also had dangerous historical behavior and CVEs around interpreter/library handling.

Why the plan does not cover it: The plan treats `apt-get, apt, dpkg, needrestart` as “minimal” and assumes “no ALL/reboot/systemctl” materially bounds privilege. It does not specify exact sudoers argument constraints, `NOEXEC`, environment reset behavior, command digests, wrapper scripts, or whether arbitrary arguments are permitted. If sudoers allows these binaries with flexible arguments, patch access is not meaningfully separate from root.

Fix direction: Treat E2 patch access as root-reaching. Prefer narrow root-owned wrapper commands for the exact patch workflow, with fixed arguments and audited behavior. If direct sudo remains, constrain arguments aggressively, remove `dpkg` where possible, disable dangerous sudo env/config injection, use `env_reset`, avoid user-controlled apt config, and assume any repo playbook push can become root on all targeted hosts.

---

**Critical: a malicious playbook can likely exfiltrate the E2 private key**
Severity: Critical

Scenario: Semaphore injects the SSH private key into the job runtime so Ansible can pass `--private-key`. A malicious playbook or role in `frischi/fleet-ansible` can run locally on the Semaphore runner, inspect process args, environment, job temp dirs, Ansible variables, mounted paths, or `/tmp`, and copy the private key to an external host or into job logs/artifacts. Even if the key is encrypted at rest in Semaphore’s DB, it must become plaintext during execution.

Why the plan does not cover it: The plan says “Private NUR in Semaphore-Key-Store” and “ACCESS_KEY_ENCRYPTION-verschlüsselt,” but that only addresses storage at rest. It does not establish where Semaphore writes the key, file permissions, lifetime, cleanup semantics, whether playbooks can execute local tasks on the runner, or whether repo contributors are trusted to handle a prod-reaching SSH credential.

Fix direction: Confirm Semaphore’s exact runtime key materialization behavior before deployment. Prevent untrusted playbooks from running local tasks on the runner. Restrict who can push/merge to the playbook repo. Require signed commits or protected branches. Consider short-lived SSH certificates instead of long-lived private keys. Run Semaphore jobs in an isolated runner with no network egress except targets and SCM, and assume repo write access equals host root access unless proven otherwise.

---

**High: `from="192.168.20.176"` is unverified and may be wrong because Ansible runs inside Docker**
Severity: High

Scenario: The SSH connection originates from the Semaphore container, not directly from the LXC network namespace. Depending on Docker networking inside LXC, the target may see source IP `.176`, a Docker bridge address, a SNAT address, or some other host/interface IP. If the pin is wrong, E2 fails. Worse, operators may “fix” it by broadening `from=` to a subnet, Docker bridge range, hostname, or removing it.

Why the plan does not cover it: The plan assumes `.176` is the source IP but does not require packet-level verification from the actual Semaphore container path to a target host. The dry-check failure only proved the missing key path, not the final source identity.

Fix direction: Before installing the production authorized key, run a controlled probe from inside the exact Semaphore container/network path to a canary and log the observed source on the target, for example with `sshd` logs, `tcpdump`, or a temporary forced-command key. Pin only the observed stable source. If Docker NAT makes this ambiguous, fix networking first rather than weakening `from=`.

---

**High: repo push access becomes prod host access**
Severity: High

Scenario: Anyone who can push to `frischi/fleet-ansible` can alter inventories, playbooks, bootstrap roles, or `ansible.cfg`, then trigger or wait for a Semaphore run. With E2 key plus sudo apt/dpkg access, that person can execute root code on the seven hosts.

Why the plan does not cover it: The plan names Forgejo SCM but does not define branch protection, review requirements, signed commits, deploy branch separation, Semaphore template restrictions, or who can trigger jobs. It treats the playbook repo as trusted without proving its controls match the new production reach.

Fix direction: Protect deployment branches, require review for bootstrap/sudo/inventory changes, restrict Semaphore to immutable refs or approved tags, restrict job trigger permissions, and audit both Forgejo and Semaphore identities. Treat SCM compromise as infrastructure compromise.

---

**High: removing `private_key_file` from shared `ansible.cfg` can break or cross-wire E1**
Severity: High

Scenario: E1 on LXC 155 relies on the existing `private_key_file = /home/semaphore/.ssh/ansible_ed25519` path, or some shared config behavior. Removing it may break E1 runs. Keeping it may cause Semaphore to use the wrong key, or cause users to mount/write the E2 key at the same path, weakening separation between E1 and E2.

Why the plan does not cover it: The plan explicitly says the same `ansible.cfg` may be used by 155, then leaves the choice as “remove OR mount key there.” That is not a reviewed design; it is a fork in the security-critical behavior.

Fix direction: Do not share ambiguous key resolution. Split caller-specific config or inventory vars. Make E1 and E2 key selection explicit per caller and per template. Test E1 after the change before rolling to rest. Avoid placing the E2 private key at the old E1 path.

---

**High: exclusions are not guaranteed by `grep`**
Severity: High

Scenario: A later inventory change, dynamic inventory, group nesting, `--limit` mistake, hostname alias, or playbook targeting `all` reaches excluded hosts `134`, `142`, or `125`. A malicious repo commit can add them back under different names or include them through children groups.

Why the plan does not cover it: “grep 134/142/125 not in target groups” is a weak static check. It does not prove the effective Ansible host graph, runtime limits, template inventory selection, or future repo changes.

Fix direction: Verify with `ansible-inventory --graph --list` from the exact Semaphore template context. Add explicit deny controls outside the repo where possible: Semaphore template limits, separate inventories, firewall/sshd authorization absence on excluded hosts, and CI checks that fail if excluded hostnames/IPs appear anywhere in effective inventory.

---

**Medium: canary dry-check may not validate the real patch path**
Severity: Medium

Scenario: A dry check proves SSH auth and maybe privilege discovery, but the real patch run exercises different tasks, sudo commands, handlers, package installs, `needrestart`, and post-tasks. A key/pin can pass `ping` while the real workflow has broader or different behavior.

Why the plan does not cover it: Acceptance says “patch-dry-check” and “ping:pong,” but does not require validating the exact real command path, sudo invocations, package update behavior, or failure handling.

Fix direction: Add a canary real patch execution with bounded package state, full verbose logs, and explicit sudo denial tests. Verify both auth and the real patch workflow before ring_rest.

---

**Medium: rollback does not handle compromise**
Severity: Medium

Scenario: If Semaphore, Forgejo, or the E2 key is compromised, deleting the Semaphore key-store entry and removing the authorized_key line is not enough if the attacker already installed persistence, modified packages, added another key, or changed sudoers through package hooks.

Why the plan does not cover it: Rollback is operational reversibility, not incident response. It assumes the only state change is the authorized key.

Fix direction: Define revocation and compromise procedure: remove key, rotate all related credentials, inspect hosts for new users/keys/sudoers/packages/systemd units, review Semaphore job logs, Forgejo commits, and package manager logs. Consider host-based detection for changes outside expected apt transactions.

---

**Medium: backup in NetBoard expands the private-key leak surface**
Severity: Medium

Scenario: The E2 private key is copied into NetBoard. Anyone with NetBoard read/admin/database/backup access may now possess a prod-reaching SSH credential. NetBoard backups, exports, screenshots, and admin workflows become part of the key custody boundary.

Why the plan does not cover it: It says “Private-Backup NetBoard” but does not describe encryption, access control, audit, retention, rotation, or whether NetBoard is appropriate for secret storage.

Fix direction: Use a real secret manager with audit and access policy, or avoid backing up long-lived private keys at all. Prefer regenerating/redeploying a new key. If stored, document who can read it and rotate after any suspected exposure.

---

**Medium: `.176` compromise has broad blast radius**
Severity: Medium

Scenario: If Semaphore LXC 157 or its Docker container is popped, the attacker gets the SSH key, job runtime, repo checkout, and network position allowed by `from=.176`. The `from=` pin then protects only against use from elsewhere, not against the most likely source after compromise.

Why the plan does not cover it: The plan relies heavily on source pinning but does not specify hardening of the runner, container isolation, egress restrictions, read-only mounts, secrets isolation, or monitoring.

Fix direction: Harden Semaphore as a privileged automation boundary: minimal admins, patched container/image, restricted Docker socket access, no unnecessary mounts, egress allowlist, job isolation, log/audit export, and alerting on unexpected SSH fan-out.

---

**Medium: authorized_key options are incomplete**
Severity: Medium

Scenario: The key allows normal shell login as `ansible`. Even with no port/X11/agent forwarding, a holder can run arbitrary non-sudo commands, inspect readable files, stage payloads, consume disk, or exploit local privilege escalation bugs. If sudo command constraints are weak, they can escalate.

Why the plan does not cover it: It includes common forwarding restrictions but no `command=` forced wrapper, no `restrict`, no PTY decision, no source subnet validation details, and no per-command audit boundary.

Fix direction: Add `restrict` where supported and consider a forced command wrapper if the workflow can tolerate it. At minimum, combine key restrictions with shell/account hardening and explicit logging.

---

**Most Severe Weakness**

The most severe weakness is that the plan treats `apt-get`, `apt`, `dpkg`, and `needrestart` sudo access as “minimal,” when in practice it is close to root-equivalent once combined with repo-controlled Ansible execution. A malicious Semaphore job or Forgejo commit can likely turn the E2 key into root code execution on every authorized host.
