import 'server-only';

import {
  cacheTags,
  type TrackDetail,
  type TrackNotes,
  trackDetailSchema,
  trackNotesSchema,
} from '@notefinder/contracts';
import { cacheLife, cacheTag } from 'next/cache';

import { serverApi } from '@/lib/api/server';

/**
 * The practice header of a Track. The page only asks once the Processing has
 * completed, and the API revalidates the Track's tag at that moment, so the
 * longest life is correct: freshness comes from invalidation, not expiry.
 */
async function getTrackDetail(trackId: string): Promise<TrackDetail> {
  'use cache';
  cacheTag(cacheTags.track(trackId));
  cacheLife('max');

  return serverApi(`/tracks/${encodeURIComponent(trackId)}`, {
    schema: trackDetailSchema,
  });
}

/** The vocal notes of a Track in sung order, cached under their own tag. */
async function getTrackNotes(trackId: string): Promise<TrackNotes> {
  'use cache';
  cacheTag(cacheTags.trackNotes(trackId));
  cacheLife('max');

  return serverApi(`/tracks/${encodeURIComponent(trackId)}/notes`, {
    schema: trackNotesSchema,
  });
}

/** What the server renders the practice view from. */
export type InitialPractice = {
  header: TrackDetail;
  notes: TrackNotes | undefined;
};

/**
 * The header and the notes for the first render, or undefined when the API
 * fails: the page then shows the practice view's own loading and error states
 * instead of failing whole, since the browser can read both on its own.
 */
export async function getInitialPractice(
  trackId: string,
): Promise<InitialPractice | undefined> {
  try {
    // `/notes` answers an empty list for an instrumental Track, so both are
    // read at once instead of the notes waiting for the header.
    const [header, notes] = await Promise.all([
      getTrackDetail(trackId),
      getTrackNotes(trackId),
    ]);
    return { header, notes: header.hasNotes ? notes : undefined };
  } catch {
    return undefined;
  }
}
