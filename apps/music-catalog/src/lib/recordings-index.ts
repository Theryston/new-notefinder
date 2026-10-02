import { SEARCH_MAX_TOTAL_HITS } from '@notefinder/contracts';
import type { IndexSettings } from '../integrations/meilisearch/meilisearch-index.js';

/**
 * What the worker puts in Meilisearch for one Recording, and what a search
 * looks at. Only the MBID is read back: the summaries shown to a client come
 * from Postgres, so the index holds text to match on and nothing to display.
 */
export type RecordingDocument = {
  mbid: string;
  title: string;
  /** The artist credit as printed, join phrases included ("A feat. B"). */
  artistCredit: string;
  /** Names and sort names of the credited artists, with their aliases. */
  artistAliases: string[];
  releaseTitles: string[];
  workTitles: string[];
  /** Genre names, from the level `getRecording` takes its genres from. */
  genres: string[];
  disambiguation: string;
};

/** The index of Recordings; its primary key is the MBID. */
export const RECORDINGS_INDEX = {
  uid: 'recordings',
  primaryKey: 'mbid',
} as const satisfies { uid: string; primaryKey: keyof RecordingDocument };

/**
 * The index the blue-green reimport builds the parallel copy into: swapped
 * with `recordings` on the flip, then holding the retired copy until it is
 * deleted. Same documents and settings, other name.
 */
export const RECORDINGS_NEXT_INDEX = {
  uid: 'recordings_next',
  primaryKey: 'mbid',
} as const satisfies { uid: string; primaryKey: keyof RecordingDocument };

// In ranking order: a match in the title beats one in the artist credit, and
// so on (Meilisearch's `attribute` rule). Typo tolerance, prefix search and
// every other setting stay at Meilisearch's defaults, which is what the
// benchmark that chose the engine measured.
const SEARCHABLE_ATTRIBUTES = [
  'title',
  'artistCredit',
  'artistAliases',
  'releaseTitles',
  'workTitles',
  'genres',
  'disambiguation',
] as const satisfies readonly (keyof RecordingDocument)[];

export const RECORDINGS_INDEX_SETTINGS: IndexSettings = {
  searchableAttributes: [...SEARCHABLE_ATTRIBUTES],
  // The window `search` lets clients page through (its offset bound is
  // derived from the same constant).
  pagination: { maxTotalHits: SEARCH_MAX_TOTAL_HITS },
};
