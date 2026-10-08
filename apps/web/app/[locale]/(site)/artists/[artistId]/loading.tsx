import { getTranslations } from 'next-intl/server';

import { ArtistHeaderSkeleton } from '@/features/artists/components/artist-header-skeleton';
import { TrackGridSkeleton } from '@/features/tracks/components/track-grid-feedback';

/**
 * Same-dimension header plus track-grid skeletons while loading. The grid
 * skeleton takes its one announced label from the artist's tracks block.
 */
export default async function ArtistLoading() {
  const t = await getTranslations('artists.tracks');

  return (
    <div className="flex flex-col gap-8">
      <ArtistHeaderSkeleton />
      <TrackGridSkeleton label={t('loading')} />
    </div>
  );
}
