<!--
  BackupScheduleCard — the per-VM backup schedule card on the Backups tab.

  Contract: UI-SPEC §"Backups tab" §Schedule card + §Copywriting Contract.
    - A Card "Schedule": a Switch "Scheduled backup" to enable/disable; when
      on, reveals Frequency (Select: Daily / Weekly) + "Keep last N" (number
      input — D-08 simple retention) + a "Save schedule" primary button.
    - On mount, fetch the current schedule (getSchedule).
    - When `backupStorageConfigured` is false, the whole card is disabled
      (D-08 — the no-backup-storage state).
    - Save → api.lifecycle.saveSchedule → enqueue toast.
-->
<script lang="ts">
  import * as Card from '$lib/components/ui/card';
  import * as Select from '$lib/components/ui/select';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Switch } from '$lib/components/ui/switch';
  import { toast } from 'svelte-sonner';
  import { api } from '$lib/api/client';
  import type { ResourceKind } from '$lib/api/types';

  type Props = {
    clusterId: number;
    vmid: number;
    type: ResourceKind;
    /** False when the cluster has no designated backup storage (D-08). */
    backupStorageConfigured: boolean;
  };

  let { clusterId, vmid, type, backupStorageConfigured }: Props = $props();

  let enabled = $state(false);
  /** "daily" or "weekly". */
  let frequency = $state<'daily' | 'weekly'>('daily');
  /** Keep last N — the simple retention count (D-08). */
  let keepLast = $state(7);
  let loading = $state(true);
  let saving = $state(false);

  /** Normalise the backend frequency string to the Select's union type. */
  function toFrequency(f: string): 'daily' | 'weekly' {
    return f === 'weekly' ? 'weekly' : 'daily';
  }

  async function load() {
    loading = true;
    try {
      const s = await api.lifecycle.getSchedule({ clusterId, vmid, type });
      if (s) {
        enabled = s.enabled;
        frequency = toFrequency(s.frequency);
        keepLast = s.keep_last;
      } else {
        // No schedule yet — keep the defaults.
        enabled = false;
        frequency = 'daily';
        keepLast = 7;
      }
    } catch {
      // Couldn't load — fall back to the defaults.
      enabled = false;
      frequency = 'daily';
      keepLast = 7;
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    void clusterId;
    void vmid;
    void type;
    void load();
  });

  const frequencyLabel = $derived(frequency === 'weekly' ? 'Weekly' : 'Daily');
  const keepValid = $derived(Number.isFinite(keepLast) && keepLast >= 1);

  async function handleSave() {
    if (saving || !backupStorageConfigured || !keepValid) return;
    saving = true;
    try {
      const s = await api.lifecycle.saveSchedule({
        clusterId,
        vmid,
        type,
        enabled,
        frequency,
        keep_last: keepLast,
      });
      enabled = s.enabled;
      frequency = toFrequency(s.frequency);
      keepLast = s.keep_last;
      toast.success('Backup schedule saved.');
    } catch {
      toast.error("Couldn't save the backup schedule. Try again.");
    } finally {
      saving = false;
    }
  }
</script>

<Card.Root>
  <Card.Header>
    <Card.Title class="text-[18px] font-semibold">Schedule</Card.Title>
  </Card.Header>
  <Card.Content>
    {#if loading}
      <div class="h-10 animate-pulse rounded bg-muted" aria-hidden="true"></div>
    {:else}
      <div class="flex flex-col gap-4" class:opacity-50={!backupStorageConfigured}>
        <!-- Enable / disable the scheduled job. -->
        <div class="flex items-center justify-between gap-4">
          <Label for="backup-schedule-enabled" class="text-[14px] font-medium">
            Scheduled backup
          </Label>
          <Switch
            id="backup-schedule-enabled"
            bind:checked={enabled}
            disabled={!backupStorageConfigured || saving}
          />
        </div>

        {#if enabled}
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div class="flex flex-col gap-2">
              <Label for="backup-schedule-frequency">Frequency</Label>
              <Select.Root type="single" bind:value={frequency}>
                <Select.Trigger
                  id="backup-schedule-frequency"
                  class="w-full"
                  disabled={!backupStorageConfigured || saving}
                >
                  {frequencyLabel}
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="daily">Daily</Select.Item>
                  <Select.Item value="weekly">Weekly</Select.Item>
                </Select.Content>
              </Select.Root>
            </div>
            <div class="flex flex-col gap-2">
              <Label for="backup-schedule-keep">Keep last</Label>
              <Input
                id="backup-schedule-keep"
                type="number"
                min={1}
                bind:value={keepLast}
                disabled={!backupStorageConfigured || saving}
                style="font-variant-numeric: tabular-nums;"
              />
              <p class="text-[13px] text-muted-foreground">
                Older backups beyond this count are removed automatically.
              </p>
            </div>
          </div>
        {/if}

        <div class="flex justify-end">
          <Button
            size="sm"
            onclick={handleSave}
            disabled={!backupStorageConfigured || saving || !keepValid}
          >
            Save schedule
          </Button>
        </div>
      </div>
    {/if}
  </Card.Content>
</Card.Root>
