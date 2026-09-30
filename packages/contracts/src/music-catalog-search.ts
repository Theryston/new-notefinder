import { z } from 'zod';
import {
  mbidSchema,
  musicCatalogErrorResponseSchema,
  musicCatalogSuccessResponseSchema,
} from './music-catalog.js';
import { recordingSchema } from './music-catalog-recording.js';

// `search`, the second operation of the Music catalog protocol
// (music-catalog.ts): free text in, an ordered list of Recording summaries
// out. Kept in its own file, like the Recording, so the envelope stays small.

/**
 * What a search looks at: `metadata` (title, artists, releases, ...) or the
 * words of the Lyrics. `lyrics` is accepted already but answers no results
 * until Lyrics are imported.
 */
export const SEARCH_SCOPES = ['metadata', 'lyrics'] as const;

export const searchScopeSchema = z.enum(SEARCH_SCOPES);

export type SearchScope = z.infer<typeof searchScopeSchema>;

/** The page size when a client does not ask for one. */
export const SEARCH_DEFAULT_LIMIT = 20;

/** The biggest page a client can ask for. */
export const SEARCH_MAX_LIMIT = 100;

/**
 * How many of the best matches a search can reach, however it is paged: the
 * search engine does not look further than this for one query (Meilisearch's
 * `pagination.maxTotalHits`, which the service sets to this value).
 */
export const SEARCH_MAX_TOTAL_HITS = 1000;

/** The last page of the biggest size starts here. */
export const SEARCH_MAX_OFFSET = SEARCH_MAX_TOTAL_HITS - SEARCH_MAX_LIMIT;

/** Far longer than any title or lyric line, short enough to bound the work. */
export const SEARCH_MAX_QUERY_LENGTH = 256;

/**
 * `search` payload. The query is trimmed before it is checked, so a text of
 * blanks is as empty as no text. Every field but `query` has a default.
 */
export const musicCatalogSearchPayloadSchema = z.object({
  query: z.string().trim().min(1).max(SEARCH_MAX_QUERY_LENGTH),
  scope: searchScopeSchema.default('metadata'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(SEARCH_MAX_LIMIT)
    .default(SEARCH_DEFAULT_LIMIT),
  offset: z.number().int().min(0).max(SEARCH_MAX_OFFSET).default(0),
});

/** What a client sends: the fields with a default may be left out. */
export type MusicCatalogSearchPayload = z.input<
  typeof musicCatalogSearchPayloadSchema
>;

/** The payload as the service reads it, with every default applied. */
export type MusicCatalogSearchParams = z.output<
  typeof musicCatalogSearchPayloadSchema
>;

/** The release a search result shows the Recording on. */
export const recordingSummaryReleaseSchema = z.object({
  mbid: mbidSchema,
  title: z.string(),
  /** The year of the release's earliest release event; null when unknown. */
  year: z.number().int().nullable(),
  /**
   * Cover Art Archive URL built from the release MBID. The catalog does not
   * know which releases have art, so it may answer 404.
   */
  coverArtUrl: z.string(),
});

export type RecordingSummaryRelease = z.infer<
  typeof recordingSummaryReleaseSchema
>;

/**
 * A Recording as a search result lists it: enough to render a row without
 * another round-trip. The fields it shares with `getRecording`'s Recording
 * are that Recording's own (same names, same meaning; the genres are chosen
 * by the same rule), so a result never tells a different story.
 */
export const recordingSummarySchema = recordingSchema
  .pick({
    mbid: true,
    title: true,
    lengthMs: true,
    disambiguation: true,
    video: true,
    artistCredit: true,
    genres: true,
  })
  .extend({
    /**
     * The release listed first by `getRecording` (the oldest, undated last);
     * null when the Recording is on no release.
     */
    primaryRelease: recordingSummaryReleaseSchema.nullable(),
  });

export type RecordingSummary = z.infer<typeof recordingSummarySchema>;

/** The matches, best first: the order the search engine ranked them in. */
export const musicCatalogSearchResultSchema = z.object({
  results: z.array(recordingSummarySchema),
});

export type MusicCatalogSearchResult = z.infer<
  typeof musicCatalogSearchResultSchema
>;

/** What a client reads back for a `search` request. */
export const musicCatalogSearchResponseSchema = z.discriminatedUnion('ok', [
  musicCatalogSuccessResponseSchema(musicCatalogSearchResultSchema),
  musicCatalogErrorResponseSchema,
]);

export type MusicCatalogSearchResponse = z.infer<
  typeof musicCatalogSearchResponseSchema
>;
