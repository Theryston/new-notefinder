import type { TrackSummary } from '@notefinder/contracts';
import type {
  NoteRow,
  ThumbnailRow,
  TrackArtistRow,
  TrackListRow,
  VocalRangeRows,
} from './tracks.repository.js';

export type TrackRelations = {
  artists: TrackArtistRow[];
  thumbnails: ThumbnailRow[];
  vocalRanges: VocalRangeRows;
};

const groupByTrack = <TRow extends { trackId: string }>(
  rows: TRow[],
): Map<string, Omit<TRow, 'trackId'>[]> => {
  const groups = new Map<string, Omit<TRow, 'trackId'>[]>();
  for (const { trackId, ...rest } of rows) {
    const group = groups.get(trackId) ?? [];
    group.push(rest);
    groups.set(trackId, group);
  }
  return groups;
};

const noteByTrack = (rows: NoteRow[]) =>
  new Map(rows.map(({ trackId, note, octave }) => [trackId, { note, octave }]));

/**
 * Joins a page of tracks with their artists, cover art and vocal range, in
 * the page's order.
 */
export const toTrackSummaries = (
  rows: TrackListRow[],
  relations: TrackRelations,
): TrackSummary[] => {
  const artistsOf = groupByTrack(relations.artists);
  const thumbnailsOf = groupByTrack(relations.thumbnails);
  const lowestOf = noteByTrack(relations.vocalRanges.lowest);
  const highestOf = noteByTrack(relations.vocalRanges.highest);

  return rows.map((row) => {
    const lowest = lowestOf.get(row.id);
    const highest = highestOf.get(row.id);
    return {
      id: row.id,
      title: row.title,
      durationSeconds: row.durationSeconds,
      artists: artistsOf.get(row.id) ?? [],
      album:
        row.albumId === null || row.albumName === null
          ? null
          : { id: row.albumId, name: row.albumName },
      thumbnails: thumbnailsOf.get(row.id) ?? [],
      vocalRange: lowest && highest ? { lowest, highest } : null,
    };
  });
};
