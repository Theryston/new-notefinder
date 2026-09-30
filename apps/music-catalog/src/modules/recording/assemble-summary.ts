import type { RecordingSummary } from '@notefinder/contracts';
import { coverArtUrl } from '../../lib/cover-art-url.js';
import { chooseTags } from './genre-fallback.js';
import type { RecordingSummaryRow } from './recording-summary-data.js';

/**
 * Builds the protocol's `RecordingSummary` from the row the summary query
 * read. No I/O. The genres follow the same rule as `getRecording`'s (the
 * first level with a genre, never mixed), so a result shows the genres the
 * full Recording would.
 */
export const assembleSummary = (
  row: RecordingSummaryRow,
): RecordingSummary => ({
  mbid: row.mbid,
  title: row.title,
  lengthMs: row.lengthMs,
  disambiguation: row.disambiguation,
  video: row.video,
  artistCredit: { name: row.artistCreditName, artists: row.artists },
  primaryRelease:
    row.primaryRelease === null
      ? null
      : {
          ...row.primaryRelease,
          coverArtUrl: coverArtUrl(row.primaryRelease.mbid),
        },
  genres: chooseTags(row.genreLevels).genres,
});
