import type { HomeRankedRow } from '@notefinder/contracts';
import { useLocale, useTranslations } from 'next-intl';

import { TrackCoverArt } from '@/features/tracks/components/track-cover-art';
import { noteName } from '@/lib/music-notes';
import { creditText } from '@/lib/track-credit';
import { SponsoredNotice } from '../components/sponsored-notice';
import {
  RANKED_COVER_SIZES,
  RANKED_HEADER_CLASS,
  RANKED_ITEM_CLASS,
  RANKED_ITEM_SUBTITLE_CLASS,
  RANKED_ITEM_TITLE_CLASS,
  RANKED_LIST_CLASS,
  RANKED_RANK_CLASS,
  RANKED_TITLE_CLASS,
} from '../layout-dimensions';
import { rowHeadingId } from '../row-heading-id';
import { isHomeRowTitleKey } from '../row-titles';

/** Covers of the first rows that load eagerly: the ones on the first screen. */
const EAGER_COVERS = 4;

/**
 * A ranked Top 10: an ordered list with a big number beside each cover. The
 * numbers come from the items' order (best first), so the list itself is the
 * ranking; screen readers already announce each item's position, so the
 * visual number stays silent. The sponsored notice, when set, sits under the
 * title like on every other row.
 */
export function RankedLayout({
  row,
  priority,
}: {
  row: HomeRankedRow;
  priority: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const { key, params } = row.title;
  if (!isHomeRowTitleKey(key)) return null;
  const headingId = rowHeadingId(row.id);
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <div className={RANKED_HEADER_CLASS}>
        <h2 id={headingId} className={RANKED_TITLE_CLASS}>
          {t(key, params)}
        </h2>
        {row.sponsored ? <SponsoredNotice placement="line" /> : null}
      </div>
      <ol className={RANKED_LIST_CLASS}>
        {row.items.map((track, index) => (
          <li key={track.id}>
            <a
              href={`/${locale}/tracks/${track.id}`}
              className={RANKED_ITEM_CLASS}
              data-home-item-id={track.id}
              data-home-item-position={index}
            >
              <span aria-hidden="true" className={RANKED_RANK_CLASS}>
                {index + 1}
              </span>
              <span className="relative size-12 shrink-0 overflow-hidden rounded-md">
                <TrackCoverArt
                  coverArtUrl={track.coverUrl}
                  placeholderSeed={track.id}
                  sizes={RANKED_COVER_SIZES}
                  priority={priority && index < EAGER_COVERS}
                />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className={RANKED_ITEM_TITLE_CLASS}>{track.title}</span>
                <span className={RANKED_ITEM_SUBTITLE_CLASS}>
                  {creditText(track.artistCredit)}
                  {track.vocalRange
                    ? ` · ${noteName(track.vocalRange.lowest)}–${noteName(track.vocalRange.highest)}`
                    : null}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}
