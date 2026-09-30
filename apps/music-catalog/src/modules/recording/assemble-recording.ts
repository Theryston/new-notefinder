import type { Recording, RecordingRelease } from '@notefinder/contracts';
import { compareText, compareTextNullsLast } from '../../lib/compare.js';
import { coverArtUrl } from '../../lib/cover-art-url.js';
import { chooseTags } from './genre-fallback.js';
import type {
  RecordingDetails,
  RecordingRow,
  ReleaseEventRow,
  ReleaseRow,
} from './recording-data.js';
import { pickReleaseEvent } from './release-event.js';

const toRelease = (
  row: ReleaseRow,
  events: readonly ReleaseEventRow[],
): RecordingRelease => {
  const { date, country } = pickReleaseEvent(
    events.filter((event) => event.releaseId === row.id),
  );
  return {
    mbid: row.mbid,
    title: row.title,
    releaseGroup: { mbid: row.releaseGroupMbid, primaryType: row.primaryType },
    status: row.status,
    date,
    country,
    mediumPosition: row.mediumPosition,
    trackPosition: row.trackPosition,
    coverArtUrl: coverArtUrl(row.mbid),
  };
};

// Oldest first, undated last, then a fixed order so equal releases (a
// Recording on two tracks of one release, say) always come out the same way.
const compareReleases = (a: RecordingRelease, b: RecordingRelease): number =>
  compareTextNullsLast(a.date, b.date) ||
  compareText(a.title, b.title) ||
  compareText(a.mbid, b.mbid) ||
  a.mediumPosition - b.mediumPosition ||
  a.trackPosition - b.trackPosition;

/**
 * Builds the protocol's `Recording` from the rows read for it. No I/O: the
 * rules that shape the answer are here (which release event a release is
 * shown with, the release order, where the genres come from), so they can be
 * tested on their own. Lyrics are not matched yet: both fields are null.
 */
export const assembleRecording = (
  row: RecordingRow,
  details: RecordingDetails,
): Recording => {
  const { source, genres, tags } = chooseTags(details.tagLevels);
  return {
    mbid: row.mbid,
    title: row.title,
    lengthMs: row.lengthMs,
    disambiguation: row.disambiguation,
    video: row.video,
    isrcs: details.isrcs,
    artistCredit: { name: row.artistCreditName, artists: details.artists },
    releases: details.releases
      .map((release) => toRelease(release, details.releaseEvents))
      .sort(compareReleases),
    works: details.works,
    genres,
    tags,
    tagsSource: source,
    externalUrls: details.externalUrls,
    lyrics: { plain: null, synced: null },
  };
};
