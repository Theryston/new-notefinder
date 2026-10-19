import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';

import { trackGridMessages } from '@/features/tracks/components/track-grid-messages';

import { getPublicFavoritesPage } from '../queries';
import { ProfileFavoritesGrid } from './profile-favorites-grid';

/**
 * The favorite songs section of a Profile. A Profile with no favorites, or
 * whose favorites could not be read, shows no section at all: the banner
 * already says who the Profile belongs to, so an empty grid adds nothing.
 */
export async function ProfileFavoritesSection({
  username,
}: {
  username: string;
}) {
  const initialPage = await getPublicFavoritesPage(username).catch(
    () => undefined,
  );
  if (!initialPage || initialPage.items.length === 0) {
    return null;
  }

  const { tracks } = await getMessages();
  const messages = trackGridMessages(
    await getTranslations('publicProfile.favorites'),
  );

  return (
    <NextIntlClientProvider messages={{ tracks }}>
      <ProfileFavoritesGrid
        username={username}
        initialPage={initialPage}
        messages={messages}
      />
    </NextIntlClientProvider>
  );
}
