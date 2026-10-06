import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { ArtistHeader } from '@/features/artists/components/artist-header';
import { getArtistResult } from '@/features/artists/queries';
import { localeAlternates } from '@/lib/i18n/metadata';
import type { Locale } from '@/lib/i18n/routing';

type ArtistRouteParams = { locale: Locale; artistId: string };

type ArtistRouteSearchParams = Record<string, string | string[] | undefined>;

// The header, the 308 and the 404 all depend on the requested ID (and the
// redirect keeps its query), so this route never prerenders statically:
// the proxy decides 308s and 404s before anything streams (a redirect or
// `notFound` issued from postponed page content would degrade to a 200),
// and the page repeats the same outcome handling as a fallback. Data still
// caches through `getArtistResult`, so repeat visits stay instant; the
// skeleton below covers the header while it streams.
export const instant = false;

/** `?a=1&b=2` for the current query, or `''` when there is none. */
function queryStringOf(searchParams: ArtistRouteSearchParams): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else if (value !== undefined) {
      params.set(key, value);
    }
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<ArtistRouteParams>;
  searchParams: Promise<ArtistRouteSearchParams>;
}): Promise<Metadata> {
  const { locale, artistId } = await params;
  const result = await getArtistResult(artistId);
  if (result.status !== 'found') {
    // No metadata of their own; the proxy normally answers moved/missing
    // before the page renders (see above), this is only its fallback.
    if (result.status === 'moved') {
      permanentRedirect(
        `/${locale}/artists/${result.newId}${queryStringOf(await searchParams)}`,
      );
    }
    notFound();
  }
  const t = await getTranslations('artists');
  return {
    title: t('metaTitle', { name: result.artist.name }),
    description: t('metaDescription', {
      name: result.artist.name,
      count: result.artist.trackCount,
    }),
    alternates: localeAlternates(locale, `/artists/${result.artist.id}`),
  };
}

/**
 * Thin artist route: reads the ID, fetches the cached header outcome and
 * renders it. A legacy ID permanently redirects (308) to the new ID with
 * the query kept; an unknown ID is a real 404. Both are normally decided
 * by the proxy before this renders (see above); the checks below are its
 * fallback.
 */
export default async function ArtistRoutePage({
  params,
  searchParams,
}: {
  params: Promise<ArtistRouteParams>;
  searchParams: Promise<ArtistRouteSearchParams>;
}) {
  const { locale, artistId } = await params;
  const query = await searchParams;
  const result = await getArtistResult(artistId);
  if (result.status === 'moved') {
    permanentRedirect(
      `/${locale}/artists/${result.newId}${queryStringOf(query)}`,
    );
  }
  if (result.status === 'missing') {
    notFound();
  }
  return <ArtistHeader artist={result.artist} />;
}
