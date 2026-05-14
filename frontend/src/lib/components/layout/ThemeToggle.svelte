<!--
  ThemeToggle — tri-state DropdownMenu (Light / Dark / System).

  Contract: UI-SPEC §Theme Toggle Contract.
    - Trigger button is h-9 w-9 and shows whichever icon matches the user's
      *selected* mode (not the effective mode — Monitor is the marker that
      "I'm letting the OS decide", which is information the user wants).
    - Selecting a mode calls theme.setMode() which persists + applies.
-->
<script lang="ts">
  import { theme } from '$lib/stores/theme.svelte';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import { Button } from '$lib/components/ui/button';
  import Sun from '@lucide/svelte/icons/sun';
  import Moon from '@lucide/svelte/icons/moon';
  import Monitor from '@lucide/svelte/icons/monitor';
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      <Button {...props} variant="ghost" size="icon" aria-label="Toggle theme">
        {#if theme.mode === 'light'}
          <Sun aria-hidden="true" />
        {:else if theme.mode === 'dark'}
          <Moon aria-hidden="true" />
        {:else}
          <Monitor aria-hidden="true" />
        {/if}
      </Button>
    {/snippet}
  </DropdownMenu.Trigger>
  <DropdownMenu.Content align="end">
    <DropdownMenu.Item onSelect={() => theme.setMode('light')}>
      <Sun aria-hidden="true" />
      Light
    </DropdownMenu.Item>
    <DropdownMenu.Item onSelect={() => theme.setMode('dark')}>
      <Moon aria-hidden="true" />
      Dark
    </DropdownMenu.Item>
    <DropdownMenu.Item onSelect={() => theme.setMode('system')}>
      <Monitor aria-hidden="true" />
      System
    </DropdownMenu.Item>
  </DropdownMenu.Content>
</DropdownMenu.Root>
