// Tag color palette — stable hash-to-hue mapping.
//
// UI-SPEC §TagPill §Color: tag colors are auto-derived from a stable FNV-1a
// 32-bit hash of the tag string. The hash maps to one of 12 palette buckets;
// each bucket is composed ONLY of existing CSS token classes — no new tokens
// introduced (Phase 1 commitment carried forward).
//
// Bucket assignment is deterministic across reloads — the same tag always
// gets the same color class, which is required for visual consistency in the
// list view where dozens of rows may show the same tag.

/** 12 palette buckets — indices must match UI-SPEC §TagPill §Palette buckets table. */
const PALETTE = [
  'bg-primary/10 border-primary/30 text-primary',       // 0
  'bg-success/10 border-success/30 text-success',       // 1
  'bg-warning/10 border-warning/30 text-warning',       // 2
  'bg-destructive/10 border-destructive/30 text-destructive', // 3
  'bg-muted border-border text-foreground',             // 4
  'bg-primary/5 border-primary/20 text-primary',        // 5
  'bg-success/5 border-success/20 text-success',        // 6
  'bg-warning/5 border-warning/20 text-warning',        // 7
  'bg-destructive/5 border-destructive/20 text-destructive', // 8
  'bg-muted/80 border-border text-muted-foreground',    // 9
  'bg-primary/15 border-primary/40 text-primary',       // 10
  'bg-muted/60 border-border text-foreground',          // 11
];

/** Number of palette buckets — exported for tests. */
export const TAG_PALETTE_SIZE = PALETTE.length;

/**
 * Return the Tailwind class string for a given tag.
 *
 * Uses FNV-1a 32-bit hash (stable, deterministic, no external dep).
 * The result is always one of the 12 entries in PALETTE.
 */
export function paletteFor(tag: string): string {
  // FNV-1a 32-bit hash — http://www.isthe.com/chongo/tech/comp/fnv/
  let h = 2166136261;
  for (let i = 0; i < tag.length; i++) {
    h ^= tag.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return PALETTE[h % PALETTE.length];
}
