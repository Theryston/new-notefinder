import type {
  RecordingGenre,
  RecordingTag,
  RecordingTagsSource,
} from '@notefinder/contracts';
import { compareText } from '../../lib/compare.js';
import type { TagLevels, TagVotesRow } from './recording-data.js';

export type ChosenTags = {
  source: RecordingTagsSource | null;
  genres: RecordingGenre[];
  tags: RecordingTag[];
};

// Most voted first; equal votes by name, so the order is always the same.
const byVotesThenName = (a: TagVotesRow, b: TagVotesRow): number =>
  b.count - a.count || compareText(a.name, b.name);

// A Recording has a tag at a level only with at least one positive vote: a
// tag whose votes cancelled out is not shown by MusicBrainz either.
const votedTags = (rows: readonly TagVotesRow[]): TagVotesRow[] =>
  rows.filter((row) => row.count > 0).sort(byVotesThenName);

const LEVELS_IN_ORDER: readonly RecordingTagsSource[] = [
  'recording',
  'release_group',
  'artist',
];

/**
 * Picks the genres and tags of a Recording. Most Recordings have none of
 * their own, so the first level that has any tag wins as a whole: the
 * Recording's, else its release groups', else its artists'. `source` says
 * which, and is null when no level has a tag. Levels are never mixed, so what
 * a client reads came from one place. Genres are the tags MusicBrainz also
 * lists as genres; the rest stay tags.
 */
export const chooseTags = (levels: TagLevels): ChosenTags => {
  for (const source of LEVELS_IN_ORDER) {
    const rows = votedTags(levels[source]);
    if (rows.length > 0) {
      return {
        source,
        genres: rows.flatMap((row) =>
          row.genreMbid === null
            ? []
            : [{ mbid: row.genreMbid, name: row.name, count: row.count }],
        ),
        tags: rows.flatMap((row) =>
          row.genreMbid === null ? [{ name: row.name, count: row.count }] : [],
        ),
      };
    }
  }
  return { source: null, genres: [], tags: [] };
};
