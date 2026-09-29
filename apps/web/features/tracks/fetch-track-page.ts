import type { TrackSummaryPage } from '@notefinder/contracts';

import {
  TRACK_PAGE_SIZE,
  type TrackCollection,
  trackCollectionPath,
} from './track-collection';

/**
 * A page of a collection's tracks, fetched from the browser. The API client
 * and the Zod schema load on the first call, so they stay out of the
 * page's first-load JS (most visitors never scroll that far).
 */
export async function fetchTrackPage(
  collection: TrackCollection,
  cursor: string,
  signal?: AbortSignal,
): Promise<TrackSummaryPage> {
  const [{ browserApi }, { trackSummaryPageSchema }] = await Promise.all([
    import('@/lib/api/browser'),
    import('@notefinder/contracts'),
  ]);
  return browserApi(`${trackCollectionPath(collection)}/tracks`, {
    schema: trackSummaryPageSchema,
    query: { cursor, limit: TRACK_PAGE_SIZE },
    signal,
  });
}
