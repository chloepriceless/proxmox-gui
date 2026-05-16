<!--
  LxcTemplateStep — the "Template" step for the Plain-LXC path (Plan 04-11).

  Contract: 04-UI-SPEC §"Step model" (LXC-05). The plain-LXC path's "Source"
  step. Heading: "Pick a container template".
    - A `Select` of the cluster's `content=vztmpl` templates (the vztmpl
      volume id is the `ostemplate` value the create body carries).
    - `Next` is blocked until a template is chosen — the parent gates the
      footer Next on `validateLxcStep('source', 'plain-lxc', formData)`.
    - The community-script path's "Source" step embeds `CatalogBrowser`
      instead — wired in `/create/+page.svelte`.

  Data: the template list has no dedicated API in this phase, so it is passed
  in as a prop (`templates`). When the list is empty (no API wired / a load
  error) the step falls back to a free-text `Input` so the wizard is never
  hard-blocked — the volume id is still validated server-side on create.
-->
<script lang="ts">
  import * as Select from '$lib/components/ui/select';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import HelpTooltip from '$lib/components/shared/HelpTooltip.svelte';

  /** One pickable vztmpl template. */
  export type LxcTemplateOption = {
    /** The vztmpl volume id (e.g. `local:vztmpl/ubuntu-24.04.tar.zst`) — the `ostemplate`. */
    volid: string;
    /** A human label (the OS name / release), falls back to the volid. */
    label?: string;
  };

  type Props = {
    /** The cluster's `content=vztmpl` templates. Empty → the free-text fallback. */
    templates?: LxcTemplateOption[];
    /** The currently-chosen vztmpl volume id (the wizard's `formData.ostemplate`). */
    value?: string;
    /** Fired when the user picks / types a template. */
    onChange?: (ostemplate: string) => void;
  };

  let { templates = [], value = '', onChange }: Props = $props();

  /** The label shown on the Select trigger for the current value. */
  const triggerLabel = $derived(
    templates.find((t) => t.volid === value)?.label ??
      (value || 'Select a container template')
  );
</script>

<section class="flex flex-col gap-4">
  <header class="flex flex-col gap-1">
    <h2 class="text-[18px] font-semibold leading-tight tracking-tight">
      Pick a container template
    </h2>
    <p class="text-muted-foreground text-[14px]">
      The LXC is created from a system template (a <code>vztmpl</code> volume on
      the cluster).
    </p>
  </header>

  <div class="flex flex-col gap-1.5">
    <div class="flex items-center gap-1.5">
      <Label for="lxc-template">Container template</Label>
      <HelpTooltip
        label="Container template"
        text="A vztmpl is a pre-built root filesystem for an LXC — e.g. Ubuntu, Debian, or Alpine. The container is created from this template."
      />
    </div>

    {#if templates.length > 0}
      <Select.Root
        type="single"
        value={value || undefined}
        onValueChange={(v) => onChange?.(v ?? '')}
      >
        <Select.Trigger id="lxc-template" class="w-full">
          {triggerLabel}
        </Select.Trigger>
        <Select.Content>
          {#each templates as tmpl (tmpl.volid)}
            <Select.Item value={tmpl.volid}>{tmpl.label ?? tmpl.volid}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
    {:else}
      <!-- Fallback — no template list available; accept the volume id directly. -->
      <Input
        id="lxc-template"
        placeholder="local:vztmpl/ubuntu-24.04-standard_24.04-1_amd64.tar.zst"
        {value}
        oninput={(e) => onChange?.(e.currentTarget.value)}
      />
      <p class="text-muted-foreground text-[13px]">
        Enter the template's storage volume id.
      </p>
    {/if}
  </div>
</section>
