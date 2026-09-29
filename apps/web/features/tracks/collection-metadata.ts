import 'server-only';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';

import { localeAlternates } from '@/lib/i18n/metadata';

import { getTrackCollection } from './queries';
import { type TrackCollection, trackCollectionPath } from './track-collection';

/**
 * Title, description and alternates of an artist's or album's page, from
 * the same cached data the page renders.
 */
export async function trackCollectionMetadata(
  collection: TrackCollection,
): Promise<Metadata> {
  const [data, t, locale] = await Promise.all([
    getTrackCollection(collection),
    getTranslations('tracks.collection'),
    getLocale(),
  ]);
  if (!data) notFound();

  const { name } = data.owner;
  const isArtist = collection.kind === 'artist';
  return {
    title: isArtist
      ? t('artistMetaTitle', { name })
      : t('albumMetaTitle', { name }),
    description: isArtist
      ? t('artistMetaDescription', { name })
      : t('albumMetaDescription', { name }),
    alternates: localeAlternates(locale, trackCollectionPath(collection)),
  };
}
