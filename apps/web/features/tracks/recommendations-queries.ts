import 'server-only';

import {
  cacheTags,
  type TrackRecommendations,
  trackRecommendationsSchema,
} from '@notefinder/contracts';
import { cacheLife, cacheTag } from 'next/cache';
import { serverApi } from '@/lib/api/server';

/** Per-Track cache, also invalidated when Processing or trending changes lists. */
export async function getTrackRecommendations(
  trackId: string,
): Promise<TrackRecommendations> {
  'use cache';
  cacheTag(cacheTags.track(trackId), cacheTags.tracks);
  cacheLife('hours');
  return serverApi(`/tracks/${encodeURIComponent(trackId)}/recommendations`, {
    schema: trackRecommendationsSchema,
  });
}
