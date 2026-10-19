import type { UserFavoritesPage } from '@notefinder/contracts';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';

import { trackGridMessages } from '@/features/tracks/components/track-grid-messages';
import { getSectionVisibilityLabels } from '@/features/users/section-visibility-labels';
import { viewerOwnsProfile } from '@/features/users/viewer-owns-profile';

import { getOwnFavoritesPage, getPublicFavoritesPage } from '../queries';
import { ProfileFavoritesGrid } from './profile-favorites-grid';
import {
  ProfileSectionScope,
  SectionVisibilityToggle,
} from './profile-section-scope';

/**
 * The favorite songs section of a Profile. A Profile with no favorites, or
 * whose favorites could not be read, shows no section at all: the banner
 * already says who the Profile belongs to, so an empty grid adds nothing. A
 * failed read still keeps the page up, but is logged so an outage is visible.
 * A section the owner hid is left out for visitors and shown dimmed to the
 * owner.
 */
export async function ProfileFavoritesSection({
  username,
}: {
  username: string;
}) {
  const visitorPage = await getPublicFavoritesPage(username).catch(
    (error: unknown) => {
      console.error(
        `Favorite songs of ${username} could not be read: ${messageOf(error)}`,
      );
      return undefined;
    },
  );
  if (visitorPage === undefined) {
    return null;
  }
  const hiddenOnServer = visitorPage === null;
  if (hiddenOnServer && !(await viewerOwnsProfile(username))) {
    return null;
  }
  const initialPage = hiddenOnServer
    ? await getOwnFavoritesPage(username).catch(() => null)
    : visitorPage;
  if (!initialPage || initialPage.items.length === 0) {
    return null;
  }

  return (
    <FavoritesGrid
      username={username}
      initialPage={initialPage}
      hiddenOnServer={hiddenOnServer}
    />
  );
}

async function FavoritesGrid({
  username,
  initialPage,
  hiddenOnServer,
}: {
  username: string;
  initialPage: UserFavoritesPage;
  hiddenOnServer: boolean;
}) {
  const { tracks } = await getMessages();
  const [t, labels] = await Promise.all([
    getTranslations('publicProfile.favorites'),
    getSectionVisibilityLabels(),
  ]);
  const messages = trackGridMessages(t);

  return (
    <ProfileSectionScope
      username={username}
      section="favorites"
      hiddenOnServer={hiddenOnServer}
      labels={labels}
    >
      <NextIntlClientProvider messages={{ tracks }}>
        <ProfileFavoritesGrid
          username={username}
          initialPage={initialPage}
          messages={messages}
          headerAction={<SectionVisibilityToggle />}
        />
      </NextIntlClientProvider>
    </ProfileSectionScope>
  );
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
