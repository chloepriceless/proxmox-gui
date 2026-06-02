<!--
  SessionExpiredModal — in-place re-auth overlay (Plan 05-06, AUTH-06 D-03).

  CRITICAL: this is an OVERLAY, never a route navigation. When the session
  idle-expires the user stays on their current route with its in-page state
  intact; this modal floats above it. A successful re-login clears
  `idle.expired` (via idle.resume) and re-runs the page loads (invalidateAll)
  so the now-valid session refreshes the data behind the modal — the user
  continues exactly where they were (D-03).

  The modal is not user-dismissable (no Escape / outside-close / close button):
  re-auth is required before any further API call will succeed.
-->
<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { invalidateAll } from '$app/navigation';
  import { api } from '$lib/api/client';
  import { idle } from '$lib/stores/idle.svelte';

  let username = $state('');
  let password = $state('');
  let busy = $state(false);
  let error = $state<string | null>(null);

  async function submit(e: Event) {
    e.preventDefault();
    if (busy) return;
    busy = true;
    error = null;
    try {
      await api.auth.login({ username, password });
      password = '';
      idle.resume();
      // Re-run the current route's loads now that the session is valid again,
      // so the data behind the modal is fresh without a navigation.
      await invalidateAll();
    } catch {
      error = 'Sign in failed. Check your username and password and try again.';
    } finally {
      busy = false;
    }
  }
</script>

<Dialog.Root open={idle.showExpired}>
  <Dialog.Content
    class="sm:max-w-sm"
    showCloseButton={false}
    onInteractOutside={(e) => e.preventDefault()}
    onEscapeKeydown={(e) => e.preventDefault()}
  >
    <Dialog.Header>
      <Dialog.Title>Session expired</Dialog.Title>
      <Dialog.Description>
        You were signed out after a period of inactivity. Sign back in to
        continue where you left off.
      </Dialog.Description>
    </Dialog.Header>
    <form onsubmit={submit} class="flex flex-col gap-3">
      <div class="flex flex-col gap-1.5">
        <Label for="reauth-username">Username</Label>
        <Input id="reauth-username" bind:value={username} autocomplete="username" required />
      </div>
      <div class="flex flex-col gap-1.5">
        <Label for="reauth-password">Password</Label>
        <Input
          id="reauth-password"
          type="password"
          bind:value={password}
          autocomplete="current-password"
          required
        />
      </div>
      {#if error}
        <p class="text-destructive text-[13px]" role="alert">{error}</p>
      {/if}
      <div class="flex justify-end">
        <Button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
      </div>
    </form>
  </Dialog.Content>
</Dialog.Root>
