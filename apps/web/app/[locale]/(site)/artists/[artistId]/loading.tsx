import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

import { ArtistHeaderSkeleton } from '@/features/artists/components/artist-header-skeleton';
import { ArtistTracksGridSkeleton } from '@/features/artists/components/artist-tracks-grid';

/**
 * Same-dimension header plus track-grid skeletons while loading. Scopes
 * the `artists` messages to the client skeleton (the `(site)` layout only
 * provides `errors` and `header`), like the tracks section does.
 */
export default async function ArtistLoading() {
  const { errors, artists } = await getMessages();

  return (
    <div className="flex flex-col gap-8">
      <ArtistHeaderSkeleton />
      <NextIntlClientProvider messages={{ errors, artists }}>
        <ArtistTracksGridSkeleton />
      </NextIntlClientProvider>
    </div>
  );
}
