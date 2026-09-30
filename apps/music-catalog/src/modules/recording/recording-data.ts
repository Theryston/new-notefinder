import type { RecordingTagsSource } from '@notefinder/contracts';

// What the repository reads for one Recording, before it is assembled into
// the protocol's `Recording`. Plain rows: no rule is applied to them yet.

/** The Recording's own row, with its artist credit's printed name. */
export type RecordingRow = {
  /** MusicBrainz's integer id: internal, it disappears on a merge. */
  id: number;
  mbid: string;
  title: string;
  lengthMs: number | null;
  disambiguation: string;
  video: boolean;
  artistCreditId: number;
  artistCreditName: string;
};

export type CreditedArtistRow = {
  mbid: string;
  name: string;
  creditedName: string;
  joinPhrase: string;
};

/** A release the Recording is on, at one of its tracks. */
export type ReleaseRow = {
  id: number;
  mbid: string;
  title: string;
  releaseGroupMbid: string;
  primaryType: string | null;
  status: string | null;
  mediumPosition: number;
  trackPosition: number;
};

/** One release event; any part of the date may be unknown. */
export type ReleaseEventRow = {
  releaseId: number;
  /** ISO 3166-1 alpha-2 code, null for an unknown country. */
  country: string | null;
  year: number | null;
  month: number | null;
  day: number | null;
};

export type WorkRow = { mbid: string; title: string };

export type ExternalUrlRow = { url: string; linkType: string };

/** A tag with its vote count; `genreMbid` is set when it is also a genre. */
export type TagVotesRow = {
  name: string;
  count: number;
  genreMbid: string | null;
};

/** The tags at each level a Recording's genres may come from. */
export type TagLevels = Record<RecordingTagsSource, TagVotesRow[]>;

/** Everything read about a Recording besides its own row. */
export type RecordingDetails = {
  artists: CreditedArtistRow[];
  isrcs: string[];
  releases: ReleaseRow[];
  releaseEvents: ReleaseEventRow[];
  works: WorkRow[];
  externalUrls: ExternalUrlRow[];
  tagLevels: TagLevels;
};
