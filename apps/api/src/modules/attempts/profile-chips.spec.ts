import {
  deriveMostSungArtist,
  deriveVocalRange,
  type ProfileAttempt,
  VOCAL_RANGE_MIN_ACCURACY,
} from './profile-chips.js';

// A valid run of a Track whose vocal range is C3 (48) to C5 (72), sung at the
// Track's own pitch. Each test overrides only what it is about.
const attempt = (overrides: Partial<ProfileAttempt> = {}): ProfileAttempt => ({
  transposeSemitones: 0,
  accuracy: 0.9,
  forwardSkip: false,
  bleedSuspected: false,
  createdAt: onDay(1),
  trackVocalRange: { lowest: 48, highest: 72 },
  artists: [artistA],
  ...overrides,
});

const artistA = { id: 'artist-a', name: 'Artist A' };
const artistB = { id: 'artist-b', name: 'Artist B' };

/** A moment of October 2026, at 10:00 UTC. */
function onDay(day: number): Date {
  return new Date(`2026-10-${String(day).padStart(2, '0')}T10:00:00.000Z`);
}

describe('deriveVocalRange', () => {
  it('is the Track range of a valid run', () => {
    expect(deriveVocalRange([attempt()])).toEqual({ lowest: 48, highest: 72 });
  });

  it('transposes the range by each attempt semitones, up and down', () => {
    expect(deriveVocalRange([attempt({ transposeSemitones: 3 })])).toEqual({
      lowest: 51,
      highest: 75,
    });
    expect(deriveVocalRange([attempt({ transposeSemitones: -5 })])).toEqual({
      lowest: 43,
      highest: 67,
    });
  });

  it('spans the lowest and highest notes across the practiced Tracks', () => {
    const range = deriveVocalRange([
      attempt({ trackVocalRange: { lowest: 50, highest: 70 } }),
      attempt({
        transposeSemitones: -2,
        trackVocalRange: { lowest: 55, highest: 76 },
      }),
      attempt({ trackVocalRange: { lowest: 52, highest: 66 } }),
    ]);

    expect(range).toEqual({ lowest: 50, highest: 74 });
  });

  it(`counts only runs at ${VOCAL_RANGE_MIN_ACCURACY * 100}% accuracy or more`, () => {
    expect(
      deriveVocalRange([attempt({ accuracy: VOCAL_RANGE_MIN_ACCURACY })]),
    ).toEqual({ lowest: 48, highest: 72 });
    expect(deriveVocalRange([attempt({ accuracy: 0.8499 })])).toBeNull();
  });

  it('ignores runs that skipped forward', () => {
    expect(deriveVocalRange([attempt({ forwardSkip: true })])).toBeNull();
  });

  it('ignores runs with a suspected bleed', () => {
    expect(deriveVocalRange([attempt({ bleedSuspected: true })])).toBeNull();
  });

  it('ignores Tracks without a vocal range', () => {
    expect(deriveVocalRange([attempt({ trackVocalRange: null })])).toBeNull();
  });

  it('is null when no attempt qualifies', () => {
    expect(deriveVocalRange([])).toBeNull();
  });

  it('keeps a transposed range inside the MIDI keys', () => {
    expect(
      deriveVocalRange([
        attempt({
          transposeSemitones: 24,
          trackVocalRange: { lowest: 110, highest: 120 },
        }),
      ]),
    ).toEqual({ lowest: 127, highest: 127 });
  });
});

describe('deriveMostSungArtist', () => {
  it('is null when there is no valid attempt', () => {
    expect(deriveMostSungArtist([])).toBeNull();
    expect(
      deriveMostSungArtist([attempt({ bleedSuspected: true })]),
    ).toBeNull();
  });

  it('is the artist with the most valid attempts', () => {
    expect(
      deriveMostSungArtist([
        attempt({ artists: [artistA] }),
        attempt({ artists: [artistB] }),
        attempt({ artists: [artistB] }),
      ]),
    ).toEqual(artistB);
  });

  it('does not count attempts with a suspected bleed', () => {
    expect(
      deriveMostSungArtist([
        attempt({ artists: [artistA] }),
        attempt({ artists: [artistB], bleedSuspected: true }),
        attempt({ artists: [artistB], bleedSuspected: true }),
      ]),
    ).toEqual(artistA);
  });

  it('counts runs below the vocal range accuracy and runs that skipped forward', () => {
    expect(
      deriveMostSungArtist([
        attempt({ artists: [artistA], accuracy: 0.2, forwardSkip: true }),
        attempt({ artists: [artistB] }),
      ]),
    ).toEqual(artistA);
  });

  it('gives an attempt to every artist credited on its Track', () => {
    expect(
      deriveMostSungArtist([
        attempt({ artists: [artistA, artistB] }),
        attempt({ artists: [artistB] }),
      ]),
    ).toEqual(artistB);
  });

  it('breaks a tie on the most recent attempt', () => {
    expect(
      deriveMostSungArtist([
        attempt({ artists: [artistA], createdAt: onDay(1) }),
        attempt({ artists: [artistB], createdAt: onDay(2) }),
      ]),
    ).toEqual(artistB);
  });

  it('uses the most recent attempt of each artist, not the first one listed', () => {
    expect(
      deriveMostSungArtist([
        attempt({ artists: [artistA], createdAt: onDay(5) }),
        attempt({ artists: [artistB], createdAt: onDay(3) }),
        attempt({ artists: [artistB], createdAt: onDay(4) }),
        attempt({ artists: [artistA], createdAt: onDay(1) }),
      ]),
    ).toEqual(artistA);
  });

  it('breaks a full tie on the smaller ID so the answer is stable', () => {
    expect(
      deriveMostSungArtist([
        attempt({ artists: [artistB], createdAt: onDay(1) }),
        attempt({ artists: [artistA], createdAt: onDay(1) }),
      ]),
    ).toEqual(artistA);
  });

  it('is null for attempts whose Track has no linked artist', () => {
    expect(deriveMostSungArtist([attempt({ artists: [] })])).toBeNull();
  });
});
