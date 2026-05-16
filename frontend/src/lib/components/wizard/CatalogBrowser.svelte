<!--
  CatalogBrowser — the community-scripts catalog browser (Plan 04-11).

  Contract: 04-UI-SPEC §"Community-scripts catalog browser" (D-05/06/07,
  LXC-01..04).
    - Two views via a "Curated / Full catalog" toggle:
        * Curated (default, LXC-01): the upstream `featured` + admin-override
          shortlist — a compact grid of 96px cards.
        * Full catalog (LXC-02): the unfiltered catalog with a `command`
          search box and `badge`-style category filter chips.
    - Catalog card (96px): icon + name (Body 14/600) + category `badge`s + a
      one-line description (Body 14/400 muted).
    - Clicking a card selects it and reveals the `ScriptDetailPanel` — the
      LXC-04 mandatory pre-deploy disclosure.
    - A no-search-match renders the shared `EmptyState`.

  Data: calls `api.catalog.listCatalog({clusterId, view, q, category})`. The
  curated view fetches `view=curated`; the full view fetches `view=full` once
  and then filters client-side (search + category) via `lxc-wizard.ts` so
  typing does not round-trip. Auto-escaped Svelte text bindings render the
  catalog name/description — never `{@html}` (T-04-11-04).
-->
<script lang="ts">
  import * as Command from '$lib/components/ui/command';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import EmptyState from '$lib/components/shared/EmptyState.svelte';
  import ScriptDetailPanel from './ScriptDetailPanel.svelte';
  import { api } from '$lib/api/client';
  import type { CatalogEntry } from '$lib/api/types';
  import {
    catalogCategories,
    curatedEntries,
    filterCatalog,
    type CatalogView
  } from './lxc-wizard';
  import SearchX from '@lucide/svelte/icons/search-x';
  import Rocket from '@lucide/svelte/icons/rocket';
  import Tag from '@lucide/svelte/icons/tag';

  type Props = {
    /** The cluster the catalog is read from. */
    clusterId: number;
    /** The currently-selected script slug (the wizard's `formData.script_slug`). */
    selectedSlug?: string | null;
    /** Fired when the user picks a script — the parent persists the slug + options. */
    onSelect?: (entry: CatalogEntry, optionDefaults: Record<string, string>) => void;
  };

  let { clusterId, selectedSlug = null, onSelect }: Props = $props();

  /** Curated (default) vs. the full searchable catalog. */
  let view = $state<CatalogView>('curated');
  /** The full catalog — fetched once when the user switches to the full view. */
  let entries = $state<CatalogEntry[]>([]);
  /** The search query (bound to the `command` input). */
  let query = $state('');
  /** The active category filter chip, or `''` for "all". */
  let activeCategory = $state('');
  let loading = $state(false);
  let loadError = $state(false);
  /** The entry whose `ScriptDetailPanel` is open. */
  let detailEntry = $state<CatalogEntry | null>(null);

  /** Fetch the catalog for the current view. */
  async function loadCatalog(): Promise<void> {
    loading = true;
    loadError = false;
    try {
      const res = await api.catalog.listCatalog({ clusterId, view });
      entries = res.entries;
    } catch {
      loadError = true;
      entries = [];
    } finally {
      loading = false;
    }
  }

  // Initial load + a reload whenever the view toggles.
  $effect(() => {
    void view;
    void loadCatalog();
  });

  /** The curated shortlist (LXC-01) — featured entries only. */
  const curated = $derived(curatedEntries(entries));

  /** The category chips available in the full catalog (LXC-02). */
  const categories = $derived(catalogCategories(entries));

  /** The entries shown for the active view, with search + category applied. */
  const shown = $derived(
    view === 'curated'
      ? curated
      : filterCatalog(entries, { q: query, category: activeCategory })
  );

  /** Whether the full-catalog search/filter produced no match. */
  const noMatch = $derived(
    view === 'full' && !loading && !loadError && shown.length === 0 && entries.length > 0
  );

  /** Switch view — resets the search + category filter. */
  function switchView(next: CatalogView): void {
    view = next;
    query = '';
    activeCategory = '';
  }

  /** Toggle a category chip (clicking the active chip clears the filter). */
  function toggleCategory(cat: string): void {
    activeCategory = activeCategory === cat ? '' : cat;
  }

  /** Open the LXC-04 detail panel for a card. */
  function openDetail(entry: CatalogEntry): void {
    detailEntry = entry;
  }
</script>

<section class="flex flex-col gap-4">
  <!-- Heading + the curated/full toggle. -->
  <header class="flex flex-col gap-3">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 class="text-[18px] font-semibold leading-tight tracking-tight">
        Choose a community script
      </h2>
      <div
        class="bg-muted inline-flex items-center gap-1 rounded-md p-1"
        role="tablist"
        aria-label="Catalog view"
      >
        <Button
          variant={view === 'curated' ? 'secondary' : 'ghost'}
          size="sm"
          role="tab"
          aria-selected={view === 'curated'}
          onclick={() => switchView('curated')}
        >
          Curated
        </Button>
        <Button
          variant={view === 'full' ? 'secondary' : 'ghost'}
          size="sm"
          role="tab"
          aria-selected={view === 'full'}
          onclick={() => switchView('full')}
        >
          Full catalog
        </Button>
      </div>
    </div>

    {#if view === 'full'}
      <!-- The `command` search box (LXC-02). -->
      <Command.Root shouldFilter={false} class="bg-transparent p-0">
        <Command.Input placeholder="Search scripts…" bind:value={query} />
      </Command.Root>

      {#if categories.length > 0}
        <!-- Category filter chips. -->
        <div class="flex flex-wrap items-center gap-2">
          {#each categories as cat (cat)}
            <button
              type="button"
              onclick={() => toggleCategory(cat)}
              aria-pressed={activeCategory === cat}
              class="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Badge
                variant={activeCategory === cat ? 'default' : 'outline'}
                class="cursor-pointer gap-1"
              >
                <Tag class="size-3" aria-hidden="true" />
                {cat}
              </Badge>
            </button>
          {/each}
        </div>
      {/if}
    {/if}
  </header>

  <!-- The card grid / states. -->
  {#if loading}
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-hidden="true">
      {#each [0, 1, 2, 3] as i (i)}
        <div class="bg-muted h-24 animate-pulse rounded-md"></div>
      {/each}
    </div>
  {:else if loadError}
    <p class="text-[14px] text-destructive">Couldn't load the catalog. Try again.</p>
  {:else if noMatch}
    <EmptyState
      icon={SearchX}
      heading="No scripts match your search"
      body="Try a different keyword or clear the category filters."
    />
  {:else}
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {#each shown as entry (entry.slug)}
        <!-- A 96px catalog card — selecting it opens the detail panel. -->
        <button
          type="button"
          onclick={() => openDetail(entry)}
          class="flex h-24 w-full flex-col gap-1 rounded-md border p-3 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring {entry.slug ===
          selectedSlug
            ? 'border-primary ring-1 ring-primary'
            : 'border-border'}"
          aria-label={`Open ${entry.name}`}
        >
          <div class="flex items-center gap-2">
            <Rocket class="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
            <span class="text-[14px] font-semibold leading-tight">{entry.name}</span>
            {#each entry.categories as cat (cat)}
              <Badge variant="outline" class="text-[11px]">{cat}</Badge>
            {/each}
          </div>
          <p class="text-muted-foreground line-clamp-2 text-[14px]">
            {entry.description}
          </p>
        </button>
      {/each}
    </div>
  {/if}
</section>

<!-- The LXC-04 mandatory pre-deploy disclosure panel. -->
{#if detailEntry}
  <ScriptDetailPanel
    {clusterId}
    entry={detailEntry}
    open={detailEntry !== null}
    onOpenChange={(v) => {
      if (!v) detailEntry = null;
    }}
    onConfirm={(e, optionDefaults) => {
      detailEntry = null;
      onSelect?.(e, optionDefaults);
    }}
  />
{/if}
