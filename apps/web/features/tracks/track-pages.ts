import { infiniteQueryOptions } from '@tanstack/react-query';

import { fetchTrackPage } from './fetch-track-page';
import { trackKeys } from './query-keys';
import type { TrackCollection } from './track-collection';

/**
 * The pages of a collection after the server-rendered first one, starting
 * at its `nextCursor`. Only fetched once `enabled` (the visitor scrolled
 * down to them).
 */
export function trackPagesOptions(
  collection: TrackCollection,
  firstCursor: string,
  enabled: boolean,
) {
  return infiniteQueryOptions({
    queryKey: trackKeys.collectionPages(collection, firstCursor),
    queryFn: ({ pageParam, signal }) =>
      fetchTrackPage(collection, pageParam, signal),
    initialPageParam: firstCursor,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled,
    // Refetching would reload every page already shown, for a list that
    // barely changes while someone scrolls it.
    staleTime: Number.POSITIVE_INFINITY,
  });
}
