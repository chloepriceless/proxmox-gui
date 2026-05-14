<!--
  TagInput — Command popover for adding tags to a VM/LXC.

  Contract: UI-SPEC §Component Contracts §TagInput.

    Trigger: "+ Add tag" Button variant="outline" size="sm"
    Input: Command.Input inside Popover with autocomplete
    Validation: /^[a-z0-9_-]+$/ client-side (D-14 + T-02-05-02)
    Optimistic: tag added immediately; rolled back on API error via onApplied callback
    Submit: Enter adds tag; Esc closes without applying
-->
<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import * as Popover from '$lib/components/ui/popover';
  import * as Command from '$lib/components/ui/command';
  import Plus from '@lucide/svelte/icons/plus';
  import { toast } from 'svelte-sonner';
  import { api } from '$lib/api/client';
  import { ApiError } from '$lib/utils/api';

  type Props = {
    clusterId: number;
    vmid: number;
    type: 'vm' | 'lxc';
    /** Current tags on the resource — used to detect duplicates. */
    currentTags: string[];
    /**
     * Existing tags from the team scope for autocomplete.
     * Phase 2 ships this as empty []; Plan 02-06 may populate from a backend
     * tag-aggregation endpoint.
     */
    suggestions?: string[];
    /** Called with the new full tag list after a successful add. */
    onApplied?: (newTags: string[]) => void;
  };

  let {
    clusterId,
    vmid,
    type,
    currentTags,
    suggestions = [],
    onApplied,
  }: Props = $props();

  let open = $state(false);
  let input = $state('');
  let submitting = $state(false);
  let inlineError = $state<string | null>(null);

  const TAG_RE = /^[a-z0-9_-]+$/;

  function validate(v: string): string | null {
    if (!v) return 'Type a tag name.';
    if (!TAG_RE.test(v)) {
      return 'Tags use lowercase letters, digits, hyphens, and underscores only.';
    }
    if (currentTags.includes(v)) return `'${v}' is already applied.`;
    return null;
  }

  async function addTag(t: string) {
    const trimmed = t.trim();
    const err = validate(trimmed);
    if (err) {
      inlineError = err;
      return;
    }
    submitting = true;
    inlineError = null;
    const next = Array.from(new Set([...currentTags, trimmed])).sort();
    try {
      await api.inventory.setTags({ clusterId, vmid, type, tags: next });
      onApplied?.(next);
      open = false;
      input = '';
    } catch (e) {
      const msg =
        e instanceof ApiError && e.status === 422
          ? "Couldn't add tag — server rejected the format."
          : "Couldn't add tag. Try again.";
      toast.error(msg);
    } finally {
      submitting = false;
    }
  }

  // Suggestions not already applied
  const availableSuggestions = $derived(
    suggestions.filter((s) => !currentTags.includes(s))
  );
</script>

<Popover.Root bind:open>
  <Popover.Trigger>
    {#snippet child({ props })}
      <Button variant="outline" size="sm" {...props} disabled={submitting}>
        <Plus class="size-4 mr-1" aria-hidden="true" />
        Add tag
      </Button>
    {/snippet}
  </Popover.Trigger>
  <Popover.Content class="w-[280px] p-0" align="start">
    <Command.Root>
      <Command.Input
        bind:value={input}
        placeholder="Type a tag…"
        onkeydown={(e: KeyboardEvent) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            addTag(input.trim());
          }
        }}
      />
      {#if inlineError}
        <div role="alert" class="px-3 py-2 text-[13px] text-destructive">{inlineError}</div>
      {/if}
      <Command.List>
        <Command.Empty>No matches. Press Enter to create.</Command.Empty>
        {#if availableSuggestions.length > 0}
          <Command.Group heading="Existing tags">
            {#each availableSuggestions as s (s)}
              <Command.Item value={s} onSelect={() => addTag(s)}>{s}</Command.Item>
            {/each}
          </Command.Group>
        {/if}
      </Command.List>
    </Command.Root>
  </Popover.Content>
</Popover.Root>
