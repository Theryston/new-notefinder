import type { Artist } from '@notefinder/contracts';
import { cn } from 'cn';
import { getTranslations } from 'next-intl/server';

import {
  EntityGenreChips,
  entityBannerClass,
  entityBannerRowClass,
  entityInfoClass,
  entityTitleClass,
  entityVisualClass,
} from '@/components/entity-header';

import { artistInitials } from '../artist-initials';

/**
 * Artist banner, a featured block: solid orange with a large initials
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
          className={cn(
            entityVisualClass,
            'flex items-center justify-center rounded-full bg-primary-foreground font-bold text-2xl text-primary md:text-3xl',
          )}
        >
          {artistInitials(artist.name)}
        </div>
        <div className="flex min-w-0 flex-col gap-3 sm:flex-1">
          <h1 id="artist-name" className={entityTitleClass}>
            {artist.name}
          </h1>
          <p className={entityInfoClass}>
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
