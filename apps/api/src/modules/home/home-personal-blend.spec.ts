import type { HomeTrack } from '@notefinder/contracts';
import type { UserTrackSignal } from './home-personal.repository.js';
import {
  blendDiscoveryCandidates,
  buildTaste,
  byBlendedDesc,
} from './home-personal-blend.js';

const track = (id: string): HomeTrack => ({
  id,
  title: `Track ${id}`,
  coverUrl: `https://cdn.example/${id}.webp`,
  artistCredit: [{ name: `Artist ${id}`, joinPhrase: '' }],
  durationMs: 180_000,
  vocalRange: { lowest: 60, highest: 72 },
});

const signal = (overrides: Partial<UserTrackSignal>): UserTrackSignal => ({
  trackId: 't1',
  attempts: 1,
  bestAccuracy: 0.5,
  lastAttemptAt: new Date('2026-10-20T10:00:00.000Z'),
  genres: ['rock'],
  artistKey: 'Artist t1',
  title: 'Track t1',
  coverUrl: null,
  artistCredit: [{ name: 'Artist t1', joinPhrase: '' }],
  durationMs: 180_000,
  vocalRangeLowest: 60,
  vocalRangeHighest: 72,
  ...overrides,
});

const emptyTaste = () => buildTaste([], []).taste;

describe('buildTaste', () => {
  it('counts one signal per run and one per favorite', () => {
    const { taste, signalCount } = buildTaste(
      [signal({ trackId: 't1', attempts: 3 })],
      [{ genres: ['pop'], artistKey: 'Artist t2' }],
    );

    expect(signalCount).toBe(4);
    expect(taste.genreSignals.get('rock')).toBe(3);
    expect(taste.genreSignals.get('pop')).toBe(1);
    expect(taste.artistSignals.get('Artist t1')).toBe(3);
  });

  it('reads an empty taste as zero totals', () => {
    const { taste, signalCount } = buildTaste([], []);

    expect(signalCount).toBe(0);
    expect(taste.totalGenreSignals).toBe(0);
    expect(taste.totalArtistSignals).toBe(0);
  });
});

describe('blendDiscoveryCandidates', () => {
  const discovery = new Map([
    ['t1', { trendingScore: 100, genres: ['rock'], artistKey: 'Artist t1' }],
    ['t2', { trendingScore: 1, genres: ['jazz'], artistKey: 'Artist t2' }],
  ]);

  it('keeps the popularity order at λ = 0', () => {
    const blended = blendDiscoveryCandidates({
      tracks: [track('t1'), track('t2')],
      discovery,
      taste: emptyTaste(),
      lambda: 0,
    }).sort(byBlendedDesc);

    expect(blended.map((candidate) => candidate.track.id)).toEqual([
      't1',
      't2',
    ]);
  });

  it('orders by taste alone at λ = 1', () => {
    const { taste } = buildTaste(
      [
        signal({
          trackId: 't2',
          attempts: 60,
          genres: ['jazz'],
          artistKey: 'Artist t2',
        }),
      ],
      [],
    );
    const blended = blendDiscoveryCandidates({
      tracks: [track('t1'), track('t2')],
      discovery,
      taste,
      lambda: 1,
    }).sort(byBlendedDesc);

    expect(blended.map((candidate) => candidate.track.id)).toEqual([
      't2',
      't1',
    ]);
  });

  it('reads every popularity as 1 without scores, so the taste alone orders', () => {
    const { taste } = buildTaste(
      [
        signal({
          trackId: 't2',
          attempts: 60,
          genres: ['jazz'],
          artistKey: 'Artist t2',
        }),
      ],
      [],
    );
    const blended = blendDiscoveryCandidates({
      tracks: [track('t1'), track('t2')],
      discovery: new Map(),
      taste,
      lambda: 1,
    }).sort(byBlendedDesc);

    expect(blended[0]).toMatchObject({
      track: expect.objectContaining({ id: 't2' }),
      popularity: 1,
    });
  });
});
