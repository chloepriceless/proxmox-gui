<!--
  CloudInitYamlPane — the read-only YAML render pane of the two-pane Cloud-Init
  editor (Plan 04-13, D-10, VM-06).

  Contract: 04-UI-SPEC §"Cloud-Init two-pane editor".
    - A styled, scrollable `<pre>` block (Mono 13/400 inside a `--muted`
      surface, `whitespace-pre`) rendering a `YamlLine[]`.
    - Each line carries `injected` — a PVE-derived default the user did not
      explicitly set. An injected line is rendered DIMMED
      (`text-muted-foreground`) with an inline `Badge variant="outline"`
      "PVE default" at line-end, so the user sees every set-vs-injected value
      (D-10 — this is what satisfies VM-06's "full visibility into what gets
      set").
    - Hand-rolled, the SnapshotTree read-only-render discipline — NO
      code-editor / syntax-highlighter library (monaco / codemirror / prismjs
      / shiki are forbidden by the UI-SPEC Design System; the checker + the
      cloudinit-editor.test.ts no-import assertion validate their absence).

  T-04-13-03 (XSS via the YAML preview): `YamlLine.text` is rendered as a
  Svelte text binding ({line.text}) — auto-escaped, never `{@html}`. The lines
  come from the backend `render_cloudinit_preview`, not raw user markup.
-->
<script lang="ts">
  import { Badge } from '$lib/components/ui/badge';
  import type { YamlLine } from '$lib/api/types';

  type Props = {
    /** The rendered `#cloud-config` lines from `cloudinitPreview`. */
    lines?: YamlLine[];
    /** True while a preview round-trip is in flight. */
    loading?: boolean;
  };

  let { lines = [], loading = false }: Props = $props();
</script>

<div class="flex h-full flex-col gap-1.5">
  <div class="flex items-center justify-between">
    <span class="text-foreground text-[13px] font-medium">Effective cloud-config</span>
    {#if loading}
      <span class="text-muted-foreground text-[12px]">Updating…</span>
    {/if}
  </div>
  <pre
    class="bg-muted text-foreground h-full max-h-[28rem] overflow-auto whitespace-pre rounded-md p-3 font-mono text-[13px] leading-relaxed"
    aria-label="Effective cloud-config preview"
    role="region">{#if lines.length === 0}<span
        class="text-muted-foreground">{loading
          ? 'Rendering the cloud-config…'
          : 'Fill in the form to see the effective cloud-config.'}</span
      >{:else}{#each lines as line, i (i)}<span
          class="block {line.injected ? 'text-muted-foreground' : ''}"
          >{line.text}{#if line.injected}<Badge
              variant="outline"
              class="ml-2 align-middle text-[11px] font-normal">PVE default</Badge
            >{/if}</span
        >{/each}{/if}</pre>
  <p class="text-muted-foreground text-[12px]">
    Dimmed lines marked
    <Badge variant="outline" class="text-[11px] font-normal">PVE default</Badge>
    are Proxmox-injected defaults you did not set.
  </p>
</div>
