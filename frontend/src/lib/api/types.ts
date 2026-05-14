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
