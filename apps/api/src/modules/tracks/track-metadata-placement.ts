// Where a Track sits on an Album (pure, so the rule is tested without a
// database). An Album's discs and track order come from its representative
// release (ADR 0003). When that release holds the Recording, its place there
// is used; otherwise the Recording's own release in the same release group
// gives it, and the disc it sits on is added when the representative release
// does not have it. MusicBrainz numbers discs and tracks from 1.

/** A disc of an Album: its position and its own name, null when it has none. */
export type AlbumDisc = { position: number; title: string | null };

/** The disc and the track position a Track takes on an Album. */
export type AlbumPlacement = { discPosition: number; trackPosition: number };

/** One medium of the representative release, as the Music catalog lists it. */
type RepresentativeMedium = {
  position: number;
  /** The medium's own title; '' when it has none. */
  title: string;
  tracks: { position: number; recordingMbid: string }[];
};

/** The discs an Album needs for one Track, and the Track's place on them. */
export type AlbumLayout = { discs: AlbumDisc[]; placement: AlbumPlacement };

export type AlbumLayoutInput = {
  recordingMbid: string;
  /** The media of the representative release. */
  media: readonly RepresentativeMedium[];
  /** Where the Recording sits on each of its own releases in this group. */
  ownPlacements: readonly AlbumPlacement[];
};

const byPlace = (a: AlbumPlacement, b: AlbumPlacement): number =>
  a.discPosition - b.discPosition || a.trackPosition - b.trackPosition;

/** The lowest place of those given, so a Recording listed twice has one place. */
const lowestOf = (
  placements: readonly AlbumPlacement[],
): AlbumPlacement | undefined => [...placements].sort(byPlace)[0];

/** The representative release's discs, in position order, unnamed when untitled. */
const discsOf = (media: readonly RepresentativeMedium[]): AlbumDisc[] =>
  media
    .map((medium) => ({
      position: medium.position,
      title: medium.title === '' ? null : medium.title,
    }))
    .sort((a, b) => a.position - b.position);

/** The places of the Recording on the representative release. */
const representativePlacementsOf = (
  recordingMbid: string,
  media: readonly RepresentativeMedium[],
): AlbumPlacement[] =>
  media.flatMap((medium) =>
    medium.tracks
      .filter((track) => track.recordingMbid === recordingMbid)
      .map((track) => ({
        discPosition: medium.position,
        trackPosition: track.position,
      })),
  );

/** The discs with the disc at `position` added (untitled) when they lack it. */
const withDisc = (discs: AlbumDisc[], position: number): AlbumDisc[] =>
  discs.some((disc) => disc.position === position)
    ? discs
    : [...discs, { position, title: null }].sort(
        (a, b) => a.position - b.position,
      );

/**
 * The layout of one Track on an Album, or undefined when neither release
 * places the Recording (the caller then links nothing).
 */
export function albumLayoutOf({
  recordingMbid,
  media,
  ownPlacements,
}: AlbumLayoutInput): AlbumLayout | undefined {
  const discs = discsOf(media);
  const representative = lowestOf(
    representativePlacementsOf(recordingMbid, media),
  );
  if (representative !== undefined) {
    return { discs, placement: representative };
  }
  const own = lowestOf(ownPlacements);
  if (own === undefined) {
    return undefined;
  }
  return {
    discs: withDisc(discs, own.discPosition),
    placement: own,
  };
}
