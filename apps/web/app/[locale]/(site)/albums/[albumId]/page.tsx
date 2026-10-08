import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { AlbumHeader } from '@/features/albums/components/album-header';
import { getAlbumResult } from '@/features/albums/queries';
import { localeAlternates } from '@/lib/i18n/metadata';
import type { Locale } from '@/lib/i18n/routing';
import { queryStringOf } from '@/lib/query-string';

type AlbumRouteParams = { locale: Locale; albumId: string };

type AlbumRouteSearchParams = Record<string, string | string[] | undefined>;

// The header, the 308 and the 404 all depend on the requested ID (and the
// redirect keeps its query), so this route never prerenders statically:
// the proxy decides 308s and 404s before anything streams (a redirect or
// `notFound` issued from postponed page content would degrade to a 200),
// and the page repeats the same outcome handling as a fallback. Data still
// caches through `getAlbumResult`, so repeat visits stay instant; the
// skeleton covers the header while it streams.
export const instant = false;

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<AlbumRouteParams>;
  searchParams: Promise<AlbumRouteSearchParams>;
}): Promise<Metadata> {
  const { locale, albumId } = await params;
  const result = await getAlbumResult(albumId);
  if (result.status !== 'found') {
    // No metadata of their own; the proxy normally answers moved/missing
    // before the page renders (see above), this is only its fallback.
    if (result.status === 'moved') {
      permanentRedirect(
        `/${locale}/albums/${result.newId}${queryStringOf(await searchParams)}`,
      );
    }
    notFound();
  }
  const t = await getTranslations('albums');
  return {
    title: t('metaTitle', { title: result.album.title }),
    description: t('metaDescription', { title: result.album.title }),
    alternates: localeAlternates(locale, `/albums/${result.album.id}`),
  };
}

/**
 * Thin album route: reads the ID, fetches the cached header outcome and
 * renders it. A legacy ID permanently redirects (308) to the new ID with
 * the query kept; an unknown ID is a real 404. Both are normally decided by
 * the proxy before this renders (see above); the checks below are its
 * fallback.
 */
export default async function AlbumRoutePage({
  params,
  searchParams,
}: {
  params: Promise<AlbumRouteParams>;
  searchParams: Promise<AlbumRouteSearchParams>;
}) {
  const { locale, albumId } = await params;
  const query = await searchParams;
  const result = await getAlbumResult(albumId);
  if (result.status === 'moved') {
    permanentRedirect(
      `/${locale}/albums/${result.newId}${queryStringOf(query)}`,
    );
  }
  if (result.status === 'missing') {
    notFound();
  }
  return <AlbumHeader album={result.album} />;
}
