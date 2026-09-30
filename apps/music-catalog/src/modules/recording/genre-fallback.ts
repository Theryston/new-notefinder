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

const hasGenre = (rows: readonly TagVotesRow[]): boolean =>
  rows.some((row) => row.genreMbid !== null);

/**
 * Picks the genres and tags of a Recording. Most Recordings have no genre of
 * their own, so the level they come from is the first that has a genre: the
 * Recording's, else its release groups', else its artists'. When no level has
 * a genre, it is the first that has any tag, so a Recording tagged only
 * "live" keeps that tag. `source` names the level, and `genres` and `tags`
 * both come from it (levels are never mixed): a Recording with only a
 * non-genre tag whose release group has a genre gets the release group's
 * genres and other tags, not its own. `source` is null, with both lists
 * empty, when no level has a tag. Genres are the tags MusicBrainz also lists
 * as genres; the rest are tags.
 */
export const chooseTags = (levels: TagLevels): ChosenTags => {
  const voted = {
    recording: votedTags(levels.recording),
    release_group: votedTags(levels.release_group),
    artist: votedTags(levels.artist),
  };
  const source =
    LEVELS_IN_ORDER.find((level) => hasGenre(voted[level])) ??
    LEVELS_IN_ORDER.find((level) => voted[level].length > 0);
  if (source === undefined) {
    return { source: null, genres: [], tags: [] };
  }
  const rows = voted[source];
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
};
