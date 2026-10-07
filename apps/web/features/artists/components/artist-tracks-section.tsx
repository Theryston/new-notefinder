import type { ArtistTracksPage } from '@notefinder/contracts';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

import { ArtistTrackTable } from './artist-track-table';

/**
 * The track-table section of the artist page: scopes the `artists`
 * messages to the client table (the `(site)` layout only provides
 * `errors` and `header`, deliberately, to keep the RSC payload small),
 * like the search page does for its namespace.
 */
export async function ArtistTracksSection({
  artistId,
  initialPage,
}: {
  artistId: string;
  initialPage?: ArtistTracksPage;
}) {
  const { errors, artists } = await getMessages();

  return (
    <NextIntlClientProvider messages={{ errors, artists }}>
      <ArtistTrackTable artistId={artistId} initialPage={initialPage} />
    </NextIntlClientProvider>
  );
}
