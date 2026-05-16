<!--
  ActionToolbar — the VM-detail lifecycle action toolbar.

  Contract: UI-SPEC §"Lifecycle action toolbar" + §"Confirmation matrix" (D-10).
    - 44px tall (h-11).
    - Left cluster: Start / Stop / Reboot / Shutdown — outline size=sm.
      Context-aware: Start disabled when running; Stop/Reboot/Shutdown
      disabled when stopped. Disabled buttons keep their place at opacity-50.
    - "More" DropdownMenu groups the lower-frequency lifecycle ops — the
      dialogs land in Plans 06/07, so the items dispatch via a prop callback;
      clear TODO markers ship now.
    - Delete sits far-right, separated by a flex spacer + a 1px border divider,
      destructive size=sm — opens ConfirmByNameDialog (reused verbatim).
    - Start fires immediately (no dialog — D-10); Stop/Reboot/Shutdown open a
      PowerConfirmDialog.
    - While a job is in flight for this VM, every button is disabled with a
      tooltip. An unreachable cluster disables the whole toolbar.
-->
<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import Play from '@lucide/svelte/icons/play';
  import Square from '@lucide/svelte/icons/square';
  import RotateCw from '@lucide/svelte/icons/rotate-cw';
  import Power from '@lucide/svelte/icons/power';
  import MoreHorizontal from '@lucide/svelte/icons/more-horizontal';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import Camera from '@lucide/svelte/icons/camera';
  import Database from '@lucide/svelte/icons/database';
  import Cpu from '@lucide/svelte/icons/cpu';
  import Copy from '@lucide/svelte/icons/copy';
  import ArrowRightLeft from '@lucide/svelte/icons/arrow-right-left';
  import FileStack from '@lucide/svelte/icons/file-stack';
  import { toast } from 'svelte-sonner';
  import ConfirmByNameDialog from '$lib/components/forms/ConfirmByNameDialog.svelte';
  import PowerConfirmDialog, {
    type PowerConfirmKind,
  } from './PowerConfirmDialog.svelte';
  import SnapshotCreateDialog from './SnapshotCreateDialog.svelte';
  import ResizeDialog from './ResizeDialog.svelte';
  import CloneDialog from './CloneDialog.svelte';
  import MigrateDialog from './MigrateDialog.svelte';
  import ConvertTemplateDialog from './ConvertTemplateDialog.svelte';
  import { api } from '$lib/api/client';
  import type { PowerActionName, ResourceKind } from '$lib/api/types';

  type Props = {
    clusterId: number;
    vmid: number;
    type: ResourceKind;
    /** Current PVE status — drives the context-aware enable/disable. */
    status: string;
    /** Display name (Delete typed-name target + toast copy). */
    vmName: string;
    /** The node this VM runs on — Clone/Migrate dialogs need it. */
    node: string;
    /** True when the cluster is unreachable — disables the whole toolbar. */
    clusterUnreachable?: boolean;
    /**
     * Called when a "More" menu item is chosen, after the toolbar has opened
     * the matching dialog. Optional — kept for observers / analytics.
     */
    onMoreAction?: (
      action: 'snapshot' | 'backup' | 'resize' | 'clone' | 'migrate' | 'template'
    ) => void;
  };

  let {
    clusterId,
    vmid,
    type,
    status,
    vmName,
    node,
    clusterUnreachable = false,
    onMoreAction,
  }: Props = $props();

  // Context-aware power state. A running VM cannot be Started; a stopped one
  // cannot be Stopped/Rebooted/Shut down.
  const isRunning = $derived(status === 'running');
  const isStopped = $derived(status === 'stopped');

  // True while a lifecycle job for THIS VM is being enqueued — every button
  // disables for the brief round-trip.
  let jobInFlight = $state(false);

  const toolbarDisabled = $derived(clusterUnreachable);

  // --- Power confirm dialog state ----------------------------------------
  let powerDialogOpen = $state(false);
  let powerKind = $state<PowerConfirmKind>('reboot');
  let pendingAction = $state<PowerActionName>('reboot');

  // --- Delete confirm dialog state ---------------------------------------
  let deleteDialogOpen = $state(false);

  /** Map a PowerConfirmKind to the API action name. */
  function actionFor(kind: PowerConfirmKind): PowerActionName {
    return kind === 'force-stop' ? 'stop' : kind;
  }

  /** Title-case label for toast copy. */
  function label(action: PowerActionName): string {
    return action.charAt(0).toUpperCase() + action.slice(1);
  }

  /** Enqueue a power action and surface the enqueue toast (UI-SPEC copy). */
  async function runPower(action: PowerActionName) {
    if (jobInFlight) return;
    jobInFlight = true;
    try {
      await api.lifecycle.power({ clusterId, vmid, type, action });
      toast(`${label(action)} queued for ${vmName}.`);
    } catch {
      toast.error(`Couldn’t queue ${label(action)} for ${vmName}. Try again.`);
    } finally {
      jobInFlight = false;
    }
  }

  /** Start — fires immediately, no dialog (D-10). */
  function onStart() {
    void runPower('start');
  }

  /** Open the OK/Cancel confirm for Stop / Reboot / Shutdown. */
  function openPowerConfirm(kind: PowerConfirmKind) {
    powerKind = kind;
    pendingAction = actionFor(kind);
    powerDialogOpen = true;
  }

  /** Confirm handler passed to PowerConfirmDialog. */
  async function confirmPower() {
    await runPower(pendingAction);
  }

  /** Escalation — the graceful-Stop dialog → Force-Stop. */
  function escalateForceStop() {
    powerKind = 'force-stop';
    pendingAction = 'stop';
  }

  /** Delete — confirmed via the typed-name ConfirmByNameDialog. */
  async function confirmDelete() {
    if (jobInFlight) return;
    jobInFlight = true;
    try {
      await api.lifecycle.del({ clusterId, vmid, type });
      toast(`Delete queued for ${vmName}.`);
    } catch {
      toast.error(`Couldn’t queue Delete for ${vmName}. Try again.`);
    } finally {
      jobInFlight = false;
    }
  }

  // --- "More" menu dialog state ------------------------------------------
  let snapshotDialogOpen = $state(false);
  let resizeDialogOpen = $state(false);
  let cloneDialogOpen = $state(false);
  let migrateDialogOpen = $state(false);
  let convertDialogOpen = $state(false);

  // Convert-to-template is qemu-only — the backend rejects an LXC 422.
  const isLxc = $derived(type === 'lxc');

  /** Open the dialog the chosen "More" item owns (Plan 03-06 wires these). */
  function more(action: 'snapshot' | 'backup' | 'resize' | 'clone' | 'migrate' | 'template') {
    switch (action) {
      case 'snapshot':
        snapshotDialogOpen = true;
        break;
      case 'resize':
        resizeDialogOpen = true;
        break;
      case 'clone':
        cloneDialogOpen = true;
        break;
      case 'migrate':
        migrateDialogOpen = true;
        break;
      case 'template':
        convertDialogOpen = true;
        break;
      case 'backup':
        // "Back up now" stays a TODO — Plan 03-07 owns the backup dialog.
        break;
    }
    onMoreAction?.(action);
  }

  /** Snapshot-create submit — enqueues the 202 job + the toast. */
  async function onSnapshotCreate(d: {
    name: string;
    description: string;
    vmstate: boolean;
  }) {
    await api.lifecycle.createSnapshot({
      clusterId,
      vmid,
      type,
      name: d.name,
      description: d.description,
      vmstate: d.vmstate,
    });
    toast(`Snapshot started for ${vmName}.`);
  }
</script>

<Tooltip.Provider>
  <div class="flex h-11 items-center gap-2">
    {#if toolbarDisabled}
      <!-- Unreachable cluster — degrade-don't-fail (Phase 2 pattern). -->
      <Tooltip.Root>
        <Tooltip.Trigger>
          {#snippet child({ props })}
            <div {...props} class="flex items-center gap-2 opacity-50">
              <Button variant="outline" size="sm" class="h-9" disabled>
                <Play class="size-3.5" aria-hidden="true" /> Start
              </Button>
              <Button variant="outline" size="sm" class="h-9" disabled>
                <Square class="size-3.5" aria-hidden="true" /> Stop
              </Button>
              <Button variant="outline" size="sm" class="h-9" disabled>
                <RotateCw class="size-3.5" aria-hidden="true" /> Reboot
              </Button>
              <Button variant="outline" size="sm" class="h-9" disabled>
                <Power class="size-3.5" aria-hidden="true" /> Shutdown
              </Button>
            </div>
          {/snippet}
        </Tooltip.Trigger>
        <Tooltip.Content>This cluster is currently unreachable.</Tooltip.Content>
      </Tooltip.Root>
    {:else}
      <!-- Power cluster — context-aware enable/disable. -->
      <Tooltip.Root>
        <Tooltip.Trigger>
          {#snippet child({ props })}
            <div {...props} class="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                class="h-9"
                disabled={isRunning || jobInFlight}
                onclick={onStart}
              >
                <Play class="size-3.5" aria-hidden="true" /> Start
              </Button>
              <Button
                variant="outline"
                size="sm"
                class="h-9"
                disabled={isStopped || jobInFlight}
                onclick={() => openPowerConfirm('stop')}
              >
                <Square class="size-3.5" aria-hidden="true" /> Stop
              </Button>
              <Button
                variant="outline"
                size="sm"
                class="h-9"
                disabled={isStopped || jobInFlight}
                onclick={() => openPowerConfirm('reboot')}
              >
                <RotateCw class="size-3.5" aria-hidden="true" /> Reboot
              </Button>
              <Button
                variant="outline"
                size="sm"
                class="h-9"
                disabled={isStopped || jobInFlight}
                onclick={() => openPowerConfirm('shutdown')}
              >
                <Power class="size-3.5" aria-hidden="true" /> Shutdown
              </Button>
            </div>
          {/snippet}
        </Tooltip.Trigger>
        {#if jobInFlight}
          <Tooltip.Content>An action is already running for this resource.</Tooltip.Content>
        {/if}
      </Tooltip.Root>

      <!-- "More" menu — lower-frequency lifecycle ops. The dialogs land in
           Plans 06/07; the items dispatch via onMoreAction for now. -->
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          {#snippet child({ props })}
            <Button {...props} variant="outline" size="sm" class="h-9" disabled={jobInFlight}>
              <MoreHorizontal class="size-3.5" aria-hidden="true" /> More
            </Button>
          {/snippet}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="start">
          <DropdownMenu.Item onSelect={() => more('snapshot')}>
            <Camera class="size-4 mr-2" aria-hidden="true" /> Snapshot
          </DropdownMenu.Item>
          <!-- TODO(03-07): wire Back up now dialog -->
          <DropdownMenu.Item onSelect={() => more('backup')}>
            <Database class="size-4 mr-2" aria-hidden="true" /> Back up now
          </DropdownMenu.Item>
          <DropdownMenu.Item onSelect={() => more('resize')}>
            <Cpu class="size-4 mr-2" aria-hidden="true" /> Resize
          </DropdownMenu.Item>
          <DropdownMenu.Separator />
          <DropdownMenu.Item onSelect={() => more('clone')}>
            <Copy class="size-4 mr-2" aria-hidden="true" /> Clone
          </DropdownMenu.Item>
          <DropdownMenu.Item onSelect={() => more('migrate')}>
            <ArrowRightLeft class="size-4 mr-2" aria-hidden="true" /> Migrate
          </DropdownMenu.Item>
          {#if isLxc}
            <!-- Container-to-template conversion isn't supported (backend 422). -->
            <Tooltip.Root>
              <Tooltip.Trigger>
                {#snippet child({ props })}
                  <div {...props}>
                    <DropdownMenu.Item disabled>
                      <FileStack class="size-4 mr-2" aria-hidden="true" />
                      Convert to template
                    </DropdownMenu.Item>
                  </div>
                {/snippet}
              </Tooltip.Trigger>
              <Tooltip.Content>
                Container-to-template conversion isn't supported here.
              </Tooltip.Content>
            </Tooltip.Root>
          {:else}
            <DropdownMenu.Item onSelect={() => more('template')}>
              <FileStack class="size-4 mr-2" aria-hidden="true" /> Convert to template
            </DropdownMenu.Item>
          {/if}
        </DropdownMenu.Content>
      </DropdownMenu.Root>

      <!-- Flex spacer + divider pushes Delete to the far right. -->
      <div class="flex-1"></div>
      <div class="h-6 w-px bg-border" aria-hidden="true"></div>

      <Button
        variant="destructive"
        size="sm"
        class="h-9"
        disabled={jobInFlight}
        onclick={() => (deleteDialogOpen = true)}
      >
        <Trash2 class="size-3.5" aria-hidden="true" /> Delete
      </Button>
    {/if}
  </div>
</Tooltip.Provider>

<!-- Power OK/Cancel confirm (Stop / Reboot / Shutdown / Force-Stop). -->
<PowerConfirmDialog
  bind:open={powerDialogOpen}
  kind={powerKind}
  {vmName}
  onConfirm={confirmPower}
  onEscalateForceStop={escalateForceStop}
/>

<!-- Delete — typed-name confirm, ConfirmByNameDialog reused verbatim. -->
<ConfirmByNameDialog
  bind:open={deleteDialogOpen}
  heading={`Delete ${vmName}?`}
  body={`This permanently destroys ${vmName} and its disks on Proxmox. Snapshots and backups taken by this GUI are not automatically removed. This can't be undone.`}
  targetName={vmName}
  confirmLabel="Delete VM"
  onConfirm={confirmDelete}
/>

<!-- "More" menu dialogs — Plan 03-06 wires Snapshot/Resize/Clone/Migrate/
     Convert; "Back up now" stays a Plan 03-07 TODO. -->
<SnapshotCreateDialog
  bind:open={snapshotDialogOpen}
  {vmName}
  onSubmit={onSnapshotCreate}
/>
<ResizeDialog bind:open={resizeDialogOpen} {clusterId} {vmid} {type} {vmName} />
<CloneDialog
  bind:open={cloneDialogOpen}
  {clusterId}
  {vmid}
  {type}
  {vmName}
  currentNode={node}
/>
<MigrateDialog
  bind:open={migrateDialogOpen}
  {clusterId}
  {vmid}
  {type}
  {vmName}
  currentNode={node}
/>
{#if !isLxc}
  <ConvertTemplateDialog
    bind:open={convertDialogOpen}
    {clusterId}
    {vmid}
    {vmName}
  />
{/if}
