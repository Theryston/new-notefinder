type CoverPalette = { c1: string; c2: string; c3: string };

/**
 * Curated artwork stand-ins for a Recording without cover art. Each entry
 * pairs a dark, a vivid and a light tone sampled from the reference grid,
 * so the search results look like real artwork instead of a generic icon.
 * These hex values stand in for the Recording's own photo, like the real
 * covers they replace, not for UI chrome (which still uses tokens only).
 */
const COVER_PALETTES: CoverPalette[] = [
  { c1: '#5E1606', c2: '#C9431E', c3: '#F4B98A' },
  { c1: '#0F3D3E', c2: '#2D8A8E', c3: '#D9ECC7' },
  { c1: '#2B3245', c2: '#6B7A90', c3: '#CBD5E1' },
  { c1: '#5A3E0A', c2: '#C99A2B', c3: '#F6E3B4' },
  { c1: '#3B0A4A', c2: '#9D4EDD', c3: '#F1A6E0' },
  { c1: '#0A3D62', c2: '#1E90D6', c3: '#A9D6F5' },
];

export type CoverPlaceholder = CoverPalette & { variant: number };

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

/**
 * Deterministic placeholder for a Recording without cover art: the same
 * seed always returns the same curated palette plus shape variant (0-5),
 * so the grid never looks broken and never shifts between renders.
 */
export function coverPlaceholder(seed: string): CoverPlaceholder {
  const index = hashSeed(seed) % COVER_PALETTES.length;
  const palette = COVER_PALETTES[index];
  if (!palette) throw new Error('Missing cover palette');
  return { variant: index, ...palette };
}

/**
 * Legacy gradient fallback, kept for existing callers until the new
 * placeholder component fully replaces it.
 */
export function coverFallbackStyle(seed: string): { background: string } {
  const { c2, c3 } = coverPlaceholder(seed);
  return { background: `linear-gradient(135deg, ${c2}, ${c3})` };
}
