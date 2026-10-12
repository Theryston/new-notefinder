import {
  type TrackDetail,
  type TrackNotes,
  trackDetailSchema,
  trackNotesSchema,
} from '@notefinder/contracts';
import { queryOptions } from '@tanstack/react-query';

import { browserApi } from '@/lib/api/browser';

import { trackKeys } from './query-keys';

/**
 * The practice header of a Track, read from the browser. The server's copy
 * arrives as `initial`; without it (the Processing completed while the page
 * was open) the browser reads it, which is how the page switches in place.
 */
export function trackPracticeQueryOptions(
  trackId: string,
  initial: TrackDetail | undefined,
) {
  return queryOptions({
    queryKey: trackKeys.practice(trackId),
    queryFn: ({ signal }) =>
      browserApi(`/tracks/${encodeURIComponent(trackId)}`, {
        schema: trackDetailSchema,
        signal,
      }),
    initialData: initial,
  });
}

/** The vocal notes of a Track, read once the header says it has some. */
export function trackNotesQueryOptions(
  trackId: string,
  enabled: boolean,
  initial: TrackNotes | undefined,
) {
  return queryOptions({
    queryKey: trackKeys.notes(trackId),
    queryFn: ({ signal }) =>
      browserApi(`/tracks/${encodeURIComponent(trackId)}/notes`, {
        schema: trackNotesSchema,
        signal,
      }),
    enabled,
    initialData: initial,
  });
}
