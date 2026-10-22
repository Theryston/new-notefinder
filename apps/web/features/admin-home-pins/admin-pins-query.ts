import type {
  EditorialPinHistoryPage,
  EditorialPinKind,
  EditorialPinPage,
  PinTrackSearchResult,
} from '@notefinder/contracts';
import { queryOptions } from '@tanstack/react-query';

/** TanStack Query keys of the admin pins panel. */
export const adminPinKeys = {
  all: ['admin-home-pins'] as const,
  list: () => [...adminPinKeys.all, 'list'] as const,
  history: (pinId: string) => [...adminPinKeys.all, pinId, 'history'] as const,
  trackSearch: (kind: EditorialPinKind, query: string) =>
    [...adminPinKeys.all, 'track-search', kind, query] as const,
  trackSummaries: (ids: string) =>
    [...adminPinKeys.all, 'track-summaries', ids] as const,
};

/**
 * Every pin, newest first. The fetcher (and its contracts schemas) loads on
 * the first read, so Zod stays out of the page's first-load JavaScript.
 */
export function adminPinsQueryOptions() {
  return queryOptions({
    queryKey: adminPinKeys.list(),
    queryFn: async ({ signal }): Promise<EditorialPinPage> => {
      const { fetchAdminPins } = await import('./admin-pins-client');
      return fetchAdminPins(signal);
    },
    retry: false,
  });
}

/** Who created and changed a pin and when. */
export function adminPinHistoryQueryOptions(pinId: string) {
  return queryOptions({
    queryKey: adminPinKeys.history(pinId),
    queryFn: async ({ signal }): Promise<EditorialPinHistoryPage> => {
      const { fetchAdminPinHistory } = await import('./admin-pins-client');
      return fetchAdminPinHistory(pinId, signal);
    },
    retry: false,
  });
}

/**
 * The picker's search matches for `query` in a pin of `kind` (a hero only
 * offers Tracks with a cover). The fetcher loads on the first search, so Zod
 * stays out of the page's first-load JavaScript.
 */
export function pinTrackSearchQueryOptions(
  query: string,
  kind: EditorialPinKind,
) {
  return queryOptions({
    queryKey: adminPinKeys.trackSearch(kind, query),
    queryFn: async ({ signal }): Promise<PinTrackSearchResult> => {
      const { searchPinTracks } = await import('./admin-pins-client');
      return searchPinTracks({ q: query, kind, limit: 10 }, signal);
    },
    retry: false,
  });
}

/**
 * The summaries of the picked Tracks, in the picker's order. Unknown or
 * uncompleted IDs stay out, so the picker can name the ones it resolves.
 */
export function pinTrackSummariesQueryOptions(ids: string[]) {
  return queryOptions({
    queryKey: adminPinKeys.trackSummaries(ids.join(',')),
    queryFn: async ({ signal }): Promise<PinTrackSearchResult> => {
      const { searchPinTracks } = await import('./admin-pins-client');
      return searchPinTracks({ ids: ids.join(',') }, signal);
    },
    retry: false,
  });
}
