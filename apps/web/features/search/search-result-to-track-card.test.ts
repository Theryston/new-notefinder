import { describe, expect, it } from 'vitest';

import { toTrackCardProps } from './search-result-to-track-card';

const mbid = '00000000-0000-4000-8000-000000000001';

function resultItem(trackId: string | null, coverArtUrl: string | null) {
  return {
    mbid,
    title: 'Bohemian Rhapsody',
    lengthMs: null,
    disambiguation: '',
    video: false,
    artistCredit: { name: 'Queen', artists: [] },
    genres: [],
    primaryRelease:
      coverArtUrl === null
        ? null
        : {
            mbid: '00000000-0000-4000-8000-000000000009',
            title: 'A Night at the Opera',
            year: 1975,
            coverArtUrl,
          },
    trackId,
  };
}

describe('toTrackCardProps', () => {
  it('maps the artist credit to the subtitle and the Recording id to the seed', () => {
    const props = toTrackCardProps(resultItem('clxlinkedtrack01', null));

    expect(props).toEqual({
      trackId: 'clxlinkedtrack01',
      title: 'Bohemian Rhapsody',
      subtitle: 'Queen',
      coverArtUrl: null,
      placeholderSeed: '00000000-0000-4000-8000-000000000001',
    });
  });

  it('maps the primary release art to the cover', () => {
    const props = toTrackCardProps(
      resultItem('clxlinkedtrack01', 'https://cover.test/opera.jpg'),
    );

    expect(props.coverArtUrl).toBe('https://cover.test/opera.jpg');
    expect(props.placeholderSeed).toBe(mbid);
  });

  it('keeps a null Track link for unprocessed Recordings', () => {
    const props = toTrackCardProps(resultItem(null, null));

    expect(props.trackId).toBeNull();
  });
});
