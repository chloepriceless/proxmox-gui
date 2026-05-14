<!--
  Sparkline — hand-rolled SVG line chart.

  Contract: UI-SPEC §Overview tab contents §Metrics card.

    - NO external chart library (recharts, uplot, chart.js, etc.)
    - Renders a <polyline> path in a scalable SVG viewBox
    - 80px tall by default, 100% width via CSS
    - Uses currentColor (text-primary via CSS class) for stroke
    - Shows "No data" placeholder when points array is empty

  Verified by must_haves.artifacts entry: "Hand-rolled SVG sparkline (no chart
  library)" + `contains: '<svg'`.
-->
<script lang="ts">
  type Props = {
    /** Y-axis values — one per sample. Typically 50 points from RRD endpoint. */
    points: number[];
    /**
     * Y-axis maximum for normalisation (e.g. maxmem for RAM, 1 for CPU %).
     * Must be > 0; clamped to 1 if 0/negative.
     */
    max: number;
    /** Chart height in pixels. Default: 80. */
    height?: number;
    /** Extra Tailwind classes applied to the <svg> or wrapper <div>. */
    class?: string;
    /** aria-label for the <svg> role="img" element. */
    label?: string;
  };

  let { points, max, height = 80, class: className = '', label = 'sparkline' }: Props = $props();

  // Fixed viewBox width; CSS scales to 100%. Enough resolution for 50 pts.
  const W = 200;
  const H = $derived(height);
  const yMax = $derived(Math.max(max, 1));

  const polyline = $derived(
    points.length === 0
      ? ''
      : points
          .map((v, i) => {
            const x = (i / Math.max(points.length - 1, 1)) * W;
            const y = H - Math.max(0, Math.min(1, v / yMax)) * H;
            return `${x.toFixed(2)},${y.toFixed(2)}`;
          })
          .join(' ')
  );
</script>

{#if points.length === 0}
  <div
    class="flex items-center justify-center text-muted-foreground text-[13px] {className}"
    style={`height: ${H}px;`}
  >
    No data
  </div>
{:else}
  <svg
    viewBox={`0 0 ${W} ${H}`}
    preserveAspectRatio="none"
    role="img"
    aria-label={label}
    class="block w-full text-primary {className}"
    style={`height: ${H}px;`}
  >
    <polyline
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linejoin="round"
      stroke-linecap="round"
      points={polyline}
    />
  </svg>
{/if}
