import type { Metadata } from 'next';

import { trackCollectionMetadata } from '@/features/tracks/collection-metadata';
import { TrackCollectionPage } from '@/features/tracks/components/track-collection-page';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/artists/[artistId]'>): Promise<Metadata> {
  const { artistId } = await params;
  return trackCollectionMetadata({ kind: 'artist', id: artistId });
}

export default function ArtistPage({
  params,
}: PageProps<'/[locale]/artists/[artistId]'>) {
  return (
    <TrackCollectionPage
      collection={params.then(({ artistId }) => ({
        kind: 'artist',
        id: artistId,
      }))}
    />
  );
}
