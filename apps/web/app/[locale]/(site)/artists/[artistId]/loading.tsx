import { ArtistHeaderSkeleton } from '@/features/artists/components/artist-header-skeleton';
import { ArtistTrackTableSkeleton } from '@/features/artists/components/artist-track-table-skeleton';

/** Same-dimension header plus track-table skeletons while loading. */
export default function ArtistLoading() {
  return (
    <div className="flex flex-col gap-8">
      <ArtistHeaderSkeleton />
      <ArtistTrackTableSkeleton />
    </div>
  );
}
