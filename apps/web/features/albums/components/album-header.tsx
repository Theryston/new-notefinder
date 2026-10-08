import type { Album } from '@notefinder/contracts';
import { getTranslations } from 'next-intl/server';

import {
  EntityGenreChips,
  entityBannerClass,
  entityBannerRowClass,
  entityTitleClass,
} from '@/components/entity-header';

import { splitAlbumArtists } from '../album-artists';
import { albumInfoItems } from '../album-info';
import { AlbumArtistLinks } from './album-artist-links';
import { AlbumCover } from './album-cover';

/**
 * The album banner: the artist banner layout with a square cover in place
 * of the initials circle, the oversized title, the credited artists (the
 * first three linked, the rest behind "and N more"), the info line (type,
 * secondary types, year, with unknown parts left out) and the genre chips.
 * Info only, no playback actions.
 */
export async function AlbumHeader({ album }: { album: Album }) {
  const t = await getTranslations('albums');
  const { visible, hidden } = splitAlbumArtists(album.artists);
  const info = albumInfoItems(album, {
    primaryType: (key) => t(`types.primary.${key}`),
    secondaryType: (key) => t(`types.secondary.${key}`),
  });

  return (
    <section aria-labelledby="album-title" className={entityBannerClass}>
      <div className={entityBannerRowClass}>
        <AlbumCover albumId={album.id} coverArtUrl={album.coverArtUrl} />
        <div className="flex min-w-0 flex-col gap-2">
          <h1 id="album-title" className={entityTitleClass}>
            {album.title}
          </h1>
          {album.artists.length > 0 ? (
            <AlbumArtistLinks
              visible={visible}
              hidden={hidden}
              artistsLabel={t('header.artistsLabel')}
              artistSeparator={t('header.artistSeparator')}
              moreLabel={t('header.artists.more', { count: hidden.length })}
              lessLabel={t('header.artists.less')}
            />
          ) : null}
          {info.length > 0 ? (
            <p className="font-medium text-muted-foreground text-sm">
              {info.join(t('header.separator'))}
            </p>
          ) : null}
          <EntityGenreChips
            genres={album.genres}
            label={t('header.genresLabel')}
          />
        </div>
      </div>
    </section>
  );
}
