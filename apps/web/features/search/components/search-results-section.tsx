'use client';

import dynamic from 'next/dynamic';
import { useQueryState } from 'nuqs';

import {
  isSearchableQuery,
  normalizeSearchQuery,
  parseSearchScope,
} from '../search-params';
import { SearchPrompt } from './search-prompt';
import { SearchSkeleton } from './search-skeleton';

/**
 * The result grid (infinite query, response parsing, cover art) loads on
 * demand, so the search page stays inside the first-load JS budget: the
 * header field and the toggle paint instantly, results stream in after.
 */
const SearchResults = dynamic(
  () => import('./search-results').then((module) => module.SearchResults),
  { loading: () => <SearchSkeleton /> },
);

/**
 * What the search page shows below its title row: results for a searchable
 * `q` in the URL, the prompt before that. The query itself lives in the
 * header field, which mirrors the same `q` (debounced).
 */
export function SearchResultsSection() {
  const [urlQuery] = useQueryState('q');
  const [urlScope] = useQueryState('scope');
  const query = normalizeSearchQuery(urlQuery);
  const scope = parseSearchScope(urlScope);

  if (!isSearchableQuery(query)) return <SearchPrompt />;
  return <SearchResults query={query} scope={scope} />;
}
