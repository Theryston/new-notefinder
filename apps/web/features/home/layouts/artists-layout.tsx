import type { HomeArtistsRow } from '@notefinder/contracts';
import { useTranslations } from 'next-intl';

import { ArtistAvatar } from '@/features/artists/components/artist-avatar';
import { Link } from '@/lib/i18n/navigation';
import { SponsoredNotice } from '../components/sponsored-notice';
import {
  ARTIST_ROW_ITEM_CLASS,
  CAROUSEL_HEADER_CLASS,
  CAROUSEL_TITLE_CLASS,
  CAROUSEL_TRACK_CLASS,
} from '../layout-dimensions';
import { rowHeadingId } from '../row-heading-id';
import { isHomeRowTitleKey } from '../row-titles';

/**
 * A row of featured artists: circular initials avatars (the catalog holds no
 * artist images) with the name under each, in the same snap track as the
 * carousels. Each artist is a real link to its page. The sponsored notice,
 * when set, sits under the title.
 */
export function ArtistsLayout({
  row,
}: {
  row: HomeArtistsRow;
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
        {row.items.map((artist) => (
          <li key={artist.id} className={ARTIST_ROW_ITEM_CLASS}>
            <Link
              href={`/artists/${artist.id}`}
              className="group flex flex-col items-center gap-2 rounded-2xl p-1 outline-none transition-colors duration-150 ease-out hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <ArtistAvatar
                name={artist.name}
                className="size-20 text-xl md:size-24 md:text-2xl"
              />
              <span className="w-full truncate text-center font-medium text-sm">
                {artist.name}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
