'use client';

import dynamic from 'next/dynamic';
import { useQueryState } from 'nuqs';

import { Toaster } from '@/components/ui/sonner';
import { PROCESS_PARAM, searchPathFrom } from '../request-sign-in';
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
 * Asks for the Track a returning visitor's `process` marker names. Loaded only
 * when there is a marker, so the request code stays off the common path.
 */
const RequestOnArrival = dynamic(() =>
  import('@/features/tracks/components/request-on-arrival').then(
    (module) => module.RequestOnArrival,
  ),
);

/**
 * What the search page shows below its title row: results for a searchable
 * `q` in the URL, the prompt before that. The query itself lives in the
 * header field, which mirrors the same `q` (debounced). A `process` marker
 * (a signed-out click on a result without a Track, after signing in) asks for
 * that Track once, and the marker leaves the URL before the request goes out.
 */
export function SearchResultsSection() {
  const [urlQuery] = useQueryState('q');
  const [urlScope] = useQueryState('scope');
  const [processMbid, setProcessMbid] = useQueryState(PROCESS_PARAM);
  const query = normalizeSearchQuery(urlQuery);
  const scope = parseSearchScope(urlScope);

  return (
    <>
      <Toaster />
      {processMbid === null ? null : (
        <RequestOnArrival
          recordingMbid={processMbid}
          onStart={() => void setProcessMbid(null, { history: 'replace' })}
        />
      )}
      {isSearchableQuery(query) ? (
        <SearchResults
          query={query}
          scope={scope}
          searchPath={searchPathFrom(urlQuery, urlScope)}
        />
      ) : (
        <SearchPrompt />
      )}
    </>
  );
}
