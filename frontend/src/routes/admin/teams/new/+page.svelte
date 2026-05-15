<!--
  /admin/teams/new — Create a shared team.

  Plan 01-10 (frontend-admin) team-management surface.

    - Page title "New team" + description.
    - Single field: Team name.
    - Submit "Create team" -> POST /api/v1/teams/ which also auto-bootstraps
      a PVE pool + privsep token on every active cluster.
    - 409 (duplicate name) -> inline error.
    - 422 -> summary alert (e.g. a reserved `personal-*` name).
    - Success -> goto('/admin/teams') + toast "Team created.".
-->
<script lang="ts">
  import { goto } from '$app/navigation';
  import { toast } from 'svelte-sonner';
  import * as Card from '$lib/components/ui/card';
  import * as Alert from '$lib/components/ui/alert';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { api, ApiError } from '$lib/api/client';
  import AlertTriangle from '@lucide/svelte/icons/triangle-alert';
  import Loader2 from '@lucide/svelte/icons/loader-2';
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';

  let name = $state('');
  let submitting = $state(false);
  let formError = $state<string | null>(null);
  let nameError = $state<string | null>(null);

  function validate(): boolean {
    nameError = null;
    const trimmed = name.trim();
    if (!trimmed) {
      nameError = 'Team name is required.';
    } else if (trimmed.length > 64) {
      nameError = 'Team name must be 64 characters or fewer.';
    }
    return nameError === null;
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    formError = null;
    if (!validate()) return;
    submitting = true;
    try {
      await api.teams.create({ name: name.trim() });
      toast.success('Team created.');
      await goto('/admin/teams');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        nameError = 'A team with that name already exists.';
      } else if (err instanceof ApiError && err.status === 422) {
        formError =
          "Couldn't create the team. Names starting with 'personal-' are reserved.";
      } else {
        formError = 'Something went wrong on our side. Please try again.';
      }
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>New team — Proxmox GUI</title>
</svelte:head>

<div class="mx-auto flex w-full max-w-[720px] flex-col gap-6">
  <header class="flex flex-col gap-2">
    <a
      href="/admin/teams"
      class="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-[13px]"
    >
      <ArrowLeft class="size-4" aria-hidden="true" />
      Back to Teams
    </a>
    <h1 class="text-[28px] font-semibold tracking-tight">New team</h1>
    <p class="text-muted-foreground text-sm">
      Creating a team provisions a Proxmox pool and a privilege-separated token on
      every active cluster.
    </p>
  </header>

  <Card.Root>
    <Card.Header>
      <Card.Title class="text-lg font-semibold tracking-tight">Team details</Card.Title>
      <Card.Description>Add members and quotas after the team is created.</Card.Description>
    </Card.Header>
    <Card.Content>
      <form class="flex flex-col gap-4" onsubmit={handleSubmit} novalidate>
        {#if formError}
          <Alert.Root variant="destructive" aria-live="polite">
            <AlertTriangle aria-hidden="true" />
            <Alert.Title>{formError}</Alert.Title>
          </Alert.Root>
        {/if}

        <div class="flex flex-col gap-2">
          <Label for="team-new-name">Team name</Label>
          <Input
            id="team-new-name"
            type="text"
            bind:value={name}
            autocomplete="off"
            spellcheck={false}
            disabled={submitting}
            required
            aria-invalid={nameError ? 'true' : undefined}
          />
          {#if nameError}
            <p class="text-destructive text-[13px]">{nameError}</p>
          {:else}
            <p class="text-muted-foreground text-[13px]">
              A short, recognisable name — e.g. "platform" or "media".
            </p>
          {/if}
        </div>

        <div class="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onclick={() => goto('/admin/teams')}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {#if submitting}
              <Loader2 class="size-4 animate-spin" aria-hidden="true" />
              Creating...
            {:else}
              Create team
            {/if}
          </Button>
        </div>
      </form>
    </Card.Content>
  </Card.Root>
</div>
