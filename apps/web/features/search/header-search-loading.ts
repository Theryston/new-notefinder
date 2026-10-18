import { normalizeSearchQuery } from './search-params';

/**
 * Whether the header field spins. On the search page the field spins from the
 * first keystroke until the URL catches up (the debounce) and the fetch it
 * triggered settles. Elsewhere typing never changes the URL, so only the
 * suggestions fetch counts: a field left with text must not spin for good.
 */
export function headerFieldLoading({
  isSearchPage,
  inputValue,
  urlQuery,
  fetching,
}: {
  isSearchPage: boolean;
  inputValue: string;
  urlQuery: string | null;
  fetching: boolean;
}): boolean {
  const debouncing =
    isSearchPage &&
    normalizeSearchQuery(inputValue) !== normalizeSearchQuery(urlQuery);
  return debouncing || fetching;
}
