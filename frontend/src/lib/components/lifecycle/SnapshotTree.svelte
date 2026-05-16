<!--
  SnapshotTree — the hand-rolled recursive snapshot tree (D-05).

  Contract: UI-SPEC §"Snapshot tree renderer" + §"Snapshots tab" + Implementation
  Note 5. NO tree-view npm dependency — mirrors the Phase 2 hand-rolled
  Sparkline.svelte precedent.

    - Builds the hierarchy from `parent` pointers: a root is a snapshot whose
      parent is null OR whose parent name is absent from the list.
    - A recursive `{#snippet}` (treeNodes) renders the hierarchy — it renders
      itself for each node's children, so the tree is genuinely recursive with
      no tree-view library.
    - Each node row: 40px tall (h-10); 24px indent per depth (padding-left);
      a 1px --border vertical branch guide + a short horizontal connector.
    - Node content: status dot + name (Body 14/400) + timestamp + size
      (Label 13/500 muted). The "current" node carries a primary-outline
      "current" Badge; its Restore item is disabled.
    - Hover (or focus) reveals a MoreHorizontal menu: "Restore to this
      snapshot" + "Delete snapshot".
    - role="tree" on the root, role="treeitem" on nodes, aria-expanded on
      branch nodes, roving tabindex with ArrowUp/ArrowDown navigation.

  T-03-06-02: every PVE-derived string (name, description) is rendered via
  Svelte text interpolation — auto-escaped. No {@html} anywhere.
-->
<script lang="ts">
  import { Badge } from '$lib/components/ui/badge';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import MoreHorizontal from '@lucide/svelte/icons/more-horizontal';
  import type { SnapshotItem } from '$lib/api/types';
  import { childrenOf as childrenOfPure, flattenSnapshotOrder } from './snapshot-tree';

  type Props = {
    /** The flat parent-pointer snapshot list from the backend. */
    snapshots: SnapshotItem[];
    /** Name of the "current" pseudo-snapshot (PVE's `current` marker). */
    currentName: string | null;
    /** Invoked when the user picks "Restore to this snapshot". */
    onRestore: (name: string) => void;
    /** Invoked when the user picks "Delete snapshot". */
    onDelete: (name: string) => void;
  };

  let { snapshots, currentName, onRestore, onDelete }: Props = $props();

  /** Children of `parentName` (null = roots) — the shared pure helper. */
  function childrenOf(parentName: string | null): SnapshotItem[] {
    return childrenOfPure(snapshots, parentName);
  }

  const rootNodes = $derived(childrenOf(null));

  /** A flat pre-order list of names — the roving-tabindex / arrow-key order. */
  const flatOrder = $derived(flattenSnapshotOrder(snapshots));

  /** Roving tabindex: which treeitem currently holds tab focus. */
  let activeName = $state<string | null>(null);

  $effect(() => {
    if (activeName === null && flatOrder.length > 0) {
      activeName = flatOrder[0];
    }
  });

  function onNodeKeydown(event: KeyboardEvent, name: string) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const idx = flatOrder.indexOf(name);
    if (idx === -1) return;
    const nextIdx =
      event.key === 'ArrowDown'
        ? Math.min(idx + 1, flatOrder.length - 1)
        : Math.max(idx - 1, 0);
    activeName = flatOrder[nextIdx];
    const el = document.querySelector<HTMLElement>(
      `[data-snapshot-node="${CSS.escape(flatOrder[nextIdx])}"]`
    );
    el?.focus();
  }

  /** "2026-05-14 16:40" from a UNIX-seconds timestamp, or "" when absent. */
  function formatSnaptime(snaptime: number | null): string {
    if (snaptime === null) return '';
    const d = new Date(snaptime * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;
  }
</script>

{#snippet treeNodes(nodes: SnapshotItem[], nodeDepth: number)}
  {#each nodes as node (node.name)}
    {@const kids = childrenOf(node.name)}
    {@const isCurrent = node.name === currentName}
    <div
      role="treeitem"
      aria-expanded={kids.length > 0 ? true : undefined}
      aria-selected={activeName === node.name}
      aria-label={`Snapshot ${node.name}`}
      data-snapshot-node={node.name}
      tabindex={activeName === node.name ? 0 : -1}
      class="group/snap relative flex h-10 items-center rounded-sm pr-2 outline-none
             hover:bg-muted focus-visible:bg-muted focus-visible:ring-1 focus-visible:ring-ring"
      style={`padding-left: ${nodeDepth * 24 + 4}px;`}
      onkeydown={(e) => onNodeKeydown(e, node.name)}
    >
      {#if nodeDepth > 0}
        <!-- 1px --border branch guide + short horizontal connector. -->
        <span
          class="pointer-events-none absolute bottom-1/2 top-0 w-px bg-border"
          style={`left: ${(nodeDepth - 1) * 24 + 12}px;`}
          aria-hidden="true"
        ></span>
        <span
          class="pointer-events-none absolute h-px w-3 bg-border"
          style={`left: ${(nodeDepth - 1) * 24 + 12}px; top: 50%;`}
          aria-hidden="true"
        ></span>
      {/if}

      <!-- Status dot — every node carries an icon-equivalent + text (a11y floor). -->
      <span
        class="mr-2 size-2 shrink-0 rounded-full {isCurrent
          ? 'bg-primary'
          : 'bg-muted-foreground'}"
        aria-hidden="true"
      ></span>

      <span class="truncate text-[14px] text-foreground">{node.name}</span>

      {#if isCurrent}
        <Badge
          variant="outline"
          class="ml-2 border-primary/30 bg-primary/10 text-[13px] font-medium text-primary"
        >
          current
        </Badge>
      {/if}

      {#if node.description}
        <span class="ml-2 truncate text-[13px] text-muted-foreground">
          {node.description}
        </span>
      {/if}

      <span class="ml-auto flex items-center gap-3 pl-3">
        {#if formatSnaptime(node.snaptime)}
          <span class="text-[13px] font-medium tabular-nums text-muted-foreground">
            {formatSnaptime(node.snaptime)}
          </span>
        {/if}
        {#if node.vmstate}
          <span class="text-[13px] font-medium text-muted-foreground">with RAM</span>
        {/if}

        <!-- Hover/focus-revealed actions menu. -->
        <div
          class="opacity-0 transition-opacity group-hover/snap:opacity-100
                 group-focus-within/snap:opacity-100"
        >
          <DropdownMenu.Root>
            <DropdownMenu.Trigger
              class="inline-flex size-7 items-center justify-center rounded-sm
                     text-muted-foreground hover:bg-background hover:text-foreground"
              aria-label={`Actions for snapshot ${node.name}`}
            >
              <MoreHorizontal class="size-4" aria-hidden="true" />
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end">
              <DropdownMenu.Item
                disabled={isCurrent}
                onSelect={() => onRestore(node.name)}
              >
                Restore to this snapshot
              </DropdownMenu.Item>
              <DropdownMenu.Item onSelect={() => onDelete(node.name)}>
                Delete snapshot
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </div>
      </span>
    </div>

    {#if kids.length > 0}
      <div role="group">
        {@render treeNodes(kids, nodeDepth + 1)}
      </div>
    {/if}
  {/each}
{/snippet}

<div role="tree" aria-label="VM snapshots" class="flex flex-col">
  {@render treeNodes(rootNodes, 0)}
</div>
