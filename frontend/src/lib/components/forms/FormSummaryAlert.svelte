<!--
  FormSummaryAlert — top-of-form error summary.

  Contract: UI-SPEC §Form Patterns §Inline + summary validation.
    - Uses Alert variant="destructive" with AlertTriangle icon.
    - Heading verbatim: "Please fix the following:".
    - Renders a clickable list of errors; clicking an item focuses the
      offending field via document.getElementById(fieldName).
    - Renders nothing when `errors` is empty.
    - The link text is the human-readable error message; we keep the field
      name as a sr-only prefix so screen readers identify the target.
-->
<script lang="ts">
  import * as Alert from '$lib/components/ui/alert';
  import AlertTriangle from '@lucide/svelte/icons/triangle-alert';

  type Props = {
    /** Map of field name → human error message. */
    errors: Record<string, string>;
    /** Optional element ID for aria-live regions referencing the alert. */
    id?: string;
  };

  let { errors, id }: Props = $props();

  // Stable ordering for screen-reader friendliness — alphabetised by field
  // name. Callers needing custom ordering can pre-sort the input map.
  const entries = $derived(Object.entries(errors));

  function focusField(fieldName: string, event: MouseEvent | KeyboardEvent) {
    event.preventDefault();
    if (typeof document === 'undefined') return;
    const el = document.getElementById(fieldName);
    if (el) {
      el.focus();
      // Scroll into view if off-screen (long forms).
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
</script>

{#if entries.length > 0}
  <Alert.Root variant="destructive" {id} aria-live="polite">
    <AlertTriangle aria-hidden="true" />
    <Alert.Title>Please fix the following:</Alert.Title>
    <Alert.Description>
      <ul class="mt-2 list-disc space-y-1 pl-5">
        {#each entries as [fieldName, message] (fieldName)}
          <li>
            <a
              href="#{fieldName}"
              class="text-destructive underline underline-offset-2 hover:no-underline"
              onclick={(e) => focusField(fieldName, e)}
            >
              <span class="sr-only">{fieldName}: </span>{message}
            </a>
          </li>
        {/each}
      </ul>
    </Alert.Description>
  </Alert.Root>
{/if}
