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
