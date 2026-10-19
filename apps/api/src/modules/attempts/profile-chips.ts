import type { MostSungArtist, TrackVocalRange } from '@notefinder/contracts';

/**
 * The Profile chips a User's saved Attempts decide: the Vocal range and the
 * Most sung artist. The rules live here, as pure functions over groups of runs
 * that the repository counted in SQL (see `AttemptsRepository`), so the
 * thresholds, the transposition and the tie-break are unit-tested without a
 * database and the read does not grow with the number of runs.
 */

/** A run must reach this accuracy to count toward the Vocal range. */
export const VOCAL_RANGE_MIN_ACCURACY = 0.85;

const MIDI_LOWEST = 0;
const MIDI_HIGHEST = 127;

/**
 * The runs of one Track, one transposition and one set of flags, with the best
 * accuracy among them: a group holds a qualifying run exactly when that best
 * accuracy reaches the threshold.
 */
export type VocalRangeGroup = {
  /** The Track's own vocal range, null when it has no notes. */
  trackVocalRange: TrackVocalRange | null;
  transposeSemitones: number;
  forwardSkip: boolean;
  bleedSuspected: boolean;
  bestAccuracy: number;
};

/** The runs of one artist, split by the bleed flag. */
export type ArtistGroup = {
  artist: MostSungArtist;
  bleedSuspected: boolean;
  /** How many runs credit this artist with the flag. */
  attempts: number;
  lastAttemptAt: Date;
};

const isQualifyingForRange = (group: VocalRangeGroup): boolean =>
  group.bestAccuracy >= VOCAL_RANGE_MIN_ACCURACY &&
  !group.forwardSkip &&
  !group.bleedSuspected;

const clampMidi = (note: number): number =>
  Math.min(MIDI_HIGHEST, Math.max(MIDI_LOWEST, note));

/**
 * The Track's range as the User sang it: the transposition moves the whole
 * range. Clamped to the MIDI keys, because a shifted range past the ends of
 * the keyboard would not be a valid vocal range on the response.
 */
const sungRangeOf = (
  trackRange: TrackVocalRange,
  transposeSemitones: number,
): TrackVocalRange => ({
  lowest: clampMidi(trackRange.lowest + transposeSemitones),
  highest: clampMidi(trackRange.highest + transposeSemitones),
});

/**
 * The lowest and highest notes across the Vocal ranges of the Tracks the User
 * practiced, each transposed by its runs. Only accurate runs with no forward
 * skip and no suspected bleed count; null when none qualify.
 */
export function deriveVocalRange(
  groups: readonly VocalRangeGroup[],
): TrackVocalRange | null {
  let range: TrackVocalRange | null = null;
  for (const group of groups) {
    if (!isQualifyingForRange(group) || !group.trackVocalRange) {
      continue;
    }
    const sung = sungRangeOf(group.trackVocalRange, group.transposeSemitones);
    range = range
      ? {
          lowest: Math.min(range.lowest, sung.lowest),
          highest: Math.max(range.highest, sung.highest),
        }
      : sung;
  }
  return range;
}

type ArtistTally = {
  artist: MostSungArtist;
  attempts: number;
  latestAt: number;
};

/** Most runs first, then the most recent one, then the smaller ID. */
const byMostSung = (a: ArtistTally, b: ArtistTally): number =>
  b.attempts - a.attempts ||
  b.latestAt - a.latestAt ||
  (a.artist.id < b.artist.id ? -1 : 1);

/**
 * The artist with the most valid runs (a suspected bleed never counts). A run
 * on a Track that credits several artists counts for each of them. Ties go to
 * the artist whose most recent run is newer; a tie on both goes to the smaller
 * ID so the answer never flips between requests.
 */
export function deriveMostSungArtist(
  groups: readonly ArtistGroup[],
): MostSungArtist | null {
  const tallies = new Map<string, ArtistTally>();
  for (const group of groups) {
    if (group.bleedSuspected) {
      continue;
    }
    const previous = tallies.get(group.artist.id);
    tallies.set(group.artist.id, {
      artist: group.artist,
      attempts: (previous?.attempts ?? 0) + group.attempts,
      latestAt: Math.max(
        previous?.latestAt ?? Number.NEGATIVE_INFINITY,
        group.lastAttemptAt.getTime(),
      ),
    });
  }
  const [winner] = [...tallies.values()].sort(byMostSung);
  return winner ? { id: winner.artist.id, name: winner.artist.name } : null;
}
