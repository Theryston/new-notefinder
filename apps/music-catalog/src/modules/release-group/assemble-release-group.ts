import type {
  MusicCatalogReleaseGroup,
  MusicCatalogReleaseMedium,
  MusicCatalogRepresentativeRelease,
} from '@notefinder/contracts';
import type { CreditedArtistRow } from '../../database/credited-artists.js';
import { releaseGroupCoverArtUrl } from '../../lib/cover-art-url.js';
import { type TagVotes, votedGenres } from '../../lib/tag-votes.js';
import type {
  MediumTrackRow,
  ReleaseGroupRow,
  ReleaseWithEvents,
} from './release-group-data.js';

/** Everything read for one release group, to assemble it. */
export type ReleaseGroupParts = {
  row: ReleaseGroupRow;
  artists: CreditedArtistRow[];
  secondaryTypes: string[];
  genres: TagVotes[];
  /** Every release of the group, Official or not. */
  releases: ReleaseWithEvents[];
  /** The release the tracks are taken from, when the group has one. */
  representative: ReleaseWithEvents | undefined;
  /** The tracks of the representative release, in position order. */
  media: MediumTrackRow[];
};

/**
 * The year of the earliest release event of any release in the group, from
 * every release (not only the representative one): the group's first release.
 */
export const firstReleaseYear = (
  releases: readonly ReleaseWithEvents[],
): number | null => {
  const years = releases.flatMap((release) =>
    release.events.flatMap((event) =>
      event.year === null ? [] : [event.year],
    ),
  );
  return years.length === 0 ? null : Math.min(...years);
};

// Tracks grouped by medium, in the order the rows came in (position order).
const toMedia = (
  rows: readonly MediumTrackRow[],
): MusicCatalogReleaseMedium[] => {
  const media = new Map<number, MusicCatalogReleaseMedium>();
  for (const row of rows) {
    const medium = media.get(row.mediumPosition) ?? {
      position: row.mediumPosition,
      title: row.mediumTitle,
      tracks: [],
    };
    medium.tracks.push({
      position: row.trackPosition,
      recordingMbid: row.recordingMbid,
    });
    media.set(row.mediumPosition, medium);
  }
  return [...media.values()];
};

const toRepresentative = (
  release: ReleaseWithEvents | undefined,
  media: MediumTrackRow[],
): MusicCatalogRepresentativeRelease | null =>
  release === undefined
    ? null
    : { mbid: release.mbid, title: release.title, media: toMedia(media) };

/**
 * Builds the protocol's release group from the rows read for it. No I/O: the
 * rules that shape the answer (the first release year, the genres, the
 * representative release's media) are here, so they can be tested on their own.
 */
export const assembleReleaseGroup = (
  parts: ReleaseGroupParts,
): MusicCatalogReleaseGroup => ({
  mbid: parts.row.mbid,
  title: parts.row.title,
  primaryType: parts.row.primaryType,
  secondaryTypes: parts.secondaryTypes,
  firstReleaseYear: firstReleaseYear(parts.releases),
  genres: votedGenres(parts.genres),
  artistCredit: { name: parts.row.artistCreditName, artists: parts.artists },
  coverArtUrl: releaseGroupCoverArtUrl(parts.row.mbid),
  representativeRelease: toRepresentative(parts.representative, parts.media),
});
