import type { AlbumDisc, AlbumTrack } from '@notefinder/contracts';

/**
 * The two disc heading shapes, translated: "Disc {number}" for a disc without
 * a name and "Disc {number} · {title}" for a named one. The grid resolves them
 * from the page's messages, so this module only picks the right one.
 */
export type DiscHeadingLabels = {
  numbered: (number: number) => string;
  named: (number: number, title: string) => string;
};

/** The heading of a disc: its name when MusicBrainz gives it one, else its number. */
export function discHeading(
  disc: AlbumDisc,
  labels: DiscHeadingLabels,
): string {
  return disc.title === null
    ? labels.numbered(disc.position)
    : labels.named(disc.position, disc.title);
}

/**
 * The grid's `groupBy` for album tracks: each track sits under its disc's
 * heading. Headings only show when the loaded tracks span more than one disc
 * (see `groupTracksByHeading`), so a single-disc album stays a plain grid.
 */
export function albumTrackGroupBy(
  labels: DiscHeadingLabels,
): (track: AlbumTrack) => string {
  return (track) => discHeading(track.disc, labels);
}
