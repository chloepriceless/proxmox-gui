<!--
  IsoLibrary — the ISO library browser (Plan 04-13, Task 2; VM-08, D-16/D-17).

  Contract: 04-UI-SPEC §"ISO library browser".
    Three regions in one panel:
      1. On-storage ISOs — a `table` of ISOs enumerated across the node's
         `content=iso`-capable storages (Pitfall 16 — the Plan-04-05 backend
         already content-filters). Columns: filename (Mono 13/400, truncate),
         size (Body 14/400 `tabular-nums`), storage. A `command` search box
         filters the list. 48px rows — the Phase-3 backup-file row density.
         Selecting a row emits the chosen ISO for the Blank+ISO source step.
         When there are no on-storage ISOs the `EmptyState` shows
         ("No ISOs on this storage yet" / a curated-or-URL hint / no CTA).
      2. Curated ISO list — a small set of common install ISOs with known
         URLs; picking one triggers `api.iso.downloadIso` (a 202 staging job).
      3. Free URL field — an `input` for any other ISO URL + a "Download ISO"
         button calling `api.iso.downloadIso`.

  D-17: the ISO URL-download is NOT admin-gated — any authenticated, team-
  scoped user. This component renders NO admin gate (the iso-library.test.ts
  no-admin-gate assertion guards it). The backend `enqueue_iso_download`
  (Plan 04-05) is the SSRF enforcement point — it rejects a non-http(s) scheme
  422 (T-04-13-04); the GUI only submits the URL, it never resolves it.

  A download enqueues a Phase-3-style 202 job that appears in the Tasks
  drawer (the jobs-store WebSocket streams its progress).
-->
<script lang="ts">
  import * as Table from '$lib/components/ui/table';
  import * as Command from '$lib/components/ui/command';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Button } from '$lib/components/ui/button';
  import { Badge } from '$lib/components/ui/badge';
  import EmptyState from '$lib/components/shared/EmptyState.svelte';
  import HelpTooltip from '$lib/components/shared/HelpTooltip.svelte';
  import Disc from '@lucide/svelte/icons/disc';
  import Download from '@lucide/svelte/icons/download';
  import FileDown from '@lucide/svelte/icons/file-down';
  import Check from '@lucide/svelte/icons/check';
  import { toast } from 'svelte-sonner';
  import { api } from '$lib/api/client';
  import { formatBytes } from '$lib/utils/format';
  import type { CloudImage, IsoItem } from '$lib/api/types';
  import {
    filterIsos,
    looksLikeHttpUrl,
    buildIsoUrlDownload,
    buildCloudImageDownload,
    isIsoLibraryEmpty,
  } from './iso-library';

  type Props = {
    /** The cluster the wizard provisions into — the iso API needs it. */
    clusterId: number;
    /** The owning team id — `listIsos` / `downloadIso` are team-scoped. */
    teamId: number;
    /** The node ISOs are enumerated on / a download stages onto. */
    node: string;
    /** The storage a free-URL / curated download stages onto. */
    storage?: string;
    /** A curated set of common install ISOs (id + name + url). */
    curated?: CloudImage[];
    /** The currently-selected on-storage ISO volume id. */
    value?: string;
    /** Per-field validation error for the ISO field — surfaced inline. */
    error?: string;
    /** Fired when the user selects an on-storage ISO. */
    onSelect?: (volid: string) => void;
  };

  let {
    clusterId,
    teamId,
    node,
    storage = 'local',
    curated = [],
    value = '',
    error,
    onSelect,
  }: Props = $props();

  // -- on-storage ISO list -------------------------------------------------

  /** The on-storage ISO list — fetched across the node's iso-capable storages. */
  let isos = $state<IsoItem[]>([]);
  /** True while the ISO list fetch is in flight. */
  let isosLoading = $state(false);
  /** An ISO-list load error, or `null`. */
  let isosError = $state<string | null>(null);
  /** The command-search query over the on-storage list. */
  let query = $state('');

  /** The on-storage list narrowed by the command-search query. */
  const filteredIsos = $derived(filterIsos(isos, query));

  /** Whether there are no ISOs on storage at all (drives the EmptyState). */
  const isoListEmpty = $derived(isIsoLibraryEmpty(isos));

  /** Fetch the on-storage ISO list whenever the cluster / node changes. */
  $effect(() => {
    const cid = clusterId;
    const tid = teamId;
    const nd = node;
    if (!nd) {
      isos = [];
      return;
    }
    let cancelled = false;
    isosLoading = true;
    api.iso
      .listIsos({ clusterId: cid, teamId: tid, node: nd })
      .then((list) => {
        if (cancelled) return;
        isos = list;
        isosError = null;
      })
      .catch(() => {
        if (!cancelled) isosError = "Couldn't load ISOs on storage.";
      })
      .finally(() => {
        if (!cancelled) isosLoading = false;
      });
    return () => {
      cancelled = true;
    };
  });

  // -- downloads -----------------------------------------------------------

  /** The free-URL download field. */
  let downloadUrl = $state('');
  /** True while a download enqueue is in flight. */
  let downloading = $state(false);

  /** Whether the free-URL "Download ISO" button is enabled. */
  const urlDownloadEnabled = $derived(
    !downloading && looksLikeHttpUrl(downloadUrl)
  );

  /** Enqueue a free-URL ISO download (D-16) — a 202 staging job. */
  async function downloadFromUrl(): Promise<void> {
    if (!urlDownloadEnabled) return;
    downloading = true;
    try {
      await api.iso.downloadIso({
        clusterId,
        body: buildIsoUrlDownload({
          teamId,
          node,
          storage,
          url: downloadUrl,
        }),
      });
      toast(`ISO download started — track progress in Tasks.`);
      downloadUrl = '';
    } catch {
      toast.error("Couldn't queue the ISO download. Check the URL and try again.");
    } finally {
      downloading = false;
    }
  }

  /** Enqueue a curated-image download (D-15/D-16) — a 202 staging job. */
  async function downloadCurated(image: CloudImage): Promise<void> {
    if (downloading) return;
    downloading = true;
    try {
      await api.iso.downloadIso({
        clusterId,
        body: buildCloudImageDownload({ teamId, node, storage, image }),
      });
      toast(`Downloading ${image.name} — track progress in Tasks.`);
    } catch {
      toast.error(`Couldn't queue the ${image.name} download. Try again.`);
    } finally {
      downloading = false;
    }
  }
</script>

<div class="flex flex-col gap-6">
  <!-- ===================== 1. on-storage ISOs ========================== -->
  <section class="flex flex-col gap-2">
    <div class="flex items-center gap-1.5">
      <Label>ISOs on storage</Label>
      <HelpTooltip
        label="ISOs on storage"
        text="Installation ISOs already present on a storage that accepts ISO content. Pick one, or download a new one below."
      />
    </div>

    {#if isosLoading}
      <p class="text-muted-foreground text-[13px]">Loading ISOs…</p>
    {:else if isosError}
      <div class="bg-destructive/10 rounded-md p-3">
        <p class="text-destructive text-[13px]">{isosError}</p>
      </div>
    {:else if isoListEmpty}
      <EmptyState
        icon={Disc}
        heading="No ISOs on this storage yet"
        body="Pick one from the curated list or paste a download URL below."
      />
    {:else}
      <Command.Root shouldFilter={false} class="bg-transparent p-0">
        <Command.Input placeholder="Search ISOs…" bind:value={query} />
      </Command.Root>
      <div class="rounded-md border">
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.Head>Filename</Table.Head>
              <Table.Head class="text-right">Size</Table.Head>
              <Table.Head>Storage</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each filteredIsos as iso (iso.volid)}
              <Table.Row
                class="h-12 cursor-pointer {value === iso.volid
                  ? 'bg-accent/50'
                  : ''}"
                onclick={() => onSelect?.(iso.volid)}
              >
                <Table.Cell class="font-mono text-[13px]">
                  <span class="flex items-center gap-2">
                    {#if value === iso.volid}
                      <Check class="text-primary size-4" aria-hidden="true" />
                    {/if}
                    <span class="truncate">{iso.filename}</span>
                  </span>
                </Table.Cell>
                <Table.Cell
                  class="text-right text-[14px]"
                  style="font-variant-numeric: tabular-nums;"
                >
                  {formatBytes(iso.size)}
                </Table.Cell>
                <Table.Cell class="text-[14px]">{iso.storage}</Table.Cell>
              </Table.Row>
            {/each}
            {#if filteredIsos.length === 0}
              <Table.Row>
                <Table.Cell colspan={3} class="text-muted-foreground text-center text-[13px]">
                  No ISOs match “{query}”.
                </Table.Cell>
              </Table.Row>
            {/if}
          </Table.Body>
        </Table.Root>
      </div>
    {/if}
    {#if error}
      <p class="text-destructive text-[13px]">{error}</p>
    {/if}
  </section>

  <!-- ====================== 2. curated ISO list ======================== -->
  {#if curated.length > 0}
    <section class="flex flex-col gap-2">
      <div class="flex items-center gap-1.5">
        <Label>Curated ISOs</Label>
        <HelpTooltip
          label="Curated ISOs"
          text="Common OS install ISOs with known download URLs. Picking one downloads it to storage if it isn't already there."
        />
      </div>
      <div class="flex flex-col gap-1.5">
        {#each curated as image (image.id)}
          <div class="flex items-center gap-3 rounded-md border px-3 py-2.5">
            <Disc class="text-muted-foreground size-4" aria-hidden="true" />
            <span class="flex flex-1 flex-col gap-0.5">
              <span class="text-foreground text-[14px] font-medium">{image.name}</span>
              <span class="text-muted-foreground text-[13px]">
                {image.os_family}
                {image.version}
              </span>
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={downloading}
              onclick={() => downloadCurated(image)}
            >
              <FileDown class="size-4" aria-hidden="true" />
              Download
            </Button>
          </div>
        {/each}
      </div>
    </section>
  {/if}

  <!-- ====================== 3. free URL download ======================= -->
  <section class="flex flex-col gap-2">
    <div class="flex items-center gap-1.5">
      <Label for="iso-url">Download by URL</Label>
      <HelpTooltip
        label="Download by URL"
        text="Paste a direct http(s) link to an ISO. Proxmox fetches it onto storage — the download runs as a background job you can track in Tasks."
      />
      <Badge variant="outline" class="text-[11px] font-normal">Any user</Badge>
    </div>
    <div class="flex items-center gap-2">
      <Input
        id="iso-url"
        type="url"
        placeholder="https://example.com/path/to/install.iso"
        bind:value={downloadUrl}
        class="flex-1"
      />
      <Button disabled={!urlDownloadEnabled} onclick={downloadFromUrl}>
        <Download class="size-4" aria-hidden="true" />
        Download ISO
      </Button>
    </div>
    <p class="text-muted-foreground text-[12px]">
      The download stages onto <span class="font-medium">{storage}</span> and
      appears in Tasks. Anyone on the team can download an ISO.
    </p>
  </section>
</div>
