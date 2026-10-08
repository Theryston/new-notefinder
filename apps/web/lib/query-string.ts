/**
 * `?a=1&b=2` for the current query, or `''` when there is none. Used by the
 * catalog routes to keep the query when they redirect a legacy ID.
 */
export function queryStringOf(
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else if (value !== undefined) {
      params.set(key, value);
    }
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}
