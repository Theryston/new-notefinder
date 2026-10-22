'use client';

import type { EditorialPinKind } from '@notefinder/contracts';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import {
  pinTrackSearchQueryOptions,
  pinTrackSummariesQueryOptions,
} from '../admin-pins-query';

/** The picker's search only starts once the admin typed this much. */
const SEARCH_MIN_LENGTH = 2;

/** How long typing pauses before the picker searches. */
const SEARCH_DEBOUNCE_MS = 300;

/** The value once typing has paused for the picker's debounce. */
function useDebouncedValue(value: string): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value]);
  return debounced;
}

/**
 * The picker's search matches for the typed text in a pin of `kind`. The
 * query only runs once typing has paused with enough text; `searchedQuery`
 * is the text the results belong to, empty while nothing was searched.
 */
export function usePinTrackSearch(query: string, kind: EditorialPinKind) {
  const debounced = useDebouncedValue(query.trim());
  const enabled = debounced.length >= SEARCH_MIN_LENGTH;
  const search = useQuery({
    ...pinTrackSearchQueryOptions(debounced, kind),
    enabled,
  });
  return { ...search, searchedQuery: enabled ? debounced : '' };
}

/**
 * The summaries of the picked Track IDs, for the picker to show by name.
 * Unknown or uncompleted IDs stay out of the answer.
 */
export function usePinTrackSummaries(ids: string[]) {
  return useQuery({
    ...pinTrackSummariesQueryOptions(ids),
    enabled: ids.length > 0,
  });
}
