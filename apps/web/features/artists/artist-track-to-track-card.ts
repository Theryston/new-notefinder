import type { ArtistTrack } from '@notefinder/contracts';

import type { TrackCardProps } from '@/features/tracks/components/track-card';

/**
 * One processed Track as the generic card inputs: the joined performer
 * names become the subtitle, the first release art becomes the cover, and
 * the Track identifier seeds the placeholder and always links to the
 * Track page.
 */
export function toArtistTrackCardProps(track: ArtistTrack): TrackCardProps {
  return {
    trackId: track.id,
    title: track.title,
    subtitle: track.artists.map((artist) => artist.name).join(', '),
    coverArtUrl: track.releases?.[0]?.coverArtUrl ?? null,
    placeholderSeed: track.id,
  };
}
