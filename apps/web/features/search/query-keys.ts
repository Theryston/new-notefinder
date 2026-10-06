import { type SearchQuery, searchQuerySchema } from '@notefinder/contracts';

/**
 * TanStack Query keys for track search. The results key carries the parsed
 * public query, so defaults are applied once and each query text plus scope
 * caches separately; the infinite key pages on top of it without the offset
 * (every page shares it, the offset travels as the page param).
 */
export const searchKeys = {
  all: ['search'] as const,
  results: (query: SearchQuery) =>
    [...searchKeys.all, searchQuerySchema.parse(query)] as const,
  infiniteResults: (query: SearchQuery) => {
    const parsed = searchQuerySchema.parse(query);
    return [
      ...searchKeys.all,
      'infinite',
      { query: parsed.query, scope: parsed.scope, limit: parsed.limit },
    ] as const;
  },
};
