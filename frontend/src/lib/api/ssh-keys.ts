// Domain-named convenience re-exports for `/api/v1/me/ssh-keys`.
//
// The canonical surface is `api.me.{listSshKeys, addSshKey, deleteSshKey}`
// (see `me.ts`). This module exists so callers that prefer
// `import * as sshKeys from '$lib/api/ssh-keys'` get the exact same
// implementation without a second source of truth.

export { listSshKeys as list, addSshKey as add, deleteSshKey as remove } from './me';
export type { SshKey, SshKeyCreateRequest } from './types';
