import type { HomeGenresRow } from '@vozzify/contracts';
import { useTranslations } from 'next-intl';

import { TrackCoverPlaceholder } from '@/features/tracks/components/track-cover-placeholder';
import { Link } from '@/lib/i18n/navigation';
import { CarouselScroller } from '../components/carousel-scroller';
import { SponsoredNotice } from '../components/sponsored-notice';
import {
  CAROUSEL_HEADER_CLASS,
  CAROUSEL_TITLE_CLASS,
  GENRE_TILE_BLOCK_CLASS,
  GENRE_TILE_ITEM_CLASS,
} from '../layout-dimensions';
import { rowHeadingId } from '../row-heading-id';
import { isHomeRowTitleKey } from '../row-titles';

/**
 * A row of genre tiles: colored blocks built from the Tracks' genres, each
 * a real link to the search for that genre. The artwork placeholder keyed by
 * the genre name colors the tile, like a cover without a photo; the name
 * sits on a bottom scrim, as on the featured lists. The sponsored notice,
 * when set, sits under the title.
 */
export function GenresLayout({
  row,
}: {
  row: HomeGenresRow;
  priority: boolean;
}) {
  const t = useTranslations();
  const { key, params } = row.title;
  if (!isHomeRowTitleKey(key)) return null;
  const headingId = rowHeadingId(row.id);
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <CarouselScroller
        header={
          <div className={CAROUSEL_HEADER_CLASS}>
            <h2 id={headingId} className={CAROUSEL_TITLE_CLASS}>
              {t(key, params)}
            </h2>
            {row.sponsored ? <SponsoredNotice placement="line" /> : null}
          </div>
        }
      >
        {row.items.map((genre) => (
          <li key={genre.name} className={GENRE_TILE_ITEM_CLASS}>
            <Link
              href={`/search?q=${encodeURIComponent(genre.name)}`}
              className="group block rounded-2xl outline-none transition-transform duration-200 ease-out hover:scale-[1.02] focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.98]"
            >
              <span className={GENRE_TILE_BLOCK_CLASS}>
                <TrackCoverPlaceholder seed={genre.name} />
                <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/60 to-transparent px-3 pt-6 pb-2.5">
                  <span className="block truncate font-semibold text-sm text-white">
                    {genre.name}
                  </span>
                </span>
              </span>
            </Link>
          </li>
        ))}
      </CarouselScroller>
    </section>
  );
}
