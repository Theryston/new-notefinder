import { chooseTags } from './genre-fallback.js';
import type { TagLevels, TagVotesRow } from './recording-data.js';

const ROCK = '00000000-0000-4000-8000-000000000501';
const POP = '00000000-0000-4000-8000-000000000502';

const genre = (name: string, count: number, mbid = ROCK): TagVotesRow => ({
  name,
  count,
  genreMbid: mbid,
});
const tag = (name: string, count: number): TagVotesRow => ({
  name,
  count,
  genreMbid: null,
});

const levels = (partial: Partial<TagLevels>): TagLevels => ({
  recording: [],
  release_group: [],
  artist: [],
  ...partial,
});

describe('chooseTags', () => {
  it('has no source, genre or tag when no level has a tag', () => {
    expect(chooseTags(levels({}))).toEqual({
      source: null,
      genres: [],
      tags: [],
    });
  });

  it.each([
    [
      'the Recording',
      levels({
        recording: [genre('rock', 1)],
        release_group: [genre('pop', 5, POP)],
        artist: [genre('pop', 9, POP)],
      }),
      'recording',
    ],
    [
      'its release groups when the Recording has none',
      levels({
        release_group: [genre('rock', 1)],
        artist: [genre('pop', 9, POP)],
      }),
      'release_group',
    ],
    [
      'its artists when neither the Recording nor its release groups have any',
      levels({ artist: [genre('rock', 1)] }),
      'artist',
    ],
  ] as const)('takes the tags from %s', (_label, given, source) => {
    const chosen = chooseTags(given);

    expect(chosen.source).toBe(source);
    expect(chosen.genres).toEqual([{ mbid: ROCK, name: 'rock', count: 1 }]);
  });

  it.each([
    [
      'the release groups',
      levels({
        recording: [tag('live', 1)],
        release_group: [genre('rock', 4), tag('british', 2)],
        artist: [genre('pop', 9, POP)],
      }),
      {
        source: 'release_group',
        genres: [{ mbid: ROCK, name: 'rock', count: 4 }],
        tags: [{ name: 'british', count: 2 }],
      },
    ],
    [
      'the artists',
      levels({
        recording: [tag('live', 1)],
        release_group: [tag('british', 2)],
        artist: [genre('pop', 9, POP), tag('female vocalists', 3)],
      }),
      {
        source: 'artist',
        genres: [{ mbid: POP, name: 'pop', count: 9 }],
        tags: [{ name: 'female vocalists', count: 3 }],
      },
    ],
  ] as const)(
    'falls back to %s when the Recording has only tags that are not genres',
    (_label, given, expected) => {
      expect(chooseTags(given)).toEqual(expected);
    },
  );

  it('gives the genres and the other tags of the level the genres come from, never the Recording’s own', () => {
    const chosen = chooseTags(
      levels({
        recording: [tag('live', 5)],
        release_group: [genre('rock', 1)],
      }),
    );

    expect(chosen).toEqual({
      source: 'release_group',
      genres: [{ mbid: ROCK, name: 'rock', count: 1 }],
      tags: [],
    });
  });

  it.each([
    [
      'the Recording when it has a tag',
      levels({
        recording: [tag('live', 1)],
        release_group: [tag('british', 2)],
        artist: [tag('pop vocal', 3)],
      }),
      'recording',
      [{ name: 'live', count: 1 }],
    ],
    [
      'its release groups when the Recording has none',
      levels({
        release_group: [tag('british', 2)],
        artist: [tag('pop vocal', 3)],
      }),
      'release_group',
      [{ name: 'british', count: 2 }],
    ],
    [
      'its artists when neither has one',
      levels({ artist: [tag('pop vocal', 3)] }),
      'artist',
      [{ name: 'pop vocal', count: 3 }],
    ],
  ] as const)(
    'keeps the tags of %s when no level has a genre',
    (_label, given, source, tags) => {
      expect(chooseTags(given)).toEqual({ source, genres: [], tags });
    },
  );

  it('counts a genre without a positive vote as no genre', () => {
    const chosen = chooseTags(
      levels({
        recording: [genre('rock', 0), tag('live', -3)],
        release_group: [genre('pop', 2, POP)],
      }),
    );

    expect(chosen.source).toBe('release_group');
    expect(chosen.genres).toEqual([{ mbid: POP, name: 'pop', count: 2 }]);
  });

  it('drops the tags without a positive vote from the level it picks', () => {
    const chosen = chooseTags(
      levels({
        recording: [genre('rock', 4), genre('pop', 0, POP), tag('x', -1)],
      }),
    );

    expect(chosen.genres).toEqual([{ mbid: ROCK, name: 'rock', count: 4 }]);
    expect(chosen.tags).toEqual([]);
  });

  it('splits genres from other tags, each most voted first and by name on a tie', () => {
    const chosen = chooseTags(
      levels({
        recording: [
          tag('live', 2),
          genre('pop', 5, POP),
          tag('a cappella', 2),
          genre('rock', 9),
          tag('british', 7),
        ],
      }),
    );

    expect(chosen.genres.map((g) => g.name)).toEqual(['rock', 'pop']);
    expect(chosen.tags.map((t) => t.name)).toEqual([
      'british',
      'a cappella',
      'live',
    ]);
  });
});
