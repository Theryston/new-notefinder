import type { PartialDate } from '../../lib/partial-date.js';

// What the repository reads for one release group, before it is assembled
// into the protocol's `MusicCatalogReleaseGroup`. Plain rows: no rule is
// applied to them yet.

/** The release group's own row, with its artist credit's printed name. */
export type ReleaseGroupRow = {
  /** MusicBrainz's integer id: internal, it disappears on a merge. */
  id: number;
  mbid: string;
  title: string;
  /** Album, Single, EP, ...; null when MusicBrainz has none. */
  primaryType: string | null;
  artistCreditId: number;
  artistCreditName: string;
};

export type CreditedArtistRow = {
  mbid: string;
  name: string;
  creditedName: string;
  joinPhrase: string;
};

/** A release of the group, with the dates of all its release events. */
export type ReleaseWithEvents = {
  id: number;
  mbid: string;
  title: string;
  /** Official, Promotion, Bootleg, ...; null when MusicBrainz has none. */
  status: string | null;
  events: PartialDate[];
};

/** One track of a release, with the medium it sits on. */
export type MediumTrackRow = {
  mediumPosition: number;
  /** The medium's own title; '' when it has none. */
  mediumTitle: string;
  trackPosition: number;
  recordingMbid: string;
};
