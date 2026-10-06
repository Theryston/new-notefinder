import { normalizeSearchQuery } from './search-params';

export type SearchHref = { pathname: '/search'; query: { q: string } };

/**
 * Where submitting the search field goes, or `null` for a blank query (there
 * is nothing to search for).
 */
export function searchHref(value: string): SearchHref | null {
  const q = normalizeSearchQuery(value);
  return q ? { pathname: '/search', query: { q } } : null;
}
