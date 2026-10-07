import type { SearchResultItem } from '@notefinder/contracts';

import type { TrackCardProps } from '@/features/tracks/components/track-card';

/**
 * A Recording summary as the generic card inputs: the artist credit becomes
 * the subtitle, the primary release art becomes the cover, the Recording
 * identifier seeds the placeholder, and the nullable Track identifier
 * decides whether the card links.
 */
export function toTrackCardProps(result: SearchResultItem): TrackCardProps {
  return {
    trackId: result.trackId,
    title: result.title,
    subtitle: result.artistCredit.name,
    coverArtUrl: result.primaryRelease?.coverArtUrl ?? null,
    placeholderSeed: result.mbid,
  };
}
