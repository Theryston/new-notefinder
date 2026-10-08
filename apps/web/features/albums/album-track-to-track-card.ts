import type { AlbumTrack } from '@notefinder/contracts';

import type { TrackCardProps } from '@/features/tracks/components/track-card';

/**
 * One album track as the generic card inputs: the joined performer names
 * become the subtitle, the first release art becomes the cover, and the Track
 * identifier seeds the placeholder and links to the Track page. The disc is
 * not a card field: it heads the group the track sits in.
 */
export function toAlbumTrackCardProps(track: AlbumTrack): TrackCardProps {
  return {
    trackId: track.id,
    title: track.title,
    subtitle: track.artists.map((artist) => artist.name).join(', '),
    coverArtUrl: track.releases?.[0]?.coverArtUrl ?? null,
    placeholderSeed: track.id,
  };
}
