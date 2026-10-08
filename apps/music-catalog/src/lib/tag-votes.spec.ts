import { votedGenres, votedTags } from './tag-votes.js';

const ROCK = '00000000-0000-4000-8000-000000000501';
const POP = '00000000-0000-4000-8000-000000000502';

describe('votedTags', () => {
  it('keeps only the tags with a positive vote count', () => {
    const rows = [
      { name: 'rock', count: 3 },
      { name: 'cancelled', count: 0 },
      { name: 'negative', count: -1 },
    ];

    expect(votedTags(rows)).toEqual([{ name: 'rock', count: 3 }]);
  });

  it('orders the tags most voted first, and by name on a tie', () => {
    const rows = [
      { name: 'soul', count: 2 },
      { name: 'pop', count: 7 },
      { name: 'art rock', count: 2 },
    ];

    expect(votedTags(rows).map((row) => row.name)).toEqual([
      'pop',
      'art rock',
      'soul',
    ]);
  });
});

describe('votedGenres', () => {
  it('keeps only the voted tags that are genres, with their MBID', () => {
    const rows = [
      { name: 'live', count: 9, genreMbid: null },
      { name: 'pop', count: 4, genreMbid: POP },
      { name: 'rock', count: 6, genreMbid: ROCK },
      { name: 'silent', count: 0, genreMbid: POP },
    ];

    expect(votedGenres(rows)).toEqual([
      { mbid: ROCK, name: 'rock', count: 6 },
      { mbid: POP, name: 'pop', count: 4 },
    ]);
  });

  it('is empty when no tag is a genre', () => {
    expect(votedGenres([{ name: 'live', count: 2, genreMbid: null }])).toEqual(
      [],
    );
  });
});
