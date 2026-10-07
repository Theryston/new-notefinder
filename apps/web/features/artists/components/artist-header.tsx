import type { Artist } from '@notefinder/contracts';
import { getTranslations } from 'next-intl/server';

import { artistInitials } from '../artist-initials';

/**
 * Spotify-style artist banner: a gradient surface with a large initials
 * visual (the catalog holds no artist images, so no photo is ever fetched),
 * the oversized name, the processed-track count and the genre chips. Info
 * only, no playback actions. Stacked on phones, side by side from `sm`,
 * with wrapping names so small screens never overflow horizontally.
 */
export async function ArtistHeader({ artist }: { artist: Artist }) {
  const t = await getTranslations('artists');

  return (
    <section
      aria-labelledby="artist-name"
      className="overflow-hidden rounded-2xl bg-gradient-to-b from-muted via-muted/50 to-background px-4 py-6 sm:px-6 sm:py-8 md:px-8 md:py-10"
    >
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
        <div
          aria-hidden="true"
          className="flex size-24 shrink-0 items-center justify-center rounded-full bg-background font-bold text-2xl text-muted-foreground shadow-sm sm:size-32 md:size-40 md:text-3xl"
        >
          {artistInitials(artist.name)}
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <h1
            id="artist-name"
            className="min-w-0 break-words font-extrabold text-5xl tracking-tighter md:text-6xl"
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
                  className="rounded-full bg-background px-3 py-1 font-medium text-muted-foreground text-xs shadow-xs"
                >
                  {genre}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </section>
  );
}
