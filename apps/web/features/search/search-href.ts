import { normalizeSearchQuery } from './search-params';

export type SearchHref = {
  pathname: '/search';
  query: { q: string };
};

/**
 * Where submitting the search field goes, or `null` for a blank query (there
 * is nothing to search for). Only the query is kept: a `scope` in an older
 * link is ignored, so the search stays a metadata search.
 */
export function searchHref(value: string): SearchHref | null {
  const q = normalizeSearchQuery(value);
  if (!q) return null;
  return { pathname: '/search', query: { q } };
}
