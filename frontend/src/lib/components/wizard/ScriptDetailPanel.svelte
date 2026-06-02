<!--
  ScriptDetailPanel — the LXC-04 mandatory pre-deploy disclosure (Plan 04-11).

  Contract: 04-UI-SPEC §"Script-detail panel" (LXC-04, D-07).
    - A `dialog` shown when a catalog card is clicked. BEFORE the user can
      advance to deploy it discloses:
        * the script SOURCE — `source_url` as an `ExternalLink`-icon link to
          the upstream GitHub file.
        * the COMMIT hash — Mono 13/400, `GitCommitHorizontal` icon.
        * the LAST-REVIEWED date — Label 13/500, `CalendarCheck` icon.
      All three come from the active catalog pin (T-04-11-01 — a user must see
      the source before deploying an unreviewed community-script).
    - A `bg-muted` attribution notice with the `ShieldQuestion` icon and the
      exact Copywriting-Contract copy.
    - D-07: when the script's metadata parsed, the panel renders the
      configurable-option form fields; when it could NOT, a `bg-warning/10`
      "options couldn't be read — defaults-only" notice shows and the deploy
      falls back to the script's own defaults.

  On confirm the panel hands the parent the selected entry + the D-07 option
  defaults (the wizard's Script step persists `script_slug` + `script_options`).
  The detail (commit/last-reviewed) may be enriched from
  `api.catalog.getCatalogEntry` — when that fetch fails, the entry-level
  attribution from the catalog list is used as the fallback.
-->
<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog';
  import { Button } from '$lib/components/ui/button';
  import { Badge } from '$lib/components/ui/badge';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { api } from '$lib/api/client';
  import type { CatalogEntry } from '$lib/api/types';
  import { parseScriptOptions, scriptAttribution } from './lxc-wizard';
  import ExternalLink from '@lucide/svelte/icons/external-link';
  import GitCommitHorizontal from '@lucide/svelte/icons/git-commit-horizontal';
  import CalendarCheck from '@lucide/svelte/icons/calendar-check';
  import ShieldQuestion from '@lucide/svelte/icons/shield-question';
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert';

  type Props = {
    /** The cluster the catalog entry belongs to. */
    clusterId: number;
    /** The catalog entry being disclosed. */
    entry: CatalogEntry;
    /** Whether the dialog is open. */
    open?: boolean;
    /** Open-state change handler. */
    onOpenChange?: (open: boolean) => void;
    /** Fired on confirm — hands the parent the entry + the D-07 option values. */
    onConfirm?: (entry: CatalogEntry, optionValues: Record<string, string>) => void;
  };

  let { clusterId, entry, open = false, onOpenChange, onConfirm }: Props = $props();

  /**
   * The LXC-04 attribution. It always reflects the current `entry` (a
   * `$derived` so a card re-render swaps it), and the detail fetch may refine
   * it with the authoritative per-pin envelope (held in `attributionOverride`).
   */
  let attributionOverride = $state<ReturnType<typeof scriptAttribution> | null>(null);
  const attribution = $derived(attributionOverride ?? scriptAttribution(entry));

  /** The D-07 parsed configurable options for this script. */
  const optionParse = $derived(parseScriptOptions(entry));

  /** The live D-07 option values, seeded from the parsed defaults. */
  let optionValues = $state<Record<string, string>>({});

  // Seed the option values whenever the entry changes.
  $effect(() => {
    const seeded: Record<string, string> = {};
    for (const f of optionParse.fields) seeded[f.key] = f.defaultValue;
    optionValues = seeded;
  });

  // Refine the attribution from the detail endpoint (it carries the
  // authoritative per-pin attribution envelope). A failure is non-fatal —
  // the entry-level attribution already shows the LXC-04 fields.
  $effect(() => {
    if (!open) return;
    const base = scriptAttribution(entry);
    attributionOverride = null;
    api.catalog
      .getCatalogEntry({ clusterId, slug: entry.slug })
      .then((res) => {
        attributionOverride = {
          sourceUrl: res.attribution.source_url ?? base.sourceUrl,
          commitSha: res.attribution.commit_sha ?? base.commitSha,
          lastReviewed: res.attribution.last_reviewed ?? base.lastReviewed
        };
      })
      .catch(() => {
        // entry-level attribution stands.
      });
  });

  // ---- D-23 SSH-trust preflight gate -------------------------------------
  // The community-script deploy runs INSIDE the new container via `pct exec`
  // over SSH from the GUI to the hosting node. Before letting the user proceed
  // we preflight that SSH trust (POST /clusters/{id}/verify-ssh). A failure
  // blocks ONLY this community-script path — plain OS-template LXCs and VMs
  // never open this panel — with a guided fix (the GUI pubkey one-liner). An
  // inconclusive probe (cluster unreachable) does NOT hard-block; the deploy
  // itself will surface a clear error.
  let sshState = $state<'checking' | 'ok' | 'failed' | 'unknown'>('checking');
  let sshDetail = $state('');
  let guiPubkey = $state('');
  const trustOneLiner = $derived(
    guiPubkey ? `echo '${guiPubkey}' >> /root/.ssh/authorized_keys` : ''
  );

  $effect(() => {
    if (!open) return;
    sshState = 'checking';
    sshDetail = '';
    api.clusters
      .verifySsh({ id: clusterId })
      .then((res) => {
        sshState = res.ok ? 'ok' : 'failed';
        sshDetail = res.detail ?? '';
        if (!res.ok && !guiPubkey) {
          api.clusters
            .getSshPubkey()
            .then((pk) => {
              guiPubkey = pk.public_key;
            })
            .catch(() => {
              /* one-liner just won't render */
            });
        }
      })
      .catch(() => {
        // Probe itself failed (cluster unreachable) — don't hard-block.
        sshState = 'unknown';
      });
  });

  /** Confirm — hand the parent the entry + the D-07 option values. */
  function confirm(): void {
    onConfirm?.(entry, { ...optionValues });
  }
</script>

<Dialog.Root bind:open onOpenChange={(v) => onOpenChange?.(v)}>
  <Dialog.Content class="max-w-lg">
    <Dialog.Header>
      <Dialog.Title>{entry.name}</Dialog.Title>
      <Dialog.Description>{entry.description}</Dialog.Description>
    </Dialog.Header>

    <div class="flex flex-col gap-4">
      <!-- LXC-04 disclosure — source / commit / last-reviewed. -->
      <dl class="flex flex-col gap-2 text-[13px]">
        <div class="flex items-center gap-2">
          <ExternalLink class="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
          <dt class="sr-only">Script source</dt>
          <dd>
            <a
              href={attribution.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              class="text-primary font-medium underline underline-offset-2"
            >
              View the script source on GitHub
            </a>
          </dd>
        </div>
        <div class="flex items-center gap-2">
          <GitCommitHorizontal
            class="text-muted-foreground size-4 shrink-0"
            aria-hidden="true"
          />
          <dt class="text-muted-foreground">Pinned commit</dt>
          <dd class="font-mono text-[13px]">{attribution.commitSha}</dd>
        </div>
        <div class="flex items-center gap-2">
          <CalendarCheck
            class="text-muted-foreground size-4 shrink-0"
            aria-hidden="true"
          />
          <dt class="text-muted-foreground font-medium">Last reviewed</dt>
          <dd class="text-[13px]">{attribution.lastReviewed}</dd>
        </div>
      </dl>

      <!-- Attribution notice — Copywriting-Contract copy, verbatim. -->
      <div class="bg-muted flex items-start gap-2 rounded-md p-3">
        <ShieldQuestion
          class="text-muted-foreground mt-0.5 size-4 shrink-0"
          aria-hidden="true"
        />
        <p class="text-muted-foreground text-[13px] leading-normal">
          This script comes from the community-scripts project. The GUI runs it
          inside the new container, never on the host. Review the source before
          deploying.
        </p>
      </div>

      <!-- D-07 — the configurable-option form, or the defaults-only notice. -->
      {#if optionParse.parsed}
        <div class="flex flex-col gap-3">
          <h3 class="text-[13px] font-semibold">Script options</h3>
          {#each optionParse.fields as field (field.key)}
            <div class="flex flex-col gap-1.5">
              <Label for={`script-opt-${field.key}`}>{field.label}</Label>
              <Input
                id={`script-opt-${field.key}`}
                bind:value={optionValues[field.key]}
              />
            </div>
          {/each}
        </div>
      {:else}
        <div class="bg-warning/10 flex items-start gap-2 rounded-md p-3">
          <TriangleAlert class="text-warning mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p class="text-[13px] leading-normal">
            This script's options couldn't be read — it will run with its default
            settings.
          </p>
        </div>
      {/if}

      {#if entry.categories.length > 0}
        <div class="flex flex-wrap gap-1.5">
          {#each entry.categories as cat (cat)}
            <Badge variant="outline">{cat}</Badge>
          {/each}
        </div>
      {/if}

      <!-- D-23 SSH-trust preflight gate. Blocks ONLY the community-script path
           when the GUI can't pct-exec on the node over SSH. -->
      {#if sshState === 'failed'}
        <div class="bg-destructive/10 flex flex-col gap-2 rounded-md p-3">
          <div class="flex items-start gap-2">
            <TriangleAlert class="text-destructive mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p class="text-[13px] leading-normal">
              <span class="font-medium">SSH trust isn't configured for this cluster.</span>
              Community scripts run inside the container over SSH from the GUI, so
              the GUI's key must be trusted on each node. Run this on every node
              (as root), then reopen this script:
            </p>
          </div>
          {#if trustOneLiner}
            <pre class="bg-muted overflow-x-auto rounded-md border border-border p-2 font-mono text-[12px]"><code>{trustOneLiner}</code></pre>
          {/if}
          <p class="text-muted-foreground text-[12px]">
            Plain OS-template containers and VMs don't need this — only community
            scripts. ({sshDetail})
          </p>
        </div>
      {/if}
    </div>

    <Dialog.Footer>
      <Button variant="ghost" onclick={() => onOpenChange?.(false)}>Cancel</Button>
      <Button onclick={confirm} disabled={sshState === 'failed'}>
        {sshState === 'checking' ? 'Checking SSH…' : 'Use this script'}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
