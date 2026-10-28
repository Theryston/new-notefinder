import type { HomeRow, HomeTrack } from '@vozzify/contracts';
import { applyEditorialPins, type OverlayPin } from './home-pin-overlay.js';

const card = (id: string): HomeTrack => ({
  id,
  title: id,
  coverUrl: `https://cdn.example/${id}.webp`,
  artistCredit: [],
  durationMs: null,
  vocalRange: null,
});

const explorationRow = (): HomeRow => ({
  id: 'explore',
  layout: 'standard',
  title: { key: 'home.rows.explore', params: {} },
  items: Array.from({ length: 6 }, (_, index) => card(`explore-${index}`)),
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
      explorationRow(),
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

  it('counts voice-fit tracks when capping exploration after the overlay', () => {
    const ordinaryRows: HomeRow[] = Array.from(
      { length: 4 },
      (_, rowIndex) => ({
        id: `ordinary-${rowIndex}`,
        layout: 'standard',
        title: { key: 'home.rows.trendingToday', params: {} },
        items: Array.from({ length: 6 }, (_, itemIndex) =>
          card(`ordinary-${rowIndex}-${itemIndex}`),
        ),
      }),
    );
    const feed: HomeRow[] = [
      { id: 'hero', layout: 'hero', track: card('hero-track') },
      ...ordinaryRows,
      {
        id: 'within-your-voice',
        layout: 'vocal-range',
        title: { key: 'home.rows.withinYourVoice', params: {} },
        items: Array.from({ length: 6 }, (_, index) => ({
          ...card(`voice-${index}`),
          vocalRange: { lowest: 60, highest: 72 },
          fitsVoice: true,
        })),
      },
      explorationRow(),
    ];

    const shown = applyEditorialPins(feed, []);

    const exploration = shown.find((row) => row.id === 'explore');
    expect(exploration?.layout).toBe('standard');
    if (exploration?.layout !== 'standard') {
      throw new Error('expected exploration row');
    }
    expect(exploration.items).toHaveLength(6);
  });
});
