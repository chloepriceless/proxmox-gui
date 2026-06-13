# T-0204 Hardening-Spec — Cross-Lab Codex-Refute (Roh-Evidenz)

**Tool:** `/usr/bin/codex exec` · codex-cli 0.139.0 · model gpt-5-codex · Refute-Modus (nicht bestätigend).
**Datum:** 2026-06-13 · **Reviewer:** Schraubi (vm-deployment-gui) · **Subagent:** codex-worker (cross-lab).
**Gate:** R22 "echter cross-lab Codex-Refute" auf `T0204-HARDENING-SPEC.md` — der frühere Refute war same-model (Claude general-purpose).
**Prompts:** `/tmp/schraubi_codex_refute_prompt.md` (v1, Prosa) · `/tmp/schraubi_codex_refute_v2.md` (v2, Spec-Volltext eingebettet).

> Konvergenz: Beide Läufe landeten unabhängig auf derselben schwerwiegendsten Schwachstelle —
> `pct stop`+Broker-Epoch schützen nur Broker-Frames, nicht externe Seiteneffekte (git/WA/Telegram).
> v2 (literaler Spec-Text) ist der maßgebliche Lauf; die Amendments A1–A11 in der Spec leiten sich daraus ab.

---

## Lauf v2 (maßgeblich — literaler Spec-Volltext eingebettet, kein File-Read nötig)

**Findings**

1. **Critical: `pct stop` is not a reliable fencing primitive**
   
   Failure scenario: a peer node is partitioned on the management/corosync path, overloaded, wedged, or has a stuck LXC shutdown. `spawnerd` issues `pct stop <peer-runner-LXC>` but cannot prove the old process is dead. If it later respawns elsewhere, singleton channels can double-login and git writers can diverge.

   The spec says “respawnt erst nach bestätigtem Stop,” so a simple “lease expiry triggers respawn” critique is not valid against the happy path. But the hard case is exactly the fail-open/fail-stuck case: what counts as “confirmed stop,” from whose perspective, and what happens when confirmation cannot be obtained? `pct stop` is a guest/container stop command, not power fencing. It does not prove the physical node cannot continue executing if the cluster API view is stale, blocked, or partitioned.

   Fix direction: require real fencing semantics: Proxmox HA watchdog/self-fencing, IPMI/PDU power fence, node-level HA fencing, or a documented “no respawn unless old node has self-fenced or is power-fenced” rule. Define timeout behavior explicitly as fail-closed: no replacement peer and no singleton start until fencing proof exists.

2. **Critical: epoch lease protects Broker routing, not external side effects**
   
   Failure scenario: old isolated peer keeps running while disconnected from Broker but still has internet access. It continues writing to git, WhatsApp, Telegram, local files, or direct APIs. Broker drops old-epoch frames only after the peer talks to Broker again or after partition heals.

   The spec partially addresses this by adding STONITH, and it correctly says lease-only is insufficient. But the literal epoch design only guards “Frames” routed through Broker. It does not cover side effects outside Broker, especially the explicitly dangerous singleton channels. The acceptance criterion “externe Kanäle erhalten genau 1 Zustellung” is asserted, not guaranteed by the Broker lease.

   Fix direction: singleton channels need their own fencing/leader lease with durable compare-and-swap semantics, or must only be reachable through a single fenced service. Old peers must lose credentials, network egress, or lease ownership before a replacement can act.

3. **Critical: epoch durability across Broker failover is left as an open question**
   
   Failure scenario: Broker/Hub fails over from a stale ZFS replica. The durable epoch counter rolls back. An old peer with a previously valid epoch reconnects and is accepted, or a replacement reuses an epoch already seen before the crash.

   The spec explicitly asks “Wo lebt der Epoch-Zähler bei Broker-Failover,” so it knows this is unresolved. That is not a minor open question; it is central to split-brain prevention. Without a monotonic, durable epoch source, the Broker-side lease is not a correctness mechanism.

   Fix direction: put epochs in a quorum-backed store, Forgejo/git with strict CAS, SQLite with synchronous durable writes on non-rollback storage, or an external consensus/lease service. Define monotonicity across Hub/Broker failover and replica rollback.

4. **High: `wal_checkpoint(TRUNCATE)` does not make a snapshot app-consistent**
   
   Failure scenario: Hub is under active writes. A pre-snapshot hook runs `PRAGMA wal_checkpoint(TRUNCATE)`, then writes resume before or during the ZFS snapshot. SQLite may be recoverable, but the snapshot is not a coherent application cut across SQLite plus JSON plus in-memory lifecycle commands.

   The spec correctly identifies that pvesr snapshots are crash-consistent, not app-consistent. But its fix direction hand-waves the critical part: quiescing. `wal_checkpoint(TRUNCATE)` drains WAL at a point in time; it does not freeze writers until after the filesystem snapshot completes. Periodic `.backup` creates a database copy, but the spec does not say the failover uses that backup instead of the live DB, nor how JSON files are coordinated with it.

   Fix direction: implement a real snapshot protocol: enter read-only/quiesced mode, flush SQLite and JSON, fsync files and directories, take snapshot, then resume. Or produce a single atomic application backup artifact and make failover restore from that artifact, not from arbitrary live `data/`.

5. **High: multi-file coherence is not solved**
   
   Failure scenario: SQLite registry says peer epoch 42 exists, JSON ledger still says epoch 41, or a lifecycle command file is renamed after the DB backup but before the ZFS snapshot. Hub starts cleanly but routes or reconciles using a mixed state.

   The spec mentions SQLite, JSON atomic rename, and idempotent Spawn-ID. Those are useful local practices, but they do not provide a transaction boundary across multiple files. “No corrupt JSON” is weaker than “state is semantically coherent.”

   Fix direction: define one authoritative state store, or add a manifest/commit marker protocol. Every snapshot/backup should contain a versioned transaction id, and startup must reject or repair mixed-generation state.

6. **High: Repl monitoring measures job freshness, not recoverability**
   
   Failure scenario: `pvesr status` is green and snapshot age is under 3 minutes, but the replica cannot boot, Hub data is incoherent, the target lacks capacity, HA constraints prevent placement, or singleton services start twice.

   The spec is right that monitoring must be pre-cutover and that failed pvesr jobs can silently rot. But Blocker #4 only gates replication health. It does not prove restore correctness, bootability, app consistency, placement feasibility, or acceptable RPO/RTO.

   Fix direction: add a recoverability gate: periodic automated restore drill on the actual target class, Hub startup validation, SQLite checks, JSON generation checks, Broker/peer reconciliation checks, singleton exclusivity checks, and alerting on stale or missing successful restore tests.

7. **High: pz2 git-only failover is an under-specified failure class**
   
   Failure scenario: fleet-core or a peer with local `data/` is scheduled, manually started, or HA-failed onto pz2, which has no ZFS replication. It comes up with git state only, missing Hub local state, epoch history, or singleton ownership state.

   The system context says pz2 has no ZFS and supports git-only failover. The spec mentions ZFS replication pz1/pz3/pve but does not define hard placement exclusions, degraded-mode behavior, or what must never run on pz2.

   Fix direction: encode Proxmox HA groups and hard constraints: Hub/Broker/fleet-core requiring local `data/` must not start on pz2 unless a documented restore path exists. For git-only nodes, define exactly which peers are allowed and which state they may reconstruct.

8. **High: `spawnerd` remains a single controller with ambiguous restart ownership**
   
   Failure scenario: fleet-core host dies. During HA restart, a stale spawnerd instance is still running somewhere, a restarted spawnerd comes up from stale replicated state, or an operator starts a second copy. Both reconcile against Broker visibility gaps and spawn peers.

   The spec rejects hot-standby spawnerd, which is reasonable, and says “Reconcile-Diff, keine doppelten peer_id.” But idempotent reconcile is only as strong as the atomicity of the spawn claim. A git Soll-Map is not a runtime lock. Broker registry is not reliable during partition or Broker failover unless its lease state is durable.

   Fix direction: add a controller lease with fencing, durable owner epoch, and compare-and-swap spawn claims per `peer_id`. Peer creation must be transactional: claim, spawn, register, confirm, release/repair.

9. **Medium: sequencing puts monitoring first, but monitoring cannot validate #1/#3**
   
   Failure scenario: Blocker #4 passes because replication jobs are fresh. Then #1/#3 still fail because fencing is not real or snapshots are incoherent.

   The spec says #4 first is required “um #1/#3 verifizieren zu können.” That is only partly true. Fresh replicas are necessary for some drills, but they do not verify fencing correctness, epoch monotonicity, app quiescing, or semantic recovery.

   Fix direction: keep #4 early as an observability prerequisite, but do not present it as making failover guarantees measurable by itself. The gate should be layered: replication health, restore drill, app consistency drill, fencing drill, singleton drill.

10. **Medium: acceptance tests are too narrow and can pass while production fails**
   
   Failure scenario: the iptables-drop drill isolates only one data path while corosync/API still works. Production loses the management path, storage replication path, or egress path differently. The test passes, but the real partition cannot fence or wrongly allows side effects.

   The spec does ask whether Corosync is physically separate, which is good. But the acceptance criterion relies on a single synthetic network failure. It does not test asymmetric partitions, API unreachability, node overload, stuck LXC shutdown, stale replica promotion, or external channel egress from the isolated node.

   Fix direction: define a fault matrix: data-link isolation, corosync loss, management API loss, node pause/hang, LXC stop hang, ZFS replication stale, Broker rollback, and internet-only isolation.

11. **Medium: “atomic rename JSON” is incomplete without fsync discipline**
   
   Failure scenario: process writes temp JSON and renames it, but crashes before fsyncing the file and parent directory. After failover from crash-consistent storage, the renamed file may be missing, old, or zero-length depending on filesystem/writeback behavior.

   The spec says tmp + atomic rename, which addresses torn reads but not durability. It also does not require startup validation or generation numbers.

   Fix direction: write temp, fsync temp, rename, fsync directory, validate on read, and keep previous-generation fallback.

12. **Medium: git is treated as universally durable without conflict policy**
   
   Failure scenario: two peers push the same repo during a partition or after stale restart. Even if Broker drops messages later, git already has divergent commits, force-push risk, duplicated work, or broken automation.

   The spec mentions both peers pushing the same git repo as a problem, but the concrete fixes center on Broker epoch and spawnerd reconcile. It does not define repository-level leases, branch isolation, protected refs, or conflict handling.

   Fix direction: require per-repo/per-branch ownership leases, protected branches, no force-push by agents, and deterministic conflict reconciliation after failover.

**Most Severe Weakness**

The most severe weakness is that the spec treats `pct stop` plus Broker epochs as split-brain protection, but neither is a proven fence for external side effects. If the old node cannot be conclusively killed or isolated, it can still write git and singleton channels while the replacement starts. That breaks the central safety property of the whole design.

---

## Lauf v1 (gegen Prosa-Beschreibung — Sandbox-Read-Fail, nur zur Konvergenz-Bestätigung)

I could not read the repo files because the sandbox wrapper fails before any shell command runs. Review below is adversarial against the design as described in your prompt.

[CRITICAL] #1 — STONITH Depends On The Same Cluster Assumptions It Is Supposed To Repair  
If Corosync and the “2.5G data-link” share the same physical or logical failure domain, the claim that the cluster API remains quorate while only the data path wobbles is not generally true. A partition can simultaneously break Broker traffic, lease traffic, and Proxmox API reachability to the isolated node, leaving spawnerd unable to prove or execute `pct stop`. Fix direction: require an explicit independent Corosync/control network, documented ring topology, tested partition matrix, and power-level fencing or watchdog fencing that does not depend on guest/container cooperation.

[CRITICAL] #1 — Lease Drop Before Confirmed Fence Creates A Dual-Owner Window  
If the old peer loses lease visibility but continues running, it may still hold WhatsApp or Telegram sessions until the stop is confirmed. During the HA window the survivor can observe lease expiry and start a replacement while the isolated process is still serving the singleton channel, causing exactly the double-login/409 condition the blocker claims to prevent. Fix direction: no replacement may start until fencing is positively confirmed, or singleton adapters must use a separate external fencing/lock primitive that the old process cannot keep using after isolation.

[HIGH] #1 — “Stop Over API” Is Not Equivalent To Fencing  
`pct stop` is a management action, not a hard isolation guarantee; it can hang, fail, target the wrong state view, or be impossible when the node is partitioned. The spec appears to treat “command issued” as “old owner dead,” but correctness requires proof that the old process can no longer access external singletons, git, Broker, or Hub state. Fix direction: define a fencing state machine with explicit outcomes: confirmed stopped, confirmed powered off, watchdog-fenced, or unsafe/no-start.

[HIGH] #1 — Epoch Counter Is Underspecified Across Broker Failover  
If the Broker owns or distributes epochs and itself fails over, the epoch source can regress, fork, or replay unless it is backed by a linearizable store. Git, local JSON, SQLite snapshots, or replicated VM disk images do not automatically provide monotonic distributed epochs under failover. Fix direction: store epochs in a quorum-backed consensus system or make Proxmox HA ownership the only authority and persist fencing epochs in a single-writer durable location with compare-and-swap semantics.

[HIGH] #1 — Lease And Stop Can Fail Open Together  
A bad partition can make the old process unable to renew the lease toward the survivor while still able to reach Telegram/WhatsApp, and can also prevent the survivor from stopping the old node over the API. That is the worst case: the safety signal says “lease expired,” while the safety action cannot be completed. Fix direction: invert the policy: expired lease alone is never permission to start singleton replacements; only confirmed fence or externally revocable singleton ownership is.

[HIGH] #2 — Reconcile-From-Git Is Not Idempotent With Two spawnerd Instances  
During the ~2 minute HA interval, the old spawnerd on a healing partition and the new spawnerd on the survivor can both compute the same SOLL/IST diff and spawn the same missing peers. Idempotence of “spawn only the diff” is local, not global, unless IST is derived from a linearizable shared registry with ownership tokens. Fix direction: make spawnerd active/passive with fenced leadership, or require per-peer compare-and-swap claims before spawn.

[HIGH] #2 — SOLL Map Has A Writer Consistency Problem  
If git is the desired-state source, the spec must say who writes SOLL, how concurrent writes are serialized, and how stale clones are rejected. A partitioned spawnerd can act on an old commit, while the survivor acts on a newer one, producing divergent process sets that both believe they are correct. Fix direction: require signed/monotonic desired-state revisions, fast-forward-only update policy, and runtime checks that refuse to act unless local SOLL equals the current authoritative remote revision.

[MEDIUM] #2 — Process Discovery Cannot Reliably Define IST After Crash/Heal  
A reconcile loop that inspects local sessions, tmux processes, PIDs, or container state may miss half-started Claude sessions, orphaned Broker registrations, or external singleton sessions already logged in. That means the loop can “correctly” spawn a replacement for a peer that is still externally alive. Fix direction: IST must include externally visible ownership state, not just local process state.

[CRITICAL] #3 — SQLite Checkpoint Does Not Freeze Writes For The Snapshot  
`PRAGMA wal_checkpoint(TRUNCATE)` only drains WAL up to that moment; it does not prevent new writes from landing between the checkpoint and the ZFS snapshot. The replicated snapshot can still contain JSON and SQLite from different logical instants, or a DB mid-transaction depending on timing and filesystem ordering. Fix direction: stop or quiesce the Hub writer, take a DB-level backup into a staging directory, fsync the staging directory, then snapshot that immutable backup.

[HIGH] #3 — Atomic Rename Does Not Make Multi-File State Snapshot-Consistent  
Atomic rename protects one pathname transition on one filesystem; it does not guarantee that a ZFS snapshot catches a coherent set of related JSON files plus SQLite state. The snapshot boundary can observe file A after rename and file B before rename, which may violate Hub invariants. Fix direction: use a manifest/epoch directory pattern where a complete state generation is written, fsynced, then activated by one manifest pointer, and recovery validates a single generation.

[HIGH] #3 — SQLite `.backup` Under Load Is Safer But Still Needs Ordering Rules  
SQLite’s backup API can produce a consistent DB image while writes continue, but it does not solve consistency between the DB and adjacent JSON files. If JSON references DB rows or vice versa, the backup can represent time T while JSON represents T+n. Fix direction: define the Hub state boundary: either move all critical state into SQLite and backup that, or implement an application-level quiesce/transaction epoch spanning both DB and JSON.

[HIGH] #4 — Replication Health Gates Do Not Measure Recoverability  
`FailCount==0`, snapshot age, and one deliberate break only prove that replication jobs recently ran and alerting fires once. They do not prove the target can boot, the Hub can open its DB, Broker epochs are valid, peers do not duplicate, or singleton channels remain single-owner after failover. Fix direction: add recurring restore drills: boot the replica in isolation, run integrity checks, validate Hub/Broker startup, verify peer reconciliation, and assert singleton adapters remain disabled until fenced.

[MEDIUM] #4 — Failed Job Retry/Alert Behavior Needs Negative Testing Matrix  
A single deliberate break under controlled conditions does not cover pvesr’s known 30 minute retry/no-alert behavior, clock skew, SSH failure, target-full, ZFS dataset rename, paused jobs, or stale successful timestamps. The gate can pass while the next real failure silently exceeds the stated data-loss window. Fix direction: gate on independent measurement of last received snapshot per dataset on the target, not only job status on the source.

[HIGH] Cross-Cutting — Sequencing #4 First Can Certify An Unsafe Architecture  
Monitoring first is useful operationally, but it can create false confidence before the safety model is fixed. If #1 fencing and #3 consistency are unsound, replication monitoring only proves that unsafe state is being replicated on schedule. Fix direction: first define the safety invariants and no-start conditions, then build monitoring around those invariants, including “refuse failover” states.

[HIGH] Cross-Cutting — pz2 Is A Different Failure Class, Not A Normal HA Target  
Because pz2 has no ZFS replication, its failover semantics are git-only and cannot preserve Hub local `data/`. Treating pz2 as just another node in topology R hides a split-brain/data-loss mode where services may restart with incomplete local state. Fix direction: explicitly mark which resources are allowed on pz2, likely exclude Hub/Broker/singletons unless they are stateless or rebuilt from authoritative durable state.

[MEDIUM] Cross-Cutting — External Singletons Need Their Own Runbook And Circuit Breaker  
WhatsApp and Telegram are not just processes; they are external sessions with provider-side state and rate/error consequences. The spec appears to couple their safety to #1, but that hides provider-specific recovery behavior during duplicate login, 409 conflict, reconnect storms, and stale sessions. Fix direction: wrap each singleton in an adapter that starts disabled after failover until fencing and provider-session checks pass.

Most severe weakness: the spec appears to use lease expiry as a start signal before it has a non-bypassable, independently confirmed fence. That is a fundamental safety violation: under the exact partition this design is meant to survive, it can create two live owners of the external singleton channels.
