// Which YouTube video stands for a Recording (CONTEXT.md "Processing"): a
// candidate is valid when its length, its title and its artists match the
// Recording, and the best valid search result wins. Pure, so the scoring and
// the selection are tested without the YouTube client.

import { compareText, foldAccents } from './track-text.js';
import { titleSimilarity } from './track-title-similarity.js';

/** What a YouTube result is: a song (the artist's "Topic" audio), or a video. */
type VideoKind = 'song' | 'video' | 'other';

/** A YouTube video as matching sees it. */
export type VideoCandidate = {
  videoId: string;
  title: string;
  /** Artist names as YouTube lists them; a channel's name for a link. */
  artists: readonly string[];
  durationSeconds: number | null;
  kind: VideoKind;
};

/** What a candidate must match: the Recording's title, length and artists. */
export type RecordingTarget = {
  title: string;
  /** In milliseconds; null when MusicBrainz has none. */
  lengthMs: number | null;
  artistNames: readonly string[];
};

/** How alike the titles must be (see `titleSimilarity`). */
const MIN_TITLE_SIMILARITY = 0.8;

/** The duration tolerance is the larger of these two, around the length. */
const MIN_DURATION_TOLERANCE_SECONDS = 3;
const DURATION_TOLERANCE_RATIO = 0.03;

/** The target a Track's Recording is matched against. */
export const recordingTargetOf = (track: {
  title: string;
  lengthMs: number | null;
  artistNames: readonly string[];
}): RecordingTarget => ({
  title: track.title,
  lengthMs: track.lengthMs,
  artistNames: track.artistNames,
});

/** How far a video's length may be from the Recording's, in seconds. */
export const durationToleranceSeconds = (lengthMs: number): number =>
  Math.max(
    MIN_DURATION_TOLERANCE_SECONDS,
    (lengthMs / 1000) * DURATION_TOLERANCE_RATIO,
  );

/**
 * Whether the video is as long as the Recording. A Recording without a length
 * cannot be compared, so any video passes that check (the other two still
 * apply); a video without a length cannot match one that has.
 */
export function isDurationMatch(
  target: RecordingTarget,
  candidate: VideoCandidate,
): boolean {
  if (target.lengthMs === null) {
    return true;
  }
  if (candidate.durationSeconds === null) {
    return false;
  }
  const difference = Math.abs(
    candidate.durationSeconds - target.lengthMs / 1000,
  );
  return difference <= durationToleranceSeconds(target.lengthMs);
}

/** A name with its accents, case and punctuation gone, for comparing names. */
const compact = (name: string): string =>
  foldAccents(name)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');

/**
 * Whether two compacted names are one artist: equal, or one contains the
 * other when the shorter has at least three characters ("queen" and
 * "queenofficial" are one artist, "a" and "amy" are not).
 */
const isSameArtist = (a: string, b: string): boolean =>
  a === b ||
  (Math.min(a.length, b.length) >= 3 && (a.includes(b) || b.includes(a)));

/**
 * Whether at least one of the Recording's artists is one of the video's. A
 * Recording with no credited artist has nothing to compare, so it passes.
 */
export function artistsMatch(
  artistNames: readonly string[],
  candidateArtists: readonly string[],
): boolean {
  const wanted = artistNames.map(compact).filter((name) => name !== '');
  if (wanted.length === 0) {
    return true;
  }
  const listed = candidateArtists.map(compact).filter((name) => name !== '');
  return wanted.some((name) =>
    listed.some((other) => isSameArtist(name, other)),
  );
}

/** Whether the video is the Recording: length, title and artists all match. */
export function isValidCandidate(
  target: RecordingTarget,
  candidate: VideoCandidate,
): boolean {
  return (
    isDurationMatch(target, candidate) &&
    titleSimilarity(target.title, candidate.title, target.artistNames) >=
      MIN_TITLE_SIMILARITY &&
    artistsMatch(target.artistNames, candidate.artists)
  );
}

/** Songs (the artist's own audio) rank before videos, whatever else matches. */
const kindRank = (kind: VideoKind): number => (kind === 'song' ? 0 : 1);

/** Distance in seconds from the Recording's length; unknown lengths tie. */
const lengthDistance = (
  target: RecordingTarget,
  candidate: VideoCandidate,
): number => {
  if (target.lengthMs === null || candidate.durationSeconds === null) {
    return 0;
  }
  return Math.abs(candidate.durationSeconds - target.lengthMs / 1000);
};

/**
 * The best valid search result: a song before a video (the "Topic" audio
 * beats a music video with a long intro when both match), then the closest
 * title, then the closest length, then the smallest video ID so the choice is
 * the same every time. Undefined when no candidate is valid.
 */
export function chooseSearchMatch<T extends VideoCandidate>(
  target: RecordingTarget,
  candidates: readonly T[],
): T | undefined {
  const ranked = candidates
    .filter((candidate) => isValidCandidate(target, candidate))
    .map((candidate) => ({
      candidate,
      kind: kindRank(candidate.kind),
      similarity: titleSimilarity(
        target.title,
        candidate.title,
        target.artistNames,
      ),
      distance: lengthDistance(target, candidate),
    }));
  ranked.sort(
    (a, b) =>
      a.kind - b.kind ||
      b.similarity - a.similarity ||
      a.distance - b.distance ||
      compareText(a.candidate.videoId, b.candidate.videoId),
  );
  return ranked[0]?.candidate;
}

/** The words a search for the Recording is made of: artists, then title. */
export const searchQueryOf = (target: RecordingTarget): string =>
  [...target.artistNames, target.title].join(' ');
