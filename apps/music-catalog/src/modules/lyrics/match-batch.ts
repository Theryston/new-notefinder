import type {
  LrclibDump,
  LrclibTrack,
} from '../../integrations/lrclib/lrclib-dump.js';
import { normalizeLyricsText } from '../../lib/normalize-text.js';
import type { LyricsInsert, MatchingRecording } from './lyrics.repository.js';
import { matchLrclibTrack } from './match-lyrics.js';

/** A Recording matched to its LRCLIB track, before the Lyrics are read. */
export type MatchedPair = { mbid: string; trackId: number };

// The dump lookup window around a Recording's length, wider than the ±2 s
// rule: the exact boundary is applied in code, on milliseconds.
const DURATION_WINDOW_S = 2.5;

const matchRecording = (
  dump: LrclibDump,
  recording: MatchingRecording,
): LrclibTrack | undefined => {
  if (recording.lengthMs === null) {
    return undefined;
  }
  const seconds = recording.lengthMs / 1000;
  const artists = [recording.artistCredit, ...recording.artistNames];
  const seen = new Set<number>();
  const candidates: LrclibTrack[] = [];
  for (const artist of new Set(artists)) {
    const found = dump.findCandidates({
      titleLower: recording.title.toLowerCase(),
      titleNormalized: normalizeLyricsText(recording.title),
      artistLower: artist.toLowerCase(),
      artistNormalized: normalizeLyricsText(artist),
      minDuration: seconds - DURATION_WINDOW_S,
      maxDuration: seconds + DURATION_WINDOW_S,
    });
    for (const track of found) {
      if (!seen.has(track.id)) {
        seen.add(track.id);
        candidates.push(track);
      }
    }
  }
  return matchLrclibTrack(
    {
      mbid: recording.mbid,
      title: recording.title,
      lengthMs: recording.lengthMs,
      artistNames: artists,
      albumTitles: recording.albumTitles,
    },
    candidates,
  );
};

/**
 * Pass one of the two-pass Lyrics import, shared by the first import and the
 * refresh: matches Recordings against the dump's lightweight track metadata
 * without reading any Lyrics. Pass two reads the Lyrics of the matched
 * tracks only, so unmatched Lyrics never reach our schema.
 */
const matchRecordingsBatch = (
  dump: LrclibDump,
  batch: readonly MatchingRecording[],
): MatchedPair[] => {
  const pairs: MatchedPair[] = [];
  for (const recording of batch) {
    const track = matchRecording(dump, recording);
    if (track !== undefined) {
      pairs.push({ mbid: recording.mbid, trackId: track.id });
    }
  }
  return pairs;
};

type MatchBatchWalker = {
  /** Recordings read per batch, in MusicBrainz id order. */
  findMatchBatch: (
    afterId: number,
    limit: number,
  ) => Promise<MatchingRecording[]>;
  /** Recordings matched per batch. */
  batchSize: number;
  /** Aborting it stops the walk after the batch in progress. */
  signal?: AbortSignal;
  /** What a matched batch means (copying, diffing, ...). */
  visit: (
    batch: readonly MatchingRecording[],
    pairs: readonly MatchedPair[],
  ) => Promise<void>;
  /** Called instead of `visit` when the walk stops early. */
  paused: () => void;
};

/**
 * Walks every Recording in id order, matching each batch against the dump.
 * Shared by the first import and the refresh: only what `visit` does with
 * the pairs differs (keeping everything, or only what changed).
 */
export const walkMatchedBatches = async (
  dump: LrclibDump,
  walker: MatchBatchWalker,
): Promise<void> => {
  let afterId = 0;
  for (;;) {
    if (walker.signal?.aborted ?? false) {
      walker.paused();
      break;
    }
    const batch = await walker.findMatchBatch(afterId, walker.batchSize);
    const last = batch.at(-1);
    if (last === undefined) {
      break;
    }
    afterId = last.id;
    await walker.visit(batch, matchRecordingsBatch(dump, batch));
  }
};

/**
 * Pass two of the two-pass import, for the matched tracks only: the Lyrics
 * text of each match, skipping tracks whose Lyrics hold no text.
 */
export const readMatchedLyrics = (
  dump: LrclibDump,
  pairs: readonly MatchedPair[],
): LyricsInsert[] => {
  if (pairs.length === 0) {
    return [];
  }
  const byTrack = new Map(pairs.map((pair) => [pair.trackId, pair.mbid]));
  return dump
    .readLyrics([...byTrack.keys()])
    .filter(
      (lyrics) =>
        (lyrics.plain?.trim() ?? '') !== '' ||
        (lyrics.synced?.trim() ?? '') !== '',
    )
    .map((lyrics) => ({
      mbid: byTrack.get(lyrics.trackId) ?? '',
      plainLyrics: lyrics.plain,
      syncedLyrics: lyrics.synced,
    }))
    .filter((row) => row.mbid !== '');
};
