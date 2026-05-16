<!--
  ConvertTemplateDialog — the emphatic one-way convert-to-template confirm.

  Contract: UI-SPEC §Confirmation matrix (alert-dialog, warning-tinted) +
  §Destructive confirmations OK/Cancel table + §Copywriting Contract.
    - alert-dialog, warning-tinted (one-way operation).
    - Heading "Convert {name} to a template?"; body verbatim from the UI-SPEC.
    - CTA "Convert to template" → api.lifecycle.convertTemplate → 202.
    - LXC conversion is rejected 422 by the backend; the toolbar disables the
      menu item for LXC, so this dialog is only ever opened for a qemu VM.
-->
<script lang="ts">
  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import { Button } from '$lib/components/ui/button';
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
  import { toast } from 'svelte-sonner';
  import { api } from '$lib/api/client';

  type Props = {
    open?: boolean;
    clusterId: number;
    vmid: number;
    /** Display name (dialog copy + toast). */
    vmName: string;
  };

  let { open = $bindable(false), clusterId, vmid, vmName }: Props = $props();

  let busy = $state(false);

  $effect(() => {
    if (open) busy = false;
  });

  async function handleConfirm() {
    if (busy) return;
    busy = true;
    try {
      await api.lifecycle.convertTemplate({ clusterId, vmid });
      toast(`Convert to template started for ${vmName}.`);
      open = false;
    } catch {
      toast.error(`Couldn’t queue the template conversion for ${vmName}. Try again.`);
    } finally {
      busy = false;
    }
  }
</script>

<AlertDialog.Root bind:open>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <div class="flex items-start gap-2">
        <TriangleAlert class="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
        <div class="flex flex-col gap-1">
          <AlertDialog.Title>Convert {vmName} to a template?</AlertDialog.Title>
          <AlertDialog.Description>
            {vmName} becomes a template and can no longer be started directly. This is a
            one-way change.
          </AlertDialog.Description>
        </div>
      </div>
    </AlertDialog.Header>

    <AlertDialog.Footer>
      <Button variant="ghost" onclick={() => (open = false)} disabled={busy}>
        Cancel
      </Button>
      <Button onclick={handleConfirm} disabled={busy}>Convert to template</Button>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
