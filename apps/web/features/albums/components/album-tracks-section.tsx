import type { AlbumTracksPage } from '@notefinder/contracts';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';

import { trackGridMessages } from '@/features/tracks/components/track-grid-messages';

import { AlbumTracksGrid } from './album-tracks-grid';

/**
 * The track-grid section of the album page. The grid's strings come from the
 * `albums.tracks` block, resolved here so the client grid gets plain strings.
 * The disc headings are formatted in the client (their placeholders depend on
 * each disc), so the provider carries just their templates. `tracks` is the
 * namespace of the `TrackCard` each row renders, like on the artist page.
 */
export async function AlbumTracksSection({
  albumId,
  initialPage,
}: {
  albumId: string;
  initialPage?: AlbumTracksPage;
}) {
  const { albums, tracks } = await getMessages();
  const messages = trackGridMessages(await getTranslations('albums.tracks'));

  return (
    <NextIntlClientProvider
      messages={{
        tracks,
        albums: { tracks: { disc: albums.tracks.disc } },
      }}
    >
      <AlbumTracksGrid
        albumId={albumId}
        initialPage={initialPage}
        messages={messages}
      />
    </NextIntlClientProvider>
  );
}
