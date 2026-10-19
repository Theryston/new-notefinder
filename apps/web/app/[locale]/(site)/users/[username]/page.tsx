import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { ProfileBanner } from '@/features/users/components/profile-banner';
import { getPublicProfile } from '@/features/users/queries';
import { localeAlternates } from '@/lib/i18n/metadata';
import type { Locale } from '@/lib/i18n/routing';
import { queryStringOf } from '@/lib/query-string';
import { needsLowercaseRedirect } from '@/lib/user-profile-route';

type UserRouteParams = { locale: Locale; username: string };

type UserRouteSearchParams = Record<string, string | string[] | undefined>;

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
  const profile = await getPublicProfile(username);
  if (!profile) {
    // No metadata of their own; the proxy answers unknown usernames first.
    return {};
  }
  const t = await getTranslations('publicProfile');
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
  const profile = await getPublicProfile(username);
  if (!profile) {
    notFound();
  }
  return (
    <div className="flex flex-col gap-8">
      <ProfileBanner profile={profile} />
    </div>
  );
}
