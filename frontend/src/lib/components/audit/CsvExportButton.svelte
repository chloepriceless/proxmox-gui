<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import Download from '@lucide/svelte/icons/download';
  import { toast } from 'svelte-sonner';
  import { ApiError } from '$lib/utils/api';
  import { api } from '$lib/api/client';
  import type { AuditFilterParams } from '$lib/api/types';

  type Props = {
    total: number;
    filters: AuditFilterParams;
  };
  let { total, filters }: Props = $props();

  const HARD_LIMIT = 50000;
  let exporting = $state(false);
  const disabled = $derived(total > HARD_LIMIT || exporting);

  async function doExport() {
    if (disabled) return;
    exporting = true;
    try {
      const blob = await api.audit.exportCsv({ filters });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const date = new Date().toISOString().slice(0, 10);
      a.download = `audit-${date}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${total} audit entries.`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        toast.error('Too many rows; refine your filter.');
      } else {
        toast.error('Export failed. Try again.');
      }
    } finally {
      exporting = false;
    }
  }
</script>

{#if total > HARD_LIMIT}
  <Tooltip.Provider>
    <Tooltip.Root>
      <Tooltip.Trigger>
        {#snippet child({ props })}
          <span {...props}>
            <Button variant="outline" size="sm" disabled>
              <Download class="size-4 mr-1" aria-hidden="true" /> Export filtered ({total} rows)
            </Button>
          </span>
        {/snippet}
      </Tooltip.Trigger>
      <Tooltip.Content>Refine your filter — exports are capped at {HARD_LIMIT} rows.</Tooltip.Content>
    </Tooltip.Root>
  </Tooltip.Provider>
{:else}
  <Button variant="outline" size="sm" onclick={doExport} {disabled}>
    {#if exporting}
      <span class="size-4 mr-1 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true"></span> Exporting…
    {:else}
      <Download class="size-4 mr-1" aria-hidden="true" /> Export filtered ({total} rows)
    {/if}
  </Button>
{/if}
