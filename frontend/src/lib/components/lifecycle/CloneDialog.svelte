<!--
  CloneDialog — the linked/full clone form dialog (Claude's discretion, pinned
  by UI-SPEC §"Clone dialog").

  Contract: UI-SPEC §"Clone dialog" + §Copywriting Contract.
    - shadcn `dialog` form.
    - Fields: Clone name (text), Mode (Select: Linked / Full), Target node
      (Select), Target storage (Select), New VMID (number — optional,
      overridable; helper "Auto-assigned. Change only if you need a specific
      ID.").
    - There is no frontend nextid helper endpoint and the clone backend
      auto-assigns the VMID server-side when `new_vmid` is omitted — so the
      VMID field is left blank by default and labelled "Auto-assigned".
    - Cancel left + CTA "Clone VM" → api.lifecycle.clone → 202.

  Node list is derived from the cluster inventory (no dedicated node endpoint).
  Target storage is a free-typed value when no enumeration is available — the
  field is optional and the backend defaults sensibly when omitted.
-->
<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog';
  import * as Select from '$lib/components/ui/select';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { toast } from 'svelte-sonner';
  import { api } from '$lib/api/client';
  import type { ResourceKind } from '$lib/api/types';

  type Props = {
    open?: boolean;
    clusterId: number;
    vmid: number;
    type: ResourceKind;
    /** Display name (dialog copy + the default clone name). */
    vmName: string;
    /** The node the source VM runs on — the default target node. */
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

  let cloneName = $state('');
  /** "linked" or "full". */
  let mode = $state('linked');
  let targetNode = $state('');
  let targetStorage = $state('');
  /** Empty string → server auto-assigns the VMID. */
  let newVmid = $state('');
  let busy = $state(false);

  let nodes = $state<string[]>([]);

  $effect(() => {
    if (!open) return;
    busy = false;
    cloneName = `${vmName}-clone`;
    mode = 'linked';
    targetNode = currentNode;
    targetStorage = '';
    newVmid = '';
    api.inventory
      .listForCluster({ clusterId })
      .then((inv) => {
        const unique = new Set(inv.items.map((it) => it.node));
        if (currentNode) unique.add(currentNode);
        nodes = Array.from(unique).sort();
      })
      .catch(() => {
        nodes = currentNode ? [currentNode] : [];
      });
  });

  const nameValid = $derived(cloneName.trim().length >= 1);

  async function handleSubmit() {
    if (busy || !nameValid || !targetNode) return;
    busy = true;
    try {
      const parsedVmid = newVmid.trim() === '' ? undefined : Number(newVmid.trim());
      await api.lifecycle.clone({
        clusterId,
        vmid,
        type,
        body: {
          name: cloneName.trim(),
          full: mode === 'full',
          target_node: targetNode,
          target_storage: targetStorage.trim() === '' ? null : targetStorage.trim(),
          new_vmid: parsedVmid,
        },
      });
      toast(`Clone started for ${vmName}.`);
      open = false;
    } catch {
      toast.error(`Couldn’t queue the clone of ${vmName}. Try again.`);
    } finally {
      busy = false;
    }
  }

  const modeLabel = $derived(mode === 'full' ? 'Full clone' : 'Linked clone');
</script>

<Dialog.Root bind:open>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Clone {vmName}</Dialog.Title>
      <Dialog.Description>
        Create a copy of this VM on the cluster.
      </Dialog.Description>
    </Dialog.Header>

    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-2">
        <Label for="clone-name">Clone name</Label>
        <Input id="clone-name" type="text" bind:value={cloneName} autocomplete="off" />
      </div>

      <div class="flex flex-col gap-2">
        <Label for="clone-mode">Mode</Label>
        <Select.Root type="single" bind:value={mode}>
          <Select.Trigger id="clone-mode" class="w-full">{modeLabel}</Select.Trigger>
          <Select.Content>
            <Select.Item value="linked">Linked clone</Select.Item>
            <Select.Item value="full">Full clone</Select.Item>
          </Select.Content>
        </Select.Root>
      </div>

      <div class="flex flex-col gap-2">
        <Label for="clone-node">Target node</Label>
        <Select.Root type="single" bind:value={targetNode}>
          <Select.Trigger id="clone-node" class="w-full">
            {targetNode || 'Choose a node'}
          </Select.Trigger>
          <Select.Content>
            {#each nodes as n (n)}
              <Select.Item value={n}>{n}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      </div>

      <div class="flex flex-col gap-2">
        <Label for="clone-storage">Target storage</Label>
        <Input
          id="clone-storage"
          type="text"
          bind:value={targetStorage}
          placeholder="Optional — leave blank to use the source storage."
          autocomplete="off"
        />
      </div>

      <div class="flex flex-col gap-2">
        <Label for="clone-vmid">New VMID</Label>
        <Input
          id="clone-vmid"
          type="number"
          min={1}
          bind:value={newVmid}
          placeholder="Auto-assigned"
        />
        <p class="text-[13px] text-muted-foreground">
          Auto-assigned. Change only if you need a specific ID.
        </p>
      </div>
    </div>

    <Dialog.Footer>
      <Button variant="ghost" onclick={() => (open = false)} disabled={busy}>
        Cancel
      </Button>
      <Button onclick={handleSubmit} disabled={busy || !nameValid || !targetNode}>
        Clone VM
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
