// Hand-written TypeScript shapes that mirror the backend's Pydantic schemas
// in the surface area Plan 01-08 needs. Plans 09 + 10 will extend this file
// with PAT, SshKey, Cluster, Team, etc.
//
// We do NOT generate these from OpenAPI yet. The hand-written approach keeps
// the public surface minimal and explicit; openapi-ts can land later as a
// separate `frontend/src/lib/api/generated/` tree (the `.gitkeep` placeholder
// reserves the directory).

export interface TeamSummary {
  id: number;
  name: string;
  personal: boolean;
}

/** Mirrors `app.auth.schemas.MeResponse` (authoritative shape returned by GET /api/v1/me). */
export interface User {
  id: number;
  username: string;
  email: string;
  is_admin: boolean;
  is_active: boolean;
  created_at: string;
  teams: TeamSummary[];
}

/** Mirrors `app.setup.schemas.SetupStatusResponse`. */
export interface SetupStatus {
  no_admin_yet: boolean;
  cluster_count: number;
}

/** Mirrors `app.setup.schemas.SetupAdminRequest` (write-only). */
export interface SetupAdminRequest {
  username: string;
  email: string;
  password: string;
}

/** Mirrors `app.setup.schemas.SetupAdminResponse`. */
export interface SetupAdminResponse {
  user_id: number;
  personal_team_id: number;
  username: string;
}

/** Mirrors `app.auth.schemas.LoginRequest` (write-only). */
export interface LoginRequest {
  username: string;
  password: string;
  /**
   * UI-only flag. The backend itself does not honour `remember_me` today;
   * it always sets the same cookie max-age. We keep the field in the
   * client-side request type so the login form can pass intent — backend
   * support can be wired later without breaking this contract.
   */
  remember_me?: boolean;
}

/**
 * Minimum cluster registration shape Plan 01-08's setup wizard needs.
 * Plan 10 will add the full `Cluster` / `ClusterUpdate` / list-shape types.
 */
export interface ClusterCreateRequest {
  name: string;
  host: string;
  port?: number;
  verify_ssl?: boolean;
  token_user: string;
  token_name: string;
  api_token_secret: string;
  tls_fingerprint?: string | null;
  notes?: string | null;
}

export interface ClusterTestRequest {
  host: string;
  port?: number;
  verify_ssl?: boolean;
  token_user: string;
  token_name: string;
  api_token_secret: string;
  tls_fingerprint?: string | null;
}

export interface ClusterTestResponse {
  ok: boolean;
  version?: string | null;
  release?: string | null;
  error?: string | null;
}

/** Whatever the backend returns for a created cluster (subset Plan 08 reads). */
export interface ClusterResponse {
  id: number;
  name: string;
  host: string;
  port: number;
}

// ---------------------------------------------------------------------------
// Account self-service (Plan 01-09): SSH keys + Personal Access Tokens
// ---------------------------------------------------------------------------

/** Mirrors `app.ssh_keys.schemas.SshKeyResponse` (list/post — no public_key). */
export interface SshKey {
  id: number;
  name: string;
  fingerprint: string;
  created_at: string;
}

/** Mirrors `app.ssh_keys.schemas.SshKeyCreate` (write-only). */
export interface SshKeyCreateRequest {
  name: string;
  public_key: string;
}

/** Mirrors `app.pats.schemas.PATListItem` — never carries the plaintext. */
export interface PATListItem {
  id: number;
  name: string;
  /** "pat_<first-8-chars-of-prefix>..." — non-secret disambiguator. */
  prefix_preview: string;
  expires_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

/**
 * Mirrors `app.pats.schemas.PATMintResponse`. Carries the plaintext exactly
 * once; UI MUST surface it via SecretRevealDialog and clear on dismiss.
 */
export interface PATMintResponse {
  id: number;
  name: string;
  expires_at: string | null;
  /** "pat_..." — only place this ever appears. T-01-09-01 mitigation. */
  plaintext: string;
  created_at: string;
}

/** Mirrors `app.pats.schemas.PATCreate` (write-only). */
export interface PATCreateRequest {
  name: string;
  expires_at?: string | null;
}

/** Mirrors `app.auth.schemas.PasswordChangeRequest` (write-only). */
export interface PasswordChangeRequest {
  current_password: string;
  new_password: string;
}

// ---------------------------------------------------------------------------
// Admin surface (Plan 01-10): users + teams + clusters CRUD
// ---------------------------------------------------------------------------

/** Mirrors `app.teams.schemas.UserSummary` (a team member). */
export interface TeamMemberSummary {
  id: number;
  username: string;
  email: string;
}

/** Mirrors `app.teams.schemas.TeamResponse` (list shape). */
export interface Team {
  id: number;
  name: string;
  personal: boolean;
  is_active: boolean;
  member_count: number;
  created_at: string;
}

/** Mirrors `app.teams.schemas.TeamDetailResponse` (single team + members). */
export interface TeamDetail extends Team {
  members: TeamMemberSummary[];
}

/** Mirrors `app.teams.schemas.TeamCreate` (write-only; personal is rejected). */
export interface TeamCreateRequest {
  name: string;
}

export interface TeamUpdateRequest {
  name?: string;
  is_active?: boolean;
}

/** Mirrors `app.users.schemas.UserResponse` (list shape — includes teams). */
export interface AdminUser {
  id: number;
  username: string;
  email: string;
  is_admin: boolean;
  is_active: boolean;
  created_at: string;
  teams: TeamSummary[];
}

/** Mirrors `app.users.schemas.UserDetailResponse`. */
export interface AdminUserDetail extends AdminUser {
  last_login: string | null;
}

/** Mirrors `app.users.schemas.UserCreate` (write-only). */
export interface AdminUserCreateRequest {
  username: string;
  email: string;
  password: string;
  is_admin?: boolean;
  team_ids?: number[];
}

/** Mirrors `app.users.schemas.UserCreateResponse` (adds personal_team_id). */
export interface AdminUserCreateResponse extends AdminUser {
  personal_team_id: number;
}

/** Mirrors `app.users.schemas.UserUpdate` — all optional, extra=forbid. */
export interface AdminUserUpdateRequest {
  email?: string;
  is_admin?: boolean;
  is_active?: boolean;
  team_ids?: number[];
}

/** Mirrors `app.users.schemas.AdminPasswordRequest` (write-only). */
export interface AdminPasswordRequest {
  new_password: string;
}

/** Mirrors `app.clusters.schemas.ClusterResponse` (read shape — NEVER carries api_token_secret). */
export interface Cluster {
  id: number;
  name: string;
  host: string;
  port: number;
  verify_ssl: boolean;
  token_user: string;
  token_name: string;
  tls_fingerprint: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  /**
   * The admin-designated backup storage for this cluster (D-08). `null` when
   * backups are disabled. Added by Plan 03-04's `0005_phase3_backup_storage`.
   */
  backup_storage: string | null;
}

/**
 * Mirrors `app.clusters.schemas.ClusterUpdate` (PATCH).
 *
 * `api_token_secret` is OPTIONAL — when omitted, the existing stored token is
 * preserved (UI-SPEC §Required cluster registration form "Update token"
 * pattern). When provided, the backend re-validates before persisting.
 */
export interface ClusterUpdateRequest {
  name?: string;
  host?: string;
  port?: number;
  verify_ssl?: boolean;
  token_user?: string;
  token_name?: string;
  api_token_secret?: string;
  tls_fingerprint?: string | null;
  notes?: string | null;
  is_active?: boolean;
  /**
   * The admin backup-storage designation (D-08). A storage name enables
   * backups; `null` is the explicit "None — backups disabled" choice. The
   * backend distinguishes absent (leave unchanged) from null (clear) via an
   * `_UNSET` sentinel — omit the key entirely to leave the value untouched.
   */
  backup_storage?: string | null;
}

// ---------------------------------------------------------------------------
// Phase 2 Inventory types (Plan 02-05): VM/LXC inventory + RRD
// ---------------------------------------------------------------------------

/** Mirrors `app.inventory.schemas.VMInventoryItem`. */
export interface VMInventoryItem {
  cluster_id: number;
  vmid: number;
  name: string | null;
  type: 'qemu' | 'lxc';
  node: string;
  status: string;
  maxcpu: number;
  /** bytes */
  maxmem: number;
  /** bytes */
  maxdisk: number;
  tags: string[];
  pool: string | null;
  is_stale: boolean;
}

/** Mirrors `app.inventory.schemas.ClusterInventory`. */
export interface ClusterInventory {
  cluster_id: number;
  cluster_name: string;
  cluster_status: string;
  is_stale: boolean;
  last_error: string | null;
  items: VMInventoryItem[];
}

/** Mirrors `app.inventory.schemas.VMDetail`. */
export interface VMDetail {
  cluster_id: number;
  vmid: number;
  name: string | null;
  type: 'qemu' | 'lxc';
  node: string;
  status: string;
  uptime: number;
  cpu: number;
  mem: number;
  maxcpu: number;
  /** bytes */
  maxmem: number;
  /** bytes */
  disk: number;
  /** bytes */
  maxdisk: number;
  netin: number;
  netout: number;
  diskread: number;
  diskwrite: number;
  tags: string[];
  description: string | null;
  raw_config: Record<string, unknown>;
}

/** Mirrors `app.inventory.schemas.RRDSample`. */
export interface RRDSample {
  time: number;
  cpu: number;
  mem: number;
  maxmem: number;
  disk: number;
  maxdisk: number;
  netin: number;
  netout: number;
  diskread: number;
  diskwrite: number;
}

/** Distinguishes between QEMU VM and LXC container at the API call level. */
export type ResourceKind = 'vm' | 'lxc';

// ---------------------------------------------------------------------------
// Phase 2 Audit types (Plan 02-06)
// ---------------------------------------------------------------------------

/** Mirrors `app.audit.schemas.AuditEntry`. */
export interface AuditEntry {
  id: number;
  occurred_at: string;       // ISO 8601
  actor_username: string | null;
  actor_pat_prefix: string | null;
  team_name: string | null;
  cluster_name: string | null;
  action: string;            // e.g. "vm.tag.update"
  target_type: string | null;
  target_id: string | null;
  result: string;            // "success" | "failure" | "pending"
  source_ip: string | null;
  correlation_id: string | null;
  payload_before: string | null;   // JSON string
  payload_after: string | null;
  error: string | null;
}

/** Mirrors `app.audit.schemas.AuditPage`. */
export interface AuditPage {
  rows: AuditEntry[];
  total: number;
  page: number;
  page_size: number;
}

/** Filter parameters for the audit list + export endpoints. */
export interface AuditFilterParams {
  from?: string;            // ISO date
  to?: string;
  action?: string[];        // server expects comma-joined; client sends list, joined in api client
  user_id?: number;
  target_type?: string[];
  vmid?: number;
  cluster_id?: number;
  show_team_actions?: boolean;
  page?: number;
  page_size?: number;
}

// ---------------------------------------------------------------------------
// Phase 2 Quotas types (Plan 02-06)
// ---------------------------------------------------------------------------

/** Per-cluster quota limit inputs for PUT /teams/{id}/quotas. */
export interface QuotaLimitInput {
  cluster_id: number;
  cpu_cores: number | null;
  ram_gb: number | null;
  disk_gb: number | null;
  vm_count: number | null;
}

/** Read-only usage snapshot per cluster. */
export interface QuotaUsagePresentable {
  cpu_cores: number;
  ram_gb: number;
  disk_gb: number;
  vm_count: number;
  lxc_count: number;
}

/** One row per cluster in a team quota response. */
export interface ClusterQuotaRow {
  cluster_id: number;
  cluster_name: string;
  limit: QuotaLimitInput;
  usage: QuotaUsagePresentable;
}

/** Full team quota page returned by GET/PUT /teams/{id}/quotas. */
export interface TeamQuotaPage {
  team_id: number;
  team_name: string;
  rows: ClusterQuotaRow[];
}

/** Per-team quota block in MyQuotasResponse. */
export interface MyTeamQuota {
  team_id: number;
  team_name: string;
  clusters: ClusterQuotaRow[];
  aggregate_limit: QuotaLimitInput;     // cluster_id=0 sentinel
  aggregate_usage: QuotaUsagePresentable;
}

/** Returned by GET /api/v1/me/quotas. */
export interface MyQuotasResponse {
  teams: MyTeamQuota[];
}

/** One dimension in a quota preview. */
export interface QuotaDimension {
  name: string;
  current: number;
  requested: number;
  limit: number | null;
  headroom: number | null;
  would_exceed: boolean;
}

/** Returned by POST /api/v1/quotas/preview. */
export interface QuotaPreview {
  would_exceed: boolean;
  dimensions: QuotaDimension[];
}

// ---------------------------------------------------------------------------
// Phase 3 Job Queue + Lifecycle types (Plan 03-05)
// ---------------------------------------------------------------------------

/**
 * The job state machine (`pending → claimed → running →
 * succeeded/failed/orphaned/needs_review`). Mirrors the backend `jobs.state`
 * column — see Plan 03-01 / 03-02.
 */
export type JobState =
  | 'pending'
  | 'claimed'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'orphaned'
  | 'needs_review';

/**
 * Mirrors `app.jobs` `JobResponse` — one job row as the jobs API and the
 * `/ws/jobs` WebSocket deliver it.
 */
export interface Job {
  id: number;
  /** e.g. "vm.power", "vm.clone", "vm.backup". */
  kind: string;
  state: JobState;
  cluster_id: number | null;
  team_id: number | null;
  upid: string | null;
  upid_node: string | null;
  /** Raw PVE error / stderr — shown under "Show technical details". */
  error: string | null;
  /** Curated human-readable error — shown first on a failed row. */
  friendly_error: string | null;
  /** Set when the job is part of a bulk fan-out (D-11). */
  batch_id: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

/** Mirrors the `GET /api/v1/jobs` response — list + Topbar-badge counts. */
export interface JobListResponse {
  jobs: Job[];
  running: number;
  failed: number;
}

/** The 202 body every single-resource lifecycle mutation returns. */
export interface JobAccepted {
  job_id: number;
  state: string;
  kind: string;
}

/** The 202 body `POST /clusters/{id}/vms/bulk-power` returns (D-11). */
export interface BulkJobAccepted {
  batch_id: string;
  job_ids: number[];
}

/** The four fast power actions the lifecycle toolbar exposes. */
export type PowerActionName = 'start' | 'stop' | 'reboot' | 'shutdown';

// ---------------------------------------------------------------------------
// Phase 3 Snapshot + Resize + Clone + Migrate types (Plan 03-06)
//
// Snapshot / resize backend contracts are from Plan 03-03; clone / migrate /
// template-convert from Plan 03-04. The snapshot list is the flat
// parent-pointer shape — the SnapshotTree component builds the hierarchy.
// ---------------------------------------------------------------------------

/**
 * Mirrors `app.lifecycle.schemas.SnapshotItem` — one flat node of the snapshot
 * list. `parent` points at the parent snapshot's name (null for a root);
 * `SnapshotTree.svelte` recurses on these pointers (D-05).
 */
export interface SnapshotItem {
  name: string;
  parent: string | null;
  /** UNIX seconds the snapshot was taken, or null when PVE omits it. */
  snaptime: number | null;
  description: string | null;
  /** True when the snapshot captured the running RAM state (qemu only). */
  vmstate: boolean | null;
}

/** Mirrors `app.lifecycle.schemas.SnapshotListResponse` (GET .../snapshots). */
export interface SnapshotListResponse {
  snapshots: SnapshotItem[];
}

/** One resizable disk in a `ResizeInfo` (Plan 03-03 `DiskInfo`). */
export interface DiskInfo {
  /** PVE disk key, e.g. "scsi0". */
  disk: string;
  /** Current size in whole GB. */
  size_gb: number;
}

/**
 * Mirrors `app.lifecycle.schemas.ResizeInfoResponse` (GET .../resize-info).
 * `cpu_hotplug` / `memory_hotplug` drive the reboot-required warnings.
 */
export interface ResizeInfo {
  cores: number;
  /** Memory in MB (PVE's native unit). */
  memory: number;
  cpu_hotplug: boolean;
  memory_hotplug: boolean;
  disks: DiskInfo[];
}

/** One disk-grow instruction in a `ResizeRequest` (Plan 03-03 `DiskGrow`). */
export interface DiskGrowInput {
  disk: string;
  new_size_gb: number;
}

/** Write body of `POST .../resize`. Disks can only grow (LIFE-09). */
export interface ResizeRequest {
  cores?: number;
  /** Memory in MB. */
  memory?: number;
  disks?: DiskGrowInput[];
}

/** Write body of `POST .../clone`. `new_vmid` omitted → server auto-assigns. */
export interface CloneRequest {
  name: string;
  /** true = full clone; false = linked clone. */
  full: boolean;
  target_node: string;
  target_storage?: string | null;
  new_vmid?: number | null;
}

/** Write body of `POST .../migrate`. `bwlimit_mbps` 0 = unlimited. */
export interface MigrateRequest {
  target_node: string;
  online: boolean;
  bwlimit_mbps: number;
}

// ---------------------------------------------------------------------------
// Phase 3 Backup + Restore + Schedule types (Plan 03-07)
//
// Backend contracts are from Plan 03-04 (backups.py / backup_routes.py).
// The Backups tab consumes the per-VM file list + schedule; the global
// /backups page consumes the team-scoped scheduled-backup list.
// ---------------------------------------------------------------------------

/** Mirrors one backup file from `GET .../backups` (Plan 03-04 storage content). */
export interface BackupFile {
  /** PVE volume id, e.g. "local:backup/vzdump-qemu-100-...". */
  volid: string;
  filename: string;
  /** Size in bytes. */
  size: number;
  /** UNIX seconds the backup was created. */
  ctime: number;
  /** Archive format, e.g. "vma.zst", "tar.zst". */
  format: string;
}

/** Mirrors `GET .../backups` — the VM's backup file list. */
export interface BackupListResponse {
  backups: BackupFile[];
}

/**
 * Mirrors `app.lifecycle.schemas.BackupScheduleResponse` (GET/PUT
 * .../backup-schedule). `keep_last` is the simple retention count (D-08).
 *
 * The GET route returns `null` when the VM has no schedule yet — callers
 * must handle the null. The PUT route always returns a populated row.
 */
export interface BackupSchedule {
  id: number | null;
  cluster_id: number;
  vmid: number;
  /** True for an LXC schedule row. */
  is_lxc: boolean;
  node: string;
  enabled: boolean;
  frequency: string;
  keep_last: number;
  /** ISO timestamp of the last scheduled run, or null when never run. */
  last_run_at: string | null;
  /** "ok" / "fail" / null — the outcome of the last scheduled run. */
  last_run_state: string | null;
}

/**
 * One row of the global `/backups` page — a scheduled backup across the
 * user's team-scoped VMs/LXCs (GET /backups/schedules, Plan 03-04 D-06).
 *
 * The backend returns `BackupScheduleResponse` rows; this is the same shape
 * as `BackupSchedule` (the schedule rows ARE the global-page rows). Kept as a
 * distinct alias so the page reads intentionally.
 */
export type ScheduledBackupRow = BackupSchedule;

// ===========================================================================
// Phase 4 — Provisioning / Networking / Console (Plan 04-09)
//
// Hand-written shapes mirroring the shipped Wave-2 backend Pydantic schemas:
//   - provisioning  → app.provisioning.schemas + app.provisioning.routes
//   - catalog       → app.catalog.routes + app.catalog.service
//   - networks      → app.networks.schemas
//   - iso           → app.iso.routes + app.iso.cloud_images
//   - console       → app.console.schemas
// ===========================================================================

// --- Provisioning (Plan 04-04 backend) -------------------------------------

/**
 * One NIC's network config — mirrors `app.provisioning.schemas.NetworkConfig`.
 *
 * `kind` selects an SDN VNet or a legacy bridge; `id` is the VNet/bridge name.
 * `ip_mode` is `dhcp` (default) or `static` — a static address MUST supply
 * `ip_cidr` (the backend's `model_validator` rejects a static NIC without it).
 */
export interface NetworkConfigInput {
  kind?: 'sdn-vnet' | 'bridge';
  id: string;
  ip_mode?: 'dhcp' | 'static';
  ip_cidr?: string | null;
  gateway?: string | null;
  vlan_tag?: number | null;
}

/**
 * Body of `POST /clusters/{id}/provisioning/lxc` — mirrors
 * `app.provisioning.schemas.CreateLxcRequest` field-for-field.
 *
 * `team_id` names the owning team (a create has no existing resource to
 * resolve the team from). `ostemplate` is the vztmpl volume id.
 */
export interface CreateLxcRequest {
  team_id: number;
  node: string;
  storage: string;
  ostemplate: string;
  hostname: string;
  cpu_cores: number;
  memory_mb: number;
  disk_gb: number;
  network?: NetworkConfigInput | null;
  unprivileged?: boolean;
  nesting?: boolean;
  features?: string[];
  ssh_public_keys?: string | null;
  password?: string | null;
  start_after_create?: boolean;
}

/**
 * Body of `POST /clusters/{id}/provisioning/qemu` — mirrors
 * `app.provisioning.schemas.CreateQemuRequest`.
 *
 * A discriminated model over `source_kind`. For the clone source kinds
 * (`template-clone` / `vm-clone`) the sizing/network/cloud-init fields are
 * ignored — the clone copies the source's config — and `source_vmid` is
 * required; for the non-clone kinds (`cloud-image` / `blank-iso`) the backend
 * requires `cpu_cores` / `memory_mb` / `disk_gb` / `storage`.
 */
export interface CreateQemuRequest {
  team_id: number;
  source_kind: 'cloud-image' | 'blank-iso' | 'template-clone' | 'vm-clone';
  node: string;
  name: string;
  storage?: string | null;
  cpu_cores?: number | null;
  memory_mb?: number | null;
  disk_gb?: number | null;
  network?: NetworkConfigInput | null;
  /** cloud-image (VM-01) */
  image_id?: string | null;
  ci_user?: string | null;
  ci_password?: string | null;
  ssh_public_keys?: string | null;
  /** blank-iso (VM-03) */
  iso_volid?: string | null;
  /** template-clone / vm-clone (VM-02 / VM-04) */
  source_vmid?: number | null;
  clone_mode?: 'linked' | 'full';
}

/**
 * Body of `POST /clusters/{id}/provisioning/community-script` — mirrors
 * `app.provisioning.schemas.CommunityScriptRequest`.
 *
 * `script_slug` names the catalog entry; `script_options` carries the D-07
 * parsed-option values. `ostemplate` is resolved server-side from the catalog
 * entry, so it is NOT part of the body.
 */
export interface CommunityScriptRequest {
  team_id: number;
  node: string;
  storage: string;
  script_slug: string;
  hostname: string;
  cpu_cores: number;
  memory_mb: number;
  disk_gb: number;
  network?: NetworkConfigInput | null;
  unprivileged?: boolean;
  ssh_public_keys?: string | null;
  script_options?: Record<string, string>;
}

/**
 * The `202 Accepted` body for a provisioning create — mirrors
 * `app.provisioning.schemas.ProvisioningJobAcceptedResponse`.
 *
 * Extends `JobAccepted` (`{job_id, state, kind}`) with the app-reserved
 * `vmid`. D-04: the wizard routes to `/inventory/{cluster}/{vmid}` immediately
 * on the 202, so the reserved VMID MUST be carried in the response body.
 */
export interface ProvisioningJobAccepted extends JobAccepted {
  vmid: number;
}

/** One rendered `#cloud-config` line — `injected` marks a PVE default (D-10). */
export interface YamlLine {
  text: string;
  injected: boolean;
}

/** One hard Cloud-Init validation error — names the offending form field. */
export interface CloudInitFieldError {
  field: string;
  message: string;
}

/**
 * The block-hard / warn-soft Cloud-Init validation verdict (D-12) — mirrors
 * `app.provisioning.routes.CloudInitVerdictOut`. `ok` is false when there are
 * any `hard_errors`.
 */
export interface CloudInitVerdict {
  hard_errors: CloudInitFieldError[];
  soft_warnings: string[];
  ok: boolean;
}

/**
 * The Cloud-Init editor form — mirrors
 * `app.provisioning.routes.CloudInitPreviewRequest` (the body of
 * `POST .../provisioning/cloudinit/preview`).
 */
export interface CloudInitForm {
  ciuser?: string | null;
  cipassword?: string | null;
  sshkeys?: string[];
  ip_mode?: string;
  ip_address?: string | null;
  gateway?: string | null;
  nameservers?: string[];
  packages?: string[];
  runcmd?: string[];
  source_kind?: string;
}

/** `200` body of `POST .../provisioning/cloudinit/preview` — lines + verdict. */
export interface CloudInitPreviewResponse {
  lines: YamlLine[];
  verdict: CloudInitVerdict;
}

// --- Catalog (Plan 04-06 backend) ------------------------------------------

/**
 * One community-scripts catalog entry — mirrors the `ScriptEntry.to_dict()`
 * shape from `app.catalog.service`. `commit_sha` + `last_reviewed` are the
 * LXC-04 attribution stamped from the active `catalog_pin`.
 */
export interface CatalogEntry {
  slug: string;
  name: string;
  description: string;
  categories: string[];
  type: string;
  featured: boolean;
  privileged: boolean;
  source_url: string;
  install_methods: Record<string, unknown>[];
  interface_port: number | null;
  default_credentials: Record<string, unknown> | null;
  notes: Record<string, unknown>[];
  commit_sha: string;
  last_reviewed: string;
}

/**
 * `200` body of `GET /clusters/{id}/catalog` — mirrors
 * `app.catalog.routes.CatalogListResponse`. `entries` carry the LXC-04
 * attribution; `view` echoes the requested `curated` / `full` mode.
 */
export interface CatalogListResponse {
  view: string;
  commit_sha: string;
  last_reviewed: string;
  entries: CatalogEntry[];
}

/**
 * `200` body of `GET /clusters/{id}/catalog/{slug}` — mirrors
 * `app.catalog.routes.CatalogEntryResponse` (the entry + its attribution).
 */
export interface CatalogEntryResponse {
  entry: CatalogEntry;
  attribution: {
    source_url?: string;
    commit_sha?: string;
    last_reviewed?: string;
  };
}

/** `200` body of `POST /catalog/sync` — the admin re-pin summary (D-05). */
export interface CatalogSyncResponse {
  added: number;
  updated: number;
  commit_sha: string;
}

// --- Networks (Plan 04-07 backend) -----------------------------------------

/**
 * A single pickable network — mirrors `app.networks.schemas.NetworkOption`.
 *
 * `applied` is the spike-§2 state-derived usability flag: a pending SDN VNet
 * is surfaced with `applied=false` so the UI badges it non-pickable
 * (Pitfall 8). `suggested_ip` is the app-side-computed lowest free address.
 */
export interface NetworkOption {
  kind: string;
  network_id: string;
  display_name: string;
  zone: string | null;
  tag: number | null;
  vlan_aware: boolean;
  applied: boolean;
  ipam_available: boolean;
  suggested_ip: string | null;
}

/**
 * `200` body of `GET /clusters/{id}/networks` — mirrors
 * `app.networks.schemas.NetworkPickerResponse`. `sdn_capable` reflects the
 * D-21 per-cluster auto-detect; when false `sdn_vnets` is empty.
 */
export interface NetworkPickerResponse {
  cluster_id: number;
  sdn_capable: boolean;
  sdn_vnets: NetworkOption[];
  bridges: NetworkOption[];
}

/**
 * `200` body of the admin `GET/PUT .../networks` — mirrors
 * `app.networks.schemas.NetworkScopeResponse` (the Networks-tab view).
 */
export interface NetworkScopeResponse {
  team_id: number;
  cluster_id: number;
  sdn_capable: boolean;
  available_sdn_vnets: NetworkOption[];
  available_bridges: NetworkOption[];
  granted: { sdn_vnets: string[]; bridges: string[] };
}

/**
 * Request body of the admin `PUT .../networks` — mirrors
 * `app.networks.schemas.NetworkScopeUpdate` (the new grant set).
 */
export interface NetworkScopeUpdate {
  sdn_vnets: string[];
  bridges: string[];
}

// --- ISO / cloud-image library (Plan 04-05 backend) ------------------------

/**
 * One ISO volume present on a storage — mirrors `app.iso.routes.IsoItem`.
 */
export interface IsoItem {
  volid: string;
  filename: string;
  size: number;
  storage: string;
  format: string | null;
}

/** One curated cloud image (D-15) — mirrors `app.iso.routes.CloudImageItem`. */
export interface CloudImage {
  id: string;
  name: string;
  os_family: string;
  version: string;
  url: string;
}

/**
 * Body of `POST /clusters/{id}/iso/download` — mirrors
 * `app.iso.routes.IsoDownloadRequest`. `content` is the PVE storage content
 * type (`iso` for an ISO, `import` for a cloud image). The backend rejects a
 * non-http(s) URL 422 (SSRF — T-04-05-01).
 */
export interface IsoDownloadRequest {
  team_id: number;
  node: string;
  storage: string;
  url: string;
  content?: string;
  filename: string;
}

// --- Console (Plan 04-08 backend) ------------------------------------------

/**
 * `200` body of `POST .../console/vncproxy` — mirrors
 * `app.console.schemas.VncProxyResponse`.
 *
 * The load-bearing field is `relay_url`: the GUI-origin reverse-proxied
 * WebSocket path the noVNC iframe connects to — never the Proxmox host URL
 * (CON-03). `ticket` is the short-lived (~30-40s) raw PVE vncticket.
 */
export interface VncProxyResponse {
  ticket: string;
  port: number;
  relay_url: string;
}

// --- Notifications (Plan 04-14 backend) ------------------------------------

/**
 * One completion in the notification-bell feed — mirrors
 * `app.notifications.routes.NotificationItem`.
 *
 * The feed is a *derived view* over the `jobs` table (D-23): each item is a
 * terminal job row (`succeeded` / `failed` — completions only, D-22). There is
 * no separate notification store.
 */
export interface NotificationItem {
  id: number;
  /** e.g. "vm.create", "lxc.start", "vm.backup". */
  kind: string;
  /** Always terminal — `succeeded` or `failed`. */
  state: JobState;
  cluster_id: number | null;
  team_id: number | null;
  /** Curated human-readable error — shown on a failed-job row. */
  friendly_error: string | null;
  created_at: string | null;
  finished_at: string | null;
}

/**
 * `200` body of `GET /notifications` (and `POST /notifications/seen`) — mirrors
 * `app.notifications.routes.NotificationFeed`. `unread_count` is the number of
 * feed rows newer than the caller's per-user last-seen cursor.
 */
export interface NotificationFeed {
  items: NotificationItem[];
  unread_count: number;
}

// --- Node resources (Plan 04-16 backend — VM-10) ---------------------------

/**
 * One cluster node's live free CPU/RAM — mirrors the backend
 * `app.clusters.schemas.NodeResourceItem` JSON returned by
 * `GET /clusters/{id}/nodes/resources`.
 *
 * The create wizard's `clusterNodes` `$effect` maps `free_cpu` / `free_ram_mb`
 * into the wizard's `NodeResource` shape (`$lib/components/wizard/node-fit`)
 * so `computeNodeFit` can fire the VM-10 "won't fit on node-X" hint against
 * live capacity. Named `NodeResourceApi` to avoid colliding with that wizard
 * `NodeResource` type.
 */
export interface NodeResourceApi {
  /** The Proxmox node name. */
  node: string;
  /** Free CPU cores on the node (a float — PVE `cpu` is a 0-1 load fraction). */
  free_cpu: number;
  /** Free RAM in MB on the node (integer). */
  free_ram_mb: number;
  /** PVE node status — `online` / `offline`. */
  status: string;
}
