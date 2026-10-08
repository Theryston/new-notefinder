import type { MusicCatalogGenre } from '@notefinder/contracts';
import { compareText } from './compare.js';

/** A tag with its vote count; `genreMbid` is set when it is also a genre. */
export type TagVotes = {
  name: string;
  count: number;
  genreMbid: string | null;
};

type Voted = { name: string; count: number };

// Most voted first; equal votes by name, so the order is always the same.
const byVotesThenName = (a: Voted, b: Voted): number =>
  b.count - a.count || compareText(a.name, b.name);

/**
 * The tags with at least one positive vote, most voted first. A tag whose
 * votes cancelled out is not shown by MusicBrainz either.
 */
export const votedTags = <T extends Voted>(rows: readonly T[]): T[] =>
  rows.filter((row) => row.count > 0).sort(byVotesThenName);

/** The voted tags that MusicBrainz also lists as genres, most voted first. */
export const votedGenres = (rows: readonly TagVotes[]): MusicCatalogGenre[] =>
  votedTags(rows).flatMap((row) =>
    row.genreMbid === null
      ? []
      : [{ mbid: row.genreMbid, name: row.name, count: row.count }],
  );
