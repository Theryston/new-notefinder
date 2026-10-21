import type { HomeCarouselRow } from '@notefinder/contracts';

import { RowCarouselShell, RowTrackCards } from './row-carousel-shell';

/**
 * A row of Tracks as a horizontal carousel: CSS scroll snapping (no carousel
 * library), each card a real link with its Vocal-range chip when the feed
 * carries one. The sponsored notice, when set, sits under the title.
 */
export function CarouselLayout({
  row,
  priority,
}: {
  row: HomeCarouselRow;
  priority: boolean;
}) {
  return (
    <RowCarouselShell
      rowId={row.id}
      title={row.title}
      sponsored={row.sponsored}
    >
      <RowTrackCards items={row.items} priority={priority} />
    </RowCarouselShell>
  );
}
