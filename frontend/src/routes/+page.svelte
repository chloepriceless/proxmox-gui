<!--
  Root route — never rendered.

  `+page.server.ts` always `throw redirect(303, '/inventory')`, so this
  component is unreachable. It exists only because a SvelteKit page route
  requires a `+page.svelte`. Keep it empty.
-->
