import {
  EXPLORATION_SLOT_SHARE,
  PERSONAL_GENRE_LIMIT,
  TASTE_SIGNAL_HALF_LIFE_DAYS,
} from './home-personal.js';
import {
  decayedTaste,
  decaySignal,
  explorationSlotCount,
  topGenres,
} from './home-personal-recommendations.js';

describe('personal taste recommendations', () => {
  it('halves a signal after its configured half-life', () => {
    const now = Date.parse('2026-10-23T00:00:00.000Z');

    expect(
      decaySignal(
        4,
        new Date(now - TASTE_SIGNAL_HALF_LIFE_DAYS * 24 * 60 * 60 * 1000),
        now,
      ),
    ).toBe(2);
  });

  it('ranks genres by decayed signal weight with deterministic ties', () => {
    const now = Date.parse('2026-10-23T00:00:00.000Z');
    const taste = decayedTaste(
      [
        {
          genres: ['rock'],
          artistKey: 'Queen',
          weight: 4,
          lastSignalAt: new Date(now),
        },
        {
          genres: ['jazz'],
          artistKey: 'Artist A',
          weight: 4,
          lastSignalAt: new Date(
            now - TASTE_SIGNAL_HALF_LIFE_DAYS * 24 * 60 * 60 * 1000,
          ),
        },
        {
          genres: ['folk'],
          artistKey: 'Artist B',
          weight: 3,
          lastSignalAt: new Date(now),
        },
        {
          genres: ['metal'],
          artistKey: 'Artist C',
          weight: 1,
          lastSignalAt: new Date(now),
        },
      ],
      now,
    );

    expect(topGenres(taste)).toEqual(['rock', 'folk', 'jazz']);
  });

  it('keeps exploration within the named share of feed positions', () => {
    const slots = explorationSlotCount(30);

    expect(EXPLORATION_SLOT_SHARE).toBe(0.2);
    expect(
      topGenres({
        genreSignals: new Map([
          ['rock', 5],
          ['jazz', 4],
          ['folk', 3],
          ['metal', 1],
        ]),
        totalGenreSignals: 13,
        artistSignals: new Map(),
        totalArtistSignals: 0,
      }),
    ).toHaveLength(PERSONAL_GENRE_LIMIT);
    expect(slots).toBe(6);
    expect(slots / 30).toBeLessThanOrEqual(EXPLORATION_SLOT_SHARE);
  });

  it('allocates no exploration slot when fewer than five positions exist', () => {
    expect(explorationSlotCount(4)).toBe(0);
  });
});
