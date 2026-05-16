<!--
  CloudInitEditor — the two-pane Cloud-Init wizard step (Plan 04-13;
  VM-05 / VM-06 / VM-07; D-09 / D-10 / D-11 / D-12 / D-14).

  Contract: 04-UI-SPEC §"Cloud-Init two-pane editor".
    - The step uses the FULL content width (the single declared exception to
      the 720px wizard width — the route opts the step into `wide`).
    - Left pane = the FORM, the sole input (D-09 — no raw / editable-YAML
      mode, no per-distro compat matrix D-14):
        * `ciuser`            — a text input + a HelpTooltip.
        * `cipassword`        — a `PasswordInput`, REQUIRED (D-11). In-memory
                                only — NEVER persisted to the wizardDraft
                                sessionStorage store (T-04-13-02).
        * SSH keys            — a multi-select pre-filled from ALL team
                                members' stored keys, grouped/labelled by
                                owner, every key deselectable (D-11).
        * the network fields  — IP mode + static address / gateway + DNS.
        * packages / runcmd   — optional one-per-line textareas.
    - Right pane = `CloudInitYamlPane` — the read-only live YAML preview.
    - On every form change the editor calls `api.provisioning.cloudinitPreview`
      and feeds the returned `lines` to the pane + the `verdict` to the
      validation blocks (D-09 — the backend is the verdict authority).
    - Validation (D-12, VM-07): `hard_errors` non-empty → a `bg-destructive/10`
      block + the wizard `Next`/CTA disabled (via `onValidityChange`) + inline
      `text-destructive` messages on the offending fields; `soft_warnings` → a
      `bg-warning/10` block, NON-blocking.

  The form data flows up through `onChange` so the /create route persists the
  cloud-init create fields (`ci_user` / `ci_password` / `ssh_public_keys`) into
  the path's formData bag — `vm-wizard.ts`'s `buildQemuRequest` carries them
  into the `createQemu` payload.

  Hand-rolled — NO code-editor / syntax-highlighter library (UI-SPEC Design
  System forbids monaco / codemirror / prismjs / shiki; the
  cloudinit-editor.test.ts no-import assertion + the checker validate it).
-->
<script lang="ts">
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Textarea } from '$lib/components/ui/textarea';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import * as Select from '$lib/components/ui/select';
  import PasswordInput from '$lib/components/forms/PasswordInput.svelte';
  import HelpTooltip from '$lib/components/shared/HelpTooltip.svelte';
  import CloudInitYamlPane from './CloudInitYamlPane.svelte';
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
  import CircleAlert from '@lucide/svelte/icons/circle-alert';
  import { api } from '$lib/api/client';
  import type { CloudInitVerdict, YamlLine } from '$lib/api/types';
  import type { VmSourceKind } from './vm-wizard';
  import {
    type CloudInitEditorForm,
    type SshKeyChoice,
    cloudInitFormDefaults,
    groupSshKeysByOwner,
    toCloudInitPreviewRequest,
    cloudInitBlocksNext,
    hardErrorFor,
    hasSoftWarnings,
    linesToList,
    listToLines,
    CLOUD_INIT_IP_MODES,
  } from './cloudinit-form';

  type Props = {
    /** The cluster the wizard provisions into — `cloudinitPreview` needs it. */
    clusterId: number;
    /** The active VM path's source kind — drives the backend ipconfig0 rule. */
    sourceKind: VmSourceKind;
    /** The SSH-key catalogue — ALL team members' keys (D-11). */
    sshKeys?: SshKeyChoice[];
    /** The current editor form value. */
    value?: CloudInitEditorForm;
    /** Fired on every form change with the full updated form. */
    onChange?: (next: CloudInitEditorForm) => void;
    /**
     * Fired with the step's block state — `true` when a hard error must
     * disable the wizard `Next`/CTA (D-12, VM-07).
     */
    onValidityChange?: (blocked: boolean) => void;
  };

  let {
    clusterId,
    sourceKind,
    sshKeys = [],
    value = cloudInitFormDefaults(),
    onChange,
    onValidityChange,
  }: Props = $props();

  /** The SSH-key catalogue grouped + labelled by owning user (D-11). */
  const sshGroups = $derived(groupSshKeysByOwner(sshKeys));

  // -- the live YAML preview + verdict ------------------------------------

  /** The rendered `#cloud-config` lines from the last preview call. */
  let lines = $state<YamlLine[]>([]);
  /** The block-hard / warn-soft verdict from the last preview call. */
  let verdict = $state<CloudInitVerdict | null>(null);
  /** True while a preview round-trip is in flight. */
  let previewing = $state(false);

  /** Whether the verdict blocks the wizard `Next`/CTA (D-12). */
  const blocksNext = $derived(cloudInitBlocksNext(verdict));

  // Surface the block signal to the wizard footer whenever it changes.
  $effect(() => {
    onValidityChange?.(blocksNext);
  });

  /**
   * Re-render the YAML pane + the verdict on every form change. The request
   * is debounced lightly so a fast typist does not fire a call per keystroke.
   */
  let previewTimer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    // Touch the form + sourceKind so this effect re-runs on any change.
    const form = value;
    const kind = sourceKind;
    const cid = clusterId;
    clearTimeout(previewTimer);
    let cancelled = false;
    previewTimer = setTimeout(() => {
      previewing = true;
      api.provisioning
        .cloudinitPreview({
          clusterId: cid,
          body: toCloudInitPreviewRequest(form, sshKeys, kind),
        })
        .then((res) => {
          if (cancelled) return;
          lines = res.lines;
          verdict = res.verdict;
        })
        .catch(() => {
          // A preview failure leaves the last good render in place; the
          // backend re-validates on create, so the editor never hard-fails.
          if (!cancelled) previewing = false;
        })
        .finally(() => {
          if (!cancelled) previewing = false;
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(previewTimer);
    };
  });

  // -- form mutation helpers ----------------------------------------------

  /** Emit a patched form. */
  function patch(part: Partial<CloudInitEditorForm>): void {
    onChange?.({ ...value, ...part });
  }

  /** Toggle one SSH key in the selection (every key is deselectable — D-11). */
  function toggleKey(id: number, checked: boolean): void {
    const next = checked
      ? [...value.sshKeyIds, id]
      : value.sshKeyIds.filter((k) => k !== id);
    patch({ sshKeyIds: next });
  }

  /** The static-IP fields only show in `static` mode. */
  const showStaticIp = $derived(value.ipMode === 'static');

  /** The IP-mode select trigger label. */
  const ipModeLabel = $derived(
    value.ipMode.charAt(0).toUpperCase() + value.ipMode.slice(1)
  );

  // -- inline hard-error messages -----------------------------------------

  const ciuserError = $derived(hardErrorFor(verdict, 'ciuser'));
  const cipasswordError = $derived(hardErrorFor(verdict, 'cipassword'));
  const ipAddressError = $derived(hardErrorFor(verdict, 'ip_address'));
  const gatewayError = $derived(hardErrorFor(verdict, 'gateway'));
  const ipconfigError = $derived(hardErrorFor(verdict, 'ipconfig0'));
  const sshkeysError = $derived(hardErrorFor(verdict, 'sshkeys'));
</script>

<section class="flex w-full flex-col gap-5">
  <header class="flex flex-col gap-1">
    <h2 class="text-[18px] font-semibold leading-tight tracking-tight">
      Cloud-Init
    </h2>
    <p class="text-muted-foreground text-[14px]">
      Set the VM's first-boot user, SSH keys and network. The preview on the
      right shows the effective cloud-config — dimmed lines are Proxmox
      defaults.
    </p>
  </header>

  <!-- The block-hard validation summary (D-12, VM-07). -->
  {#if blocksNext && verdict}
    <div class="bg-destructive/10 flex flex-col gap-1.5 rounded-md p-3">
      <div class="text-destructive flex items-center gap-1.5 text-[13px] font-medium">
        <CircleAlert class="size-4" aria-hidden="true" />
        Fix these before continuing
      </div>
      <ul class="text-destructive flex flex-col gap-0.5 text-[13px]">
        {#each verdict.hard_errors as err (err.field)}
          <li>{err.message}</li>
        {/each}
      </ul>
    </div>
  {/if}

  <!-- The warn-soft advisory summary (D-12 — non-blocking). -->
  {#if hasSoftWarnings(verdict) && verdict}
    <div class="bg-warning/10 flex flex-col gap-1.5 rounded-md p-3">
      <div class="text-warning-foreground flex items-center gap-1.5 text-[13px] font-medium">
        <TriangleAlert class="size-4" aria-hidden="true" />
        Heads up
      </div>
      <ul class="text-muted-foreground flex flex-col gap-0.5 text-[13px]">
        {#each verdict.soft_warnings as warn (warn)}
          <li>{warn}</li>
        {/each}
      </ul>
    </div>
  {/if}

  <!-- The two-pane layout — form left, the read-only YAML pane right. -->
  <div class="grid gap-6 lg:grid-cols-2">
    <!-- ====================== left pane — the form ====================== -->
    <div class="flex flex-col gap-4">
      <!-- ciuser -->
      <div class="flex flex-col gap-1.5">
        <div class="flex items-center gap-1.5">
          <Label for="ci-user">First-boot user</Label>
          <HelpTooltip
            label="First-boot user"
            text="The cloud-init user account created on first boot (the `ciuser` field). Leave blank to use the image's default account."
          />
        </div>
        <Input
          id="ci-user"
          placeholder="ubuntu"
          value={value.ciuser}
          aria-invalid={ciuserError ? 'true' : undefined}
          oninput={(e) => patch({ ciuser: e.currentTarget.value })}
        />
        {#if ciuserError}
          <p class="text-destructive text-[13px]">{ciuserError}</p>
        {/if}
      </div>

      <!-- cipassword — required (D-11) -->
      <div class="flex flex-col gap-1.5">
        <div class="flex items-center gap-1.5">
          <Label for="ci-password">Password</Label>
          <HelpTooltip
            label="Password"
            text="The first-boot password for the cloud-init user (the `cipassword` field). Required. It is sent over HTTPS and is never saved in your browser draft."
          />
        </div>
        <PasswordInput
          id="ci-password"
          placeholder="Required"
          required
          autocomplete="new-password"
          value={value.cipassword}
          aria-invalid={cipasswordError ? 'true' : undefined}
        />
        {#if cipasswordError}
          <p class="text-destructive text-[13px]">{cipasswordError}</p>
        {/if}
      </div>

      <!-- SSH keys — the team-wide multi-select (D-11) -->
      <div class="flex flex-col gap-1.5">
        <div class="flex items-center gap-1.5">
          <Label>SSH keys</Label>
          <HelpTooltip
            label="SSH keys"
            text="Pick one or more SSH public keys to authorise on the new VM. Keys from every member of the owning team are listed, grouped by owner."
          />
        </div>
        {#if sshGroups.length === 0}
          <p class="text-muted-foreground text-[13px]">
            No SSH keys are stored for this team. Add one from your account
            settings, or set a password above.
          </p>
        {:else}
          <div class="flex flex-col gap-3 rounded-md border p-3">
            {#each sshGroups as group (group.owner)}
              <fieldset class="flex flex-col gap-1.5">
                <legend class="text-muted-foreground text-[12px] font-medium">
                  {group.owner}
                </legend>
                {#each group.keys as key (key.id)}
                  <label class="flex items-center gap-2.5 text-[14px]">
                    <Checkbox
                      checked={value.sshKeyIds.includes(key.id)}
                      onCheckedChange={(c) => toggleKey(key.id, c === true)}
                    />
                    <span class="flex flex-1 flex-col">
                      <span class="text-foreground">{key.name}</span>
                    </span>
                  </label>
                {/each}
              </fieldset>
            {/each}
          </div>
        {/if}
        {#if sshkeysError}
          <p class="text-destructive text-[13px]">{sshkeysError}</p>
        {/if}
      </div>

      <!-- network — IP mode -->
      <div class="flex flex-col gap-1.5">
        <div class="flex items-center gap-1.5">
          <Label for="ci-ip-mode">IP configuration</Label>
          <HelpTooltip
            label="IP configuration"
            text="How the VM's primary NIC gets its address on first boot — DHCP, a static address, or none."
          />
        </div>
        <Select.Root
          type="single"
          value={value.ipMode}
          onValueChange={(v) => v && patch({ ipMode: v })}
        >
          <Select.Trigger id="ci-ip-mode" class="w-full">
            {ipModeLabel}
          </Select.Trigger>
          <Select.Content>
            {#each CLOUD_INIT_IP_MODES as mode (mode)}
              <Select.Item value={mode}>
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
        {#if ipconfigError}
          <p class="text-destructive text-[13px]">{ipconfigError}</p>
        {/if}
      </div>

      {#if showStaticIp}
        <div class="flex flex-col gap-1.5">
          <Label for="ci-ip-address">Static IP address (CIDR)</Label>
          <Input
            id="ci-ip-address"
            placeholder="10.0.0.5/24"
            value={value.ipAddress}
            aria-invalid={ipAddressError ? 'true' : undefined}
            oninput={(e) => patch({ ipAddress: e.currentTarget.value })}
          />
          {#if ipAddressError}
            <p class="text-destructive text-[13px]">{ipAddressError}</p>
          {/if}
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="ci-gateway">Gateway</Label>
          <Input
            id="ci-gateway"
            placeholder="10.0.0.1"
            value={value.gateway}
            aria-invalid={gatewayError ? 'true' : undefined}
            oninput={(e) => patch({ gateway: e.currentTarget.value })}
          />
          {#if gatewayError}
            <p class="text-destructive text-[13px]">{gatewayError}</p>
          {/if}
        </div>
      {/if}

      <!-- DNS servers -->
      <div class="flex flex-col gap-1.5">
        <Label for="ci-dns">DNS servers</Label>
        <Textarea
          id="ci-dns"
          placeholder="1.1.1.1&#10;8.8.8.8"
          rows={2}
          value={listToLines(value.nameservers)}
          oninput={(e) => patch({ nameservers: linesToList(e.currentTarget.value) })}
        />
        <p class="text-muted-foreground text-[12px]">One per line. Optional.</p>
      </div>

      <!-- packages -->
      <div class="flex flex-col gap-1.5">
        <Label for="ci-packages">Packages</Label>
        <Textarea
          id="ci-packages"
          placeholder="curl&#10;htop"
          rows={2}
          value={listToLines(value.packages)}
          oninput={(e) => patch({ packages: linesToList(e.currentTarget.value) })}
        />
        <p class="text-muted-foreground text-[12px]">
          Extra packages installed on first boot. One per line. Optional.
        </p>
      </div>

      <!-- runcmd -->
      <div class="flex flex-col gap-1.5">
        <Label for="ci-runcmd">First-boot commands</Label>
        <Textarea
          id="ci-runcmd"
          placeholder="systemctl enable docker"
          rows={2}
          value={listToLines(value.runcmd)}
          oninput={(e) => patch({ runcmd: linesToList(e.currentTarget.value) })}
        />
        <p class="text-muted-foreground text-[12px]">
          Commands run once on first boot. One per line. Optional.
        </p>
      </div>
    </div>

    <!-- ================= right pane — the live YAML preview ============= -->
    <div class="lg:sticky lg:top-4 lg:self-start">
      <CloudInitYamlPane {lines} loading={previewing} />
    </div>
  </div>
</section>
