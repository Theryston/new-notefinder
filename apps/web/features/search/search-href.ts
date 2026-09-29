export type SearchHref = { pathname: '/search'; query: { q: string } };

/**
 * Where submitting the search field goes, or `null` for a blank query (there
 * is nothing to search for).
 */
export function searchHref(value: string): SearchHref | null {
  const q = value.trim().replace(/\s+/g, ' ');
  return q ? { pathname: '/search', query: { q } } : null;
}
