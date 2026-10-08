import type { CatalogTrack } from '@notefinder/contracts';
import { describe, expect, it } from 'vitest';

import { toCatalogTrackCardProps } from './catalog-track-to-track-card';

function makeTrack(overrides: Partial<CatalogTrack> = {}): CatalogTrack {
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
      {
        mbid: '00000000-0000-4000-8000-000000002102',
        title: 'Greatest Hits',
        year: null,
        coverArtUrl: null,
      },
    ],
    ...overrides,
  };
}

describe('toCatalogTrackCardProps', () => {
  it('joins performer names and picks the first-release cover', () => {
    const props = toCatalogTrackCardProps(makeTrack());

    expect(props).toEqual({
      trackId: 'track-1',
      title: 'Bohemian Rhapsody',
      subtitle: 'Queen, David Bowie',
      coverArtUrl: 'https://coverartarchive.org/release/2101/front-500',
      placeholderSeed: 'track-1',
    });
  });

  it('falls back to a null cover when there are no releases', () => {
    const props = toCatalogTrackCardProps(makeTrack({ releases: [] }));

    expect(props.coverArtUrl).toBeNull();
    expect(props.placeholderSeed).toBe('track-1');
  });

  it('falls back to a null cover when releases are missing', () => {
    const props = toCatalogTrackCardProps(makeTrack({ releases: undefined }));

    expect(props.coverArtUrl).toBeNull();
    expect(props.placeholderSeed).toBe('track-1');
  });

  it('always links to the Track page', () => {
    const props = toCatalogTrackCardProps(makeTrack());

    expect(props.trackId).toBe('track-1');
  });
});
