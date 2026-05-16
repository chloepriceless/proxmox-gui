<!--
  ResizeDialog — the CPU / memory / disk-grow form dialog (D-12, LIFE-08/09).

  Contract: UI-SPEC §"Resize dialog" + §Copywriting Contract.
    - shadcn `dialog` form. On open, fetch getResizeInfo.
    - Fields inline (NO Advanced disclosure): vCPU (number), Memory GB
      (number), Disk grow per disk (number, shows current → new).
    - Reboot-required warning: when cpu_hotplug is false and the user changes
      cores, a Label 13/500 text-warning line "Requires a reboot to take
      effect." appears under vCPU; same for memory when memory_hotplug false.
    - Disk shrink block: each disk input enforces min = current size_gb; a
      smaller value shows an inline field error AND a persistent
      bg-destructive/10 notice. The "Resize VM" CTA is disabled while any disk
      field is invalid.
    - NO lock-override field anywhere (Pitfall 17 / T-03-06-04).
    - Cancel left + CTA "Resize VM" → api.lifecycle.resize → 202 → toast.
-->
<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import CircleAlert from '@lucide/svelte/icons/circle-alert';
  import { toast } from 'svelte-sonner';
  import { api } from '$lib/api/client';
  import type { ResizeInfo, ResourceKind } from '$lib/api/types';

  type Props = {
    open?: boolean;
    clusterId: number;
    vmid: number;
    type: ResourceKind;
    /** Display name (dialog copy + toast). */
    vmName: string;
  };

  let { open = $bindable(false), clusterId, vmid, type, vmName }: Props = $props();

  let info = $state<ResizeInfo | null>(null);
  let loading = $state(false);
  let loadError = $state(false);
  let busy = $state(false);

  // Editable fields — seeded from `info` once it loads.
  let cores = $state(0);
  let memoryGb = $state(0);
  /** disk key → desired new size in GB. */
  let diskSizes = $state<Record<string, number>>({});

  // Fetch resize-info each time the dialog opens.
  $effect(() => {
    if (!open) return;
    busy = false;
    loading = true;
    loadError = false;
    info = null;
    api.lifecycle
      .getResizeInfo({ clusterId, vmid, type })
      .then((res) => {
        info = res;
        cores = res.cores;
        memoryGb = Math.round(res.memory / 1024);
        const seeded: Record<string, number> = {};
        for (const d of res.disks) seeded[d.disk] = d.size_gb;
        diskSizes = seeded;
        loading = false;
      })
      .catch(() => {
        loadError = true;
        loading = false;
      });
  });

  /** A disk field is invalid when its new size is below the current size. */
  function diskInvalid(disk: string, currentGb: number): boolean {
    const next = diskSizes[disk];
    return typeof next === 'number' && Number.isFinite(next) && next < currentGb;
  }

  const anyDiskInvalid = $derived(
    info !== null && info.disks.some((d) => diskInvalid(d.disk, d.size_gb))
  );

  // Reboot-required warnings — only when the value changed AND hotplug is off.
  const cpuRebootRequired = $derived(
    info !== null && !info.cpu_hotplug && cores !== info.cores
  );
  const memRebootRequired = $derived(
    info !== null && !info.memory_hotplug && memoryGb !== Math.round(info.memory / 1024)
  );

  async function handleSubmit() {
    if (busy || !info || anyDiskInvalid) return;
    busy = true;
    try {
      const body: {
        cores?: number;
        memory?: number;
        disks?: { disk: string; new_size_gb: number }[];
      } = {};
      if (cores !== info.cores) body.cores = cores;
      if (memoryGb !== Math.round(info.memory / 1024)) body.memory = memoryGb * 1024;
      const grownDisks = info.disks
        .filter((d) => diskSizes[d.disk] > d.size_gb)
        .map((d) => ({ disk: d.disk, new_size_gb: diskSizes[d.disk] }));
      if (grownDisks.length > 0) body.disks = grownDisks;

      await api.lifecycle.resize({ clusterId, vmid, type, body });
      toast(`Resize queued for ${vmName}.`);
      open = false;
    } catch {
      toast.error(`Couldn’t queue the resize for ${vmName}. Try again.`);
    } finally {
      busy = false;
    }
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Resize {vmName}</Dialog.Title>
      <Dialog.Description>
        Adjust CPU, memory, and disk for this VM.
      </Dialog.Description>
    </Dialog.Header>

    {#if loading}
      <div class="flex flex-col gap-3" aria-hidden="true">
        {#each [0, 1, 2] as i (i)}
          <div class="h-9 animate-pulse rounded bg-muted"></div>
        {/each}
      </div>
    {:else if loadError || !info}
      <p class="text-[14px] text-destructive">Couldn't load the current sizing.</p>
    {:else}
      <div class="flex flex-col gap-4">
        <!-- vCPU -->
        <div class="flex flex-col gap-2">
          <Label for="resize-cpu">vCPU</Label>
          <Input id="resize-cpu" type="number" min={1} bind:value={cores} />
          {#if cpuRebootRequired}
            <p class="text-[13px] font-medium text-warning">
              Requires a reboot to take effect.
            </p>
          {/if}
        </div>

        <!-- Memory -->
        <div class="flex flex-col gap-2">
          <Label for="resize-mem">Memory GB</Label>
          <Input id="resize-mem" type="number" min={1} bind:value={memoryGb} />
          {#if memRebootRequired}
            <p class="text-[13px] font-medium text-warning">
              Requires a reboot to take effect.
            </p>
          {/if}
        </div>

        <!-- Disks — grow only. -->
        {#each info.disks as d (d.disk)}
          <div class="flex flex-col gap-2">
            <Label for={`resize-disk-${d.disk}`}>
              Disk ({d.disk}) — {d.size_gb} GB → {diskSizes[d.disk] ?? d.size_gb} GB
            </Label>
            <Input
              id={`resize-disk-${d.disk}`}
              type="number"
              min={d.size_gb}
              bind:value={diskSizes[d.disk]}
              aria-invalid={diskInvalid(d.disk, d.size_gb) ? 'true' : undefined}
            />
            {#if diskInvalid(d.disk, d.size_gb)}
              <p class="text-[13px] text-destructive">
                Disks can only grow. Enter a value of {d.size_gb} GB or more.
              </p>
            {/if}
          </div>
        {/each}

        <!-- Persistent shrink-blocked notice (UI-SPEC verbatim). -->
        {#if anyDiskInvalid}
          <div
            class="flex items-start gap-2 rounded-md border border-destructive/30
                   bg-destructive/10 px-3 py-2"
          >
            <CircleAlert class="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
            <p class="text-[14px] text-foreground">
              Disks can only grow. Shrinking is not supported by Proxmox.
            </p>
          </div>
        {/if}
      </div>
    {/if}

    <Dialog.Footer>
      <Button variant="ghost" onclick={() => (open = false)} disabled={busy}>
        Cancel
      </Button>
      <Button
        onclick={handleSubmit}
        disabled={busy || loading || loadError || !info || anyDiskInvalid}
      >
        Resize VM
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
