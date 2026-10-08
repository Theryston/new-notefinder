import type { CatalogTracksPage } from '@notefinder/contracts';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';

import { trackGridMessages } from '@/features/tracks/components/track-grid-messages';

import { ArtistTracksGrid } from './artist-tracks-grid';

/**
 * The track-grid section of the artist page. The grid's strings come from
 * the `artists.tracks` block, resolved here so the client grid gets plain
 * strings. `tracks` is the namespace of the `TrackCard` each row renders,
 * like the search page does for the same card.
 */
export async function ArtistTracksSection({
  artistId,
  initialPage,
}: {
  artistId: string;
  initialPage?: CatalogTracksPage;
}) {
  const { tracks } = await getMessages();
  const messages = trackGridMessages(await getTranslations('artists.tracks'));

  return (
    <NextIntlClientProvider messages={{ tracks }}>
      <ArtistTracksGrid
        artistId={artistId}
        initialPage={initialPage}
        messages={messages}
      />
    </NextIntlClientProvider>
  );
}
