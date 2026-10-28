import type { HomeRow, HomeTrack } from '@vozzify/contracts';
import { applyEditorialPins, type OverlayPin } from './home-pin-overlay.js';

const track = (id: string): HomeTrack => ({
  id,
  title: `Track ${id}`,
  coverUrl: null,
  artistCredit: [{ name: 'Artist', joinPhrase: '' }],
  durationMs: null,
  vocalRange: null,
});

const tracks = (count: number, prefix = 't'): HomeTrack[] =>
  Array.from({ length: count }, (_, i) => track(`${prefix}${i}`));

const genresRow = (): HomeRow => ({
  id: 'genres',
  layout: 'genres',
  title: { key: 'home.rows.genres', params: {} },
  items: Array.from({ length: 6 }, (_, i) => ({ name: `Genre ${i}` })),
});

const artistsRow = (): HomeRow => ({
  id: 'featured-artists',
  layout: 'artists',
  title: { key: 'home.rows.featuredArtists', params: {} },
  items: Array.from({ length: 6 }, (_, i) => ({
    id: `artist-${i}`,
    name: `Artist ${i}`,
  })),
});

const albumsRow = (): HomeRow => ({
  id: 'featured-albums',
  layout: 'albums',
  title: { key: 'home.rows.featuredAlbums', params: {} },
  items: Array.from({ length: 6 }, (_, i) => ({
    id: `album-${i}`,
    title: `Album ${i}`,
    coverArtUrl: null,
    year: 2000 + i,
  })),
});

const pin = (trackIds: string[]): OverlayPin => ({
  id: 'pin-1',
  kind: 'row',
  position: 1,
  priority: 0,
  createdAt: Date.parse('2026-10-21T00:00:00.000Z'),
  sponsored: false,
  title: { key: 'home.rows.pinned', params: { title: 'Pinned' } },
  tracks: trackIds.map(track),
});

describe('applyEditorialPins with entity rows', () => {
  it('passes the genre, artist and album rows through untouched', () => {
    const rows: HomeRow[] = [
      { id: 'hero', layout: 'hero', track: track('h0') },
      {
        id: 'trending-today',
        layout: 'standard',
        title: { key: 'home.rows.trendingToday', params: {} },
        items: tracks(8),
      },
      genresRow(),
      artistsRow(),
      albumsRow(),
    ];

    const overlaid = applyEditorialPins(rows, [pin(['t0', 't1'])]);

    const byId = new Map(overlaid.map((row) => [row.id, row]));
    expect(byId.get('genres')).toEqual(genresRow());
    expect(byId.get('featured-artists')).toEqual(artistsRow());
    expect(byId.get('featured-albums')).toEqual(albumsRow());
    const trending = byId.get('trending-today');
    expect(trending?.layout).toBe('standard');
    if (trending?.layout === 'standard') {
      expect(trending.items.map((item) => item.id)).toEqual([
        't2',
        't3',
        't4',
        't5',
        't6',
        't7',
      ]);
    }
  });

  it('keeps the entity rows when there are no pins', () => {
    const rows: HomeRow[] = [genresRow(), artistsRow(), albumsRow()];

    expect(applyEditorialPins(rows, [])).toEqual(rows);
  });
});
