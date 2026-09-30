import type { CreditedArtistRow, TagLevels } from './recording-data.js';

// What the summary query reads for one Recording, before it is assembled into
// the protocol's `RecordingSummary`. Everything comes from one query.

/** The release a summary shows: the one `getRecording` lists first. */
export type PrimaryReleaseRow = {
  mbid: string;
  title: string;
  /** The year of the release's earliest release event, null when unknown. */
  year: number | null;
};

export type RecordingSummaryRow = {
  mbid: string;
  title: string;
  lengthMs: number | null;
  disambiguation: string;
  video: boolean;
  artistCreditName: string;
  artists: CreditedArtistRow[];
  primaryRelease: PrimaryReleaseRow | null;
  /**
   * The Recording's genres at each level genres may come from (see
   * `chooseTags`). A level is left empty when a level before it already has
   * genres: it would not be used.
   */
  genreLevels: TagLevels;
};
