import { isSearchableQuery, normalizeSearchQuery } from './search-params';

/**
 * Whether the header field spins.
 *
 * On the search page the field spins from the first keystroke until the URL
 * catches up (the debounce) and the fetch it triggered settles.
 *
 * Elsewhere typing never changes the URL, so the field spins while the
 * suggestions lag the typed text (the debounce has not caught up yet), and
 * while their fetch runs. Both only count for searchable text: a blank field
 * never spins, and a field left with text stops once the suggestions catch up,
 * whether or not the list is open.
 */
export function headerFieldLoading({
  isSearchPage,
  inputValue,
  urlQuery,
  debouncedQuery,
  fetching,
}: {
  isSearchPage: boolean;
  inputValue: string;
  urlQuery: string | null;
  debouncedQuery: string;
  fetching: boolean;
}): boolean {
  const typed = normalizeSearchQuery(inputValue);
  if (isSearchPage) {
    return typed !== normalizeSearchQuery(urlQuery) || fetching;
  }
  if (!isSearchableQuery(inputValue)) return false;
  const suggestionsLag = typed !== normalizeSearchQuery(debouncedQuery);
  return suggestionsLag || fetching;
}
