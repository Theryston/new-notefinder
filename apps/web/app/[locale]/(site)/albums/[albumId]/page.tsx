import type { Metadata } from 'next';

import { trackCollectionMetadata } from '@/features/tracks/collection-metadata';
import { TrackCollectionPage } from '@/features/tracks/components/track-collection-page';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/albums/[albumId]'>): Promise<Metadata> {
  const { albumId } = await params;
  return trackCollectionMetadata({ kind: 'album', id: albumId });
}

export default function AlbumPage({
  params,
}: PageProps<'/[locale]/albums/[albumId]'>) {
  return (
    <TrackCollectionPage
      collection={params.then(({ albumId }) => ({
        kind: 'album',
        id: albumId,
      }))}
    />
  );
}
