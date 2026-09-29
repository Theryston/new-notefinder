import type { Thumbnail } from '@notefinder/contracts';

/**
 * The smallest cover at least `minWidth` wide (sharp on the rendered size
 * without downloading more than needed), else the widest one there is.
 * Covers without a known width are the last resort.
 */
export function pickThumbnail(
  thumbnails: Thumbnail[],
  minWidth: number,
): Thumbnail | undefined {
  const sized = thumbnails
    .filter((thumbnail) => thumbnail.width !== null)
    .sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
  return (
    sized.find((thumbnail) => (thumbnail.width ?? 0) >= minWidth) ??
    sized.at(-1) ??
    thumbnails[0]
  );
}
