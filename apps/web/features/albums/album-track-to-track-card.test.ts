import type { AlbumTrack } from '@notefinder/contracts';
import { describe, expect, it } from 'vitest';

import { toAlbumTrackCardProps } from './album-track-to-track-card';

function makeTrack(overrides: Partial<AlbumTrack> = {}): AlbumTrack {
  return {
    id: 'track-1',
    title: 'Bohemian Rhapsody',
    lengthMs: 354_000,
    disambiguation: '',
    video: false,
    isrcs: [],
    artists: [
      { id: 'artist-1', name: 'Queen' },
      { id: 'artist-2', name: 'David Bowie' },
    ],
    genres: [],
    releases: [
      {
        mbid: '00000000-0000-4000-8000-000000002101',
        title: 'A Night at the Opera',
        year: 1975,
        coverArtUrl: 'https://coverartarchive.org/release/2101/front-500',
      },
    ],
    disc: { position: 2, title: 'Bonus Disc' },
    ...overrides,
  };
}

describe('toAlbumTrackCardProps', () => {
  it('shows the title with the performer names as the subtitle', () => {
    expect(toAlbumTrackCardProps(makeTrack())).toMatchObject({
      title: 'Bohemian Rhapsody',
      subtitle: 'Queen, David Bowie',
    });
  });

  it('uses the first release art as the cover', () => {
    expect(toAlbumTrackCardProps(makeTrack()).coverArtUrl).toBe(
      'https://coverartarchive.org/release/2101/front-500',
    );
  });

  it('has no cover when the track has no release art', () => {
    expect(
      toAlbumTrackCardProps(makeTrack({ releases: [] })).coverArtUrl,
    ).toBeNull();
  });

  it('links to the track page and seeds the placeholder by track', () => {
    expect(toAlbumTrackCardProps(makeTrack())).toMatchObject({
      trackId: 'track-1',
      placeholderSeed: 'track-1',
    });
  });

  it('leaves the disc out of the card, since the grid heads it', () => {
    expect(toAlbumTrackCardProps(makeTrack())).not.toHaveProperty('disc');
  });
});
