<!--
  MigrateDialog — the live/offline migrate form dialog (D-12, LIFE-11).

  Contract: UI-SPEC §"Migrate dialog" + Implementation Note 7 + §Copywriting.
    - shadcn `dialog` form.
    - Core: "Target node" Select (cluster nodes excluding the current node) +
      a one-line summary "Move {vmName} from {currentNode} to {target}."
    - Advanced `collapsible` (collapsed by default, ALWAYS present):
      "Migration type" Select (Online (live) / Offline) + a bwlimit number
      input labelled MB/s with helper "0 = unlimited". bwlimit stays visible
      inside Advanced — never removed (D-12 success-criterion).
    - A backend pre-flight failure (409) shows a bg-destructive/10 inline
      notice and keeps the "Migrate VM" CTA disabled.
    - Cancel left + CTA "Migrate VM" → api.lifecycle.migrate → 202.

  Node list: the frontend has no dedicated node endpoint, so the unique node
  set is derived from the cluster inventory (each VM/LXC row carries `node`).
-->
<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog';
  import * as Select from '$lib/components/ui/select';
  import * as Collapsible from '$lib/components/ui/collapsible';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import CircleAlert from '@lucide/svelte/icons/circle-alert';
  import { toast } from 'svelte-sonner';
  import { api, ApiError } from '$lib/api/client';
  import type { ResourceKind } from '$lib/api/types';

  type Props = {
    open?: boolean;
    clusterId: number;
    vmid: number;
    type: ResourceKind;
    /** Display name (dialog copy + toast). */
    vmName: string;
    /** The node the VM currently runs on — excluded from the target list. */
    currentNode: string;
  };

  let {
    open = $bindable(false),
    clusterId,
    vmid,
    type,
    vmName,
    currentNode,
  }: Props = $props();

  let nodes = $state<string[]>([]);
  let targetNode = $state('');
  let online = $state(true);
  let bwlimit = $state(0);
  let busy = $state(false);
  let preflightError = $state<string | null>(null);
  let advancedOpen = $state(false);

  // Load the candidate node list from the cluster inventory each time the
  // dialog opens. The current node is excluded — you cannot migrate in place.
  $effect(() => {
    if (!open) return;
    busy = false;
    preflightError = null;
    targetNode = '';
    online = true;
    bwlimit = 0;
    advancedOpen = false;
    api.inventory
      .listForCluster({ clusterId })
      .then((inv) => {
        const unique = new Set(inv.items.map((it) => it.node));
        unique.delete(currentNode);
        nodes = Array.from(unique).sort();
      })
      .catch(() => {
        nodes = [];
      });
  });

  const migrationTypeLabel = $derived(online ? 'Online (live)' : 'Offline');

  async function handleSubmit() {
    if (busy || !targetNode) return;
    busy = true;
    preflightError = null;
    try {
      await api.lifecycle.migrate({
        clusterId,
        vmid,
        type,
        body: { target_node: targetNode, online, bwlimit_mbps: bwlimit },
      });
      toast(`Migrate started for ${vmName}.`);
      open = false;
    } catch (err) {
      // A 409 pre-flight failure (node-local snippet / lost quorum) carries a
      // friendly message — surface it inline and keep the CTA blocked.
      if (err instanceof ApiError && err.status === 409) {
        const detail =
          typeof err.body === 'object' && err.body !== null && 'detail' in err.body
            ? String((err.body as { detail: unknown }).detail)
            : 'This VM can’t be migrated right now.';
        preflightError = detail;
      } else {
        toast.error(`Couldn’t queue the migration for ${vmName}. Try again.`);
      }
    } finally {
      busy = false;
    }
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Migrate {vmName}</Dialog.Title>
      <Dialog.Description>
        Move this VM to another node in the cluster.
      </Dialog.Description>
    </Dialog.Header>

    <div class="flex flex-col gap-4">
      <!-- Core: target node. -->
      <div class="flex flex-col gap-2">
        <Label for="migrate-target">Target node</Label>
        <Select.Root type="single" bind:value={targetNode}>
          <Select.Trigger id="migrate-target" class="w-full">
            {targetNode || 'Choose a node'}
          </Select.Trigger>
          <Select.Content>
            {#each nodes as n (n)}
              <Select.Item value={n}>{n}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
        {#if targetNode}
          <p class="text-[13px] text-muted-foreground">
            Move {vmName} from {currentNode} to {targetNode}.
          </p>
        {/if}
      </div>

      <!-- Advanced disclosure — always present, collapsed by default. bwlimit
           lives here and is never removed (D-12 success-criterion). -->
      <Collapsible.Root bind:open={advancedOpen}>
        <Collapsible.Trigger
          class="flex items-center gap-1 text-[13px] font-medium text-muted-foreground
                 hover:text-foreground"
        >
          <ChevronDown
            class="size-4 transition-transform {advancedOpen ? '' : '-rotate-90'}"
            aria-hidden="true"
          />
          Advanced
        </Collapsible.Trigger>
        <Collapsible.Content class="flex flex-col gap-4 pt-3">
          <div class="flex flex-col gap-2">
            <Label for="migrate-type">Migration type</Label>
            <Select.Root
              type="single"
              value={online ? 'online' : 'offline'}
              onValueChange={(v) => (online = v === 'online')}
            >
              <Select.Trigger id="migrate-type" class="w-full">
                {migrationTypeLabel}
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="online">Online (live)</Select.Item>
                <Select.Item value="offline">Offline</Select.Item>
              </Select.Content>
            </Select.Root>
          </div>

          <div class="flex flex-col gap-2">
            <Label for="migrate-bwlimit">Bandwidth limit (MB/s)</Label>
            <Input id="migrate-bwlimit" type="number" min={0} bind:value={bwlimit} />
            <p class="text-[13px] text-muted-foreground">0 = unlimited</p>
          </div>
        </Collapsible.Content>
      </Collapsible.Root>

      <!-- Pre-flight failure notice (409). -->
      {#if preflightError}
        <div
          class="flex items-start gap-2 rounded-md border border-destructive/30
                 bg-destructive/10 px-3 py-2"
        >
          <CircleAlert class="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
          <p class="text-[14px] text-foreground">{preflightError}</p>
        </div>
      {/if}
    </div>

    <Dialog.Footer>
      <Button variant="ghost" onclick={() => (open = false)} disabled={busy}>
        Cancel
      </Button>
      <Button onclick={handleSubmit} disabled={busy || !targetNode || preflightError !== null}>
        Migrate VM
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
