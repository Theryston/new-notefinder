import type { HomeRow, HomeTrack } from '@notefinder/contracts';
import { applyEditorialPins, type OverlayPin } from './home-pin-overlay.js';

const card = (id: string): HomeTrack => ({
  id,
  title: id,
  coverUrl: `https://cdn.example/${id}.webp`,
  artistCredit: [],
  durationMs: null,
  vocalRange: null,
});

describe('personal exploration after the editorial pin overlay', () => {
  it('drops exploration when pins remove ordinary rows below their minimum', () => {
    const pinnedTracks = Array.from({ length: 6 }, (_, index) =>
      card(`pinned-${index}`),
    );
    const ordinaryRows: HomeRow[] = Array.from({ length: 5 }, (_, index) => ({
      id: `ordinary-${index}`,
      layout: 'standard',
      title: { key: 'home.rows.trendingToday', params: {} },
      items: pinnedTracks,
    }));
    const feed: HomeRow[] = [
      { id: 'hero', layout: 'hero', track: card('pinned-0') },
      ...ordinaryRows,
      {
        id: 'explore',
        layout: 'standard',
        title: { key: 'home.rows.explore', params: {} },
        items: Array.from({ length: 6 }, (_, index) =>
          card(`explore-${index}`),
        ),
      },
    ];
    const pin: OverlayPin = {
      id: 'pin-1',
      kind: 'row',
      position: 0,
      priority: 1,
      createdAt: 1,
      sponsored: false,
      title: { key: 'home.rows.pinned', params: { title: 'Pinned' } },
      tracks: pinnedTracks,
    };

    const shown = applyEditorialPins(feed, [pin]);

    expect(shown.map((row) => row.id)).toEqual(['pin-pin-1']);
  });
});
