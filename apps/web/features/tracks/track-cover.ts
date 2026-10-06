/**
 * Deterministic gradient for a Recording without cover art, so the grid
 * never looks broken and the same Recording always shows the same colors.
 * A plain inline gradient (not a design token): it stands in for the
 * Recording's own artwork, like the photos it replaces.
 */
export function coverFallbackStyle(seed: string): { background: string } {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const hue = ((hash % 360) + 360) % 360;
  const nextHue = (hue + 40) % 360;
  return {
    background: `linear-gradient(135deg, hsl(${hue}, 65%, 55%), hsl(${nextHue}, 65%, 42%))`,
  };
}
