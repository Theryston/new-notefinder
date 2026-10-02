import type { LrclibTrack } from '../../integrations/lrclib/lrclib-dump.js';
import { normalizeLyricsText } from '../../lib/normalize-text.js';

/** A Recording asking for Lyrics: what the match compares. */
export type MatchableRecording = {
  mbid: string;
  title: string;
  /** Null when MusicBrainz has no length: without it no match is confident. */
  lengthMs: number | null;
  /** The printed artist credit plus every credited artist name. */
  artistNames: string[];
  /** The titles of the releases it is on; empty when on none. */
  albumTitles: string[];
};

/**
 * How far apart two durations may be and still be the same take: a studio take
 * and its video, say, differ by less. A live take or a remix differs by more,
 * but those already fail on the title.
 */
const LYRICS_MAX_DURATION_DIFF_MS = 2000;

/**
 * The one LRCLIB track a Recording may take its Lyrics from, or undefined
 * when there is no confident match. Strict on purpose: the normalized title
 * and artist must be equal, the length within ±2 s, and when several tracks
 * pass, exactly one must sit on the Recording's album (the tie-breaker).
 * Anything ambiguous means no Lyrics rather than wrong Lyrics.
 */
export const matchLrclibTrack = (
  recording: MatchableRecording,
  candidates: readonly LrclibTrack[],
): LrclibTrack | undefined => {
  const { lengthMs } = recording;
  if (lengthMs === null) {
    return undefined;
  }
  const title = normalizeLyricsText(recording.title);
  const artists = new Set(recording.artistNames.map(normalizeLyricsText));
  const albums = new Set(recording.albumTitles.map(normalizeLyricsText));
  const passing = candidates.filter(
    (candidate) =>
      normalizeLyricsText(candidate.title) === title &&
      artists.has(normalizeLyricsText(candidate.artist)) &&
      Math.abs(candidate.duration * 1000 - lengthMs) <=
        LYRICS_MAX_DURATION_DIFF_MS,
  );
  if (passing.length === 0) {
    return undefined;
  }
  const onAlbum = passing.filter((candidate) =>
    albums.has(normalizeLyricsText(candidate.album)),
  );
  if (onAlbum.length === 1) {
    return onAlbum[0];
  }
  if (passing.length === 1) {
    return passing[0];
  }
  return undefined;
};
