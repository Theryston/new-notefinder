import { describe, expect, it } from 'vitest';

import { toTrackCardProps } from './search-result-to-track-card';

const mbid = '00000000-0000-4000-8000-000000000001';

function resultItem(trackId: string | null, coverUrl: string | null) {
  return {
    mbid,
    title: 'Bohemian Rhapsody',
    artistCredit: 'Queen',
    coverUrl,
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

  it('maps the indexed cover URL to the cover', () => {
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
