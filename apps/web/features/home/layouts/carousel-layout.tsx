import type { HomeCarouselRow } from '@notefinder/contracts';
import { useTranslations } from 'next-intl';

import { TrackCard } from '@/features/tracks/components/track-card';
import { creditText } from '@/lib/track-credit';
import { SponsoredNotice } from '../components/sponsored-notice';
import {
  CAROUSEL_COVER_SIZES,
  CAROUSEL_HEADER_CLASS,
  CAROUSEL_ITEM_CLASS,
  CAROUSEL_TITLE_CLASS,
  CAROUSEL_TRACK_CLASS,
} from '../layout-dimensions';
import { rowHeadingId } from '../row-heading-id';
import { isHomeRowTitleKey } from '../row-titles';

/** Covers of the first row that load eagerly: the ones on the first screen. */
const EAGER_COVERS = 4;

/**
 * A row of Tracks as a horizontal carousel: CSS scroll snapping (no carousel
 * library), each card a real link. The title is a translation key from the
 * feed; a key this web doesn't know hides the row rather than showing a raw
 * key. The sponsored notice, when set, sits under the title.
 */
export function CarouselLayout({
  row,
  priority,
}: {
  row: HomeCarouselRow;
  priority: boolean;
}) {
  const t = useTranslations();
  const { key, params } = row.title;
  if (!isHomeRowTitleKey(key)) return null;
  const headingId = rowHeadingId(row.id);
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <div className={CAROUSEL_HEADER_CLASS}>
        <h2 id={headingId} className={CAROUSEL_TITLE_CLASS}>
          {t(key, params)}
        </h2>
        {row.sponsored ? <SponsoredNotice placement="line" /> : null}
      </div>
      <ul className={CAROUSEL_TRACK_CLASS}>
        {row.items.map((track, index) => (
          <li key={track.id} className={CAROUSEL_ITEM_CLASS}>
            <TrackCard
              trackId={track.id}
              title={track.title}
              subtitle={creditText(track.artistCredit)}
              coverArtUrl={track.coverUrl}
              placeholderSeed={track.id}
              coverSizes={CAROUSEL_COVER_SIZES}
              coverPriority={priority && index < EAGER_COVERS}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
