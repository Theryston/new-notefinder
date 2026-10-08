import type { CatalogTracksPage } from '@notefinder/contracts';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

import { ArtistTracksGrid } from './artist-tracks-grid';

/**
 * The track-grid section of the artist page: scopes the `artists`
 * messages to the client grid (the `(site)` layout only provides
 * `errors` and `header`, deliberately, to keep the RSC payload small),
 * like the search page does for its namespace.
 */
export async function ArtistTracksSection({
  artistId,
  initialPage,
}: {
  artistId: string;
  initialPage?: CatalogTracksPage;
}) {
  const { errors, artists } = await getMessages();

  return (
    <NextIntlClientProvider messages={{ errors, artists }}>
      <ArtistTracksGrid artistId={artistId} initialPage={initialPage} />
    </NextIntlClientProvider>
  );
}
