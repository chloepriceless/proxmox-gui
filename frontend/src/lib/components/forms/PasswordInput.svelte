<!--
  PasswordInput — reusable password input with Eye / EyeOff visibility toggle.

  Contract: UI-SPEC §Login + §Form Patterns.
    - Wraps the shadcn-svelte Input primitive.
    - Toggle button positioned absolute-right inside the input wrapper.
    - Visibility state is component-local (`revealed`) — never persisted.
    - The button is `type="button"` so ENTER inside the input still submits
      the surrounding form (instead of toggling visibility).
-->
<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';
  import { Input } from '$lib/components/ui/input';
  import Eye from '@lucide/svelte/icons/eye';
  import EyeOff from '@lucide/svelte/icons/eye-off';

  // Wrapper-level props (the outer <div> swallows `class`); everything else
  // is forwarded to the underlying Input. We intentionally pick a small set
  // of common HTMLInputAttributes rather than spreading the full type, which
  // pulls in image-specific keys (`width`, `height`, etc.) that conflict
  // with the union shape shadcn-svelte's Input enforces for `type="file"`.
  type Props = {
    value?: string;
    name?: string;
    id?: string;
    placeholder?: string;
    disabled?: boolean;
    autocomplete?: HTMLInputAttributes['autocomplete'];
    required?: boolean;
    'aria-invalid'?: HTMLInputAttributes['aria-invalid'];
    'aria-describedby'?: string;
    class?: string;
  };

  let {
    value = $bindable(''),
    name,
    id,
    placeholder,
    disabled = false,
    autocomplete,
    required = false,
    'aria-invalid': ariaInvalid,
    'aria-describedby': ariaDescribedby,
    class: className = ''
  }: Props = $props();

  let revealed = $state(false);
</script>

<div class="relative {className}">
  <Input
    type={revealed ? 'text' : 'password'}
    {name}
    {id}
    {placeholder}
    {disabled}
    {autocomplete}
    {required}
    bind:value
    class="pr-10"
    aria-invalid={ariaInvalid}
    aria-describedby={ariaDescribedby}
  />
  <button
    type="button"
    class="text-muted-foreground hover:text-foreground absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded transition-colors disabled:opacity-50"
    aria-label={revealed ? 'Hide password' : 'Show password'}
    aria-pressed={revealed}
    onclick={() => (revealed = !revealed)}
    {disabled}
    tabindex={-1}
  >
    {#if revealed}
      <EyeOff class="size-4" aria-hidden="true" />
    {:else}
      <Eye class="size-4" aria-hidden="true" />
    {/if}
  </button>
</div>
