import { normalizeLyricsText } from '../../lib/normalize-text.js';

/** A kept Lyrics row with the Recordings it is revalidated against. */
export type RevalidateLyrics = {
  mbid: string;
  plain: string | null;
  synced: string | null;
};

/** What the revalidation compares: the match data of one copy. */
export type RevalidateRecording = {
  mbid: string;
  title: string;
  /** Null when MusicBrainz has no length: without it no match is confident. */
  lengthMs: number | null;
  /** The name of every credited artist. */
  artistNames: string[];
};

/**
 * How far apart the two copies' durations may be and still be the same take:
 * the import's ±2 s rule, applied between the copies instead of between a
 * Recording and a dump track.
 */
const CARRY_MAX_DURATION_DIFF_MS = 2000;

/**
 * Whether kept Lyrics survive the reimport onto the parallel copy: the
 * Recording carries them only when the new copy still describes the same
 * take — the normalized title and artist set are unchanged and the length
 * within ±2 s. Anything else (a gone, retitled, re-credited or resized
 * Recording) drops them: the next dump import matches those Recordings
 * again from scratch. No confident basis means no Lyrics, like the import.
 */
export const revalidateCarriedLyrics = (options: {
  kept: RevalidateLyrics;
  /** The Recording the Lyrics matched on the serving copy. */
  before: RevalidateRecording | undefined;
  /** The same MBID on the parallel copy, when still there. */
  after: RevalidateRecording | undefined;
}): 'keep' | 'drop' => {
  const { before, after } = options;
  if (before === undefined || after === undefined) {
    return 'drop';
  }
  if (before.lengthMs === null || after.lengthMs === null) {
    return 'drop';
  }
  if (normalizeLyricsText(after.title) !== normalizeLyricsText(before.title)) {
    return 'drop';
  }
  if (!sameArtists(before.artistNames, after.artistNames)) {
    return 'drop';
  }
  if (Math.abs(after.lengthMs - before.lengthMs) > CARRY_MAX_DURATION_DIFF_MS) {
    return 'drop';
  }
  return 'keep';
};

// The same take keeps its credited artists: renames and re-credits drop the
// Lyrics, which the next dump import matches again.
const sameArtists = (before: string[], after: string[]): boolean => {
  const oldNames = new Set(before.map(normalizeLyricsText));
  const newNames = after.map(normalizeLyricsText);
  return (
    newNames.length === oldNames.size &&
    newNames.every((name) => oldNames.has(name))
  );
};
