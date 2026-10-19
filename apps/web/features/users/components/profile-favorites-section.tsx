import type { UserFavoritesPage } from '@notefinder/contracts';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';

import { trackGridMessages } from '@/features/tracks/components/track-grid-messages';
import { getSectionVisibilityLabels } from '@/features/users/section-visibility-labels';
import { viewerOwnsProfile } from '@/features/users/viewer-owns-profile';

import { getOwnFavoritesPage, getPublicFavoritesPage } from '../queries';
import { OwnerSectionUnavailable } from './owner-section-unavailable';
import { ProfileFavoritesGrid } from './profile-favorites-grid';
import {
  ProfileSectionScope,
  SectionVisibilityToggle,
} from './profile-section-scope';

/**
 * The favorite songs section of a Profile. A Profile with no favorites shows
 * no section at all: the banner already says who the Profile belongs to, so an
 * empty grid adds nothing. A section the owner hid is left out for visitors and
 * shown dimmed to the owner; a read the owner cannot get is said so. A failed
 * read is logged, so an outage is visible, and the page stays up.
 */
export async function ProfileFavoritesSection({
  username,
}: {
  username: string;
}) {
  const visitorPage = await getPublicFavoritesPage(username).catch(
    (error: unknown) => {
      logFailure(username, error);
      return undefined;
    },
  );
  if (visitorPage) {
    return visitorPage.items.length > 0 ? (
      <FavoritesGrid
        username={username}
        initialPage={visitorPage}
        hiddenForVisitors={false}
      />
    ) : null;
  }
  // Hidden for visitors, no such User, or unreadable: only the owner can still
  // see it, and only the owner's answer decides what they are shown.
  if (!(await viewerOwnsProfile(username))) {
    return null;
  }
  const ownPage = await getOwnFavoritesPage(username).catch(
    (error: unknown) => {
      logFailure(username, error);
      return undefined;
    },
  );
  if (ownPage === undefined) {
    return <FavoritesUnavailable username={username} />;
  }
  if (!ownPage || ownPage.items.length === 0) {
    return null;
  }
  return (
    <FavoritesGrid
      username={username}
      initialPage={ownPage}
      hiddenForVisitors={visitorPage === null}
    />
  );
}

async function FavoritesUnavailable({ username }: { username: string }) {
  const t = await getTranslations('publicProfile.favorites');
  return (
    <OwnerSectionUnavailable
      username={username}
      section="favorites"
      title={t('title')}
    />
  );
}

async function FavoritesGrid({
  username,
  initialPage,
  hiddenForVisitors,
}: {
  username: string;
  initialPage: UserFavoritesPage;
  hiddenForVisitors: boolean;
}) {
  const { tracks } = await getMessages();
  const [t, labels] = await Promise.all([
    getTranslations('publicProfile.favorites'),
    getSectionVisibilityLabels(),
  ]);

  return (
    <ProfileSectionScope
      username={username}
      section="favorites"
      hiddenForVisitors={hiddenForVisitors}
      labels={labels}
    >
      <NextIntlClientProvider messages={{ tracks }}>
        <ProfileFavoritesGrid
          username={username}
          initialPage={initialPage}
          messages={trackGridMessages(t)}
          headerAction={<SectionVisibilityToggle />}
        />
      </NextIntlClientProvider>
    </ProfileSectionScope>
  );
}

function logFailure(username: string, error: unknown): void {
  console.error(
    `Favorite songs of ${username} could not be read: ${messageOf(error)}`,
  );
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
