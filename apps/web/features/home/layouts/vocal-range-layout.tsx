import type { HomeVocalRangeRow } from '@vozzify/contracts';

import { RowCarouselShell, RowTrackCards } from './row-carousel-shell';

/**
 * A by-voice row: the carousel shell, with each card's Vocal range drawn as
 * a bar over its cover and named in its chip. The bar is decorative (hidden
 * from assistive tech); the chip carries the same range as text. The
 * sponsored notice, when set, sits under the title like on a standard row.
 */
export function VocalRangeLayout({
  row,
  priority,
}: {
  row: HomeVocalRangeRow;
  priority: boolean;
}) {
  return (
    <RowCarouselShell
      rowId={row.id}
      title={row.title}
      sponsored={row.sponsored}
    >
      <RowTrackCards items={row.items} priority={priority} rangeBar />
    </RowCarouselShell>
  );
}
