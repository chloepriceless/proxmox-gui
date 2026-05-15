<!--
  Sparkline — hand-rolled SVG line chart.

  Contract: UI-SPEC §Overview tab contents §Metrics card.

    - NO external chart library (recharts, uplot, chart.js, etc.)
    - Renders a <polyline> path in a scalable SVG viewBox
    - 80px tall by default, 100% width via CSS
    - Uses currentColor (text-primary via CSS class) for stroke
    - Shows "No data" placeholder when points array is empty
    - Top/bottom corner labels show what the Y-axis range represents
      (the `format(max)` reference — "what is 100%")
    - Pointer hover reveals a guide line, marker dot and a value tooltip

  Verified by must_haves.artifacts entry: "Hand-rolled SVG sparkline (no chart
  library)" + `contains: '<svg'`.
-->
<script lang="ts">
  import { formatClock } from '$lib/utils/format';

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
    /** Extra Tailwind classes applied to the wrapper. */
    class?: string;
    /** aria-label for the <svg> role="img" element. */
    label?: string;
    /** Formats a Y-value for the axis labels + hover tooltip. Default: String. */
    format?: (v: number) => string;
    /** Optional UNIX-second timestamps, one per point — shown in the tooltip. */
    times?: number[];
  };

  let {
    points,
    max,
    height = 80,
    class: className = '',
    label = 'sparkline',
    format = (v: number) => String(v),
    times = []
  }: Props = $props();

  // Fixed viewBox width; CSS scales to 100%. Enough resolution for 50 pts.
  const W = 200;
  const H = $derived(height);
  const yMax = $derived(Math.max(max, 1));

  // Per-point geometry: fx is a 0..1 fraction of the width, fy a 0..1
  // fraction of the height (0 = top of the chart, 1 = baseline).
  const coords = $derived(
    points.map((v, i) => ({
      fx: i / Math.max(points.length - 1, 1),
      fy: 1 - Math.max(0, Math.min(1, v / yMax))
    }))
  );

  const polyline = $derived(
    coords.map((c) => `${(c.fx * W).toFixed(2)},${(c.fy * H).toFixed(2)}`).join(' ')
  );

  // Hover state — index into points, or null when not hovering.
  let hoverIdx = $state<number | null>(null);

  function onMove(e: PointerEvent) {
    if (points.length === 0) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    const i = Math.round(frac * (points.length - 1));
    hoverIdx = Math.max(0, Math.min(points.length - 1, i));
  }

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  const hover = $derived(
    hoverIdx === null
      ? null
      : {
          leftPct: coords[hoverIdx].fx * 100,
          topPct: coords[hoverIdx].fy * 100,
          value: format(points[hoverIdx]),
          time: times[hoverIdx] ? formatClock(times[hoverIdx]) : ''
        }
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
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="relative {className}"
    style={`height: ${H}px;`}
    onpointermove={onMove}
    onpointerleave={() => (hoverIdx = null)}
  >
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
      class="block h-full w-full text-primary"
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

    <!-- Y-axis reference labels: top = chart max ("100%"), bottom = zero. -->
    <span
      class="pointer-events-none absolute right-0 top-0 rounded bg-background/70 px-1
             text-[10px] leading-tight text-muted-foreground"
    >
      {format(yMax)}
    </span>
    <span
      class="pointer-events-none absolute bottom-0 right-0 rounded bg-background/70 px-1
             text-[10px] leading-tight text-muted-foreground"
    >
      {format(0)}
    </span>

    {#if hover}
      <!-- vertical guide -->
      <div
        class="pointer-events-none absolute bottom-0 top-0 w-px bg-border"
        style={`left: ${hover.leftPct}%;`}
      ></div>
      <!-- marker dot -->
      <div
        class="pointer-events-none absolute size-1.5 -translate-x-1/2 -translate-y-1/2
               rounded-full bg-primary ring-2 ring-background"
        style={`left: ${hover.leftPct}%; top: ${hover.topPct}%;`}
      ></div>
      <!-- value tooltip -->
      <div
        class="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full
               whitespace-nowrap rounded border border-border bg-popover px-1.5 py-0.5
               text-[11px] text-popover-foreground shadow-sm"
        style={`left: ${clamp(hover.leftPct, 10, 90)}%; top: ${Math.max(hover.topPct - 4, 6)}%;`}
      >
        <span class="font-medium">{hover.value}</span>
        {#if hover.time}<span class="text-muted-foreground"> · {hover.time}</span>{/if}
      </div>
    {/if}
  </div>
{/if}
