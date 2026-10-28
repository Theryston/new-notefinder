import type { SearchResultItem } from '@vozzify/contracts';

import type { TrackCardProps } from '@/features/tracks/components/track-card';

/**
 * A compact Recording search result as the generic card inputs: the printed
 * artist credit becomes the subtitle, the indexed release art becomes cover, the Recording
 * identifier seeds the placeholder, and the nullable Track identifier
 * decides whether the card links.
 */
export function toTrackCardProps(result: SearchResultItem): TrackCardProps {
  return {
    trackId: result.trackId,
    title: result.title,
    subtitle: result.artistCredit,
    coverArtUrl: result.coverUrl,
    placeholderSeed: result.mbid,
  };
}
