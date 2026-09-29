import 'server-only';
import {
  type Album,
  type Artist,
  albumSchema,
  artistSchema,
  cacheTags,
  type TrackSummaryPage,
  trackSummaryPageSchema,
} from '@notefinder/contracts';
import { cacheLife, cacheTag } from 'next/cache';

import { ApiError } from '@/lib/api/api-error';
import { serverApi } from '@/lib/api/server';

import {
  TRACK_PAGE_SIZE,
  type TrackCollection,
  trackCollectionPath,
} from './track-collection';

export type TrackCollectionData = {
  /** The artist or album. */
  owner: Artist | Album;
  firstPage: TrackSummaryPage;
};

const ownerTag = ({ kind, id }: TrackCollection) =>
  kind === 'artist' ? cacheTags.artist(id) : cacheTags.album(id);

/**
 * An artist or album with the first page of its tracks, or `null` when the
 * ID is unknown. Cached until one of its tags is invalidated: the owner's,
 * any list of tracks, or one of the tracks shown.
 */
export async function getTrackCollection(
  collection: TrackCollection,
): Promise<TrackCollectionData | null> {
  'use cache';
  cacheTag(ownerTag(collection), cacheTags.tracks);

  const path = trackCollectionPath(collection);
  try {
    const [owner, firstPage] = await Promise.all([
      serverApi(path, {
        schema: collection.kind === 'artist' ? artistSchema : albumSchema,
      }),
      serverApi(`${path}/tracks`, {
        schema: trackSummaryPageSchema,
        query: { limit: TRACK_PAGE_SIZE },
      }),
    ]);
    cacheTag(...firstPage.items.map((track) => cacheTags.track(track.id)));
    cacheLife('max');
    return { owner, firstPage };
  } catch (error) {
    if (error instanceof ApiError && error.code === 'NOT_FOUND') {
      // Short, like legacy: the import may create it any moment, and
      // nothing invalidates a lookup of an ID that didn't exist.
      cacheLife('minutes');
      return null;
    }
    throw error;
  }
}
