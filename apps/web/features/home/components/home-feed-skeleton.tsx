import { Skeleton } from '@/components/ui/skeleton';
import { TrackCardSkeleton } from '@/features/tracks/components/track-card-skeleton';
import { cn } from '@/lib/utils';

import {
  CAROUSEL_HEADER_CLASS,
  CAROUSEL_ITEM_CLASS,
  CAROUSEL_TITLE_SKELETON_CLASS,
  CAROUSEL_TRACK_CLASS,
  HERO_BLOCK_CLASS,
  RANKED_HEADER_CLASS,
  RANKED_ITEM_CLASS,
  RANKED_LIST_CLASS,
  RANKED_META_SKELETON_CLASS,
  RANKED_RANK_CLASS,
  RANKED_TITLE_SKELETON_CLASS,
} from '../layout-dimensions';

const CARDS_PER_ROW = 6;
const CARD_KEYS = Array.from({ length: CARDS_PER_ROW }, (_, index) => index);
const RANKED_SKELETON_ROWS = 6;
const RANK_KEYS = Array.from({ length: RANKED_SKELETON_ROWS }, (_, i) => i);

/** One carousel's reserved space: the title line, then the cards. */
export function CarouselRowSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className={CAROUSEL_HEADER_CLASS}>
        <Skeleton className={CAROUSEL_TITLE_SKELETON_CLASS} />
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

/** Reserved space of a ranked row: the title line, then the numbered rows. */
export function RankedRowSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      <div className={RANKED_HEADER_CLASS}>
        <Skeleton className={RANKED_TITLE_SKELETON_CLASS} />
      </div>
      <div className={RANKED_LIST_CLASS}>
        {RANK_KEYS.map((key) => (
          <div key={key} className={RANKED_ITEM_CLASS}>
            <span className={RANKED_RANK_CLASS} />
            <Skeleton className="size-12 shrink-0 rounded-md" />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <Skeleton className={RANKED_META_SKELETON_CLASS} />
              <Skeleton className={RANKED_META_SKELETON_CLASS} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
