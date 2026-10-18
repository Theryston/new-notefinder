'use client';

import { useEffect, useState } from 'react';

import { SEARCH_DEBOUNCE_MS } from '../search-params';

/**
 * The query as it stands once typing has paused for the shared search
 * debounce. The header uses it to tell when its suggestions lag the field;
 * the suggestions query uses it to fetch.
 */
export function useDebouncedQuery(query: string): string {
  const [debounced, setDebounced] = useState(query);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);
  return debounced;
}
