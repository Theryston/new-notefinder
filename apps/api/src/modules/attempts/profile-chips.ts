import type { MostSungArtist, TrackVocalRange } from '@notefinder/contracts';

/**
 * The Profile chips a User's saved Attempts decide: the Vocal range and the
 * Most sung artist. Pure rules, so the thresholds, the transposition and the
 * tie-break are unit-tested without a database.
 */

/** An Attempt must reach this accuracy to count toward the Vocal range. */
export const VOCAL_RANGE_MIN_ACCURACY = 0.85;

const MIDI_LOWEST = 0;
const MIDI_HIGHEST = 127;

/** One saved Attempt with what the chips read: its Track and its artists. */
export type ProfileAttempt = {
  transposeSemitones: number;
  accuracy: number;
  forwardSkip: boolean;
  bleedSuspected: boolean;
  createdAt: Date;
  /** The Track's own vocal range, null when it has no notes. */
  trackVocalRange: TrackVocalRange | null;
  /** The Track's artists, one entry per artist credited on it. */
  artists: MostSungArtist[];
};

/** A run that counts toward the Vocal range: accurate, not leaked or skipped. */
const countsForVocalRange = (attempt: ProfileAttempt): boolean =>
  attempt.accuracy >= VOCAL_RANGE_MIN_ACCURACY &&
  !attempt.forwardSkip &&
  !attempt.bleedSuspected;

const clampMidi = (note: number): number =>
  Math.min(MIDI_HIGHEST, Math.max(MIDI_LOWEST, note));

/**
 * The Track's range as the User sang it: the Attempt's transposition moves
 * the whole range. Clamped to MIDI keys, since a transposed range can reach
 * past the ends of the keyboard.
 */
const sungRangeOf = (
  attempt: ProfileAttempt,
  trackRange: TrackVocalRange,
): TrackVocalRange => ({
  lowest: clampMidi(trackRange.lowest + attempt.transposeSemitones),
  highest: clampMidi(trackRange.highest + attempt.transposeSemitones),
});

/**
 * The lowest and highest notes across the Vocal ranges of the Tracks the
 * User practiced, each transposed by its Attempt. Only accurate runs with no
 * forward skip and no suspected bleed count; null when none qualify.
 */
export function deriveVocalRange(
  attempts: readonly ProfileAttempt[],
): TrackVocalRange | null {
  let range: TrackVocalRange | null = null;
  for (const attempt of attempts) {
    if (!countsForVocalRange(attempt) || !attempt.trackVocalRange) {
      continue;
    }
    const sung = sungRangeOf(attempt, attempt.trackVocalRange);
    range = range
      ? {
          lowest: Math.min(range.lowest, sung.lowest),
          highest: Math.max(range.highest, sung.highest),
        }
      : sung;
  }
  return range;
}

type ArtistTally = MostSungArtist & { count: number; lastAt: number };

/** Most Attempts first, then the most recent one, then the smaller ID. */
const byTallyOrder = (a: ArtistTally, b: ArtistTally): number =>
  b.count - a.count || b.lastAt - a.lastAt || (a.id < b.id ? -1 : 1);

/**
 * The artist with the most valid Attempts (a suspected bleed never counts).
 * Each credited artist of a Track gets the Attempt. Ties go to the artist
 * whose most recent Attempt is newer; a tie on both goes to the smaller ID so
 * the answer never flips between requests.
 */
export function deriveMostSungArtist(
  attempts: readonly ProfileAttempt[],
): MostSungArtist | null {
  const tallies = new Map<string, ArtistTally>();
  for (const attempt of attempts) {
    if (attempt.bleedSuspected) {
      continue;
    }
    for (const artist of attempt.artists) {
      const previous = tallies.get(artist.id);
      tallies.set(artist.id, {
        id: artist.id,
        name: artist.name,
        count: (previous?.count ?? 0) + 1,
        lastAt: Math.max(
          previous?.lastAt ?? Number.NEGATIVE_INFINITY,
          attempt.createdAt.getTime(),
        ),
      });
    }
  }
  const [winner] = [...tallies.values()].sort(byTallyOrder);
  return winner ? { id: winner.id, name: winner.name } : null;
}
