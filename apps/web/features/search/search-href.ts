import type { SearchScope } from '@notefinder/contracts';

import { normalizeSearchQuery } from './search-params';

export type SearchHref = {
  pathname: '/search';
  query: { q: string; scope?: SearchScope };
};

/**
 * Where submitting the search field goes, or `null` for a blank query (there
 * is nothing to search for). `scope` is the existing scope when submitting
 * from the search page: `lyrics` survives the handoff, `metadata` (the
 * default) stays omitted from the URL so header links keep their shape.
 */
export function searchHref(
  value: string,
  scope?: SearchScope | null,
): SearchHref | null {
  const q = normalizeSearchQuery(value);
  if (!q) return null;
  if (scope === 'lyrics') return { pathname: '/search', query: { q, scope } };
  return { pathname: '/search', query: { q } };
}
