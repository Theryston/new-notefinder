import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { NoticeMessage } from '@/components/notice-message';
import { ProfileBanner } from '@/features/users/components/profile-banner';
import { ProfileFavoritesSection } from '@/features/users/components/profile-favorites-section';
import { ProfileSummary } from '@/features/users/components/profile-summary';
import { ProfileSummarySkeleton } from '@/features/users/components/profile-summary-skeleton';
import {
  PracticeHistorySection,
  PracticeHistorySkeleton,
} from '@/features/users/practice-history/components/practice-history-section';
import {
  getPublicProfile,
  getPublicSectionVisibility,
} from '@/features/users/queries';
import { localeAlternates } from '@/lib/i18n/metadata';
import type { Locale } from '@/lib/i18n/routing';
import { queryStringOf } from '@/lib/query-string';
import { needsLowercaseRedirect } from '@/lib/user-profile-route';

type UserRouteParams = { locale: Locale; username: string };

type UserRouteSearchParams = Record<string, string | string[] | undefined>;

/** Every section shown, for when the flags cannot be read. */
const SHOWN_EVERYWHERE = {
  summary: true,
  practiceHistory: true,
  favorites: true,
};

// The 308 and the 404 depend on the requested username, so this route never
// prerenders statically. The proxy decides both before anything streams (a
// redirect or `notFound` issued from postponed page content would degrade to
// a 200); the page repeats the same outcomes as a fallback.
export const instant = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<UserRouteParams>;
}): Promise<Metadata> {
  const { locale, username } = await params;
  const t = await getTranslations('publicProfile');
  const profile = await getPublicProfile(username).catch(() => undefined);
  if (!profile) {
    // Nothing to describe: the layout's site metadata applies. The API being
    // unreachable is the same here, and the page says so in its body.
    return {};
  }
  return {
    title: t('metaTitle', { name: profile.name }),
    description: t('metaDescription', { name: profile.name }),
    alternates: localeAlternates(locale, `/users/${profile.username}`),
  };
}

/**
 * Thin Profile route: reads the username, then renders the banner of the
 * cached public Profile. A mixed-case username permanently redirects (308)
 * to the lowercase path, keeping the query; an unknown one is a real 404.
 * When the API cannot be reached, the page stays up and says so in place
 * rather than failing the whole document.
 */
export default async function UserProfilePage({
  params,
  searchParams,
}: {
  params: Promise<UserRouteParams>;
  searchParams: Promise<UserRouteSearchParams>;
}) {
  const { locale, username } = await params;
  if (needsLowercaseRedirect(username)) {
    permanentRedirect(
      `/${locale}/users/${encodeURIComponent(username.toLowerCase())}${queryStringOf(await searchParams)}`,
    );
  }
  const profile = await getPublicProfile(username).catch(() => undefined);
  if (profile === undefined) {
    return <ProfileUnavailable />;
  }
  if (!profile) {
    notFound();
  }
  // A hidden section gets no placeholder, so a visitor never sees a skeleton
  // that then disappears. If the flags cannot be read, every section is laid
  // out as shown.
  const shown =
    (await getPublicSectionVisibility(profile.username).catch(() => null)) ??
    SHOWN_EVERYWHERE;
  return (
    <div className="flex flex-col gap-8">
      <ProfileBanner profile={profile} />
      <Suspense fallback={null}>
        <ProfileFavoritesSection username={profile.username} />
      </Suspense>
      <Suspense fallback={shown.summary ? <ProfileSummarySkeleton /> : null}>
        <ProfileSummary username={profile.username} />
      </Suspense>
      <Suspense
        fallback={shown.practiceHistory ? <PracticeHistorySkeleton /> : null}
      >
        <PracticeHistorySection username={profile.username} />
      </Suspense>
    </div>
  );
}

async function ProfileUnavailable() {
  const t = await getTranslations('publicProfile');
  return (
    <NoticeMessage
      title={t('unavailable.title')}
      description={t('unavailable.description')}
    />
  );
}
