# Phase 3: Job Queue & Lifecycle - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-16
**Phase:** 03-job-queue-lifecycle
**Areas discussed:** Tasks drawer & live progress, Snapshots & backups, Action controls & confirmations, Errors & retry

---

## Tasks Drawer & Live Progress

### Drawer scope
| Option | Description | Selected |
|--------|-------------|----------|
| Mine + team toggle | Default to my jobs; toggle reveals team jobs | |
| Mine only | Just jobs I initiated | |
| Always team-wide | All my teams' jobs, no toggle | ✓ |

### Auto-open behavior
| Option | Description | Selected |
|--------|-------------|----------|
| Badge only | Drawer stays collapsed; icon shows a count | |
| Always auto-open | Drawer opens on every action | |
| Open for long jobs | Auto-open for clone/migrate/backup/restore only | ✓ |

### Completion notification
| Option | Description | Selected |
|--------|-------------|----------|
| Toast on every finish | Success + failure both toast | ✓ |
| Toast on failure only | Only failures toast | |
| No toasts | Drawer-only | |

### Progress display
| Option | Description | Selected |
|--------|-------------|----------|
| Status + elapsed | Spinner, task-type, elapsed, UPID; backup INFO lines | ✓ |
| Parsed % bar | Parse a percentage from the task log | |
| Indeterminate only | Spinner only | |

**Notes:** Team-wide chosen for transparency on shared resources. %-parsing rejected as fragile (Pitfall 13).

---

## Snapshots & Backups

### Snapshot display
| Option | Description | Selected |
|--------|-------------|----------|
| Tree view | Indented tree with branches + current marker | ✓ |
| Flat list | Chronological list with parent column | |

### Backups home
| Option | Description | Selected |
|--------|-------------|----------|
| Per-VM Backups tab | Detail-page tab only | |
| Dedicated /backups page | Global page only | |
| Both | Per-VM tab + global overview page | ✓ |

### Restore-from-backup mode
| Option | Description | Selected |
|--------|-------------|----------|
| Ask each time | In-place vs. restore-as-new, default in-place | ✓ |
| Restore in place only | Always overwrite | |
| Restore as new only | Always new VMID | |

### Backup target / retention config
| Option | Description | Selected |
|--------|-------------|----------|
| Storage + keep-N | User picks storage + simple keep-N | |
| Storage + full prune | User picks storage + full prune options | |
| Admin-preset target | Admin sets storage per cluster; user picks retention | ✓ |

**Notes:** Admin-preset target introduces a new per-cluster admin config surface. Retention granularity for v1 stays simple "keep last N"; full prune deferred.

---

## Action Controls & Confirmations

### Action button placement
| Option | Description | Selected |
|--------|-------------|----------|
| Detail toolbar + list menu | Toolbar on detail page + per-row list menu | ✓ |
| Detail page only | Actions only on detail page | |
| List menu only | Per-row menu everywhere | |

### Destructive confirmation pattern
| Option | Description | Selected |
|--------|-------------|----------|
| Typed-name for data loss | Restore-snapshot + in-place restore also typed-name | ✓ |
| OK/Cancel for non-delete | Only Delete is typed-name | |
| Typed-name only for Delete | ROADMAP literal minimum | |

### Bulk action behavior
| Option | Description | Selected |
|--------|-------------|----------|
| One job each, grouped | Per-VM jobs grouped under a batch header; single confirm | ✓ |
| One job each, flat | N flat job rows | |
| Per-VM confirm | Confirm each VM individually | |

### Resize & migrate form complexity
| Option | Description | Selected |
|--------|-------------|----------|
| Simple + Advanced section | Core fields inline; bwlimit/live-offline behind Advanced | ✓ |
| Everything inline | All parameters on the main form | |

**Notes:** Delete typed-name confirm and Force-Stop OK/Cancel were ROADMAP-locked going in. bwlimit stays visible (success-criteria requirement) — placed in the Advanced disclosure, not hidden.

---

## Errors & Retry

### Error mapping strategy
| Option | Description | Selected |
|--------|-------------|----------|
| Curated table + raw fallback | Friendly map + raw message for unknowns | ✓ |
| Curated table, hide unknowns | Generic message for unmapped errors | |
| Raw passthrough only | No curated mapping | |

### Where technical detail lives
| Option | Description | Selected |
|--------|-------------|----------|
| Expandable 'Show details' | Collapsible raw stderr/UPID/task log | ✓ |
| Always inline | Friendly + raw shown together | |
| Audit log only | Raw detail not in the UI | |

### Redaction for non-admins
| Option | Description | Selected |
|--------|-------------|----------|
| Everyone sees it | Full raw detail visible to all users | ✓ |
| Redact for non-admins | Non-admins get redacted detail | |
| Friendly only for non-admins | Technical block admin-only | |

### Retry policy
| Option | Description | Selected |
|--------|-------------|----------|
| Idempotent ops only | Retry button only on safely-repeatable ops | ✓ |
| Retry on everything, warn | Retry everywhere, warn on risky ops | |
| Manual re-run only | No retry button | |

**Notes:** Redaction declined — conscious deviation from Pitfall 24, accepted for the small-team home-lab audience and to keep self-service friction low.

## Claude's Discretion

- In-app "Unlock" button feasibility for locked VMs (privsep-token permissions — researcher to confirm)
- Clone wizard details (VMID auto-allocation + reservation, name, linked/full, target node/storage)
- Snapshot include-RAM-state toggle, snapshot name/description
- WebSocket reconnection / backfill for the Tasks drawer
- arq concurrency + UPID poll cadence (backoff)
- Orphan-reaper admin surface for needs_review jobs
- Embedded Redis provisioning approach in the LXC

## Deferred Ideas

- Full PVE prune retention (keep-daily/weekly/monthly/yearly) — v1 ships keep-last-N
- Admin "all-resources" overview vs. team-scoped admin — open question carried from Phase 2
- UI-07 notification bell, noVNC console — Phase 4
- Audit log retention/rotation — Phase 5
- Quota reconciliation / drift detection sweep — out of Phase 3 scope
- Pitfall-8 personal-team-token bootstrap gap — Phase 1 / Plan 01-06 follow-up
