import { Skeleton } from '@/components/ui/skeleton';
import { TrackCardSkeleton } from '@/features/tracks/components/track-card-skeleton';
import { cn } from '@/lib/utils';

import {
  CAROUSEL_HEADER_CLASS,
  CAROUSEL_ITEM_CLASS,
  CAROUSEL_TRACK_CLASS,
  HERO_BLOCK_CLASS,
} from '../layout-dimensions';

const CARDS_PER_ROW = 6;
const CARD_KEYS = Array.from({ length: CARDS_PER_ROW }, (_, index) => index);

/** One carousel's reserved space: the title line, then the cards. */
export function CarouselRowSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className={CAROUSEL_HEADER_CLASS}>
        <Skeleton className="h-7 w-56 rounded-md" />
      </div>
      <div className={CAROUSEL_TRACK_CLASS}>
        {CARD_KEYS.map((key) => (
          <div key={key} className={CAROUSEL_ITEM_CLASS}>
            <TrackCardSkeleton />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The home while its first page loads: the hero's block and two carousels, at
 * the sizes the rows take, so the rows land without a layout shift.
 */
export function HomeFeedSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-12">
      <Skeleton className={cn('rounded-2xl', HERO_BLOCK_CLASS)} />
      <CarouselRowSkeleton />
      <CarouselRowSkeleton />
    </div>
  );
}
