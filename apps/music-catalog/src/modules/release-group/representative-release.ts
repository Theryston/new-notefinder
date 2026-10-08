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
 * release, dated before undated, ties broken by MBID. The choice depends only
 * on the data, so every call answers the same release. Undefined when none of
 * the group's releases is Official.
 */
export const pickRepresentativeRelease = (
  releases: readonly ReleaseWithEvents[],
): ReleaseWithEvents | undefined => {
  const candidates = releases
    .filter((release) => release.status === OFFICIAL)
    .map((release) => ({ release, date: earliestDate(release) }));
  candidates.sort(
    (a, b) =>
      compareTextNullsLast(a.date, b.date) ||
      compareText(a.release.mbid, b.release.mbid),
  );
  return candidates[0]?.release;
};
