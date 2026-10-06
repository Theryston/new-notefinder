import { z } from 'zod';
import {
  recordingSummarySchema,
  SEARCH_DEFAULT_LIMIT,
  SEARCH_MAX_LIMIT,
  SEARCH_MAX_OFFSET,
  SEARCH_MAX_QUERY_LENGTH,
  searchScopeSchema,
} from './music-catalog-search.js';

// The public track search: what the web sends the API and what the API
// answers. The query mirrors the Music catalog payload semantics (same scope
// vocabulary, defaults and bounds), so the API forwards it as-is; the result
// reuses the catalog's summaries untouched and only adds the Track link.
// Never redeclare these shapes in an app: import them from here.

// Limits arrive as HTTP query params (strings), so they coerce; the catalog
// payload takes real numbers over the WebSocket.
export const searchQuerySchema = z.object({
  query: z.string().trim().min(1).max(SEARCH_MAX_QUERY_LENGTH),
  scope: searchScopeSchema.default('metadata'),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(SEARCH_MAX_LIMIT)
    .default(SEARCH_DEFAULT_LIMIT),
  offset: z.coerce.number().int().min(0).max(SEARCH_MAX_OFFSET).default(0),
});

/** What a client sends: the fields with a default may be left out. */
export type SearchQuery = z.input<typeof searchQuerySchema>;

/** The query as the API reads it, with every default applied. */
export type SearchQueryParams = z.output<typeof searchQuerySchema>;

/**
 * One search hit: the catalog's summary plus the Track link. `trackId` is
 * the Track id when notefinder already processed that Recording, else null:
 * the web links only when it is present, otherwise it renders a static card.
 */
export const searchResultItemSchema = recordingSummarySchema.extend({
  trackId: z.string().nullable(),
});

export type SearchResultItem = z.infer<typeof searchResultItemSchema>;

/** The matches, best first: the order the search engine ranked them in. */
export const searchResultSchema = z.object({
  results: z.array(searchResultItemSchema),
});

export type SearchResult = z.infer<typeof searchResultSchema>;
