import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { TrackProcessingSection } from '@/features/tracks/components/track-processing-section';
import { getTrackProcessingResult } from '@/features/tracks/queries';
import { localeAlternates } from '@/lib/i18n/metadata';
import type { Locale } from '@/lib/i18n/routing';
import { queryStringOf } from '@/lib/query-string';

type TrackRouteParams = { locale: Locale; trackId: string };

type TrackRouteSearchParams = Record<string, string | string[] | undefined>;

// The state, the 308 and the 404 all depend on the requested ID and change
// while the Track processes, so this route never prerenders: the proxy decides
// 308s and 404s before anything streams, and the page repeats the same outcome
// handling as a fallback (see the album route for why).
export const instant = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<TrackRouteParams>;
}): Promise<Metadata> {
  const { locale, trackId } = await params;
  const result = await getTrackProcessingResult(trackId);
  if (result.status === 'moved') {
    permanentRedirect(`/${locale}/tracks/${result.newId}`);
  }
  if (result.status === 'missing') {
    notFound();
  }
  const { title } = result.state.track;
  const t = await getTranslations('tracks.processing');
  return {
    title: t('metaTitle', { title }),
    description: t('metaDescription', { title }),
    alternates: localeAlternates(locale, `/tracks/${result.state.track.id}`),
  };
}

/**
 * Thin Processing route: reads the ID, fetches the Track's state and renders
 * it. A legacy ID permanently redirects (308) to the new ID with the query
 * kept; an unknown ID is a real 404. Both are normally decided by the proxy
 * before this renders; the checks below are its fallback.
 */
export default async function TrackRoutePage({
  params,
  searchParams,
}: {
  params: Promise<TrackRouteParams>;
  searchParams: Promise<TrackRouteSearchParams>;
}) {
  const { locale, trackId } = await params;
  const query = await searchParams;
  const result = await getTrackProcessingResult(trackId);
  if (result.status === 'moved') {
    permanentRedirect(
      `/${locale}/tracks/${result.newId}${queryStringOf(query)}`,
    );
  }
  if (result.status === 'missing') {
    notFound();
  }
  return <TrackProcessingSection initialState={result.state} />;
}
