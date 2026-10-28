import type { HomeAlbumsRow } from '@vozzify/contracts';
import { useTranslations } from 'next-intl';

import { TrackCoverArt } from '@/features/tracks/components/track-cover-art';
import { Link } from '@/lib/i18n/navigation';
import { CarouselScroller } from '../components/carousel-scroller';
import { SponsoredNotice } from '../components/sponsored-notice';
import {
  ALBUM_ROW_ITEM_CLASS,
  CAROUSEL_COVER_SIZES,
  CAROUSEL_HEADER_CLASS,
  CAROUSEL_TITLE_CLASS,
} from '../layout-dimensions';
import { rowHeadingId } from '../row-heading-id';
import { isHomeRowTitleKey } from '../row-titles';

/** Covers of the first row that load eagerly: the ones on the first screen. */
const EAGER_COVERS = 4;

/**
 * A row of featured albums: each cover stacked over two sheets peeking out
 * at its bottom-right corner, with the title and the release year under it,
 * in the same snap track as the carousels. Each album is a real link to its
 * page. The sponsored notice, when set, sits under the title.
 */
export function AlbumsLayout({
  row,
  priority,
}: {
  row: HomeAlbumsRow;
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
        {row.items.map((album, index) => (
          <li key={album.id} className={ALBUM_ROW_ITEM_CLASS}>
            <Link
              href={`/albums/${album.id}`}
              className="group flex flex-col gap-1.5 rounded-2xl p-2 outline-none transition-colors duration-150 ease-out hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="relative block aspect-square">
                <span
                  aria-hidden="true"
                  className="absolute inset-0 translate-x-2 translate-y-2 rounded-xl bg-accent"
                />
                <span
                  aria-hidden="true"
                  className="absolute inset-0 translate-x-1 translate-y-1 rounded-xl bg-muted"
                />
                <span className="absolute inset-0 overflow-hidden rounded-xl">
                  <TrackCoverArt
                    coverArtUrl={album.coverArtUrl}
                    placeholderSeed={album.id}
                    sizes={CAROUSEL_COVER_SIZES}
                    priority={priority && index < EAGER_COVERS}
                  />
                </span>
              </span>
              <span className="block truncate font-semibold text-sm">
                {album.title}
              </span>
              {album.year === null ? null : (
                <span className="block text-muted-foreground text-xs tabular-nums">
                  {album.year}
                </span>
              )}
            </Link>
          </li>
        ))}
      </CarouselScroller>
    </section>
  );
}
