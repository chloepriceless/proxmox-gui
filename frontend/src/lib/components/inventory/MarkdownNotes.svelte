<!--
  MarkdownNotes — render/edit notes stored in PVE VM description field.

  Contract: UI-SPEC §Component Contracts §MarkdownNotes.

    Default mode: render with .prose prose-sm dark:prose-invert max-w-none
    Edit mode: shadcn Textarea 240px tall (h-60), mono 13px
    Footer: "Cancel" (ghost) + "Save notes" (primary)
    Empty state: "No notes yet." + "+ Add notes" button
    Max: 8000 chars (D-15 PVE limit); inline error at cap
    Sanitization: marked + DOMPurify (T-02-05-01 — renderMarkdown)
-->
<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Textarea } from '$lib/components/ui/textarea';
  import Pencil from '@lucide/svelte/icons/pencil';
  import { toast } from 'svelte-sonner';
  import { api } from '$lib/api/client';
  import { ApiError } from '$lib/utils/api';
  import { renderMarkdown } from '$lib/utils/markdown';

  type Props = {
    clusterId: number;
    vmid: number;
    type: 'vm' | 'lxc';
    /** Current notes string (PVE description). Empty string = no notes. */
    notes: string;
    /** Called with the new notes string after a successful save. */
    onApplied?: (notes: string) => void;
  };

  let { clusterId, vmid, type, notes, onApplied }: Props = $props();

  const MAX = 8000;

  let editing = $state(false);
  // Draft is initialised empty; startEdit() always syncs from the current
  // `notes` prop so the initial value doesn't matter. This avoids the Svelte
  // "only captures initial value" warning on $state(notes).
  let draft = $state('');
  let saving = $state(false);
  let error = $state<string | null>(null);

  function startEdit() {
    draft = notes;
    editing = true;
    error = null;
  }

  function cancelEdit() {
    editing = false;
    error = null;
  }

  async function save() {
    if (draft.length > MAX) {
      error = `Notes are limited to ${MAX} characters. Trim ${draft.length - MAX} characters to save.`;
      return;
    }
    saving = true;
    error = null;
    try {
      await api.inventory.setNotes({ clusterId, vmid, type, notes: draft });
      onApplied?.(draft);
      editing = false;
    } catch (e) {
      error =
        e instanceof ApiError && e.status === 422
          ? 'Notes exceeded server limit.'
          : "Couldn't save notes. Try again.";
      toast.error(error);
    } finally {
      saving = false;
    }
  }

  const rendered = $derived(notes ? renderMarkdown(notes) : '');
  const remaining = $derived(MAX - draft.length);
</script>

{#if editing}
  <div class="flex flex-col gap-2">
    <label for="vm-notes" class="text-[13px] font-medium">Notes (Markdown supported)</label>
    <Textarea
      id="vm-notes"
      bind:value={draft}
      class="h-60 font-mono text-[13px]"
      placeholder="Write notes in Markdown…"
    />
    {#if error}
      <div role="alert" class="text-[13px] text-destructive">{error}</div>
    {/if}
    <div class="flex items-center justify-between text-[13px] text-muted-foreground">
      <span>{remaining < 200 ? `${remaining} chars left` : ''}</span>
      <div class="flex gap-2">
        <Button variant="ghost" onclick={cancelEdit} disabled={saving}>Cancel</Button>
        <Button onclick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save notes'}
        </Button>
      </div>
    </div>
  </div>
{:else if notes}
  <div class="flex items-start justify-between gap-4">
    <!-- prose styling via Tailwind Typography class equivalents (no plugin needed) -->
    <div
      class="prose prose-sm dark:prose-invert max-w-none text-[14px] leading-relaxed"
      role="article"
    >
      {@html rendered}
    </div>
    <Button variant="ghost" size="sm" onclick={startEdit} aria-label="Edit notes">
      <Pencil class="size-4 mr-1" aria-hidden="true" /> Edit
    </Button>
  </div>
{:else}
  <div class="flex flex-col items-start gap-2">
    <p class="text-[14px] text-muted-foreground">No notes yet.</p>
    <Button variant="outline" onclick={startEdit}>+ Add notes</Button>
  </div>
{/if}
