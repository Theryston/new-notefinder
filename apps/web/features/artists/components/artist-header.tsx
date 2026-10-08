import type { Artist } from '@notefinder/contracts';
import { getTranslations } from 'next-intl/server';

import {
  EntityGenreChips,
  entityBannerClass,
  entityBannerRowClass,
  entityTitleClass,
} from '@/components/entity-header';

import { artistInitials } from '../artist-initials';

/**
 * Spotify-style artist banner: a gradient surface with a large initials
 * visual (the catalog holds no artist images, so no photo is ever fetched),
 * the oversized name, the processed-track count and the genre chips. Info
 * only, no playback actions. The banner itself is shared with the album
 * header (see `components/entity-header.tsx`).
 */
export async function ArtistHeader({ artist }: { artist: Artist }) {
  const t = await getTranslations('artists');

  return (
    <section aria-labelledby="artist-name" className={entityBannerClass}>
      <div className={entityBannerRowClass}>
        <div
          aria-hidden="true"
          className="flex size-24 shrink-0 items-center justify-center rounded-full bg-background font-bold text-2xl text-muted-foreground shadow-sm sm:size-32 md:size-40 md:text-3xl"
        >
          {artistInitials(artist.name)}
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <h1 id="artist-name" className={entityTitleClass}>
            {artist.name}
          </h1>
          <p className="font-medium text-muted-foreground text-sm">
            {t('header.trackCount', { count: artist.trackCount })}
          </p>
          <EntityGenreChips
            genres={artist.genres}
            label={t('header.genresLabel')}
          />
        </div>
      </div>
    </section>
  );
}
