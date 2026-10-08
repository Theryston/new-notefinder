import { compareText, compareTextNullsLast } from '../../lib/compare.js';
import { formatPartialDate } from '../../lib/partial-date.js';
import type { ReleaseWithEvents } from './release-group-data.js';

// MusicBrainz's status for a release its label published as such.
const OFFICIAL = 'Official';

// The release's date is its earliest release event, as formatPartialDate
// writes it; null when none of its events has a year.
const earliestDate = (release: ReleaseWithEvents): string | null =>
  release.events
    .map((event) => formatPartialDate(event))
    .sort(compareTextNullsLast)[0] ?? null;

/**
 * The release a release group's tracks are taken from: its earliest Official
 * release or, when none of its releases is Official, its earliest release of
 * any status. Earliest means by the earliest release event: dated before
 * undated, ties broken by MBID. The choice depends only on the data, so every
 * call answers the same release. Undefined only when the group has no releases.
 */
export const pickRepresentativeRelease = (
  releases: readonly ReleaseWithEvents[],
): ReleaseWithEvents | undefined => {
  const official = releases.filter((release) => release.status === OFFICIAL);
  const candidates = (official.length > 0 ? official : releases).map(
    (release) => ({ release, date: earliestDate(release) }),
  );
  candidates.sort(
    (a, b) =>
      compareTextNullsLast(a.date, b.date) ||
      compareText(a.release.mbid, b.release.mbid),
  );
  return candidates[0]?.release;
};
