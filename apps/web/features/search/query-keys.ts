import { type SearchQuery, searchQuerySchema } from '@notefinder/contracts';

/**
 * TanStack Query keys for track search. The results key carries the parsed
 * public query, so defaults are applied once and each query text plus scope
 * caches separately; the future infinite query pages on top of it.
 */
export const searchKeys = {
  all: ['search'] as const,
  results: (query: SearchQuery) =>
    [...searchKeys.all, searchQuerySchema.parse(query)] as const,
};
