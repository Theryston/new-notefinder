import { SEARCH_MAX_TOTAL_HITS } from '@notefinder/contracts';
import type { IndexSettings } from '../integrations/meilisearch/meilisearch-index.js';

/**
 * What the worker puts in Meilisearch for one Recording that has Lyrics, and
 * what a lyrics-scope search looks at. One text field, so a line of either
 * form matches: the plain Lyrics when known, else the synced ones without
 * their timestamps. Only the MBID is read back: what a result shows comes
 * from Postgres, like for the metadata index.
 */
export type LyricsDocument = {
  mbid: string;
  lyrics: string;
};

/** The index of Lyrics; its primary key is the Recording's MBID. */
export const LYRICS_INDEX = {
  uid: 'lyrics',
  primaryKey: 'mbid',
} as const satisfies { uid: string; primaryKey: keyof LyricsDocument };

export const LYRICS_INDEX_SETTINGS: IndexSettings = {
  // A single field: there is nothing to rank above anything else. Typo
  // tolerance, prefix search and every other setting stay at Meilisearch's
  // defaults, like for the metadata index.
  searchableAttributes: ['lyrics'],
  // The window `search` lets clients page through (its offset bound is
  // derived from the same constant).
  pagination: { maxTotalHits: SEARCH_MAX_TOTAL_HITS },
};

/** The synced lines without their `[mm:ss.xx]` timestamps. */
export const stripLrcTags = (synced: string): string =>
  synced
    .split('\n')
    .map((line) => line.replace(/(\[[^\]]*\])+/g, '').trim())
    .filter((line) => line.length > 0)
    .join('\n');

/**
 * The text indexed for a Recording's Lyrics: the plain ones when known, else
 * the synced lines without their timestamps. Undefined when both are missing,
 * so a Recording without Lyrics never reaches the index.
 */
export const lyricsSearchText = (
  plain: string | null,
  synced: string | null,
): string | undefined => {
  if (plain !== null && plain.trim().length > 0) {
    return plain;
  }
  if (synced !== null) {
    const stripped = stripLrcTags(synced);
    if (stripped.length > 0) {
      return stripped;
    }
  }
  return undefined;
};
