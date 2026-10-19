import 'server-only';

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { getSiteUrl } from '@/lib/env/client';
import { localeAlternates } from '@/lib/i18n/metadata';
import type { Locale } from '@/lib/i18n/routing';
import { creditText } from '@/lib/track-credit';
import { distinctNoteNames } from './note-summary';
import type { InitialPractice } from './practice-queries';

/** How many notes the description lists: enough to tell songs apart. */
const DESCRIBED_NOTES = 12;

type MetaMessage =
  | 'metaTitle'
  | 'metaTitleNoArtists'
  | 'metaDescription'
  | 'metaDescriptionNoNotes'
  | 'metaDescriptionNoArtists'
  | 'metaDescriptionNoArtistsNoNotes';

type MetaValues = { title: string; artists: string; notes: string };

/** The page's translator, narrowed to the metadata messages. */
export type TranslateMeta = (key: MetaMessage, values: MetaValues) => string;

function descriptionKey(hasArtists: boolean, hasNotes: boolean): MetaMessage {
  if (hasArtists) {
    return hasNotes ? 'metaDescription' : 'metaDescriptionNoNotes';
  }
  return hasNotes
    ? 'metaDescriptionNoArtists'
    : 'metaDescriptionNoArtistsNoNotes';
}

/**
 * The metadata of a completed Track, in the structure the legacy page had: a
 * title naming the song and its artists, a description listing the notes,
 * Open Graph `music.song` with the cover, the duration and the artists, and
 * the canonical URL (with the hreflang alternates).
 */
export function buildPracticeMetadata({
  locale,
  practice: { header, notes },
  siteUrl,
  translate,
}: {
  locale: Locale;
  practice: InitialPractice;
  siteUrl: URL;
  translate: TranslateMeta;
}): Metadata {
  const artists = creditText(header.artistCredit);
  const noteList = distinctNoteNames(notes?.notes ?? [], DESCRIBED_NOTES).join(
    ', ',
  );
  const values = { title: header.title, artists, notes: noteList };
  const title = translate(
    artists === '' ? 'metaTitleNoArtists' : 'metaTitle',
    values,
  );
  const description = translate(
    descriptionKey(artists !== '', noteList !== ''),
    values,
  );
  const path = `/tracks/${header.id}` as const;

  return {
    title,
    description,
    alternates: localeAlternates(locale, path),
    openGraph: {
      type: 'music.song',
      title,
      description,
      url: `/${locale}${path}`,
      images: header.coverUrl ? [{ url: header.coverUrl }] : undefined,
      duration:
        header.durationMs === null
          ? undefined
          : Math.round(header.durationMs / 1000),
      musicians: header.artistCredit.flatMap((entry) =>
        entry.artistId === null
          ? []
          : [new URL(`/${locale}/artists/${entry.artistId}`, siteUrl)],
      ),
    },
  };
}

/** The localized metadata of a completed Track's page. */
export async function practiceMetadata(
  locale: Locale,
  practice: InitialPractice,
): Promise<Metadata> {
  const t = await getTranslations('tracks.practice');
  return buildPracticeMetadata({
    locale,
    practice,
    siteUrl: getSiteUrl(),
    translate: (key, values) => t(key, values),
  });
}
