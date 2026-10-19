import {
  type ArtistGroup,
  deriveMostSungArtist,
  deriveVocalRange,
  VOCAL_RANGE_MIN_ACCURACY,
  type VocalRangeGroup,
} from './profile-chips.js';

// A group of runs on a Track whose vocal range is C3 (48) to C5 (72), sung at
// the Track's own pitch with the best run at 90%. Each test overrides only what
// it is about.
const rangeGroup = (
  overrides: Partial<VocalRangeGroup> = {},
): VocalRangeGroup => ({
  trackVocalRange: { lowest: 48, highest: 72 },
  transposeSemitones: 0,
  forwardSkip: false,
  bleedSuspected: false,
  bestAccuracy: 0.9,
  ...overrides,
});

const artistA = { id: 'artist-a', name: 'Artist A' };
const artistB = { id: 'artist-b', name: 'Artist B' };

/** A moment of October 2026, at 10:00 UTC. */
function onDay(day: number): Date {
  return new Date(`2026-10-${String(day).padStart(2, '0')}T10:00:00.000Z`);
}

const artistGroup = (overrides: Partial<ArtistGroup> = {}): ArtistGroup => ({
  artist: artistA,
  bleedSuspected: false,
  attempts: 1,
  lastAttemptAt: onDay(1),
  ...overrides,
});

describe('deriveVocalRange', () => {
  it('is the Track range of a valid group', () => {
    expect(deriveVocalRange([rangeGroup()])).toEqual({
      lowest: 48,
      highest: 72,
    });
  });

  it('transposes the range by each group semitones, up and down', () => {
    expect(deriveVocalRange([rangeGroup({ transposeSemitones: 3 })])).toEqual({
      lowest: 51,
      highest: 75,
    });
    expect(deriveVocalRange([rangeGroup({ transposeSemitones: -5 })])).toEqual({
      lowest: 43,
      highest: 67,
    });
  });

  it('spans the lowest and highest notes across the practiced Tracks', () => {
    const range = deriveVocalRange([
      rangeGroup({ trackVocalRange: { lowest: 50, highest: 70 } }),
      rangeGroup({
        transposeSemitones: -2,
        trackVocalRange: { lowest: 55, highest: 76 },
      }),
      rangeGroup({ trackVocalRange: { lowest: 52, highest: 66 } }),
    ]);

    expect(range).toEqual({ lowest: 50, highest: 74 });
  });

  it(`counts a group whose best run reaches ${VOCAL_RANGE_MIN_ACCURACY * 100}%`, () => {
    expect(
      deriveVocalRange([
        rangeGroup({ bestAccuracy: VOCAL_RANGE_MIN_ACCURACY }),
      ]),
    ).toEqual({ lowest: 48, highest: 72 });
  });

  it('ignores a group whose best run is under the accuracy threshold', () => {
    expect(deriveVocalRange([rangeGroup({ bestAccuracy: 0.8499 })])).toBeNull();
  });

  it('does not let an inaccurate group widen the range', () => {
    expect(
      deriveVocalRange([
        rangeGroup(),
        rangeGroup({
          trackVocalRange: { lowest: 20, highest: 100 },
          bestAccuracy: 0.5,
        }),
      ]),
    ).toEqual({ lowest: 48, highest: 72 });
  });

  it('ignores groups that skipped forward', () => {
    expect(deriveVocalRange([rangeGroup({ forwardSkip: true })])).toBeNull();
  });

  it('ignores groups with a suspected bleed', () => {
    expect(deriveVocalRange([rangeGroup({ bleedSuspected: true })])).toBeNull();
  });

  it('ignores Tracks without a vocal range', () => {
    expect(
      deriveVocalRange([rangeGroup({ trackVocalRange: null })]),
    ).toBeNull();
  });

  it('is null when no group qualifies', () => {
    expect(deriveVocalRange([])).toBeNull();
  });

  it('keeps a transposed range inside the MIDI keys at the top', () => {
    expect(
      deriveVocalRange([
        rangeGroup({
          transposeSemitones: 24,
          trackVocalRange: { lowest: 110, highest: 120 },
        }),
      ]),
    ).toEqual({ lowest: 127, highest: 127 });
  });

  it('keeps a transposed range inside the MIDI keys at the bottom', () => {
    expect(
      deriveVocalRange([
        rangeGroup({
          transposeSemitones: -8,
          trackVocalRange: { lowest: 5, highest: 20 },
        }),
      ]),
    ).toEqual({ lowest: 0, highest: 12 });
  });
});

describe('deriveMostSungArtist', () => {
  it('is null when there is no group', () => {
    expect(deriveMostSungArtist([])).toBeNull();
  });

  it('is null when every run of every artist suspected a bleed', () => {
    expect(
      deriveMostSungArtist([artistGroup({ bleedSuspected: true })]),
    ).toBeNull();
  });

  it('is the artist with the most valid runs, summed over its groups', () => {
    expect(
      deriveMostSungArtist([
        artistGroup({ artist: artistA, attempts: 2 }),
        artistGroup({ artist: artistA, attempts: 1 }),
        artistGroup({ artist: artistB, attempts: 2 }),
      ]),
    ).toEqual(artistA);
  });

  it('does not count runs with a suspected bleed', () => {
    expect(
      deriveMostSungArtist([
        artistGroup({ artist: artistA, attempts: 1 }),
        artistGroup({ artist: artistB, attempts: 3, bleedSuspected: true }),
      ]),
    ).toEqual(artistA);
  });

  it('breaks a tie on the most recent run', () => {
    expect(
      deriveMostSungArtist([
        artistGroup({ artist: artistA, lastAttemptAt: onDay(1) }),
        artistGroup({ artist: artistB, lastAttemptAt: onDay(2) }),
      ]),
    ).toEqual(artistB);
  });

  it('takes the most recent run of each artist, whichever group holds it', () => {
    expect(
      deriveMostSungArtist([
        artistGroup({ artist: artistA, lastAttemptAt: onDay(5) }),
        artistGroup({
          artist: artistA,
          lastAttemptAt: onDay(1),
          bleedSuspected: false,
        }),
        artistGroup({ artist: artistB, lastAttemptAt: onDay(3) }),
        artistGroup({ artist: artistB, lastAttemptAt: onDay(4) }),
      ]),
    ).toEqual(artistA);
  });

  it('breaks a full tie on the smaller ID so the answer is stable', () => {
    expect(
      deriveMostSungArtist([
        artistGroup({ artist: artistB, lastAttemptAt: onDay(1) }),
        artistGroup({ artist: artistA, lastAttemptAt: onDay(1) }),
      ]),
    ).toEqual(artistA);
  });

  it('counts a multi-artist Track once for each credited artist', () => {
    // One run on a Track credited to A and B, and one on a Track credited to
    // B and C: B has two runs, A and C one each.
    expect(
      deriveMostSungArtist([
        artistGroup({ artist: artistA, attempts: 1 }),
        artistGroup({ artist: artistB, attempts: 2 }),
        artistGroup({
          artist: { id: 'artist-c', name: 'Artist C' },
          attempts: 1,
        }),
      ]),
    ).toEqual(artistB);
  });
});
