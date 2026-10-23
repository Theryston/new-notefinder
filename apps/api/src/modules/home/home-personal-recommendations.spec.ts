import {
  EXPLORATION_SLOT_SHARE,
  PERSONAL_GENRE_LIMIT,
  TASTE_SIGNAL_HALF_LIFE_DAYS,
} from './home-personal.js';
import {
  decayedTaste,
  decaySignal,
  explorationSlotCount,
  rankTasteArtists,
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

  it('decays each artist activity before adding it to the artist total', () => {
    const now = Date.parse('2026-10-23T00:00:00.000Z');
    const ancient = new Date(now - 180 * 24 * 60 * 60 * 1000);
    const recent = new Date(now);
    const activities = [
      ...Array.from({ length: 100 }, () => ({
        artistId: 'rock-artist',
        name: 'Rock artist',
        attempts: 1,
        lastAttemptAt: ancient,
      })),
      ...Array.from({ length: 10 }, () => ({
        artistId: 'jazz-artist',
        name: 'Jazz artist',
        attempts: 1,
        lastAttemptAt: recent,
      })),
      {
        artistId: 'rock-artist',
        name: 'Rock artist',
        attempts: 1,
        lastAttemptAt: recent,
      },
    ];

    expect(
      rankTasteArtists(activities, now).map(({ artistId }) => artistId),
    ).toEqual(['jazz-artist', 'rock-artist']);
  });

  it('lets recent genre activity outweigh more numerous ancient practice', () => {
    const now = Date.parse('2026-10-23T00:00:00.000Z');
    const ancient = new Date(now - 180 * 24 * 60 * 60 * 1000);
    const recent = new Date(now);
    const taste = decayedTaste(
      [
        ...Array.from({ length: 100 }, () => ({
          genres: ['rock'],
          artistKey: 'rock-artist',
          weight: 1,
          lastSignalAt: ancient,
        })),
        ...Array.from({ length: 10 }, () => ({
          genres: ['jazz'],
          artistKey: 'jazz-artist',
          weight: 1,
          lastSignalAt: recent,
        })),
      ],
      now,
    );

    expect(topGenres(taste)[0]).toBe('jazz');
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
