import type { Artist } from '@notefinder/contracts';
import { getTranslations } from 'next-intl/server';

import { artistInitials } from '../artist-initials';

/**
 * Minimal Spotify-style artist header: an initials visual (the catalog
 * holds no artist images), the name, the processed-track count and the
 * genres. Stacked on phones, side by side from `sm`.
 */
export async function ArtistHeader({ artist }: { artist: Artist }) {
  const t = await getTranslations('artists');

  return (
    <section
      aria-labelledby="artist-name"
      className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6"
    >
      <div
        aria-hidden="true"
        className="flex size-24 shrink-0 items-center justify-center rounded-full bg-muted font-bold text-2xl text-muted-foreground sm:size-32 md:size-40 md:text-3xl"
      >
        {artistInitials(artist.name)}
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <h1
          id="artist-name"
          className="truncate font-extrabold text-4xl tracking-tight"
        >
          {artist.name}
        </h1>
        <p className="font-medium text-muted-foreground text-sm">
          {t('header.trackCount', { count: artist.trackCount })}
        </p>
        {artist.genres.length > 0 ? (
          <ul
            aria-label={t('header.genresLabel')}
            className="flex flex-wrap gap-2"
          >
            {artist.genres.map((genre) => (
              <li
                key={genre}
                className="rounded-full bg-muted px-3 py-1 font-medium text-muted-foreground text-xs"
              >
                {genre}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
