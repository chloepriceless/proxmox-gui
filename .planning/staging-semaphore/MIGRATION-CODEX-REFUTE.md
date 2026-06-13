# Semaphore-Migration pz2->pz3 — Cross-Lab Codex-Refute (Roh-Evidenz)

**Tool:** /usr/bin/codex exec · gpt-5-codex · Refute-Modus · 2026-06-13. **Gate:** R22/R26 (Migration Live-CI-Service + verschluesselte DB-Secrets + IP-Cutover + destruktiver Decommission).
**Verdict:** Migrationsweg ok, 11 Verify/Cutover-Haertungs-Findings -> M-A1..M-A11 in MIGRATION-PZ2-TO-PZ3.md. Schwerwiegendste: Decryption-Beweis muss authentifizierter privater Clone sein, nicht 'kein Error'.

---

**Findings**

**Critical: SQLite copy can be inconsistent or stale**
Severity: Critical  
Concrete scenario: Semaphore uses SQLite in WAL mode. Recent committed changes are in `data/database.sqlite-wal`, while `database.sqlite` is behind. The plan stops the container and copies `/opt/semaphore/`, but its integrity claim specifically centers on `database.sqlite`. If the tar excludes hidden/sidecar files by mistake, or if the DB is copied after stop without an explicit checkpoint/integrity check, migrated Semaphore may lose the latest templates, token state, sessions, or user changes.  
Why plan does not cover it: “docker compose stop” reduces risk, but it does not prove WAL was checkpointed or that `database.sqlite-wal` and `database.sqlite-shm` were captured. The plan has no `PRAGMA wal_checkpoint`, `PRAGMA integrity_check`, file inventory, or post-copy DB validation.  
Fix direction: Before archive, stop Semaphore cleanly, then run SQLite validation from the same data directory: `PRAGMA wal_checkpoint(TRUNCATE); PRAGMA integrity_check;`. Archive the entire `data/` directory including `database.sqlite*` with numeric ownership. After restore, run `sqlite3 database.sqlite 'PRAGMA integrity_check;'` and verify expected rows directly before app boot.

**Critical: Secret-decryption proof is too weak**
Severity: Critical  
Concrete scenario: The dry-check task “clones repo, then fails at host-connect” may pass because the repo is public, cached, using a different credential path, using an existing checkout, or failing after a partial/authless operation. The encrypted SCM token could still be undecryptable, wrong, or unused. Frischi later wires campaigns and discovers private repo access or webhook-triggered runs fail.  
Why plan does not cover it: The plan assumes same `SEMAPHORE_ACCESS_KEY_ENCRYPTION` plus same image is sufficient, but it does not specify a direct authenticated operation proving the migrated encrypted token decrypted to the expected secret. It also does not verify whether Semaphore’s encryption depends on config, DB fields, provider version, or exact env-loading behavior.  
Fix direction: Prove decryption with a private authenticated Git operation that cannot succeed anonymously and cannot use cache. Inspect task logs for authenticated clone against a private endpoint, or use Semaphore API/UI to update/test the repository credential. Also verify the migrated container actually sees the expected `SEMAPHORE_ACCESS_KEY_ENCRYPTION` at runtime, not just that `.env` exists.

**High: Admin bootstrap behavior is unproven**
Severity: High  
Concrete scenario: The migrated DB already has an admin user. On first boot, env vars such as `SEMAPHORE_ADMIN_PASSWORD` are still present. Depending on Semaphore bootstrap logic, the app may ignore them, reset the existing admin password, attempt duplicate creation, mutate role/user records, or initialize against the wrong/empty DB path if config resolution differs.  
Why plan does not cover it: The plan treats env reuse as harmless but does not verify Semaphore v2.18.12 bootstrap semantics with a non-empty SQLite DB. Login success only proves one password works after the fact; it does not prove no user mutation occurred or that DB initialization did not silently target another path before correction.  
Fix direction: Check Semaphore v2.18.12 startup behavior against existing DB before migration. Capture pre/post user table IDs, usernames, password hash timestamps if available, and project/template counts. Consider removing bootstrap-only admin env vars after initial creation if Semaphore no longer needs them, while preserving encryption/key env.

**High: Cutover can expose or blackhole service due to firewall/order race**
Severity: High  
Concrete scenario: LXC150 comes up on `.176`, Docker starts before the fail-closed firewall service or before `DOCKER-USER` rules are installed. For a short window, port 3000 may be reachable more broadly than intended, or Docker’s iptables rules may bypass INPUT policy. Conversely, firewall rules may be applied before Docker creates chains, producing a broken allowlist and a dead service.  
Why plan does not cover it: “deploy fail-closed FW … Before=docker.service” is directionally good but not a verified boot-order contract. The plan does not say firewall is installed and enabled before assigning `.176`, nor does it test cold-boot behavior.  
Fix direction: Install and enable firewall while still on temp IP, verify rule persistence, then cut over. Make Docker depend on the firewall unit, assert `DOCKER-USER` exists, and run a reboot test of LXC150 before declaring success. Validate allowed and denied sources after a full restart, not only after manual rule application.

**High: ARP/MAC cutover is under-specified**
Severity: High  
Concrete scenario: `.176` moves from LXC157 on pz2 to LXC150 on pz3 with a new MAC. Gateway, switches, clients, Forgejo callbacks, or monitoring retain stale ARP entries. Users hit the old MAC or blackhole traffic until caches expire. Rollback has the same problem in reverse.  
Why plan does not cover it: The plan says stopping 157 “frees .176” but does not include gratuitous ARP, neighbor cache flushes, or a test from the actual gateway and important clients.  
Fix direction: At cutover and rollback, send gratuitous ARP from LXC150 for `.176`, flush neighbor entries on the gateway if manageable, and verify from LAN, WG, Forgejo/ansible-control, and monitoring sources.

**High: Bind-to-IP can fail during boot or rollback**
Severity: High  
Concrete scenario: Compose is changed from `127.0.0.1:3000` to `192.168.20.176:3000`, but Docker starts before the address is configured in the LXC. The container fails to bind, remains unhealthy, or restart-loops. On reboot, same race reappears.  
Why plan does not cover it: There is a manual restart verify, but no cold-boot/onboot test with the final IP and firewall ordering.  
Fix direction: Prefer binding the container to `127.0.0.1` or all interfaces internally and controlling exposure with host/LXC firewall, or add explicit systemd ordering so Docker starts only after network-online and the target address exists. Reboot LXC150 after final cutover and verify.

**Medium: UID/GID preservation is assumed, not proven**
Severity: Medium  
Concrete scenario: `pct push` or extraction maps owner names instead of numeric IDs, or tar extraction inside the new unprivileged LXC creates files owned by root or a nonexistent name. Semaphore starts but cannot read/write `config/` or `data/`, causing SQLite permission errors or a new empty DB to be created elsewhere.  
Why plan does not cover it: It says “preserve owner/perms” and notes uid `1001`, but does not require `tar --numeric-owner`, post-restore `stat`, or write tests.  
Fix direction: Archive/extract with numeric owners. Verify `stat -c '%u:%g %a %n'` on `.env`, `config/config.json`, `data/database.sqlite*`, and run an app-level write test such as saving a non-destructive setting or launching a task.

**Medium: Forgejo reachability from pz3 is not guaranteed**
Severity: Medium  
Concrete scenario: LXC150 on pz3 cannot reach `192.168.20.172:3000` due to Proxmox bridge firewall, LXC-level policy, asymmetric routing, Forgejo allowlists, or Docker subnet collisions. Migration appears healthy via local login but task execution fails.  
Why plan does not cover it: The dry-check covers this only if it truly performs a fresh authenticated clone from LXC150. There is no independent network test from the new container namespace.  
Fix direction: From LXC150, test TCP reachability and authenticated Git access before cutover: `curl`/`nc` to Forgejo, then a fresh clone using the migrated Semaphore credential through Semaphore itself.

**Medium: Hidden host/IP-specific state is not inventoried**
Severity: Medium  
Concrete scenario: `config/config.json` or DB settings contain a public URL, webhook URL, runner path, temp directory, task working dir, SSH known-hosts path, or callback address tied to pz2, old container ID, or previous bind assumptions. UI works, but webhooks, API callbacks, task logs, or integrations point to stale locations.  
Why plan does not cover it: It treats `/opt/semaphore/` as complete but does not audit config and DB settings for node/IP/path references.  
Fix direction: Grep and query for `192.168.20.42`, `192.168.20.176`, `pz2`, `157`, old paths, webhook/base URL fields, and runner directories. Decide which references should remain `.176` and which must change.

**Medium: Decommission leaves external references ambiguous**
Severity: Medium  
Concrete scenario: NetBoard, monitoring, dashboards, backup jobs, alert rules, or inventory still describe Semaphore as LXC157 on pz2. Operators later patch the wrong node, restart the stopped fallback, or destroy the wrong instance.  
Why plan does not cover it: Reporting to Hub is not the same as updating source-of-truth records and monitoring ownership.  
Fix direction: Add an explicit post-cutover checklist: update NetBoard asset/tile, monitoring target metadata, backup target, Proxmox inventory, and runbook. Mark LXC157 as stopped fallback with a destroy hold.

**Low: “No greenfield duplicate” is weakened during verify**
Severity: Low  
Concrete scenario: LXC150 runs with copied production DB and secrets on a temp IP. Even bound to localhost, it may execute scheduled tasks, poll repositories, send notifications, or mutate DB state independently of old 157.  
Why plan does not cover it: The plan focuses on LAN exposure and IP conflict, not application-level duplication or scheduler side effects while both old and new copies exist.  
Fix direction: Disable schedules/runner execution during verify, or ensure old 157 is fully stopped before any new app boot. Record that no scheduled tasks are active.

**Single Most Severe Weakness**

The most severe weakness is the lack of a hard, direct proof that the migrated encrypted SCM token decrypts and is used successfully. If that assumption is wrong, the migration can pass login/project/template checks while silently delivering a Semaphore instance that cannot run real patch campaigns. The plan needs an authenticated, cache-free repository operation through Semaphore using the migrated credential, plus explicit verification that the runtime encryption key is exactly the backed-up key.
